import crypto from 'crypto';
import { promisify } from 'util';
import { config } from './config';
import { getStore } from './db';
import type { SessionAudience, UserRecord } from './db';

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const OTP_SECRET = process.env.OTP_SECRET || 'bonfils-store-otp-dev-secret';

export function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function hashPassword(password: string, salt = newSalt()): Promise<{ hash: string; salt: string }> {
  const derived = await scrypt(password, salt, 64);
  return { hash: derived.toString('hex'), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  if (!hash || !salt) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(code: string, email: string): string {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${email.toLowerCase()}:${code}`).digest('hex');
}

export function verifyOtpHash(code: string, email: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code, email), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function createSession(userId: string, audience: SessionAudience, ttlMs: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await getStore().createSession({ token, userId, audience, createdAt: now, expiresAt: now + ttlMs });
  return token;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);
    if (timestamps.length >= this.limit) {
      const retryAfterMs = this.windowMs - (now - timestamps[0]);
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        remaining: 0,
      };
    }
    timestamps.push(now);
    this.hits.set(key, timestamps);
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) {
        if (v.every(t => now - t >= this.windowMs)) this.hits.delete(k);
      }
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: this.limit - timestamps.length };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

export const authRateLimiter = new RateLimiter(20, config.loginAttemptWindowMs);
export const loginRateLimiter = new RateLimiter(config.maxLoginAttempts, config.loginAttemptWindowMs);
export const otpRateLimiter = new RateLimiter(15, config.loginAttemptWindowMs);
export const adminRateLimiter = new RateLimiter(10, config.loginAttemptWindowMs);
export const writeRateLimiter = new RateLimiter(120, 60 * 1000);

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.charAt(0)}***@${domain}`;
}

export function clientKey(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function safeUser(user: UserRecord) {
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}
