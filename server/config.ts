import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(process.cwd());

for (const candidate of ['.env.local', '.env']) {
  const envPath = path.join(rootDir, candidate);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0 && !value.includes('optional')) {
      return value.trim();
    }
  }
  return undefined;
}

function toBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const databaseUrl = firstDefined(
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.PG_URL,
  process.env.POSTGRES_PRISMA_URL,
);

const gmailUser = firstDefined(process.env.GMAIL_USER);
const gmailAppPassword = firstDefined(process.env.GMAIL_APP_PASSWORD);

// Gmail's SMTP endpoint is a constant, not a setting. Making host/port
// configurable only created ways to weaken the connection by accident (a
// STARTTLS port paired with TLS disabled) or to aim real credentials at a
// relay the operator did not intend. The transport is pinned to implicit TLS,
// so the mailbox and app password are the only things worth configuring.
const GMAIL_SMTP_HOST = 'smtp.gmail.com';
const GMAIL_SMTP_PORT = 465;

// Gmail rejects a From header naming anything other than the authenticated
// mailbox, so the sender display name is a brand constant rather than a
// per-deploy setting that could produce an undeliverable message.
const EMAIL_BRAND = 'BonfilsStore';

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: firstDefined(process.env.APP_URL) || 'http://localhost:3000',
  databaseUrl,
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
  emailBrand: EMAIL_BRAND,
  gmailSmtpHost: GMAIL_SMTP_HOST,
  gmailSmtpPort: GMAIL_SMTP_PORT,
  gmailUser,
  gmailAppPassword,
  // Both values are required. Gmail rejects an unauthenticated relay, so a
  // half-configured pair must fail closed rather than open a socket that looks
  // configured but silently cannot send.
  isSmtpConfigured: Boolean(gmailUser && gmailAppPassword),
  blobToken: firstDefined(process.env.BLOB_READ_WRITE_TOKEN),
  superAdminEmail: firstDefined(process.env.SUPER_ADMIN_EMAIL),
  superAdminPassword: firstDefined(process.env.SUPER_ADMIN_PASSWORD),
  superAdminName: firstDefined(process.env.SUPER_ADMIN_NAME),
  runMigrationsOnBoot: toBool(process.env.RUN_MIGRATIONS_ON_BOOT, true),
  allowSeededDemoAccounts: toBool(process.env.SEED_DEMO_ACCOUNTS, true),
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  adminSessionTtlMs: 24 * 60 * 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,
  adminOtpMaxAttempts: 3,
  otpResendCooldownMs: 45 * 1000,
  maxLoginAttempts: 8,
  loginAttemptWindowMs: 15 * 60 * 1000,
  maxUploadBytes: 3 * 1024 * 1024,
} as const;

export type AppConfig = typeof config;
