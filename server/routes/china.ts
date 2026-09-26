import { Router } from 'express';
import { getStore } from '../db';
import type { ChinaRequest, ChinaRequestStatus, Quotation } from '../../src/types';
import { logActivity, requireAuth, requireRole } from '../middleware';
import { newId, writeRateLimiter, clientKey } from '../security';
import { sendEmail } from '../services/email';
import { chinaRequestEmailTemplate, quotationEmailTemplate } from '../services/email-templates';
import { asyncHandler, EMAIL_REGEX, normalizeEmail, toNumber } from './helpers';

const router = Router();

const STATUSES: ChinaRequestStatus[] = [
  'REQUEST_RECEIVED', 'UNDER_REVIEW', 'CONTACTING_CUSTOMER', 'PRODUCT_SEARCHING', 'SUPPLIER_FOUND',
  'PRICE_NEGOTIATION', 'CUSTOMER_CONFIRMATION', 'PAYMENT_PENDING', 'PURCHASED', 'SHIPPING',
  'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED',
];

router.post('/', asyncHandler(async (req, res) => {
  const limiter = writeRateLimiter.check(`china:${clientKey(req)}`);
  if (!limiter.allowed) {
    return res.status(429).json({ error: 'Too many sourcing requests. Please wait a moment and try again.' });
  }

  const body = req.body || {};
  const customerEmail = normalizeEmail(body.customerEmail || req.user?.email);
  if (!EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!body.productName || !body.quantity) {
    return res.status(400).json({ error: 'Product name and quantity are required.' });
  }

  const store = getStore();
  const sequence = await store.nextCounter('china-request', 100);
  const now = new Date().toISOString();
  const request: ChinaRequest = {
    id: newId('CR'),
    requestNumber: `BFS-CHINA-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`,
    userId: req.user?.id,
    productName: String(body.productName).trim(),
    description: String(body.description || '').trim(),
    category: String(body.category || 'General').trim(),
    quantity: Math.max(1, Math.floor(toNumber(body.quantity, 1))),
    preferredBrand: body.preferredBrand,
    modelNumber: body.modelNumber,
    color: body.color,
    size: body.size,
    specifications: body.specifications,
    estimatedBudget: body.estimatedBudget !== undefined ? toNumber(body.estimatedBudget, 0) : undefined,
    images: Array.isArray(body.images) ? body.images.slice(0, 8) : [],
    referenceUrl: body.referenceUrl,
    customerName: String(body.customerName || req.user?.name || 'Customer').trim(),
    customerEmail,
    customerPhone: String(body.customerPhone || '').trim(),
    whatsapp: body.whatsapp,
    country: String(body.country || req.user?.country || 'Rwanda').trim(),
    city: String(body.city || req.user?.city || 'Kigali').trim(),
    deliveryAddress: String(body.deliveryAddress || '').trim(),
    preferredContactMethod: ['email', 'whatsapp', 'phone'].includes(body.preferredContactMethod) ? body.preferredContactMethod : 'email',
    shippingMethod: ['air', 'sea', 'express'].includes(body.shippingMethod) ? body.shippingMethod : 'air',
    maxWaitingTime: ['15_days', '30_days', '45_days', 'more_than_45_days'].includes(body.maxWaitingTime) ? body.maxWaitingTime : '30_days',
    preferredDeliveryPeriod: body.preferredDeliveryPeriod,
    urgency: body.urgency === 'urgent' ? 'urgent' : 'normal',
    destination: String(body.destination || 'Kigali, Rwanda').trim(),
    instructions: body.instructions,
    status: 'REQUEST_RECEIVED',
    statusHistory: [{
      status: 'REQUEST_RECEIVED',
      note: 'Request registered in the sourcing pipeline.',
      updatedBy: 'System',
      timestamp: now,
    }],
    createdAt: now,
    updatedAt: now,
  };

  const created = await store.createChinaRequest(request);
  await logActivity({
    actor: req.user ?? null,
    action: 'CHINA_REQUEST_CREATED',
    targetType: 'china_request',
    targetId: created.id,
    details: `Sourcing request ${created.requestNumber} submitted for "${created.productName}".`,
  });
  await sendEmail({
    to: created.customerEmail,
    subject: `BONFILS STORE - Sourcing request ${created.requestNumber} received`,
    purpose: 'china_request',
    html: chinaRequestEmailTemplate(created),
  });

  res.json({
    success: true,
    request: created,
    message: 'Your sourcing request has been received. Our China team will send a quotation within 24-48 hours.',
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const store = getStore();
  const user = req.user;
  const emailParam = typeof req.query.email === 'string' ? normalizeEmail(req.query.email) : undefined;

  if (user?.roles.includes('super_admin') || user?.roles.includes('staff')) {
    const requests = await store.listChinaRequests({ status: typeof req.query.status === 'string' ? req.query.status : undefined });
    return res.json({ requests });
  }
  if (user) {
    const requests = await store.listChinaRequests({ userId: user.id });
    return res.json({ requests });
  }
  if (emailParam) {
    // Public lookup is limited to the request numbers a customer already knows.
    const requests = (await store.listChinaRequests({ email: emailParam }))
      .map(request => ({
        id: request.id,
        requestNumber: request.requestNumber,
        productName: request.productName,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      }));
    return res.json({ requests });
  }
  res.json({ requests: [] });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const store = getStore();
  const user = req.user;
  const request = await store.findChinaRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  const privileged = user?.roles.includes('super_admin') || user?.roles.includes('staff');
  const isOwner = Boolean(user && request.userId === user.id);
  if (!privileged && !isOwner) {
    return res.status(403).json({ error: 'You do not have access to this request.' });
  }
  res.json({ request });
}));

router.post('/:id/quotation', requireAuth, requireRole('staff', 'super_admin'), asyncHandler(async (req, res) => {
  const store = getStore();
  const request = await store.findChinaRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  const productCost = toNumber(req.body?.productCost, 0);
  const chinaLocalShipping = toNumber(req.body?.chinaLocalShipping, 0);
  const internationalShipping = toNumber(req.body?.internationalShipping, 0);
  const serviceFee = toNumber(req.body?.serviceFee, 0);
  if ([productCost, chinaLocalShipping, internationalShipping, serviceFee].some(value => value < 0)) {
    return res.status(400).json({ error: 'Quotation amounts cannot be negative.' });
  }

  const quotation: Quotation = {
    id: newId('QUO'),
    requestId: request.id,
    productCost,
    chinaLocalShipping,
    internationalShipping,
    serviceFee,
    total: productCost + chinaLocalShipping + internationalShipping + serviceFee,
    currency: 'USD',
    notes: String(req.body?.notes || '').trim(),
    validUntil: String(req.body?.validUntil || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  const updated = await store.updateChinaRequest(request.id, {
    quotation,
    status: 'CUSTOMER_CONFIRMATION',
    statusHistory: [
      ...request.statusHistory,
      { status: 'CUSTOMER_CONFIRMATION', note: `Quotation prepared by ${req.user!.name}.`, updatedBy: req.user!.name, timestamp: now },
    ],
  });

  await logActivity({
    actor: req.user!,
    action: 'QUOTATION_CREATED',
    targetType: 'quotation',
    targetId: quotation.id,
    details: `Quotation of $${quotation.total.toFixed(2)} issued for ${request.requestNumber}.`,
  });
  await sendEmail({
    to: request.customerEmail,
    subject: `BONFILS STORE - Quotation ready for ${request.requestNumber}`,
    purpose: 'quotation_ready',
    html: quotationEmailTemplate(request, quotation),
  });
  if (request.userId) {
    await store.createNotification({
      id: newId('NTF'),
      userId: request.userId,
      title: 'Your quotation is ready',
      message: `Review the quotation for ${request.requestNumber}.`,
      type: 'quotation',
      link: `/china-requests/${request.id}`,
      read: false,
      createdAt: now,
    });
  }

  res.json({ success: true, quotation, request: updated });
}));

router.post('/:id/quotation/respond', asyncHandler(async (req, res) => {
  const store = getStore();
  const user = req.user;
  const request = await store.findChinaRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  const privileged = user?.roles.includes('super_admin') || user?.roles.includes('staff');
  if (!privileged && !(user && request.userId === user.id)) {
    return res.status(403).json({ error: 'You do not have access to this request.' });
  }
  if (!request.quotation) {
    return res.status(400).json({ error: 'There is no quotation to respond to yet.' });
  }

  const action = req.body?.action === 'reject' ? 'reject' : 'accept';
  const now = new Date().toISOString();
  const quotation: Quotation = {
    ...request.quotation,
    status: action === 'accept' ? 'accepted' : 'rejected',
  };
  const updated = await store.updateChinaRequest(request.id, {
    quotation,
    status: action === 'accept' ? 'PAYMENT_PENDING' : 'CANCELLED',
    statusHistory: [
      ...request.statusHistory,
      {
        status: action === 'accept' ? 'PAYMENT_PENDING' : 'CANCELLED',
        note: `Quotation ${action === 'accept' ? 'accepted' : 'rejected'}${req.body?.notes ? `: ${String(req.body.notes)}` : ''}.`,
        updatedBy: user?.name || request.customerName,
        timestamp: now,
      },
    ],
  });

  await logActivity({
    actor: user ?? null,
    action: action === 'accept' ? 'QUOTATION_ACCEPTED' : 'QUOTATION_REJECTED',
    targetType: 'quotation',
    targetId: quotation.id,
    details: `Quotation ${action === 'accept' ? 'accepted' : 'rejected'} for ${request.requestNumber}.`,
  });

  res.json({ success: true, request: updated });
}));

router.patch('/:id/status', requireAuth, requireRole('staff', 'super_admin'), asyncHandler(async (req, res) => {
  const store = getStore();
  const request = await store.findChinaRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  const status = String(req.body?.status) as ChinaRequestStatus;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown request status.' });
  }

  const now = new Date().toISOString();
  const updated = await store.updateChinaRequest(request.id, {
    status,
    assignedStaffId: request.assignedStaffId || req.user!.id,
    assignedStaffName: request.assignedStaffName || req.user!.name,
    carrier: req.body?.carrier ?? request.carrier,
    trackingNumber: req.body?.trackingNumber ?? request.trackingNumber,
    supplierNotes: req.body?.supplierNotes ?? request.supplierNotes,
    statusHistory: [
      ...request.statusHistory,
      { status, note: String(req.body?.note || 'Status updated.'), updatedBy: req.user!.name, timestamp: now },
    ],
  });

  if (request.userId) {
    await store.createNotification({
      id: newId('NTF'),
      userId: request.userId,
      title: `Request ${request.requestNumber} updated`,
      message: `Status is now ${status.replace(/_/g, ' ').toLowerCase()}.`,
      type: 'china_request',
      link: `/china-requests/${request.id}`,
      read: false,
      createdAt: now,
    });
  }

  await logActivity({
    actor: req.user!,
    action: 'CHINA_REQUEST_STATUS',
    targetType: 'china_request',
    targetId: request.id,
    details: `${request.requestNumber} moved to ${status}.`,
  });

  res.json({ success: true, request: updated });
}));

export default router;
