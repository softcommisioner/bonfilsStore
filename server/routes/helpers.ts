import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getStore } from '../db';
import type { OtpPurpose, OtpRecord, UserRecord } from '../db';
import { generateOtp, hashOtp, maskEmail, newId, otpRateLimiter, clientKey, verifyOtpHash } from '../security';
import { config } from '../config';
import { sendEmail } from '../services/email';
import { otpEmailTemplate } from '../services/email-templates';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

export function requireString(value: unknown, field: string, max = 500): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${field} is too long.`), { status: 400 });
  return text;
}

export function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolves a product category against the active category list so products can
 * never be filed under a name that does not exist (for example a category that
 * was retired by the 12-category restructure).
 */
export async function resolveCategoryName(value: unknown): Promise<string> {
  const store = getStore();
  const categories = await store.listCategories(false);
  const requested = typeof value === 'string' ? value.trim() : '';
  if (requested) {
    const match = categories.find(category => category.name.toLowerCase() === requested.toLowerCase());
    if (!match) {
      throw Object.assign(new Error(`"${requested}" is not an active category.`), { status: 400 });
    }
    return match.name;
  }
  return categories[0]?.name || 'Other';
}

export function publicUser(user: UserRecord) {
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}

export interface IssueOtpParams {
  email: string;
  purpose: OtpPurpose;
  recipientName: string;
  purposeText: string;
  subject: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  isAdmin?: boolean;
  minutes?: number;
}

export async function issueOtp(params: IssueOtpParams): Promise<{ otp: OtpRecord; code: string; maskedEmail: string }> {
  const store = getStore();
  await store.invalidateOtps(params.email, params.purpose);

  const code = generateOtp();
  const now = Date.now();
  const minutes = params.minutes ?? 5;
  const otp: OtpRecord = {
    id: newId('OTP'),
    email: params.email,
    purpose: params.purpose,
    otpHash: hashOtp(code, params.email),
    expiresAt: now + minutes * 60 * 1000,
    attempts: 0,
    maxAttempts: params.maxAttempts ?? config.otpMaxAttempts,
    resendAvailableAt: now + config.otpResendCooldownMs,
    createdAt: now,
    payload: params.payload,
  };
  await store.createOtp(otp);

  const purposeMap: Record<OtpPurpose, 'registration_otp' | 'login_otp' | 'password_reset_otp' | 'admin_otp'> = {
    registration: 'registration_otp',
    login: 'login_otp',
    password_reset: 'password_reset_otp',
    admin_login: 'admin_otp',
  };

  await sendEmail({
    to: params.email,
    subject: params.subject,
    purpose: purposeMap[params.purpose],
    html: otpEmailTemplate({
      code,
      purposeText: params.purposeText,
      recipientName: params.recipientName,
      minutes,
      isAdmin: params.isAdmin,
    }),
  });

  return { otp, code, maskedEmail: maskEmail(params.email) };
}

export interface ConsumeOtpResult {
  ok: true;
  otp: OtpRecord;
}

export type ConsumeOtpOutcome = ConsumeOtpResult | { ok: false; status: number; error: string };

export async function consumeOtp(params: {
  req: Request;
  email: string;
  code: string;
  purpose: OtpPurpose;
  expectAudience?: 'app' | 'admin';
}): Promise<ConsumeOtpOutcome> {
  const store = getStore();

  const limiter = otpRateLimiter.check(`${params.purpose}:${clientKey(params.req)}`);
  if (!limiter.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Too many verification attempts. Try again in ${limiter.retryAfterSeconds} seconds.`,
    };
  }

  const otp = await store.latestOtp(params.email, params.purpose);
  if (!otp) {
    return { ok: false, status: 400, error: 'No active verification code for this email. Please request a new code.' };
  }
  if (Date.now() > otp.expiresAt) {
    return { ok: false, status: 400, error: 'Verification code has expired. Please request a new one.' };
  }
  if (otp.attempts >= otp.maxAttempts) {
    return { ok: false, status: 429, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
  }
  if (!verifyOtpHash(params.code, params.email, otp.otpHash)) {
    const attempts = otp.attempts + 1;
    await store.updateOtp(otp.id, { attempts });
    const remaining = otp.maxAttempts - attempts;
    return {
      ok: false,
      status: 400,
      error: remaining > 0 ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Incorrect verification code. Please request a new code.',
    };
  }

  const now = Date.now();
  await store.updateOtp(otp.id, { verifiedAt: now, expiresAt: now - 1 });
  otpRateLimiter.reset(`${params.purpose}:${clientKey(params.req)}`);
  return { ok: true, otp };
}
