import { afterEach, describe, expect, it } from "vitest";
import {
  corsHeadersFor,
  isOriginAllowed,
  normalizeOrigin,
  preflightResponse,
  resetCorsConfig,
} from "../supabase/functions/_shared/cors.ts";

function setAllowedOrigins(value: string | undefined) {
  (globalThis as any).Deno = {
    env: { get: (name: string) => (name === "ALLOWED_ORIGINS" ? value : undefined) },
  };
}

afterEach(() => {
  resetCorsConfig();
  setAllowedOrigins(undefined);
  delete (globalThis as any).Deno;
});

describe("normalizeOrigin", () => {
  it("lower-cases and strips trailing slashes and whitespace", () => {
    expect(normalizeOrigin("HTTPS://Example.com/")).toBe("https://example.com");
    expect(normalizeOrigin("  http://localhost:5173 ")).toBe("http://localhost:5173");
  });
});

describe("corsHeadersFor", () => {
  it("allows a configured origin (echoed back exactly)", () => {
    setAllowedOrigins("https://app.saluscare.com");
    resetCorsConfig();
    const h = corsHeadersFor("https://app.saluscare.com");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://app.saluscare.com");
  });

  it("allows localhost dev origins without configuration", () => {
    setAllowedOrigins(undefined);
    resetCorsConfig();
    expect(corsHeadersFor("http://localhost:5173")["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173"
    );
    expect(corsHeadersFor("http://127.0.0.1:3000")["Access-Control-Allow-Origin"]).toBe(
      "http://127.0.0.1:3000"
    );
  });

  it("rejects an unlisted origin (no ACAO header)", () => {
    setAllowedOrigins("https://app.saluscare.com");
    resetCorsConfig();
    const h = corsHeadersFor("https://evil.example.com");
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("sends no ACAO header when Origin is absent (non-browser clients unaffected)", () => {
    setAllowedOrigins(undefined);
    resetCorsConfig();
    const h = corsHeadersFor(null);
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Content-Type"]).toBe("application/json");
  });

  it("supports a comma-separated allowlist", () => {
    setAllowedOrigins("https://a.com, https://b.com/");
    resetCorsConfig();
    expect(isOriginAllowed("https://a.com")).toBe(true);
    expect(isOriginAllowed("https://b.com")).toBe(true);
    expect(isOriginAllowed("https://c.com")).toBe(false);
  });

  it("does not match by prefix (origin equality is exact)", () => {
    setAllowedOrigins("https://app.saluscare.com");
    resetCorsConfig();
    expect(isOriginAllowed("https://app.saluscare.com.evil.io")).toBe(false);
    expect(isOriginAllowed("https://evil-saluscare.com")).toBe(false);
  });
});

describe("preflightResponse", () => {
  it("returns 204 with allow-methods and no ACAO for disallowed origin", () => {
    setAllowedOrigins("https://app.saluscare.com");
    resetCorsConfig();
    const req = new Request("https://edge/functions/session-start", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com", "Access-Control-Request-Method": "POST" },
    });
    const res = preflightResponse(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns ACAO for allowed origin", () => {
    setAllowedOrigins(undefined);
    resetCorsConfig();
    const req = new Request("https://edge/functions/session-start", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" },
    });
    const res = preflightResponse(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});
