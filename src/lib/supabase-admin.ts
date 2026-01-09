import { createClient } from "@supabase/supabase-js";

let cachedAdmin:
  | ReturnType<typeof createClient>
  | null = null;

export function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are missing.");
  }

  cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedAdmin;
}

export async function uploadImage(
  bucket: string,
  path: string,
  file: ArrayBuffer | Buffer,
  contentType = "image/jpeg",
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  return data;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: ArrayBuffer | Buffer,
  contentType: string,
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  return data;
}

export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSec = 3600,
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(bucket: string, path: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw error;
}
