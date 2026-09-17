import type { FollowupsResponse, HistoryResponse } from "@/types/api";

const BASE_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

async function callFunction<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const { method = "POST", body, query } = options;

  let url = `${BASE_URL}/${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Downscale an image file client-side before upload.
 *
 * Motivation: a modern phone photo is 3–12 MB; base64-encoded that's ~4–16 MB
 * of JSON, which overflows the Supabase Edge Function request body limit and
 * gets every large upload rejected with a cryptic 500.
 *
 * Strategy: draw the image into a canvas at a bounded max edge (default
 * 1568px — sufficient detail for rashes, wounds and other visual symptoms)
 * and re-encode as JPEG at quality 0.82. Re-encoding any input (including
 * PNG/WebP) as JPEG typically shrinks a photo by 5–20x; the output rarely
 * exceeds ~400 KB.
 *
 * EXIF orientation: createImageBitmap respects it via the `imageOrientation`
 * option where supported; the legacy <img> fallback relies on the browser's
 * default orientation handling. Either way pixels land upright on the canvas.
 *
 * Returns the original file untouched if it's already small enough, can't be
 * decoded, or the canvas path is unavailable — upload failures then fall
 * through to existing error handling.
 */
export async function prepareImageForUpload(
  file: File,
  maxEdge = 1568,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  const SMALL_ENOUGH = 300 * 1024; // bytes — below this, send as-is

  if (file.size <= SMALL_ENOUGH) {
    return { base64: await fileToBase64(file), mimeType: file.type || "image/jpeg" };
  }

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) throw new Error("canvas 2d unavailable");
    ctx2d.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (!base64) throw new Error("canvas encode failed");

    return { base64, mimeType: "image/jpeg" };
  } catch {
    // Canvas/bitmap path failed — degrade gracefully to the original bytes.
    return { base64: await fileToBase64(file), mimeType: file.type || "image/jpeg" };
  }
}

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      // fall through to <img>
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image decode failed"));
      img.src = objectUrl;
    });
  } finally {
    // The bitmap/img keeps decoding independently of the URL lifetime.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}

export const api = {
  sessionStart: (token: string) =>
    callFunction<{ sessionId: string; greeting: string }>("session-start", token),

  sessionMessage: (token: string, text: string, sessionId: string, skipClarification?: boolean) =>
    callFunction("session-message", token, { body: { text, sessionId, skipClarification } }),

  sessionImage: (
    token: string,
    imageBase64: string,
    imageMimeType: string,
    text: string | undefined,
    sessionId: string
  ) =>
    callFunction("session-image", token, {
      body: { imageBase64, imageMimeType, text, sessionId },
    }),

  sessionFollowup: (
    token: string,
    text: string,
    parentSessionId: string,
    newSessionId: string,
    recentExchanges?: { question: string; answer: string }[]
  ) =>
    callFunction("session-followup", token, {
      body: { text, parentSessionId, newSessionId, recentExchanges },
    }),

  sessionHistory: (token: string, sessionId: string) =>
    callFunction<HistoryResponse>("session-history", token, { method: "GET", query: { sessionId } }),

  sessionFollowups: (token: string, limit?: number) =>
    callFunction<FollowupsResponse>("session-followups", token, {
      method: "GET",
      query: limit ? { limit: String(limit) } : undefined,
    }),
};