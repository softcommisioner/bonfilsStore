import { config } from '../config';
import { getStore } from '../db';
import { newId } from '../security';
import type { EmailRecord } from '../../src/types';

type EmailPurpose = EmailRecord['purpose'];

interface SendParams {
  to: string;
  subject: string;
  html: string;
  purpose: EmailPurpose;
  replyTo?: string;
}

async function deliverWithResend(params: SendParams): Promise<{ delivered: boolean; detail?: string }> {
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
      return { delivered: false, detail: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }
    return { delivered: true };
  } catch (error) {
    return { delivered: false, detail: (error as Error).message };
  }
}

export async function sendEmail(params: SendParams): Promise<EmailRecord> {
  const { delivered, detail } = await deliverWithResend(params);
  if (!delivered) {
    console.warn(`[email] delivery skipped for ${params.to} (${params.purpose}): ${detail}`);
  }

  const record: EmailRecord = {
    id: newId('EML'),
    to: params.to,
    subject: params.subject,
    purpose: params.purpose,
    html: params.html,
    sentAt: new Date().toISOString(),
    status: delivered ? 'sent' : 'failed',
  };

  try {
    await getStore().recordEmail(record);
  } catch (error) {
    console.error('[email] failed to record email', error);
  }
  return record;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(config.resendApiKey);
}
