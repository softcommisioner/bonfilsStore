import { Router } from 'express';
import { getStore } from '../db';
import type { Order, OrderItem } from '../../src/types';
import { logActivity, pushNotification, requireAuth } from '../middleware';
import { newId, writeRateLimiter, clientKey } from '../security';
import { sendEmail } from '../services/email';
import { orderConfirmationEmailTemplate } from '../services/email-templates';
import { asyncHandler, toNumber } from './helpers';

const router = Router();

const SHIPPING_FEE = 5;
const FREE_SHIPPING_THRESHOLD = 200;
const MAX_ITEM_QUANTITY = 50;

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const limiter = writeRateLimiter.check(`order:${clientKey(req)}`);
  if (!limiter.allowed) {
    return res.status(429).json({ error: 'Too many checkout attempts. Please wait a moment and try again.' });
  }

  const user = req.user!;
  const store = getStore();
  const payload = req.body || {};
  const rawItems: Array<{ productId: string; quantity: number }> = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  const address = payload.shippingAddress || {};
  const requiredAddress = ['fullName', 'phone', 'street', 'city', 'country'];
  for (const field of requiredAddress) {
    if (!address[field] || String(address[field]).trim().length < 2) {
      return res.status(400).json({ error: `Shipping address is missing: ${field}.` });
    }
  }

  // Re-read every product from the database and revalidate stock/price.
  const items: OrderItem[] = [];
  const stockLines: Array<{ productId: string; quantity: number }> = [];
  for (const raw of rawItems) {
    const productId = String(raw.productId || '');
    const quantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(toNumber(raw.quantity, 1))));
    if (!productId) continue;

    const product = await store.findProduct(productId);
    if (!product || !product.isActive) {
      return res.status(400).json({ error: `One of the items is no longer available: ${product?.title || productId}` });
    }
    if (product.stock <= 0) {
      return res.status(409).json({ error: `${product.title} is out of stock.` });
    }
    if (quantity > product.stock) {
      return res.status(409).json({ error: `Only ${product.stock} unit(s) of ${product.title} are left in stock.` });
    }

    stockLines.push({ productId, quantity });
    items.push({
      id: newId('ITM'),
      productId: product.id,
      productTitle: product.title,
      productImage: product.images[0] || '',
      businessId: product.businessId,
      sellerName: product.sellerName,
      price: product.price,
      quantity,
      status: 'pending',
    });
  }

  if (!items.length) {
    return res.status(400).json({ error: 'No valid items in your cart.' });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingFee;

  const sequence = await store.nextCounter('order', 1000);
  const now = new Date().toISOString();
  const order: Order = {
    id: newId('ORD'),
    orderNumber: `BFS-ORD-${new Date().getFullYear()}-${String(sequence).padStart(5, '0')}`,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: String(address.phone),
    items,
    subtotal,
    shippingFee,
    total,
    status: 'processing',
    shippingAddress: {
      fullName: String(address.fullName),
      phone: String(address.phone),
      street: String(address.street),
      city: String(address.city),
      country: String(address.country),
      notes: address.notes ? String(address.notes) : undefined,
    },
    paymentMethod: ['card', 'mobile_money', 'bank_transfer', 'cash_on_delivery'].includes(payload.paymentMethod)
      ? payload.paymentMethod
      : 'mobile_money',
    paymentStatus: payload.paymentMethod === 'card' ? 'paid' : 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const placed = await store.placeOrder(order, stockLines);

  await pushNotification({
    userId: user.id,
    title: `Order ${placed.orderNumber} confirmed`,
    message: `Thank you! Your order of ${placed.items.length} item(s) is being prepared.`,
    type: 'order',
  });

  const sellerIds = Array.from(new Set(items.map(item => item.businessId)));
  for (const businessId of sellerIds) {
    const business = await store.findBusiness(businessId);
    if (business?.ownerId) {
      await pushNotification({
        userId: business.ownerId,
        title: 'New order received',
        message: `Order ${placed.orderNumber} contains your product(s).`,
        type: 'order',
      });
    }
  }

  await logActivity({
    actor: user,
    action: 'ORDER_PLACED',
    targetType: 'order',
    targetId: placed.id,
    details: `Order ${placed.orderNumber} placed for $${placed.total.toFixed(2)} (${placed.items.length} item(s)).`,
  });

  await sendEmail({
    to: user.email,
    subject: `BONFILS STORE - Order ${placed.orderNumber} confirmed`,
    purpose: 'order_confirmation',
    html: orderConfirmationEmailTemplate(placed),
  });

  res.json({ success: true, order: placed });
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const orders = await getStore().listOrders({ customerId: req.user!.id });
  res.json({ orders });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const store = getStore();
  const user = req.user!;
  const order = await store.findOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  const isOwner = order.customerId === user.id;
  const isSeller = order.items.some(item => item.businessId === user.businessId);
  const isAdmin = user.roles.includes('super_admin') || user.roles.includes('staff');
  if (!isOwner && !isSeller && !isAdmin) {
    return res.status(403).json({ error: 'You do not have access to this order.' });
  }
  res.json({ order });
}));

router.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const store = getStore();
  const order = await store.findOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  if (order.customerId !== req.user!.id && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'You can only cancel your own orders.' });
  }
  if (!['pending', 'processing'].includes(order.status)) {
    return res.status(400).json({ error: 'This order can no longer be cancelled.' });
  }
  const updated = await store.updateOrder(order.id, { status: 'cancelled' });
  await logActivity({
    actor: req.user!,
    action: 'ORDER_CANCELLED',
    targetType: 'order',
    targetId: order.id,
    details: `Order ${order.orderNumber} cancelled by ${req.user!.name}.`,
  });
  res.json({ success: true, order: updated, message: 'Order cancelled.' });
}));

export default router;
