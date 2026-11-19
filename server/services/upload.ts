import { put } from '@vercel/blob';
import { config } from '../config.js';
import { isProductStorageConfigured, PRODUCT_IMAGES_BUCKET, productStorageClient } from './supabaseServer.js';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

export class UploadError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'UploadError';
  }
}

export function assertSupportedImage(mime: string, size: number): void {
  if (!ALLOWED_MIME.has(mime)) {
    throw new UploadError(`Unsupported image type: ${mime}. Allowed: ${[...ALLOWED_MIME].join(', ')}`);
  }
  if (size > config.maxUploadBytes) {
    throw new UploadError(`Image is larger than ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB.`, 413);
  }
}

function safeName(original: string): string {
  const base = original.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase();
  return base.slice(-60) || 'image';
}

/**
 * Returns a durable image URL without touching the local filesystem.
 * Prefers configured object storage (Vercel Blob / Supabase Storage) and
 * otherwise returns the provided base64 data URL directly so uploads keep
 * working on read-only/serverless environments without a database.
 */
export async function uploadImage(params: {
  data: Buffer;
  mime: string;
  filename: string;
  folder?: string;
  dataUrl?: string;
}): Promise<{ url: string; storage: 'blob' | 'supabase' | 'data-url' }> {
  assertSupportedImage(params.mime, params.data.byteLength);
  const objectName = `${Date.now()}-${safeName(params.filename)}`;

  if (config.blobToken) {
    try {
      const result = await put(`${params.folder || 'products'}/${objectName}`, params.data, {
        access: 'public',
        token: config.blobToken,
        contentType: params.mime,
        addRandomSuffix: true,
      });
      return { url: result.url, storage: 'blob' };
    } catch (error) {
      console.error('[upload] Vercel Blob upload failed, trying next storage option', error);
    }
  }

  if (isProductStorageConfigured()) {
    try {
      const path = `${params.folder || 'products'}/${objectName}`;
      const client = productStorageClient();
      const { error } = await client.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, params.data, { contentType: params.mime, upsert: true });
      if (error) throw new Error(error.message);
      const { data: publicUrl } = client.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
      return { url: publicUrl.publicUrl, storage: 'supabase' };
    } catch (error) {
      console.error('[upload] Supabase Storage upload failed, falling back to data URL', error);
    }
  }

  const url = params.dataUrl || `data:${params.mime};base64,${params.data.toString('base64')}`;
  return { url, storage: 'data-url' };
}

export function readDataUrl(dataUrl: string): { data: Buffer; mime: string } {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!match) throw new UploadError('Expected a base64 data URL (data:image/png;base64,...).');
  return { mime: match[1], data: Buffer.from(match[2], 'base64') };
}
