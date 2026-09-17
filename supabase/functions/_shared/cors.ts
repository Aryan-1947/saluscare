// ---------------------------------------------------------------------------
// Shared CORS handling for all edge functions.
//
// Every function used to reply `Access-Control-Allow-Origin: *`. Since all
// endpoints authenticate with an Auth0 bearer token, a wildcard CORS policy
// hands any website the ability to fire authenticated triage requests (and
// paid Groq calls) from a victim's browser — the browser blocks the *reads*,
// but the writes (and the API spend) still go through.
//
// Rules:
//   - Origins come from the ALLOWED_ORIGINS env secret (comma-separated) plus
//     localhost dev origins, which are always allowed (no mixed-content or
//     token-leak concern for a local listener using loopback).
//   - Non-browser clients (curl, the smoke test) send no Origin header and
//     are unaffected by CORS — they are still subject to auth + rate limits.
//   - With no Origin header, responses carry no ACAO header at all, so
//     browser-based callers are strictly allowlist-gated.
// ---------------------------------------------------------------------------

export type CorsConfig = {
  allowedOrigins: Set<string>;
  allowCredentials: boolean;
};

let cachedConfig: CorsConfig | null = null;

// Deno-guarded so the module can also load under Node (unit tests).
function getEnv(name: string): string | undefined {
  try {
    return (globalThis as any).Deno?.env?.get(name);
  } catch {
    return undefined;
  }
}

function loadConfig(): CorsConfig {
  if (cachedConfig) return cachedConfig;

  const configured = (getEnv("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter((o) => o.length > 0);

  const allowedOrigins = new Set<string>([
    ...configured,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ]);

  cachedConfig = { allowedOrigins, allowCredentials: false };
  return cachedConfig;
}

// Lower-case, strip a single trailing slash. Subpaths are not origins.
export function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/$/, "");
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const config = loadConfig();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json",
  };

  if (origin && config.allowedOrigins.has(normalizeOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = normalizeOrigin(origin);
  }
  // No Origin (non-browser) or disallowed Origin: no ACAO header, so browsers
  // block cross-origin reads while non-browser callers keep working.

  return headers;
}

/** Test hook: clears the cached config so env changes are picked up. */
export function resetCorsConfig(): void {
  cachedConfig = null;
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return loadConfig().allowedOrigins.has(normalizeOrigin(origin));
}

// Standard preflight response for OPTIONS requests.
export function preflightResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(req.headers.get("origin")),
  });
}
