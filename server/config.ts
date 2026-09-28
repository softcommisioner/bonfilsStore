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

const emailHost = firstDefined(process.env.EMAIL_HOST);
const emailUser = firstDefined(process.env.EMAIL_USER);
const emailPass = firstDefined(process.env.EMAIL_PASS);
const emailPort = Number.parseInt(process.env.EMAIL_PORT || '465', 10) || 465;
// Port 465 is implicit TLS; 587 is STARTTLS. Both are encrypted, the handshake
// just happens at a different point. Only an explicit EMAIL_SECURE=false
// disables TLS, which is reserved for a local debugging relay.
const emailSecure = toBool(process.env.EMAIL_SECURE, emailPort === 465);
const emailFromName = firstDefined(process.env.EMAIL_FROM_NAME) || 'BonfilsStore';

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: firstDefined(process.env.APP_URL) || 'http://localhost:3000',
  databaseUrl,
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
  resendApiKey: firstDefined(process.env.RESEND_API_KEY),
  emailFrom: firstDefined(process.env.EMAIL_FROM) || 'BONFILS STORE <notifications@bonfilsstore.com>',
  // Whether EMAIL_FROM was set explicitly, or is only the marketing default.
  // The SMTP path needs this: Gmail rejects a From header that is not the
  // authenticated mailbox, so the default must not leak into SMTP sends.
  emailFromExplicit: Boolean(firstDefined(process.env.EMAIL_FROM)),
  emailHost,
  emailPort,
  emailUser,
  emailPass,
  emailSecure,
  emailFromName,
  // Both a user and a password are required: Gmail rejects an unauthenticated
  // relay, and a half-configured block must fail closed rather than silently
  // fall back to an unauthenticated socket.
  isSmtpConfigured: Boolean(emailHost && emailUser && emailPass),
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
