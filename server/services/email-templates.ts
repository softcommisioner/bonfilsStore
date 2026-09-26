import type { ChinaRequest, Order, Quotation } from '../../src/types';

const BRAND = '#FF6A00';
const INK = '#1F2933';
const MUTED = '#6B7280';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));
}

function money(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function shell(title: string, subtitle: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#F5F5F4;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
    <tr>
      <td style="background:${BRAND};padding:22px 28px;color:#FFFFFF;">
        <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;">BONFILS STORE</div>
        <div style="font-size:13px;opacity:0.92;margin-top:2px;">${escapeHtml(subtitle)}</div>
      </td>
    </tr>
    <tr><td style="padding:28px;">${body}</td></tr>
    <tr>
      <td style="background:#FAFAF9;padding:18px 28px;border-top:1px solid #E5E7EB;font-size:12px;color:${MUTED};text-align:center;">
        &copy; ${new Date().getFullYear()} BONFILS STORE · Kigali, Rwanda<br />
        Multi-vendor marketplace · China sourcing &amp; international freight
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
  const heading = params.isAdmin ? 'Super Admin verification' : 'Account verification';
  return shell(
    `${heading} code`,
    heading,
    `<h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(params.purposeText)}</h1>
     <p style="margin:0 0 18px;line-height:1.6;color:#374151;">Hello <strong>${escapeHtml(params.recipientName)}</strong>,</p>
     <p style="margin:0 0 22px;line-height:1.6;color:#374151;">Use the single-use verification code below to continue on BONFILS STORE.</p>
     <div style="background:#FFF7ED;border:1px dashed ${BRAND};border-radius:10px;padding:22px;text-align:center;margin:0 0 22px;">
       <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND};margin-bottom:10px;">Your verification code</div>
       <div style="font-size:36px;font-weight:800;letter-spacing:10px;font-family:Consolas,Menlo,monospace;color:${INK};">${escapeHtml(params.code)}</div>
       <div style="font-size:13px;color:${MUTED};margin-top:10px;">Valid for ${minutes} minutes · single use only</div>
     </div>
     <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">
       If you did not request this code, ignore this email and do not share it with anyone. BONFILS STORE will never ask you for this code.
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
