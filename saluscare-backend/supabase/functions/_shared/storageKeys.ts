// ---------------------------------------------------------------------------
// Storage key sanitization for Supabase Storage.
//
// Auth0 subject ids look like "auth0|123..." or "google-oauth2|10966..." -
// the pipe is fine for DB text columns, but it is NOT a valid Supabase
// Storage object key character ("Invalid key" on upload). Every storage
// path component must go through storageSafeId().
// ---------------------------------------------------------------------------

/** Only lowercase alphanumerics and dashes survive sanitization. */
export function storageSafeId(raw: string): string {
  const safe = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return safe || "unknown-user";
}

/** A session id must be a UUID (clients generate them with crypto.randomUUID). */
export function assertUuid(value: string, label = "sessionId"): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${label}: must be a UUID`);
  }
  return value.toLowerCase();
}

/** Whitelisted image extensions; anything else falls back to "jpg". */
export function safeImageExtension(mimeType: string | undefined | null): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const key = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  return map[key] ?? "jpg";
}

/**
 * Mime types the vision model can actually read. The frontend file picker and
 * client-side downscaler are advisory only, so the server re-checks every
 * upload against this allowlist before storing or analyzing it.
 */
export const IMAGE_MIME_ALLOWLIST = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Hard ceiling on the DECODED image payload. The client normally sends
 * ~<=400 KB after downscaling (see frontend prepareImageForUpload), so
 * anything above 6 MB is abnormal and risks the edge function body limit.
 */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Validate a client-declared image upload before it reaches storage or the
 * vision model. Throws with a user-facing message when rejected.
 */
export function assertUploadableImage(mimeType: string | undefined | null, sizeBytes: number): void {
  const key = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (!IMAGE_MIME_ALLOWLIST.includes(key as (typeof IMAGE_MIME_ALLOWLIST)[number])) {
    throw new Error("Unsupported image type. Please upload a JPEG, PNG or WebP image.");
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Image payload is empty.");
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Please upload an image under 6 MB.");
  }
}

/** Build the full storage path for a symptom image. */
export function buildImagePath(userId: string, sessionId: string, mimeType: string | undefined | null): string {
  return `${storageSafeId(userId)}/${assertUuid(sessionId)}/${crypto.randomUUID()}.${safeImageExtension(mimeType)}`;
}
