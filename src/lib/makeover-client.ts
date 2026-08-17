import { supabase } from "@/integrations/supabase/client";

export function getDeviceFp(): string {
  try {
    const K = "aia_dfp_v1";
    let v = localStorage.getItem(K);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(K, v);
    }
    return v;
  } catch { return "anon"; }
}

// Client-side image downscale to keep uploads fast on Android.
export async function downscaleImage(file: File, maxDim = 2048, quality = 0.88): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality) as unknown as Blob) ?? file;
}

export async function uploadMakeoverImage(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const path = `makeover/${id}/original.jpg`;
  const { error } = await supabase.storage.from("artworks").upload(path, blob, {
    contentType: "image/jpeg", upsert: false, cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return path;
}

export function saveClaimToken(sessionId: string, claimToken: string) {
  try { localStorage.setItem(`aia_mk_${sessionId}`, claimToken); } catch { /* ignore */ }
}
export function getClaimToken(sessionId: string): string | null {
  try { return localStorage.getItem(`aia_mk_${sessionId}`); } catch { return null; }
}

// Track total free downloads/shares across all makeovers on this device.
const DL_KEY = "aia_mk_downloads_v1";
export const FREE_DOWNLOAD_LIMIT = 3;
export function getDownloadCount(): number {
  try { return parseInt(localStorage.getItem(DL_KEY) ?? "0", 10) || 0; } catch { return 0; }
}
export function incrementDownloadCount(): number {
  const n = getDownloadCount() + 1;
  try { localStorage.setItem(DL_KEY, String(n)); } catch { /* ignore */ }
  return n;
}
