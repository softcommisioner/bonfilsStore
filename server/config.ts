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

function repairConnectionString(value: string): string | undefined {
  const schemeMatch = /^([a-z][a-z0-9+.-]*:\/\/)/i.exec(value);
  if (!schemeMatch) return undefined;
  const rest = value.slice(schemeMatch[1].length);
  const cut = rest.search(/[/?#]/);
  const authority = cut === -1 ? rest : rest.slice(0, cut);
  const suffix = cut === -1 ? '' : rest.slice(cut);
  const at = authority.lastIndexOf('@');
  if (at === -1) return undefined;
  const userInfo = authority.slice(0, at);
  const hostPart = authority.slice(at + 1);
  if (!hostPart) return undefined;
  const colon = userInfo.indexOf(':');
  const user = colon === -1 ? userInfo : userInfo.slice(0, colon);
  const password = colon === -1 ? '' : userInfo.slice(colon + 1);
  const safe = (segment: string) => segment.replace(/%(?![0-9A-Fa-f]{2})|[^\w.\-~%!$&'()*+,;=]/g, (ch) => (
    ch === '%' ? '%25' : encodeURIComponent(ch)
  ));
  const repaired = `${schemeMatch[1]}${safe(user)}${colon === -1 ? '' : `:${safe(password)}`}@${hostPart}${suffix}`;
  try {
    new URL(repaired);
    return repaired;
  } catch {
    return undefined;
  }
}

function normalizeAndValidateDatabaseUrl(value: string): string {
  let normalized = value;
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (!normalized) {
    throw new Error('Invalid DATABASE_URL/POSTGRES_URL: connection string is empty after trimming.');
  }
  try {
    new URL(normalized);
    return normalized;
  } catch {
    const repaired = repairConnectionString(normalized);
    if (repaired) return repaired;
    throw new Error(
      'Invalid DATABASE_URL/POSTGRES_URL: could not parse connection string. Check for surrounding quotes/whitespace, unencoded special characters in credentials, or a missing/invalid host or port.',
    );
  }
}

function pickDatabaseUrl(): string | undefined {
  for (const raw of [process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.PG_URL, process.env.POSTGRES_PRISMA_URL]) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.replace(/[\r\n]+/g, '').trim();
    if (!trimmed || trimmed.includes('optional')) continue;
    return normalizeAndValidateDatabaseUrl(trimmed);
  }
  return undefined;
}

const databaseUrl = pickDatabaseUrl();

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
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  adminSessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,
  adminOtpMaxAttempts: 3,
  otpResendCooldownMs: 45 * 1000,
  maxLoginAttempts: 8,
  loginAttemptWindowMs: 15 * 60 * 1000,
  maxUploadBytes: 3 * 1024 * 1024,
} as const;

export type AppConfig = typeof config;
