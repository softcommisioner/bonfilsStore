import { put } from '@vercel/blob';
import { config } from '../config';
import { getStore } from '../db';
import { newId } from '../security';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

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
 * Uploads an image to Vercel Blob when BLOB_READ_WRITE_TOKEN is configured and
 * otherwise stores it in the database media table so uploads keep working in
 * every environment. Returns the public URL.
 */
export async function uploadImage(params: {
  data: Buffer;
  mime: string;
  filename: string;
  folder?: string;
}): Promise<{ url: string; storage: 'blob' | 'database' }> {
  assertSupportedImage(params.mime, params.data.byteLength);

  if (config.blobToken) {
    try {
      const result = await put(`${params.folder || 'products'}/${Date.now()}-${safeName(params.filename)}`, params.data, {
        access: 'public',
        token: config.blobToken,
        contentType: params.mime,
        addRandomSuffix: true,
      });
      return { url: result.url, storage: 'blob' };
    } catch (error) {
      console.error('[upload] Vercel Blob upload failed, falling back to database storage', error);
    }
  }

  const id = newId('MED');
  const encoded = params.data.toString('base64');
  await getStore().createMedia({ id, mime: params.mime, data: encoded, createdAt: Date.now() });
  return { url: `/api/media/${id}.${EXTENSION[params.mime] || 'bin'}`, storage: 'database' };
}

export function readDataUrl(dataUrl: string): { data: Buffer; mime: string } {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!match) throw new UploadError('Expected a base64 data URL (data:image/png;base64,...).');
  return { mime: match[1], data: Buffer.from(match[2], 'base64') };
}
