import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

export function useSignedUrl(bucket: string, value: string | null | undefined, expiresIn = 3600) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    getSignedUrl(bucket, value, expiresIn).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [bucket, value, expiresIn]);
  return url;
}
