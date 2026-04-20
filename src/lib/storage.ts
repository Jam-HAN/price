import { getSupabaseAdmin } from './supabase';

const BUCKET = 'price-uploads';

export async function uploadSheetImage(params: {
  vendorName: string;
  effectiveDate: string;
  bytes: Buffer | Uint8Array;
  contentType: string;
  extension: string;
}): Promise<{ path: string }> {
  const sb = getSupabaseAdmin();
  const safeName = params.vendorName.replace(/[^\p{L}\p{N}_-]/gu, '_');
  const path = `${params.effectiveDate}/${safeName}_${Date.now()}.${params.extension}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, params.bytes, {
    contentType: params.contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path };
}

export async function signedUrl(path: string, ttlSeconds = 3600): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data) throw new Error(error?.message ?? 'createSignedUrl failed');
  return data.signedUrl;
}

export async function downloadSheet(path: string): Promise<Buffer> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? 'download failed');
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}
