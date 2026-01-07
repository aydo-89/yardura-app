import { env } from '@/lib/env';
import { createSignedUrl } from '@/lib/supabase-admin';

export async function resolveStorageUrl(
  value?: string | null,
  expiresInSec = 60 * 60 * 24,
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (!env.STORAGE_BUCKET) return null;
  try {
    return await createSignedUrl(env.STORAGE_BUCKET, value, expiresInSec);
  } catch {
    return null;
  }
}
