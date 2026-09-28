import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';
import { getStore } from '../db/index.js';
import { newId } from '../security.js';
import type { EmailRecord } from '../../src/types.js';

type EmailPurpose = EmailRecord['purpose'];

interface SendParams {
  to: string;
  subject: string;
  html: string;
  purpose: EmailPurpose;
  replyTo?: string;
}

type DeliveryResult = { delivered: boolean; detail?: string; transport?: string };

/**
 * A single transporter is reused per process so a warm lambda does not rebuild
 * its TLS options on every OTP.
 */
let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter {
  if (smtpTransport) return smtpTransport;
  smtpTransport = nodemailer.createTransport({
    // Pinned to Gmail over implicit TLS. `secure: true` means the TLS handshake
    // happens before any credential is written to the socket, and `requireTLS`
    // keeps that true even if a future refactor relaxes `secure`, so a
    // misconfiguration fails loudly instead of leaking a password or a one-time
    // code in clear text.
    host: config.gmailSmtpHost,
    port: config.gmailSmtpPort,
    secure: true,
    requireTLS: true,
    auth: { user: config.gmailUser, pass: config.gmailAppPassword },
    // Deliberately not pooled. A lambda that is frozen between requests would
    // otherwise keep a warm socket that can go stale, which shows up as email
    // that works for a while and then silently stops. One connection per send
    // costs a handshake but cannot rot. Raise the timeouts instead, so a slow
    // relay is given room rather than failing the OTP.
    pool: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
  return smtpTransport;
}

/**
 * Gmail only accepts mail From: the authenticated mailbox (or a verified alias
 * on that account), so the header is always derived from GMAIL_USER. The
 * notifications@bonfilsstore.com marketing address is a different domain and
 * would be rejected with a 550, which is why it is reserved for the fallback
 * relay rather than used here.
 */
export function resolveFromAddress(): string {
  const name = config.emailBrand.replace(/["\\]/g, '');
  return `"${name}" <${config.gmailUser}>`;
}

async function deliverWithSmtp(params: SendParams): Promise<DeliveryResult> {
  if (!config.isSmtpConfigured) return { delivered: false, detail: 'GMAIL_USER/GMAIL_APP_PASSWORD not configured' };
  try {
    const info = await getSmtpTransport().sendMail({
      from: resolveFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    return { delivered: true, transport: 'smtp', detail: info.messageId };
  } catch (error) {
    return { delivered: false, transport: 'smtp', detail: (error as Error).message };
  }
}

/** Probes the Gmail relay so deploys can prove mail works. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; transport: string; detail: string }> {
  if (!config.isSmtpConfigured) {
    return { ok: false, transport: 'none', detail: 'GMAIL_USER/GMAIL_APP_PASSWORD not configured' };
  }
  try {
    await getSmtpTransport().verify();
    return { ok: true, transport: 'smtp', detail: `${config.gmailSmtpHost}:${config.gmailSmtpPort} as ${config.gmailUser}` };
  } catch (error) {
    return { ok: false, transport: 'smtp', detail: (error as Error).message };
  }
}

export async function sendEmail(params: SendParams): Promise<EmailRecord> {
  const result = await deliverWithSmtp(params);

  if (!result.delivered) {
    // Never fatal: the OTP is already persisted, so a relay outage degrades to
    // a logged failure plus the admin console's recorded-email view rather than
    // locking the user out mid-flow.
    console.warn(`[email] delivery skipped for ${params.to} (${params.purpose}): ${result.detail}`);
  }

  const record: EmailRecord = {
    id: newId('EML'),
    to: params.to,
    subject: params.subject,
    purpose: params.purpose,
    html: params.html,
    sentAt: new Date().toISOString(),
    status: result.delivered ? 'sent' : 'failed',
  };

  try {
    await getStore().recordEmail(record);
  } catch (error) {
    console.error('[email] failed to record email', error);
  }
  return record;
}

export function isEmailDeliveryConfigured(): boolean {
  return config.isSmtpConfigured;
}
