import { Router } from 'express';
import { getStore } from '../db';
import type { Product } from '../../src/types';
import { logActivity, requireAuth, requireRole } from '../middleware';
import { clientKey, newId, writeRateLimiter } from '../security';
import { asyncHandler, resolveCategoryName, toNumber } from './helpers';

const router = Router();

router.use(requireAuth, requireRole('seller', 'super_admin'));

async function requireSellerBusiness(userId: string) {
  const store = getStore();
  const user = await store.findUserById(userId);
  const business = user?.businessId ? await store.findBusiness(user.businessId) : await store.findBusinessByOwner(userId);
  return { store, user, business };
}

async function productFromPayload(body: Record<string, unknown>, existing?: Product): Promise<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'salesCount' | 'reviewsCount' | 'rating'>> {
  const price = toNumber(body.price, existing?.price ?? 0);
  if (price <= 0) throw Object.assign(new Error('Price must be greater than zero.'), { status: 400 });
  const title = String(body.title || existing?.title || '').trim();
  if (!title) throw Object.assign(new Error('Product title is required.'), { status: 400 });

  return {
    businessId: existing?.businessId || '',
    sellerName: existing?.sellerName || '',
    isOfficial: existing?.isOfficial ?? false,
    title,
    description: String(body.description ?? existing?.description ?? '').trim(),
    category: await resolveCategoryName(body.category ?? existing?.category),
    brand: String(body.brand ?? existing?.brand ?? '').trim(),
    price,
    originalPrice: body.originalPrice !== undefined && body.originalPrice !== null && body.originalPrice !== ''
      ? toNumber(body.originalPrice, price)
      : existing?.originalPrice,
    stock: Math.max(0, Math.floor(toNumber(body.stock, existing?.stock ?? 0))),
    images: Array.isArray(body.images)
      ? body.images.filter((image): image is string => typeof image === 'string' && image.length > 0).slice(0, 8)
      : existing?.images || [],
    shippingOrigin: String(body.shippingOrigin ?? existing?.shippingOrigin ?? 'Kigali Local Warehouse'),
    shippingTimeDays: String(body.shippingTimeDays ?? existing?.shippingTimeDays ?? '1 - 2 Days'),
    specifications: (body.specifications && typeof body.specifications === 'object'
      ? body.specifications
      : existing?.specifications) as Product['specifications'],
    isFeatured: existing?.isFeatured ?? false,
    isActive: body.isActive === undefined ? (existing?.isActive ?? true) : Boolean(body.isActive),
  };
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(404).json({ error: 'No store is linked to your account yet.' });
  }
  const products = await store.listProducts({ sellerId: business.id, pageSize: 100, includeInactive: true });
  const orders = await store.listOrders({ businessId: business.id });
  const productIds = new Set(products.products.map(product => product.id));
  const relevant = orders.map(order => ({
    ...order,
    items: order.items.filter(item => productIds.has(item.productId)),
  })).filter(order => order.items.length);

  const totalRevenue = relevant
    .filter(order => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);

  res.json({
    business,
    products: products.products,
    orders: relevant,
    metrics: {
      totalProducts: products.products.length,
      activeProducts: products.products.filter(product => product.isActive).length,
      outOfStock: products.products.filter(product => product.stock === 0).length,
      lowStock: products.products.filter(product => product.stock > 0 && product.stock <= 5).length,
      totalOrders: relevant.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalUnitsSold: relevant.reduce(
        (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      ),
      pendingOrders: relevant.filter(order => ['pending', 'processing'].includes(order.status)).length,
    },
  });
}));

router.post('/products', asyncHandler(async (req, res) => {
  const limiter = writeRateLimiter.check(`seller-product:${clientKey(req)}`);
  if (!limiter.allowed) {
    return res.status(429).json({ error: 'Too many product changes. Please wait a moment.' });
  }
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(403).json({ error: 'Your account is not linked to a store yet.' });
  }

  const payload = await productFromPayload(req.body || {});
  const now = new Date().toISOString();
  const product: Product = {
    ...payload,
    id: newId('PRD'),
    businessId: business.id,
    sellerName: business.name,
    isOfficial: business.type === 'official',
    rating: 5,
    reviewsCount: 0,
    salesCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const created = await store.createProduct(product);

  await logActivity({
    actor: req.user!,
    action: 'PRODUCT_CREATED',
    targetType: 'product',
    targetId: created.id,
    details: `Seller "${business.name}" published "${created.title}".`,
  });
  res.json({ success: true, product: created });
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(403).json({ error: 'Your account is not linked to a store yet.' });
  }
  const existing = await store.findProduct(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  if (existing.businessId !== business.id && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'You can only edit products from your own store.' });
  }
  if (existing.isFeatured && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Featured products can only be changed by the Super Admin.' });
  }

  const payload = await productFromPayload(req.body || {}, existing);
  const updated = await store.updateProduct(existing.id, {
    ...payload,
    businessId: business.id,
    sellerName: business.name,
    isOfficial: business.type === 'official',
    isFeatured: existing.isFeatured,
  });
  res.json({ success: true, product: updated });
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(403).json({ error: 'Your account is not linked to a store yet.' });
  }
  const existing = await store.findProduct(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  if (existing.businessId !== business.id && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'You can only remove products from your own store.' });
  }
  if (existing.isFeatured) {
    return res.status(400).json({ error: 'Featured products must be unfeatured by the Super Admin before removal.' });
  }

  await store.deleteProduct(existing.id);
  await logActivity({
    actor: req.user!,
    action: 'PRODUCT_DELETED',
    targetType: 'product',
    targetId: existing.id,
    details: `Product "${existing.title}" removed.`,
  });
  res.json({ success: true, message: 'Product removed.' });
}));

router.patch('/orders/:orderId/status', asyncHandler(async (req, res) => {
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(403).json({ error: 'Your account is not linked to a store yet.' });
  }
  const order = await store.findOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
  const status = String(req.body?.status) as typeof statuses[number];
  if (!statuses.includes(status)) {
    return res.status(400).json({ error: 'Unknown order status.' });
  }
  if (!order.items.some(item => item.businessId === business.id) && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'This order does not contain products from your store.' });
  }

  const items = order.items.map(item => (item.businessId === business.id ? { ...item, status, trackingNumber: req.body?.trackingNumber || item.trackingNumber } : item));
  const allSettled = items.every(item => ['delivered', 'cancelled'].includes(item.status));
  const anyShipped = items.some(item => ['shipped', 'delivered'].includes(item.status));
  const orderStatus = allSettled
    ? (items.every(item => item.status === 'cancelled') ? 'cancelled' : 'delivered')
    : anyShipped ? 'partially_shipped' : status === 'shipped' ? 'shipped' : 'processing';

  const updated = await store.updateOrder(order.id, { items, status: orderStatus as typeof order.status });
  await logActivity({
    actor: req.user!,
    action: 'ORDER_ITEM_STATUS',
    targetType: 'order',
    targetId: order.id,
    details: `${business.name} marked items of ${order.orderNumber} as ${status}.`,
  });
  res.json({ success: true, order: updated });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const { store, business } = await requireSellerBusiness(req.user!.id);
  if (!business) {
    return res.status(404).json({ error: 'No store is linked to your account yet.' });
  }
  const patch: Record<string, unknown> = {};
  for (const field of ['name', 'description', 'phone', 'email', 'country', 'city', 'shippingTerms'] as const) {
    if (req.body?.[field] !== undefined) patch[field] = String(req.body[field]).trim();
  }
  const updated = await store.updateBusiness(business.id, patch as never);
  res.json({ success: true, business: updated });
}));

export default router;
