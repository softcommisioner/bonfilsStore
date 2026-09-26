import type { Product } from '../types';

const CATEGORY_IMAGE_SLUG: Record<string, string> = {
  'Laptops & Computers': 'laptops-computers',
  'CCTV & Security': 'cctv-security',
  'Motorcycles & Accessories': 'motorcycles-accessories',
  'Beauty & Cosmetics': 'beauty-cosmetics',
  Electronics: 'electronics',
  'Phones & Tablets': 'phones-tablets',
  'Smart Home & IoT': 'smart-home-iot',
  Networking: 'networking',
  'Solar & Electrical': 'solar-electrical',
  'Home & Kitchen': 'home-kitchen',
  Fashion: 'fashion',
  'Tools & Hardware': 'tools-hardware',
};

export function categorySlug(category: string): string {
  return CATEGORY_IMAGE_SLUG[category] || category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function categoryImage(category?: string): string {
  if (!category) return inlinePlaceholder('BONFILS STORE');
  return `/images/categories/${categorySlug(category)}.svg`;
}

function inlinePlaceholder(label: string): string {
  const text = (label || 'BONFILS').slice(0, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#FFF7ED"/>
    <rect x="140" y="200" width="320" height="200" rx="24" fill="none" stroke="#FF6A00" stroke-width="8"/>
    <circle cx="300" cy="276" r="34" fill="none" stroke="#FF6A00" stroke-width="8"/>
    <path d="M200 372l70-64 46 40 34-28 50 44" fill="none" stroke="#FF6A00" stroke-width="8" stroke-linecap="round"/>
    <text x="300" y="450" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#9A3412">${text.replace(/[<>&"']/g, '')}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function placeholderFor(product?: Pick<Product, 'title' | 'category'> | null): string {
  if (product?.category) return categoryImage(product.category);
  return inlinePlaceholder(product?.title || 'BONFILS STORE');
}

const RENAMED_LEGACY_ASSETS: Record<string, string> = {
  'product_cctv_camera_1790334796559.jpg': '/images/products/cctv-camera.jpg',
  'product_industrial_generator_1790334833001.jpg': '/images/products/power-generator.jpg',
  'product_smart_drone_1790334810567.jpg': '/images/products/smart-drone.jpg',
  'hero_logistics_marketplace_1790334780179.jpg': '/images/products/logistics-freight.jpg',
};

function normalizeImageUrl(
  raw: string | undefined | null,
  product?: Pick<Product, 'title' | 'category'> | null,
): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/src/')) {
    const file = value.split('/').pop() || '';
    return RENAMED_LEGACY_ASSETS[file] || null;
  }
  return value.startsWith('/') ? value : `/${value}`;
}

/**
 * Ordered list of image URLs to try for a product: its own photos first, then
 * the category artwork, then an inline SVG. Consumers walk the list with
 * `nextProductImage()` on every load error, so a missing file can never strand
 * the UI on a broken image.
 */
export function productImageCandidates(
  product: Pick<Product, 'images' | 'title' | 'category'> | null | undefined,
): string[] {
  const candidates: string[] = [];
  for (const raw of product?.images || []) {
    const url = normalizeImageUrl(raw, product);
    if (url) candidates.push(url);
  }
  if (product?.category) candidates.push(categoryImage(product.category));
  candidates.push(inlinePlaceholder(product?.title || product?.category || 'BONFILS STORE'));

  const seen = new Set<string>();
  return candidates.filter(url => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/** Resolves a usable image URL, transparently repairing legacy src/ asset paths. */
export function resolveProductImage(
  product: Pick<Product, 'images' | 'title' | 'category'> | null | undefined,
  index = 0,
): string {
  const candidates = productImageCandidates(product);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Returns the next URL to try, or null when every candidate has failed. */
export function nextProductImage(
  product: Pick<Product, 'images' | 'title' | 'category'> | null | undefined,
  index: number,
): string | null {
  const candidates = productImageCandidates(product);
  return index + 1 < candidates.length ? candidates[index + 1] : null;
}
