import { useCallback, useEffect, useState } from 'react';
import type { Product } from '../types';

/**
 * Imagery resolution for the storefront.
 *
 * The API is the single source of truth: a product's photos arrive in
 * `images[]` (written by the admin/seller upload endpoints, which store the
 * file on Vercel Blob or the media table and persist the public URL). Some
 * upstream feeds expose a single `image` / `imageUrl` string instead, so those
 * aliases are accepted too.
 *
 * The resolver builds an ordered candidate list and returns the next entry on
 * every load error, so a dead or blocked URL can never strand a card on a
 * broken image. The last candidate is a neutral tile - never the old category
 * line illustration, which made every seeded product look like a placeholder.
 */

const RENAMED_LEGACY_ASSETS: Record<string, string> = {
  'product_cctv_camera_1790334796559.jpg': '/images/products/cctv-camera.jpg',
  'product_industrial_generator_1790334833001.jpg': '/images/products/power-generator.jpg',
  'product_smart_drone_1790334810567.jpg': '/images/products/smart-drone.jpg',
  'hero_logistics_marketplace_1790334780179.jpg': '/images/products/logistics-freight.jpg',
};

/** Loose shape so we can read the single-image aliases off any API payload. */
export type ProductImageSource = Partial<
  Pick<Product, 'images' | 'title' | 'category'> & { image?: string; imageUrl?: string; thumbnail?: string }
>;

function normalizeImageUrl(raw: unknown): string | null {
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

/** Every image URL the API gave us, in order, de-duplicated. */
export function productImageUrls(product: ProductImageSource | null | undefined): string[] {
  if (!product) return [];
  const raw: unknown[] = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
    product.imageUrl,
    product.thumbnail,
  ];
  const urls: string[] = [];
  for (const entry of raw) {
    const url = normalizeImageUrl(entry);
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

/**
 * Ordered list of image URLs to try, ending in a neutral placeholder. Consumers
 * advance through the list with `advanceProductImage()` on every load error.
 */
export function productImageCandidates(product: ProductImageSource | null | undefined): string[] {
  return [...productImageUrls(product), neutralPlaceholder()];
}

/** Resolves a usable image URL, transparently repairing legacy src/ asset paths. */
export function resolveProductImage(
  product: ProductImageSource | null | undefined,
  index = 0,
): string {
  const candidates = productImageCandidates(product);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Returns the next URL to try, or null when every candidate has failed. */
export function nextProductImage(
  product: ProductImageSource | null | undefined,
  index: number,
): string | null {
  const candidates = productImageCandidates(product);
  return index + 1 < candidates.length ? candidates[index + 1] : null;
}

/**
 * Reusable broken-image cascade. Returns the URL to render plus an `onError`
 * handler to attach to the <img>, so every card behaves identically instead of
 * each view re-implementing the walk.
 */
export function useProductImage(product: ProductImageSource | null | undefined) {
  const [index, setIndex] = useState(0);

  // Keyed on the resolved URL list rather than the raw array, so a parent that
  // rebuilds `images` on every render cannot reset the cascade mid-walk.
  const candidates = productImageCandidates(product);
  const key = candidates.join('|');

  useEffect(() => {
    setIndex(0);
  }, [key]);

  const src = candidates[Math.min(index, candidates.length - 1)];

  const onError = useCallback(() => {
    setIndex(current => (current + 1 < candidates.length ? current + 1 : current));
  }, [candidates.length]);

  return { src, onError, candidates };
}

/**
 * Last-resort tile. Deliberately plain - a soft neutral field with a short
 * caption - so an image-less product reads as "no photo yet" instead of
 * masquerading as marketplace artwork.
 */
export function neutralPlaceholder(label?: string): string {
  const text = (label || 'No image').slice(0, 22).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#F5F5F4"/>
    <g fill="none" stroke="#D6D3D1" stroke-width="10" stroke-linejoin="round">
      <rect x="168" y="204" width="264" height="192" rx="18"/>
      <path d="M168 336l70-62 52 44 40-32 102 88"/>
    </g>
    <circle cx="330" cy="272" r="22" fill="#E7E5E4"/>
    <text x="300" y="452" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#A8A29E">${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
