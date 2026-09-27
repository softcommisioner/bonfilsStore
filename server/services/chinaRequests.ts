import { randomUUID } from 'node:crypto';
import { callerScopedClient, SUPABASE_BUCKET, SupabaseNotConfiguredError } from './supabaseServer.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * China sourcing requests, persisted in Supabase.
 *
 * Every function here takes the CALLER's access token and builds a client that
 * forwards it. Authorisation is done by the database (migrations 0016-0018),
 * not by filtering in this file. If a `where` clause is missing below, the
 * request simply returns fewer rows than it should -- it does not return rows
 * the caller may not see.
 */

export const CHINA_REQUEST_STATUSES = [
  'REQUEST_RECEIVED',
  'UNDER_REVIEW',
  'CONTACTING_CUSTOMER',
  'PRODUCT_SEARCHING',
  'SUPPLIER_FOUND',
  'PRICE_NEGOTIATION',
  'CUSTOMER_CONFIRMATION',
  'PAYMENT_PENDING',
  'PURCHASED',
  'SHIPPING',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type ChinaRequestStatus = (typeof CHINA_REQUEST_STATUSES)[number];

export interface CreateChinaRequestInput {
  productName: string;
  description: string;
  quantity: number;
  /** Free text from the form, stored as jsonb `{ raw: "..." }`. See 0015. */
  specifications?: string;
  budget?: number | null;
  productUrl?: string | null;
  customerName: string;
  customerEmail: string;
  contactPhone: string;
  shippingPreference?: string | null;
  additionalNotes?: string | null;
}

export interface ChinaRequestRow {
  id: string;
  request_number: string;
  customer_id: string | null;
  product_name: string;
  description: string;
  quantity: number;
  specifications: unknown;
  budget: number | null;
  product_url: string | null;
  contact_phone: string | null;
  shipping_preference: string | null;
  status: ChinaRequestStatus;
  assigned_staff_id: string | null;
  quotation_amount: number | null;
  customer_name: string | null;
  customer_email: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChinaRequestImageRow {
  id: string;
  request_id: string;
  storage_path: string;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avf';
    default:
      return 'bin';
  }
}

/**
 * Resolves the caller's profile id.
 *
 * RLS compares `customer_id` against profiles.id via profiles.auth_user_id, so
 * the caller must send a PROFILE id here, not an auth user id. Confusing the
 * two produces a request that inserts fine but is then invisible to its owner
 * -- no error, just an empty list. The RPC is SECURITY DEFINER and returns null
 * rather than raising when the profile is missing.
 */
async function resolveProfileId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.rpc('current_profile_id');
  if (error) throw new Error(`current_profile_id failed: ${error.message}`);
  if (!data) {
    throw new Error(
      'No profile is linked to the signed-in account. Backfill profiles.auth_user_id ' +
        'from auth.users (see 0014) before creating requests.',
    );
  }
  return data as string;
}

export async function createChinaRequest(
  accessToken: string,
  input: CreateChinaRequestInput,
): Promise<ChinaRequestRow> {
  const db = callerScopedClient(accessToken);
  const customerId = await resolveProfileId(db);

  const { data, error } = await db
    .from('china_requests')
    .insert({
      customer_id: customerId,
      product_name: input.productName,
      description: input.description,
      quantity: input.quantity,
      specifications: input.specifications ? { raw: input.specifications } : {},
      budget: input.budget ?? null,
      product_url: input.productUrl ?? null,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      contact_phone: input.contactPhone,
      shipping_preference: input.shippingPreference ?? null,
      additional_notes: input.additionalNotes ?? null,
      // status and request_number are deliberately omitted:
      //   request_number -> assigned by the 0015 trigger
      //   status         -> column default REQUEST_RECEIVED
      // Sending them from here would let a client pre-seed a status.
    })
    .select()
    .single();

  if (error) throw new Error(`Insert china_requests failed: ${error.message}`);
  return data as ChinaRequestRow;
}

export async function listMyChinaRequests(accessToken: string): Promise<ChinaRequestRow[]> {
  const db = callerScopedClient(accessToken);
  const { data, error } = await db
    .from('china_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`List china_requests failed: ${error.message}`);
  return (data ?? []) as ChinaRequestRow[];
}

export async function getChinaRequest(
  accessToken: string,
  id: string,
): Promise<ChinaRequestRow | null> {
  const db = callerScopedClient(accessToken);
  const { data, error } = await db
    .from('china_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Get china_request failed: ${error.message}`);
  return (data as ChinaRequestRow) ?? null;
}

export interface UploadResult {
  image: ChinaRequestImageRow;
  signedUrl: string;
}

/**
 * Uploads one image for a request.
 *
 * The storage path is generated HERE and never accepted from the caller. The
 * path's first segment is the profile id, and the 0018 storage policies
 * authorise from that segment alone -- so a client-chosen path would let a
 * caller write into, or read from, another customer's folder. Treat the path
 * as a security boundary.
 */
export async function uploadChinaRequestImage(
  accessToken: string,
  requestId: string,
  file: { buffer: Buffer; mimeType: string; size: number; fileName?: string },
): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(file.mimeType)) {
    throw new Error(
      `Unsupported image type "${file.mimeType}". Allowed: ${[...ALLOWED_MIME].join(', ')}.`,
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds the 8 MiB limit (${file.size} bytes).`);
  }

  const db = callerScopedClient(accessToken);
  const profileId = await resolveProfileId(db);

  // Prove the caller may attach to this request before writing any bytes.
  const request = await getChinaRequest(accessToken, requestId);
  if (!request) throw new Error('Request not found, or not visible to this account.');
  if (request.customer_id !== profileId) {
    throw new Error('Only the customer who submitted a request can add images to it.');
  }

  const objectPath = `${profileId}/${requestId}/${randomUUID()}.${extensionFor(file.mimeType)}`;

  const { error: uploadError } = await db.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, file.buffer, { contentType: file.mimeType, upsert: false });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { count } = await db
    .from('china_request_images')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId);
  const sortOrder = count ?? 0;

  const { data, error } = await db
    .from('china_request_images')
    .insert({
      request_id: requestId,
      storage_path: objectPath,
      storage_bucket: SUPABASE_BUCKET,
      file_name: file.fileName ?? null,
      mime_type: file.mimeType,
      size_bytes: file.size,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) {
    // The object is already in the bucket with no row pointing at it.
    // Removing it here avoids a storage leak that nothing will ever collect.
    await db.storage.from(SUPABASE_BUCKET).remove([objectPath]);
    throw new Error(`Insert china_request_images failed: ${error.message}`);
  }

  const { data: signed, error: signError } = await db.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(objectPath, 3600);
  if (signError) throw new Error(`Signed URL failed: ${signError.message}`);

  return { image: data as ChinaRequestImageRow, signedUrl: signed.signedUrl };
}

/**
 * Signed URLs for a request's images.
 *
 * Signed rather than public: the bucket is private (0018), and these expire in
 * an hour. Storing a signed URL in public_url would be a bug -- it would look
 * like a permanent link and stop working an hour later.
 */
export async function listChinaRequestImages(
  accessToken: string,
  requestId: string,
): Promise<Array<ChinaRequestImageRow & { signedUrl: string | null }>> {
  const db = callerScopedClient(accessToken);

  const { data, error } = await db
    .from('china_request_images')
    .select('*')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`List china_request_images failed: ${error.message}`);

  const rows = (data ?? []) as ChinaRequestImageRow[];
  if (rows.length === 0) return [];

  const { data: signed, error: signError } = await db.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  if (signError) throw new Error(`Signed URLs failed: ${signError.message}`);

  return rows.map((row, i) => ({
    ...row,
    signedUrl: signed?.[i]?.signedUrl ?? null,
  }));
}

export { SupabaseNotConfiguredError };
