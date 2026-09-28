import type { ChinaRequest, Order, Quotation } from '../../src/types.js';
import { config } from '../config.js';

const BRAND = '#FF6A00';
const INK = '#1F2933';
const MUTED = '#6B7280';

/**
 * Sender display name. Deliberately not an env var: Gmail requires the From
 * header to name the authenticated mailbox, so letting the brand drift per
 * environment would only produce mail that Gmail refuses. Falls back to the
 * storefront name if config is unavailable.
 */
function brandName(): string {
  return config.emailBrand || 'BonfilsStore';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));
}

function money(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function shell(title: string, subtitle: string, body: string): string {
  const brand = escapeHtml(brandName());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#F5F5F4;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E5E7EB;">
    <tr>
      <td style="background:${BRAND};padding:22px 28px;">
        <div style="font-size:20px;font-weight:800;letter-spacing:0.3px;color:#FFFFFF;">${brand}</div>
        <div style="font-size:13px;color:#FFE8D4;margin-top:2px;">${escapeHtml(subtitle)}</div>
      </td>
    </tr>
    <tr><td style="padding:28px;">${body}</td></tr>
    <tr>
      <td style="background:#FAFAF9;padding:20px 28px;border-top:1px solid #E5E7EB;font-size:12px;color:${MUTED};text-align:center;line-height:1.7;">
        &copy; ${new Date().getFullYear()} ${brand} &middot; Kigali, Rwanda<br />
        Multi-vendor marketplace &middot; China sourcing &amp; international freight<br />
        <span style="color:#9CA3AF;">This is an automated message. Please do not reply.</span>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpEmailTemplate(params: {
  code: string;
  purposeText: string;
  recipientName: string;
  minutes?: number;
  isAdmin?: boolean;
}): string {
  const minutes = params.minutes ?? 5;
  const brand = escapeHtml(brandName());
  // One template serves customers, sellers, staff and super admins; only the
  // eyebrow and the warning tone change, so the flow can never drift per role.
  const eyebrow = params.isAdmin ? 'Super Admin console' : 'Secure sign-in';
  const heading = params.isAdmin ? 'Super Admin verification' : 'Account verification';

  return shell(
    `${heading} code`,
    eyebrow,
    `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;color:${INK};">${escapeHtml(params.purposeText)}</h1>
     <p style="margin:0 0 20px;line-height:1.65;color:#374151;font-size:14px;">
       Hello <strong style="color:${INK};">${escapeHtml(params.recipientName)}</strong>,
     </p>
     <p style="margin:0 0 24px;line-height:1.65;color:#374151;font-size:14px;">
       Use the single-use verification code below to continue on ${brand}.
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 22px;">
       <tr>
         <td align="center" style="background:#FFF7ED;border:1px dashed ${BRAND};border-radius:12px;padding:26px 20px;">
           <div style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${BRAND};margin-bottom:14px;">
             Your verification code
           </div>
           <div style="font-size:40px;font-weight:800;letter-spacing:12px;line-height:1.2;font-family:Consolas,Menlo,monospace;color:${INK};">
             ${escapeHtml(params.code)}
           </div>
           <div style="font-size:13px;color:${MUTED};margin-top:14px;">
             Expires in ${minutes} minutes &middot; single use only
           </div>
         </td>
       </tr>
     </table>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FAFAF9;border:1px solid #E5E7EB;border-radius:10px;margin:0 0 22px;">
       <tr>
         <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#374151;">
           <strong style="color:${INK};">Did not request this?</strong>
           Ignore this email. ${brand} will never ask you to read out a code, and no support agent will request it.
         </td>
       </tr>
     </table>
     <p style="margin:0;font-size:13px;line-height:1.65;color:${MUTED};">
       Having trouble? Reply through the ${brand} dashboard and our team will help you sign in.
     </p>`,
  );
}

export function chinaRequestEmailTemplate(request: ChinaRequest): string {
  return shell(
    'China sourcing request received',
    'China Sourcing & International Freight',
    `<h1 style="margin:0 0 12px;font-size:20px;">We received your sourcing request</h1>
     <p style="margin:0 0 18px;line-height:1.6;color:#374151;">Hello <strong>${escapeHtml(request.customerName)}</strong>,</p>
     <table role="presentation" width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;background:#FAFAF9;border:1px solid #E5E7EB;border-radius:8px;margin:0 0 18px;">
       <tr><td style="color:${MUTED};">Request</td><td align="right" style="font-weight:700;color:${BRAND};">${escapeHtml(request.requestNumber)}</td></tr>
       <tr><td style="color:${MUTED};">Product</td><td align="right" style="font-weight:600;">${escapeHtml(request.productName)}</td></tr>
       <tr><td style="color:${MUTED};">Quantity</td><td align="right" style="font-weight:600;">${escapeHtml(request.quantity)}</td></tr>
       <tr><td style="color:${MUTED};">Shipping</td><td align="right" style="font-weight:600;">${escapeHtml(String(request.shippingMethod).toUpperCase())}</td></tr>
       <tr><td style="color:${MUTED};">Status</td><td align="right" style="font-weight:700;color:#22A06B;">${escapeHtml(request.status.replace(/_/g, ' '))}</td></tr>
     </table>
     <p style="margin:0;line-height:1.6;color:#374151;">Our sourcing team will verify factory pricing and send an itemised quotation to your dashboard within 24-48 hours.</p>`,
  );
}

export function quotationEmailTemplate(request: ChinaRequest, quote: Quotation): string {
  return shell(
    'Quotation ready',
    'Official China sourcing quotation',
    `<h1 style="margin:0 0 12px;font-size:20px;">Quotation for ${escapeHtml(request.requestNumber)}</h1>
     <p style="margin:0 0 18px;line-height:1.6;color:#374151;">Hello <strong>${escapeHtml(request.customerName)}</strong>, your quotation is ready to review.</p>
     <table role="presentation" width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;background:#FAFAF9;border:1px solid #E5E7EB;border-radius:8px;margin:0 0 18px;">
       <tr><td style="color:${MUTED};">Product cost (${escapeHtml(request.quantity)} units)</td><td align="right" style="font-weight:600;">${money(quote.productCost)}</td></tr>
       <tr><td style="color:${MUTED};">China local shipping</td><td align="right" style="font-weight:600;">${money(quote.chinaLocalShipping)}</td></tr>
       <tr><td style="color:${MUTED};">International freight</td><td align="right" style="font-weight:600;">${money(quote.internationalShipping)}</td></tr>
       <tr><td style="color:${MUTED};">Procurement &amp; inspection fee</td><td align="right" style="font-weight:600;">${money(quote.serviceFee)}</td></tr>
       <tr style="background:#FFF7ED;"><td style="font-size:16px;font-weight:800;color:${BRAND};">Total payable</td><td align="right" style="font-size:18px;font-weight:800;color:${BRAND};">${money(quote.total)}</td></tr>
     </table>
     ${quote.notes ? `<p style="margin:0 0 18px;padding:12px;background:#F3F4F6;border-radius:6px;font-size:13px;color:#374151;"><strong>Notes:</strong> ${escapeHtml(quote.notes)}</p>` : ''}
     <p style="margin:0;line-height:1.6;color:#374151;">Please accept or reject this quotation in your dashboard before <strong>${escapeHtml(quote.validUntil)}</strong>.</p>`,
  );
}

export function orderConfirmationEmailTemplate(order: Order): string {
  const rows = order.items.map(item => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${escapeHtml(item.productTitle)}<div style="font-size:12px;color:${MUTED};">${escapeHtml(item.sellerName)} · Qty ${escapeHtml(item.quantity)}</div></td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #E5E7EB;font-weight:600;white-space:nowrap;">${money(item.price * item.quantity)}</td>
    </tr>`).join('');

  return shell(
    'Order confirmation',
    'Order confirmation',
    `<h1 style="margin:0 0 12px;font-size:20px;">Thank you for your order</h1>
     <p style="margin:0 0 18px;line-height:1.6;color:#374151;">Hello <strong>${escapeHtml(order.customerName)}</strong>, order <strong style="color:${BRAND};">${escapeHtml(order.orderNumber)}</strong> is being prepared.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;">${rows}</table>
     <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;background:#FAFAF9;border:1px solid #E5E7EB;border-radius:8px;">
       <tr><td style="color:${MUTED};">Subtotal</td><td align="right" style="font-weight:600;">${money(order.subtotal)}</td></tr>
       <tr><td style="color:${MUTED};">Shipping</td><td align="right" style="font-weight:600;">${money(order.shippingFee)}</td></tr>
       <tr><td style="font-weight:800;color:${BRAND};">Total</td><td align="right" style="font-weight:800;color:${BRAND};font-size:18px;">${money(order.total)}</td></tr>
     </table>
     <p style="margin:18px 0 0;font-size:13px;color:${MUTED};">Deliver to: ${escapeHtml(order.shippingAddress?.street || '')}, ${escapeHtml(order.shippingAddress?.city || '')}, ${escapeHtml(order.shippingAddress?.country || '')}</p>`,
  );
}

export function shippingUpdateEmailTemplate(params: {
  recipientName: string;
  trackingNumber: string;
  status: string;
  stage: number;
  checkpoints?: Array<{ title: string; location: string; date: string; completed: boolean }>;
}): string {
  const checkpoints = (params.checkpoints || []).map(checkpoint => `<li style="margin:0 0 6px;color:${checkpoint.completed ? '#047857' : MUTED};">${checkpoint.completed ? '&#10003;' : '&#9675;'} ${escapeHtml(checkpoint.title)} — ${escapeHtml(checkpoint.location)} (${escapeHtml(checkpoint.date)})</li>`).join('');
  return shell(
    'Shipment update',
    'International tracking update',
    `<h1 style="margin:0 0 12px;font-size:20px;">Shipment ${escapeHtml(params.trackingNumber)}</h1>
     <p style="margin:0 0 18px;line-height:1.6;color:#374151;">Hello <strong>${escapeHtml(params.recipientName)}</strong>, your shipment is now <strong>${escapeHtml(params.status.replace(/_/g, ' '))}</strong> (stage ${escapeHtml(params.stage)} of 5).</p>
     ${checkpoints ? `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">${checkpoints}</ul>` : ''}`,
  );
}
