import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  // Intentionally do not throw in build; routes can guard at runtime
  console.warn('[supabase-admin] Missing SUPABASE url or service role key');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function uploadImage(
  bucket: string,
  path: string,
  file: ArrayBuffer | Buffer,
  contentType = 'image/jpeg'
) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return data;
}

export function publicUrl(bucket: string, path: string) {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

