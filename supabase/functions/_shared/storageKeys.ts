// ---------------------------------------------------------------------------
// Storage key sanitization for Supabase Storage.
//
// Auth0 subject ids look like "auth0|123..." or "google-oauth2|10966..." —
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
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const key = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  return map[key] ?? "jpg";
}

/** Build the full storage path for a symptom image. */
export function buildImagePath(userId: string, sessionId: string, mimeType: string | undefined | null): string {
  return `${storageSafeId(userId)}/${assertUuid(sessionId)}/${crypto.randomUUID()}.${safeImageExtension(mimeType)}`;
}
