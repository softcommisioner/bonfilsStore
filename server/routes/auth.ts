import { Router } from 'express';
import { config } from '../config.js';
import { getStore } from '../db/index.js';
import type { UserRecord } from '../db/index.js';
import { logActivity, pushNotification, requireAuth } from '../middleware.js';
import {
  clientKey, createSession, hashPassword, loginRateLimiter, newId, safeUser, verifyPassword,
} from '../security.js';
import {
  asyncHandler, EMAIL_REGEX, normalizeEmail, publicUser, requireString,
} from './helpers.js';

const router = Router();

function normalizedRoles(user: UserRecord): UserRecord['roles'] {
  const roles = new Set<string>(user.roles);
  if (user.accountType === 'seller' || user.accountType === 'both' || user.businessId) {
    roles.add('seller');
  }
  if (user.accountType === 'customer' || user.accountType === 'both') {
    roles.add('customer');
  }
  return Array.from(roles) as UserRecord['roles'];
}

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
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
  }

  const roles: UserRecord['roles'] = accountType === 'seller'
    ? ['seller']
    : accountType === 'both'
      ? ['customer', 'seller']
      : ['customer'];

  const { hash, salt } = await hashPassword(String(password));

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
      isVerified: true,
      status: 'active',
      shippingTerms: 'Standard delivery in 1-3 business days.',
      createdAt: new Date().toISOString(),
    });
  }
  const user = await store.createUser({
    id: userId,
    name: String(name).trim(),
    email: emailNormalized,
    phone: String(phone).trim(),
    country: String(country).trim(),
    city: String(city).trim(),
    roles,
    accountType,
    isVerified: true,
    status: 'active',
    businessId,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  });

  const token = await createSession(user.id, 'app', config.sessionTtlMs);
  const business = user.businessId ? await store.findBusiness(user.businessId) : undefined;

  await logActivity({
    actor: user,
    action: 'REGISTERED',
    targetType: 'auth',
    details: `Account created and activated for ${emailNormalized}.`,
  });
  await pushNotification({
    userId: user.id,
    title: 'Welcome to BONFILS STORE!',
    message: 'Your account is active. Start shopping or manage your store today.',
    type: 'system',
  });

  res.json({
    success: true,
    message: 'Account created successfully. You are now signed in.',
    user: publicUser(user),
    token,
    business,
  });
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

  // Normalise legacy accounts on sign-in so seller dashboards and their API
  // routes always receive the expected role and verified flags.
  const activeUser = (await store.updateUser(user.id, {
    roles: normalizedRoles(user),
    isVerified: true,
    status: 'active',
  }))!;

  const token = await createSession(activeUser.id, 'app', config.sessionTtlMs);
  await logActivity({
    actor: activeUser,
    action: 'LOGIN_SUCCESS',
    targetType: 'auth',
    details: `Successful sign-in for ${activeUser.email}.`,
  });

  const business = activeUser.businessId ? await store.findBusiness(activeUser.businessId) : undefined;
  res.json({ success: true, message: 'Signed in successfully.', user: publicUser(activeUser), token, business });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const emailNormalized = normalizeEmail(req.body?.email);
  if (!emailNormalized) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  res.json({
    success: true,
    email: emailNormalized,
    message: 'You can set a new password directly without an email verification code.',
  });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body || {};
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Email, new password and confirmation are required.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const store = getStore();
  const user = await store.findUserByEmail(emailNormalized);
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const { hash, salt } = await hashPassword(String(newPassword));
  await store.updateUser(user.id, {
    passwordHash: hash,
    passwordSalt: salt,
    isVerified: true,
    status: 'active',
  });
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
