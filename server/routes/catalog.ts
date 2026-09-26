import { Router } from 'express';
import { config } from '../config';
import { getStore } from '../db';
import { readDataUrl, uploadImage, UploadError } from '../services/upload';
import { asyncHandler, toNumber } from './helpers';

const router = Router();

const SORTS = new Set(['price_asc', 'price_desc', 'popular', 'rating', 'newest']);

function parseProductQuery(query: Record<string, unknown>) {
  return {
    search: typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined,
    category: typeof query.category === 'string' && query.category && query.category !== 'All' ? query.category : undefined,
    sellerId: typeof query.seller === 'string' && query.seller ? query.seller : undefined,
    brand: typeof query.brand === 'string' && query.brand ? query.brand : undefined,
    minPrice: query.minPrice !== undefined && query.minPrice !== '' ? toNumber(query.minPrice, 0) : undefined,
    maxPrice: query.maxPrice !== undefined && query.maxPrice !== '' ? toNumber(query.maxPrice, 0) : undefined,
    sort: SORTS.has(String(query.sort)) ? String(query.sort) : undefined,
    page: Math.max(1, toNumber(query.page, 1)),
    pageSize: Math.min(48, Math.max(1, toNumber(query.pageSize, 12))),
    featuredOnly: query.featured === 'true' || query.featured === '1',
  };
}

router.get('/products', asyncHandler(async (req, res) => {
  const store = getStore();
  const result = await store.listProducts(parseProductQuery(req.query as Record<string, unknown>));
  res.json(result);
}));

router.get('/products/featured', asyncHandler(async (_req, res) => {
  const result = await getStore().listProducts({ featuredOnly: true, pageSize: 12, sort: 'popular' });
  res.json({ products: result.products, total: result.total });
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  const store = getStore();
  const product = await store.findProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  if (!product.isActive && !req.user?.roles.includes('super_admin')) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const business = product.businessId ? await store.findBusiness(product.businessId) : undefined;
  const related = await store.listProducts({ category: product.category, pageSize: 8 });
  res.json({
    product,
    business: business || undefined,
    related: related.products.filter(item => item.id !== product.id).slice(0, 6),
  });
}));

router.get('/categories', asyncHandler(async (_req, res) => {
  const store = getStore();
  const categories = await store.listCategories(false);
  const counts = await store.countProductsByCategory();
  res.json({
    categories: categories.map(category => ({
      ...category,
      count: counts[category.name] || 0,
    })),
  });
}));

router.get('/categories/:slug', asyncHandler(async (req, res) => {
  const store = getStore();
  const slug = String(req.params.slug).toLowerCase();
  const categories = await store.listCategories(false);
  const category = categories.find(item => item.slug.toLowerCase() === slug || item.name.toLowerCase() === slug);
  if (!category) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  const result = await store.listProducts({ category: category.name, pageSize: 48 });
  res.json({ category, products: result.products, total: result.total });
}));

router.get('/sellers', asyncHandler(async (_req, res) => {
  const store = getStore();
  const businesses = await store.listBusinesses();
  const counts = await store.countProductsByCategory();
  const products = await store.listAllProducts();
  res.json({
    businesses: businesses.map(business => ({
      ...business,
      totalProducts: products.filter(product => product.businessId === business.id).length,
    })),
    categoryCount: Object.keys(counts).length,
  });
}));

router.get('/sellers/:id', asyncHandler(async (req, res) => {
  const store = getStore();
  const business = await store.findBusiness(req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Shop not found.' });
  }
  const result = await store.listProducts({ sellerId: business.id, pageSize: 48 });
  res.json({ business, products: result.products, total: result.total });
}));

router.get('/brands', asyncHandler(async (_req, res) => {
  const products = await getStore().listAllProducts();
  const brands = Array.from(new Set(products.map(product => product.brand).filter(Boolean))).sort();
  res.json({ brands });
}));

router.get('/media/:file', asyncHandler(async (req, res) => {
  const id = String(req.params.file).split('.')[0];
  const media = await getStore().findMedia(id);
  if (!media) {
    return res.status(404).json({ error: 'Image not found.' });
  }
  res.setHeader('Content-Type', media.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(media.data, 'base64'));
}));

router.post('/uploads', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Sign in to upload images.' });
  }
  const isAdmin = req.user.roles.includes('super_admin') || req.user.roles.includes('seller');
  if (!isAdmin) {
    return res.status(403).json({ error: 'You do not have permission to upload images.' });
  }

  try {
    const { dataUrl, filename, folder } = req.body || {};
    if (typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'A base64 data URL is required.' });
    }
    const { data, mime } = readDataUrl(dataUrl);
    const result = await uploadImage({
      data,
      mime,
      filename: typeof filename === 'string' && filename ? filename : 'image.png',
      folder: typeof folder === 'string' && folder ? folder : 'products',
    });
    res.json({ success: true, url: result.url, storage: result.storage, maxBytes: config.maxUploadBytes });
  } catch (error) {
    if (error instanceof UploadError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}));

router.get('/health', asyncHandler(async (_req, res) => {
  const store = getStore();
  res.json({
    success: true,
    status: 'ok',
    storage: store.kind,
    emailDelivery: Boolean(config.resendApiKey),
    blobStorage: Boolean(config.blobToken),
    timestamp: new Date().toISOString(),
  });
}));

export default router;
