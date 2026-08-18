import { supabase } from "@/integrations/supabase/client";

/**
 * Given a value stored in DB (which may be either a storage path or a legacy
 * public URL), return the storage object path within the bucket.
 */
export function extractStoragePath(bucket: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.substring(idx + marker.length);
  const marker2 = `/object/sign/${bucket}/`;
  const idx2 = value.indexOf(marker2);
  if (idx2 >= 0) return value.substring(idx2 + marker2.length).split("?")[0];
  // Already a path
  if (!value.startsWith("http")) return value;
  return null;
}

export async function getSignedUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractStoragePath(bucket, value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
