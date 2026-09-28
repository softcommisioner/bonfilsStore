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
    host: config.emailHost,
    port: config.emailPort,
    // Implicit TLS on 465, STARTTLS on 587. `requireTLS` refuses to downgrade
    // to plaintext if the server does not offer STARTTLS, so a misconfigured
    // port fails loudly instead of leaking a code in clear text.
    secure: config.emailSecure,
    requireTLS: !config.emailSecure,
    auth: { user: config.emailUser, pass: config.emailPass },
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
 * Gmail only accepts mail From: the authenticated mailbox (or a verified
 * alias). The marketing default (notifications@bonfilsstore.com) is a different
 * domain entirely and would be rejected with a 550, so unless the operator
 * deliberately set EMAIL_FROM the SMTP path derives its own header from
 * EMAIL_USER.
 */
export function resolveFromAddress(): string {
  if (config.isSmtpConfigured && !config.emailFromExplicit) {
    const name = config.emailFromName.replace(/["\\]/g, '');
    return `"${name}" <${config.emailUser}>`;
  }
  return config.emailFrom;
}

async function deliverWithSmtp(params: SendParams): Promise<DeliveryResult> {
  if (!config.isSmtpConfigured) return { delivered: false, detail: 'EMAIL_HOST/EMAIL_USER/EMAIL_PASS not configured' };
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

async function deliverWithResend(params: SendParams): Promise<DeliveryResult> {
  if (!config.resendApiKey) return { delivered: false, detail: 'RESEND_API_KEY not configured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { delivered: false, transport: 'resend', detail: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }
    return { delivered: true, transport: 'resend' };
  } catch (error) {
    return { delivered: false, transport: 'resend', detail: (error as Error).message };
  }
}

/** Probes the configured relay so deploys can prove mail works. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; transport: string; detail: string }> {
  if (config.isSmtpConfigured) {
    try {
      await getSmtpTransport().verify();
      return { ok: true, transport: 'smtp', detail: `${config.emailHost}:${config.emailPort} as ${config.emailUser}` };
    } catch (error) {
      return { ok: false, transport: 'smtp', detail: (error as Error).message };
    }
  }
  if (config.resendApiKey) {
    return { ok: true, transport: 'resend', detail: 'RESEND_API_KEY present' };
  }
  return { ok: false, transport: 'none', detail: 'no EMAIL_* or RESEND_API_KEY configured' };
}

export async function sendEmail(params: SendParams): Promise<EmailRecord> {
  const result = config.isSmtpConfigured
    ? await deliverWithSmtp(params)
    : await deliverWithResend(params);

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
  return Boolean(config.isSmtpConfigured || config.resendApiKey);
}
