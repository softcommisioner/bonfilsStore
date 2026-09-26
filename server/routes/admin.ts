import { Router } from 'express';
import { config } from '../config';
import { getStore } from '../db';
import type { UserRecord } from '../db';
import type { AdminStats, Product } from '../../src/types';
import { logActivity, pushNotification, requireAdmin } from '../middleware';
import { adminRateLimiter, clientKey, createSession, hashPassword, newId, verifyPassword } from '../security';
import {
  asyncHandler, consumeOtp, EMAIL_REGEX, issueOtp, normalizeEmail, publicUser, resolveCategoryName, toNumber,
} from './helpers';
import { sendEmail } from '../services/email';
import { uploadImage, UploadError } from '../services/upload';

const router = Router();

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

// ---------------------------------------------------------------- admin auth
router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const limiter = adminRateLimiter.check(`${clientKey(req)}:${email}`);
  if (!limiter.allowed) {
    return res.status(429).json({
      error: `Too many Super Admin attempts. Try again in ${limiter.retryAfterSeconds} seconds.`,
    });
  }

  const store = getStore();
  const user = await store.findUserByEmail(email);
  const valid = user ? await verifyPassword(password, user.passwordHash, user.passwordSalt) : false;

  if (!user || !valid || !user.roles.includes('super_admin') || user.status !== 'active') {
    await logActivity({
      actor: null,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'auth',
      details: `Rejected Super Admin sign-in attempt for ${email}.`,
    });
    return res.status(401).json({ error: 'Invalid Super Admin credentials.' });
  }

  const { maskedEmail } = await issueOtp({
    email,
    purpose: 'admin_login',
    recipientName: user.name,
    purposeText: 'Super Admin verification',
    subject: 'BONFILS STORE - Super Admin Verification Code',
    payload: { userId: user.id },
    maxAttempts: config.adminOtpMaxAttempts,
    isAdmin: true,
  });

  await logActivity({
    actor: user,
    action: 'ADMIN_OTP_SENT',
    targetType: 'auth',
    details: `Super Admin verification code sent to ${maskedEmail}.`,
  });

  res.json({
    success: true,
    requireOtp: true,
    email,
    maskedEmail,
    message: `A 6-digit Super Admin code was sent to ${maskedEmail}.`,
  });
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const store = getStore();
  const result = await consumeOtp({ req, email, code, purpose: 'admin_login' });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const user = await store.findUserByEmail(email);
  if (!user || !user.roles.includes('super_admin') || user.status !== 'active') {
    return res.status(403).json({ error: 'This account is not authorised for administration.' });
  }

  // Admin sessions are single audience and short lived. A normal app session
  // can never be used to reach the admin API.
  await store.deleteAdminSessionsForUser(user.id);
  const token = await createSession(user.id, 'admin', config.adminSessionTtlMs);

  await logActivity({
    actor: user,
    action: 'ADMIN_LOGIN_SUCCESS',
    targetType: 'auth',
    details: 'Super Admin signed in with a verified email code.',
  });

  res.json({ success: true, message: 'Super Admin verified.', user: publicUser(user), token });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    await getStore().deleteSession(header.slice(7).trim());
  }
  res.json({ success: true, message: 'Admin session closed.' });
}));

router.get('/session', requireAdmin, asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user!) });
}));

// -------------------------------------------------------------------- stats
router.get('/stats', requireAdmin, asyncHandler(async (_req, res) => {
  const store = getStore();
  const [users, businesses, categories, products, orders, chinaRequests, shipments] = await Promise.all([
    store.listUsers(),
    store.listBusinesses(),
    store.listCategories(true),
    store.listAllProducts(),
    store.listOrders({}),
    store.listChinaRequests({}),
    store.listShippingOrders(),
  ]);

  const validOrders = orders.filter(order => order.status !== 'cancelled');
  const revenue = validOrders.reduce((sum, order) => sum + order.total, 0);
  const paidRevenue = validOrders
    .filter(order => order.paymentStatus === 'paid')
    .reduce((sum, order) => sum + order.total, 0);

  const monthlyMap = new Map<string, { revenue: number; orders: number }>();
  for (const order of validOrders) {
    const key = new Date(order.createdAt).toISOString().slice(0, 7);
    const entry = monthlyMap.get(key) || { revenue: 0, orders: 0 };
    entry.revenue += order.total;
    entry.orders += 1;
    monthlyMap.set(key, entry);
  }

  const categoryMap = new Map<string, number>();
  for (const product of products) {
    categoryMap.set(product.category, (categoryMap.get(product.category) || 0) + 1);
  }

  const activeChinaStatuses = new Set([
    'REQUEST_RECEIVED', 'UNDER_REVIEW', 'CONTACTING_CUSTOMER', 'PRODUCT_SEARCHING', 'SUPPLIER_FOUND',
    'PRICE_NEGOTIATION', 'CUSTOMER_CONFIRMATION', 'PAYMENT_PENDING', 'PURCHASED', 'SHIPPING', 'IN_TRANSIT', 'ARRIVED',
  ]);

  const stats: AdminStats = {
    totalUsers: users.length,
    totalCustomers: users.filter(user => user.roles.includes('customer')).length,
    totalSellers: users.filter(user => user.roles.includes('seller')).length,
    totalStaff: users.filter(user => user.roles.includes('staff')).length,
    totalSuperAdmins: users.filter(user => user.roles.includes('super_admin')).length,
    totalBusinesses: businesses.length,
    totalProducts: products.length,
    activeProducts: products.filter(product => product.isActive).length,
    featuredProducts: products.filter(product => product.isFeatured).length,
    outOfStockProducts: products.filter(product => product.stock === 0).length,
    totalCategories: categories.length,
    totalOrders: orders.length,
    totalRevenue: Number(revenue.toFixed(2)),
    pendingOrders: orders.filter(order => ['pending', 'processing', 'partially_shipped'].includes(order.status)).length,
    chinaRequestsCount: chinaRequests.length,
    activeChinaRequests: chinaRequests.filter(request => activeChinaStatuses.has(request.status)).length,
    activeShipments: shipments.filter(shipment => shipment.status !== 'delivered').length,
    paidRevenue: Number(paidRevenue.toFixed(2)),
    pendingPaymentOrders: orders.filter(order => order.paymentStatus === 'pending').length,
    lowStockProducts: products.filter(product => product.stock > 0 && product.stock <= 5).length,
    latestOrders: orders.slice(0, 8),
    topProducts: [...products].sort((a, b) => b.salesCount - a.salesCount).slice(0, 8),
    monthlyRevenue: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({ month, revenue: Number(value.revenue.toFixed(2)), orders: value.orders })),
    categoryBreakdown: Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };

  res.json({ stats });
}));

// --------------------------------------------------------------------- users
router.get('/users', requireAdmin, asyncHandler(async (_req, res) => {
  const users = await getStore().listUsers();
  res.json({ users: users.map(publicUser) });
}));

router.post('/users', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');
  if (!EMAIL_REGEX.test(email) || !name || password.length < 12) {
    return res.status(400).json({ error: 'Name, a valid email and a password of at least 12 characters are required.' });
  }
  if (await store.findUserByEmail(email)) {
    return res.status(400).json({ error: 'A user with that email already exists.' });
  }

  const roles: UserRecord['roles'] = (Array.isArray(req.body?.roles) && req.body.roles.length
    ? req.body.roles
    : ['customer']) as UserRecord['roles'];
  if (roles.includes('super_admin') && !req.user!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Only a Super Admin can create another Super Admin.' });
  }

  const { hash, salt } = await hashPassword(password);
  const user = await store.createUser({
    id: newId('USR'),
    name,
    email,
    phone: String(req.body?.phone || ''),
    country: String(req.body?.country || 'Rwanda'),
    city: String(req.body?.city || 'Kigali'),
    roles,
    accountType: roles.includes('seller') ? 'seller' : 'customer',
    isVerified: true,
    status: 'active',
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  });

  await logActivity({
    actor: req.user!,
    action: 'USER_CREATED',
    targetType: 'user',
    targetId: user.id,
    details: `Created ${roles.join('/')} account ${user.email}.`,
  });
  res.json({ success: true, user: publicUser(user) });
}));

router.put('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const target = await store.findUserById(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const patch: Partial<UserRecord> = {};
  for (const field of ['name', 'phone', 'country', 'city'] as const) {
    if (req.body?.[field] !== undefined) patch[field] = String(req.body[field]);
  }
  if (req.body?.status !== undefined) {
    if (!['active', 'disabled'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Status must be active or disabled.' });
    }
    patch.status = req.body.status;
  }
  if (req.body?.roles !== undefined) {
    const roles = req.body.roles as UserRecord['roles'];
    const removingSelf = target.id === req.user!.id && !roles.includes('super_admin');
    if (removingSelf) {
      return res.status(400).json({ error: 'You cannot remove your own Super Admin role.' });
    }
    patch.roles = roles;
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long.' });
    }
    const { hash, salt } = await hashPassword(String(req.body.password));
    patch.passwordHash = hash;
    patch.passwordSalt = salt;
  }

  const updated = await store.updateUser(target.id, patch);
  if (patch.passwordHash) {
    await store.deleteSessionsForUser(target.id);
  }
  await logActivity({
    actor: req.user!,
    action: 'USER_UPDATED',
    targetType: 'user',
    targetId: target.id,
    details: `Updated account ${target.email}: ${Object.keys(patch).join(', ')}.`,
  });
  res.json({ success: true, user: publicUser(updated!) });
}));

router.delete('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const target = await getStore().findUserById(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (target.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Another Super Admin must demote this account before it can be deleted.' });
  }
  await getStore().deleteUser(target.id);
  await logActivity({
    actor: req.user!,
    action: 'USER_DELETED',
    targetType: 'user',
    targetId: target.id,
    details: `Deleted account ${target.email}.`,
  });
  res.json({ success: true, message: 'User deleted.' });
}));

// ---------------------------------------------------------------- businesses
router.get('/businesses', requireAdmin, asyncHandler(async (_req, res) => {
  const store = getStore();
  const [businesses, products, orders] = await Promise.all([
    store.listBusinesses(),
    store.listAllProducts(),
    store.listOrders({}),
  ]);
  res.json({
    businesses: businesses.map(business => ({
      ...business,
      totalProducts: products.filter(product => product.businessId === business.id).length,
      totalOrders: orders.filter(order => order.items.some(item => item.businessId === business.id)).length,
    })),
  });
}));

router.put('/businesses/:id', requireAdmin, asyncHandler(async (req, res) => {
  const patch: Record<string, unknown> = {};
  for (const field of ['name', 'description', 'phone', 'email', 'city', 'country', 'shippingTerms', 'status'] as const) {
    if (req.body?.[field] !== undefined) patch[field] = String(req.body[field]);
  }
  if (req.body?.isVerified !== undefined) patch.isVerified = Boolean(req.body.isVerified);
  if (req.body?.type !== undefined && ['official', 'external'].includes(req.body.type)) patch.type = req.body.type;

  const updated = await getStore().updateBusiness(req.params.id, patch as never);
  if (!updated) {
    return res.status(404).json({ error: 'Business not found.' });
  }
  await logActivity({
    actor: req.user!,
    action: 'BUSINESS_UPDATED',
    targetType: 'seller',
    targetId: updated.id,
    details: `Updated shop ${updated.name}: ${Object.keys(patch).join(', ')}.`,
  });
  res.json({ success: true, business: updated });
}));

// ----------------------------------------------------------------- products
router.get('/products', requireAdmin, asyncHandler(async (req, res) => {
  const result = await getStore().listProducts({
    page: Math.max(1, toNumber(req.query.page, 1)),
    pageSize: Math.min(100, Math.max(1, toNumber(req.query.pageSize, 24))),
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    includeInactive: true,
  });
  res.json(result);
}));

router.post('/products', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const title = String(req.body?.title || '').trim();
  const price = toNumber(req.body?.price, 0);
  if (!title || price <= 0) {
    return res.status(400).json({ error: 'A title and a price greater than zero are required.' });
  }

  const businessId = String(req.body?.businessId || 'BIZ-001');
  const business = await store.findBusiness(businessId);
  if (!business) {
    return res.status(400).json({ error: 'Select an existing store for this product.' });
  }

  const categoryName = String(req.body?.category || '').trim();
  if (categoryName && !(await store.findCategoryByName(categoryName))) {
    return res.status(400).json({ error: 'Choose an existing category (create it first under Categories).' });
  }

  const now = new Date().toISOString();
  const product: Product = {
    id: newId('PRD'),
    businessId: business.id,
    sellerName: business.name,
    isOfficial: business.type === 'official',
    title,
    description: String(req.body?.description || '').trim(),
    category: categoryName || await resolveCategoryName(''),
    brand: String(req.body?.brand || '').trim(),
    price,
    originalPrice: req.body?.originalPrice ? toNumber(req.body.originalPrice, price) : undefined,
    stock: Math.max(0, Math.floor(toNumber(req.body?.stock, 0))),
    images: Array.isArray(req.body?.images)
      ? req.body.images.filter((image: unknown): image is string => typeof image === 'string').slice(0, 8)
      : [],
    rating: 5,
    reviewsCount: 0,
    salesCount: 0,
    shippingOrigin: String(req.body?.shippingOrigin || 'Kigali Local Warehouse'),
    shippingTimeDays: String(req.body?.shippingTimeDays || '1 - 2 Days'),
    specifications: (req.body?.specifications || {}) as Product['specifications'],
    isFeatured: Boolean(req.body?.isFeatured),
    isActive: req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
    createdAt: now,
    updatedAt: now,
  };
  const created = await store.createProduct(product);
  await logActivity({
    actor: req.user!,
    action: 'PRODUCT_CREATED',
    targetType: 'product',
    targetId: created.id,
    details: `Admin created "${created.title}" in ${created.category}.`,
  });
  res.json({ success: true, product: created });
}));

router.put('/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const existing = await store.findProduct(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const patch: Partial<Product> = {};
  const fields = [
    'title', 'description', 'category', 'brand', 'shippingOrigin', 'shippingTimeDays',
  ] as const;
  for (const field of fields) {
    if (req.body?.[field] !== undefined) (patch as any)[field] = String(req.body[field]);
  }
  if (patch.category && !(await store.findCategoryByName(patch.category))) {
    return res.status(400).json({ error: 'Choose an existing category (create it first under Categories).' });
  }
  if (req.body?.price !== undefined) {
    const price = toNumber(req.body.price, 0);
    if (price <= 0) return res.status(400).json({ error: 'Price must be greater than zero.' });
    patch.price = price;
  }
  if (req.body?.originalPrice !== undefined) {
    patch.originalPrice = req.body.originalPrice === null || req.body.originalPrice === ''
      ? undefined
      : toNumber(req.body.originalPrice, existing.price);
  }
  if (req.body?.stock !== undefined) patch.stock = Math.max(0, Math.floor(toNumber(req.body.stock, 0)));
  if (req.body?.images !== undefined && Array.isArray(req.body.images)) {
    patch.images = req.body.images.filter((image: unknown): image is string => typeof image === 'string').slice(0, 8);
  }
  if (req.body?.specifications !== undefined) patch.specifications = req.body.specifications;
  if (req.body?.isFeatured !== undefined) patch.isFeatured = Boolean(req.body.isFeatured);
  if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
  if (req.body?.businessId !== undefined) {
    const business = await store.findBusiness(String(req.body.businessId));
    if (!business) return res.status(400).json({ error: 'Unknown store.' });
    patch.businessId = business.id;
    patch.sellerName = business.name;
    patch.isOfficial = business.type === 'official';
  }

  const updated = await store.updateProduct(existing.id, patch);
  await logActivity({
    actor: req.user!,
    action: 'PRODUCT_UPDATED',
    targetType: 'product',
    targetId: existing.id,
    details: `Updated "${updated?.title || existing.title}": ${Object.keys(patch).join(', ')}.`,
  });
  res.json({ success: true, product: updated });
}));

router.delete('/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const existing = await store.findProduct(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  await store.deleteProduct(existing.id);
  await logActivity({
    actor: req.user!,
    action: 'PRODUCT_DELETED',
    targetType: 'product',
    targetId: existing.id,
    details: `Deleted product "${existing.title}".`,
  });
  res.json({ success: true, message: 'Product deleted.' });
}));

// --------------------------------------------------------------- categories
router.get('/categories', requireAdmin, asyncHandler(async (_req, res) => {
  const store = getStore();
  const [categories, counts] = await Promise.all([store.listCategories(true), store.countProductsByCategory()]);
  res.json({
    categories: categories.map(category => ({ ...category, count: counts[category.name] || 0 })),
  });
}));

router.post('/categories', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  if (await store.findCategoryByName(name)) {
    return res.status(400).json({ error: 'That category already exists.' });
  }

  const created = await store.createCategory({
    id: newId('CAT'),
    name,
    slug: slugify(name),
    image: req.body?.image ? String(req.body.image) : undefined,
    description: String(req.body?.description || '').trim(),
    sortOrder: Math.max(0, Math.floor(toNumber(req.body?.sortOrder, 100))),
    isActive: req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
    createdAt: new Date().toISOString(),
  });
  await logActivity({
    actor: req.user!,
    action: 'CATEGORY_CREATED',
    targetType: 'category',
    targetId: created.id,
    details: `Category "${created.name}" created.`,
  });
  res.json({ success: true, category: created });
}));

router.put('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const patch: Record<string, unknown> = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    const existing = await store.findCategoryByName(name);
    if (existing && existing.id !== req.params.id) {
      return res.status(400).json({ error: 'Another category already uses that name.' });
    }
    patch.name = name;
    patch.slug = slugify(name);
  }
  if (req.body?.description !== undefined) patch.description = String(req.body.description);
  if (req.body?.image !== undefined) patch.image = String(req.body.image);
  if (req.body?.sortOrder !== undefined) patch.sortOrder = Math.max(0, Math.floor(toNumber(req.body.sortOrder, 0)));
  if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);

  const updated = await store.updateCategory(req.params.id, patch as never);
  if (!updated) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  await logActivity({
    actor: req.user!,
    action: 'CATEGORY_UPDATED',
    targetType: 'category',
    targetId: updated.id,
    details: `Category "${updated.name}" updated: ${Object.keys(patch).join(', ')}.`,
  });
  res.json({ success: true, category: updated });
}));

router.delete('/categories/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const categories = await store.listCategories(true);
  const category = categories.find(item => item.id === req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  const counts = await store.countProductsByCategory();
  if ((counts[category.name] || 0) > 0) {
    return res.status(400).json({ error: `Move or delete the ${counts[category.name]} product(s) in this category first.` });
  }
  await store.deleteCategory(category.id);
  await logActivity({
    actor: req.user!,
    action: 'CATEGORY_DELETED',
    targetType: 'category',
    targetId: category.id,
    details: `Category "${category.name}" deleted.`,
  });
  res.json({ success: true, message: 'Category deleted.' });
}));

// -------------------------------------------------------------------- orders
router.get('/orders', requireAdmin, asyncHandler(async (req, res) => {
  const orders = await getStore().listOrders({
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
  });
  res.json({ orders });
}));

router.patch('/orders/:id', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const order = await store.findOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  const statuses = ['pending', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled'] as const;
  const patch: Record<string, unknown> = {};
  if (req.body?.status !== undefined) {
    if (!statuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Unknown order status.' });
    }
    patch.status = req.body.status;
  }
  if (req.body?.paymentStatus !== undefined) {
    if (!['paid', 'pending'].includes(req.body.paymentStatus)) {
      return res.status(400).json({ error: 'Unknown payment status.' });
    }
    patch.paymentStatus = req.body.paymentStatus;
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  const updated = await store.updateOrder(order.id, patch as never);
  if (patch.paymentStatus === 'paid' || patch.status === 'delivered') {
    await pushNotification({
      userId: order.customerId,
      title: `Order ${order.orderNumber} update`,
      message: `Your order is now ${String(patch.status || order.status).replace(/_/g, ' ')}.`,
      type: 'order',
    });
  }
  await logActivity({
    actor: req.user!,
    action: 'ORDER_UPDATED',
    targetType: 'order',
    targetId: order.id,
    details: `Order ${order.orderNumber} updated: ${Object.keys(patch).join(', ')}.`,
  });
  res.json({ success: true, order: updated });
}));

// ------------------------------------------------------- china requests admin
router.get('/china-requests', requireAdmin, asyncHandler(async (req, res) => {
  const requests = await getStore().listChinaRequests({
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
  });
  res.json({ requests });
}));

router.patch('/china-requests/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const store = getStore();
  const request = await store.findChinaRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }
  const staffId = String(req.body?.staffId || '');
  const staff = staffId ? await store.findUserById(staffId) : null;
  if (staffId && !staff) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }
  const updated = await store.updateChinaRequest(request.id, {
    assignedStaffId: staff?.id,
    assignedStaffName: staff?.name,
    status: 'UNDER_REVIEW',
    statusHistory: [
      ...request.statusHistory,
      {
        status: 'UNDER_REVIEW',
        note: staff ? `Assigned to ${staff.name}.` : 'Unassigned.',
        updatedBy: req.user!.name,
        timestamp: new Date().toISOString(),
      },
    ],
  });
  await logActivity({
    actor: req.user!,
    action: 'CHINA_REQUEST_ASSIGNED',
    targetType: 'china_request',
    targetId: request.id,
    details: `${request.requestNumber} assigned to ${staff?.name || 'nobody'}.`,
  });
  res.json({ success: true, request: updated });
}));

// ----------------------------------------------------------------- operations
router.get('/activity-logs', requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, toNumber(req.query.limit, 60)));
  const logs = await getStore().listActivityLogs(limit);
  res.json({ logs });
}));

router.get('/emails', requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, toNumber(req.query.limit, 40)));
  const emails = await getStore().listEmails(limit);
  res.json({
    emails: emails.map(email => ({
      id: email.id,
      to: email.to,
      subject: email.subject,
      purpose: email.purpose,
      status: email.status,
      sentAt: email.sentAt,
    })),
    deliveryConfigured: Boolean(config.resendApiKey),
  });
}));

router.post('/uploads', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { dataUrl, filename, folder } = req.body || {};
    if (typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'A base64 data URL is required.' });
    }
    const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl.trim());
    if (!match) {
      return res.status(400).json({ error: 'Unsupported image payload.' });
    }
    const result = await uploadImage({
      data: Buffer.from(match[2], 'base64'),
      mime: match[1],
      filename: typeof filename === 'string' && filename ? filename : 'image.png',
      folder: typeof folder === 'string' && folder ? folder : 'products',
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof UploadError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}));

export default router;
