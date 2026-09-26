import { Router } from 'express';
import { config } from '../config';
import { getStore } from '../db';
import type { UserRecord } from '../db';
import { logActivity, pushNotification, requireAuth } from '../middleware';
import {
  clientKey, createSession, hashPassword, loginRateLimiter, newId, safeUser, verifyPassword,
} from '../security';
import {
  asyncHandler, consumeOtp, EMAIL_REGEX, issueOtp, normalizeEmail, publicUser, requireString,
} from './helpers';

const router = Router();

const PURPOSE_BY_EMAIL: Record<string, 'registration' | 'login' | 'admin_login' | 'password_reset'> = {
  registration: 'registration',
  login: 'login',
  admin_login: 'admin_login',
  password_reset: 'password_reset',
};

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, phone, password, confirmPassword, country, city, accountType, acceptTerms } = req.body || {};

  if (!name || !email || !phone || !password || !confirmPassword || !country || !city || !accountType) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!acceptTerms) {
    return res.status(400).json({ error: 'You must accept the Terms and Conditions.' });
  }

  const emailNormalized = normalizeEmail(email);
  if (!EMAIL_REGEX.test(emailNormalized)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const store = getStore();
  const existing = await store.findUserByEmail(emailNormalized);
  if (existing && existing.isVerified) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
  }
  if (existing && existing.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'This email is reserved for platform administration.' });
  }

  const roles: UserRecord['roles'] = accountType === 'seller'
    ? ['seller']
    : accountType === 'both'
      ? ['customer', 'seller']
      : ['customer'];

  const { hash, salt } = await hashPassword(String(password));

  let user = existing;
  if (user) {
    user = (await store.updateUser(user.id, {
      name: String(name).trim(),
      phone: String(phone).trim(),
      country: String(country).trim(),
      city: String(city).trim(),
      accountType,
      roles,
      passwordHash: hash,
      passwordSalt: salt,
    }))!;
  } else {
    const userId = newId('USR');
    let businessId: string | undefined;
    if (roles.includes('seller')) {
      businessId = newId('BIZ');
      await store.createBusiness({
        id: businessId,
        ownerId: userId,
        name: `${String(name).trim()}'s Shop`,
        type: 'external',
        description: `Direct marketplace store managed by ${String(name).trim()}.`,
        phone: String(phone).trim(),
        email: emailNormalized,
        country: String(country).trim(),
        city: String(city).trim(),
        rating: 5,
        reviewsCount: 0,
        totalProducts: 0,
        totalSales: 0,
        isVerified: false,
        status: 'active',
        shippingTerms: 'Standard delivery in 1-3 business days.',
        createdAt: new Date().toISOString(),
      });
    }
    user = await store.createUser({
      id: userId,
      name: String(name).trim(),
      email: emailNormalized,
      phone: String(phone).trim(),
      country: String(country).trim(),
      city: String(city).trim(),
      roles,
      accountType,
      isVerified: false,
      status: 'active',
      businessId,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    });
  }

  await issueOtp({
    email: emailNormalized,
    purpose: 'registration',
    recipientName: user.name,
    purposeText: 'Verify your email address',
    subject: 'BONFILS STORE - Verify Your Email',
    payload: { userId: user.id },
  });

  await logActivity({
    actor: user,
    action: 'REGISTER_INITIATED',
    targetType: 'auth',
    details: `Registration initiated, verification code emailed to ${emailNormalized}.`,
  });

  res.json({
    success: true,
    message: 'Account created! Please enter the 6-digit verification code sent to your email.',
    email: emailNormalized,
    expiresInSeconds: 300,
  });
}));

router.post('/verify-registration-otp', asyncHandler(async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }
  const emailNormalized = normalizeEmail(email);
  const store = getStore();

  const result = await consumeOtp({ req, email: emailNormalized, code: String(code).trim(), purpose: 'registration' });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const user = await store.findUserByEmail(emailNormalized);
  if (!user) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  const updated = await store.updateUser(user.id, { isVerified: true, status: 'active' });
  const token = await createSession(user.id, 'app', config.sessionTtlMs);

  await logActivity({
    actor: user,
    action: 'EMAIL_VERIFIED',
    targetType: 'auth',
    details: `Email verified and account activated for ${user.email}.`,
  });
  await pushNotification({
    userId: user.id,
    title: 'Welcome to BONFILS STORE!',
    message: 'Your account has been verified. Start shopping or manage your store today.',
    type: 'system',
  });

  res.json({ success: true, message: 'Email verified successfully. Welcome to BONFILS STORE.', user: publicUser(updated!), token });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const emailNormalized = normalizeEmail(email);
  const store = getStore();

  const limiter = loginRateLimiter.check(`${clientKey(req)}:${emailNormalized}`);
  if (!limiter.allowed) {
    return res.status(429).json({ error: `Too many login attempts. Try again in ${limiter.retryAfterSeconds} seconds.` });
  }

  const user = await store.findUserByEmail(emailNormalized);
  const valid = user ? await verifyPassword(String(password), user.passwordHash, user.passwordSalt) : false;
  if (!user || !valid) {
    await logActivity({
      actor: null,
      action: 'LOGIN_FAILED',
      targetType: 'auth',
      details: `Failed login attempt for ${emailNormalized}.`,
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account has been disabled. Please contact support.' });
  }
  if (!user.isVerified) {
    await issueOtp({
      email: emailNormalized,
      purpose: 'registration',
      recipientName: user.name,
      purposeText: 'Complete your email verification',
      subject: 'BONFILS STORE - Verify Your Email',
      payload: { userId: user.id },
    });
    return res.status(403).json({
      error: 'Your email is not verified yet. We have resent a verification code to your email.',
      unverified: true,
      email: emailNormalized,
    });
  }

  const { maskedEmail } = await issueOtp({
    email: emailNormalized,
    purpose: 'login',
    recipientName: user.name,
    purposeText: 'Confirm your sign-in',
    subject: 'BONFILS STORE - Verify Your Login',
    payload: { userId: user.id },
  });

  await logActivity({
    actor: user,
    action: 'LOGIN_OTP_SENT',
    targetType: 'auth',
    details: `Login verification code sent to ${maskedEmail}.`,
  });

  res.json({
    success: true,
    requireOtp: true,
    email: emailNormalized,
    maskedEmail,
    message: `We sent a 6-digit verification code to ${maskedEmail}.`,
    expiresInSeconds: 300,
  });
}));

router.post('/verify-login-otp', asyncHandler(async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }
  const emailNormalized = normalizeEmail(email);
  const store = getStore();

  const result = await consumeOtp({ req, email: emailNormalized, code: String(code).trim(), purpose: 'login' });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const user = await store.findUserByEmail(emailNormalized);
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'Account is not active.' });
  }

  const token = await createSession(user.id, 'app', config.sessionTtlMs);
  await logActivity({
    actor: user,
    action: 'LOGIN_SUCCESS',
    targetType: 'auth',
    details: `Successful sign-in for ${user.email}.`,
  });

  const business = user.businessId ? await store.findBusiness(user.businessId) : undefined;
  res.json({ success: true, message: 'Signed in successfully.', user: publicUser(user), token, business });
}));

router.post('/resend-otp', asyncHandler(async (req, res) => {
  const { email, purpose } = req.body || {};
  const emailNormalized = normalizeEmail(email);
  const resolved = PURPOSE_BY_EMAIL[String(purpose)];
  if (!emailNormalized || !resolved) {
    return res.status(400).json({ error: 'A valid email and purpose are required.' });
  }

  const store = getStore();
  const user = await store.findUserByEmail(emailNormalized);
  if (!user) {
    return res.status(404).json({ error: 'We could not find an account for that email address.' });
  }
  if (resolved === 'admin_login' && !user.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'This account is not authorised for administration.' });
  }

  const current = await store.latestOtp(emailNormalized, resolved);
  if (current && Date.now() < current.resendAvailableAt) {
    const wait = Math.ceil((current.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ error: `Please wait ${wait} seconds before requesting another code.` });
  }

  await issueOtp({
    email: emailNormalized,
    purpose: resolved,
    recipientName: user.name,
    purposeText: resolved === 'admin_login' ? 'Super Admin verification' : 'Your verification code',
    subject: resolved === 'admin_login'
      ? 'BONFILS STORE - Super Admin Verification Code'
      : 'BONFILS STORE - New Verification Code',
    payload: { userId: user.id },
    maxAttempts: resolved === 'admin_login' ? config.adminOtpMaxAttempts : config.otpMaxAttempts,
    isAdmin: resolved === 'admin_login',
  });

  res.json({ success: true, message: 'A new verification code has been sent to your email.', expiresInSeconds: 300 });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const emailNormalized = normalizeEmail(req.body?.email);
  if (!emailNormalized) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const store = getStore();
  const user = await store.findUserByEmail(emailNormalized);
  if (user && user.status === 'active' && user.isVerified) {
    await issueOtp({
      email: emailNormalized,
      purpose: 'password_reset',
      recipientName: user.name,
      purposeText: 'Reset your password',
      subject: 'BONFILS STORE - Password Reset Code',
      payload: { userId: user.id },
    });
  }
  res.json({
    success: true,
    email: emailNormalized,
    message: 'If an account exists for that email, a password reset code is on its way.',
  });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, code, newPassword, confirmPassword } = req.body || {};
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized || !code || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const store = getStore();
  const result = await consumeOtp({
    req,
    email: emailNormalized,
    code: String(code).trim(),
    purpose: 'password_reset',
  });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const user = await store.findUserByEmail(emailNormalized);
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  if (user.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Administrator passwords must be changed through the admin console.' });
  }

  const { hash, salt } = await hashPassword(String(newPassword));
  await store.updateUser(user.id, { passwordHash: hash, passwordSalt: salt });
  await store.deleteSessionsForUser(user.id);

  await logActivity({
    actor: user,
    action: 'PASSWORD_RESET',
    targetType: 'auth',
    details: `Password reset completed for ${user.email}. All sessions revoked.`,
  });

  res.json({ success: true, message: 'Your password has been updated. Please sign in again.' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const business = user.businessId ? await getStore().findBusiness(user.businessId) : undefined;
  res.json({ user: safeUser(user), business: business || undefined });
}));

router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const patch: Partial<UserRecord> = {};
  for (const field of ['name', 'phone', 'country', 'city'] as const) {
    if (req.body?.[field] !== undefined) patch[field] = requireString(req.body[field], field, 120);
  }
  if (req.body?.accountType && ['customer', 'seller', 'both'].includes(req.body.accountType)) {
    patch.accountType = req.body.accountType;
  }
  const updated = await getStore().updateUser(user.id, patch);
  if (!updated) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  res.json({ success: true, user: safeUser(updated) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    await getStore().deleteSession(header.slice(7).trim());
  }
  res.json({ success: true, message: 'Signed out.' });
}));

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    registrationOpen: true,
    minPasswordLength: 8,
    maxLoginAttempts: config.maxLoginAttempts,
  });
});

export default router;
