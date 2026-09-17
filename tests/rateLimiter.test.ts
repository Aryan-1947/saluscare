import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  rateLimitResponse,
  type RateLimitRule,
} from "../supabase/functions/_shared/rateLimiter.ts";

// Stub of the supabase client: checkRateLimit only calls .rpc().
type RpcCall = { fn: string; args: Record<string, unknown> };

function makeSupabaseStub(options: { resolveWith?: unknown; rejectWith?: Error } = {}) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (options.rejectWith) throw options.rejectWith;
      return { data: options.resolveWith, error: null };
    },
  };
  return { client: client as any, calls };
}

const RULE: RateLimitRule = { endpoint: "session-message", limit: 20, windowSeconds: 300 };

const USER = "auth0|123";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Silence fail-open error logs in the throw tests.
    // (console.error is restored by vitest's spy handling if needed.)
  });

  it("allows when the SQL function returns allowed=true", async () => {
    const { client, calls } = makeSupabaseStub({ resolveWith: [{ allowed: true, used: 3 }] });
    const result = await checkRateLimit(client, USER, RULE);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(3);
    expect(calls[0].fn).toBe("check_rate_limit");
    expect(calls[0].args).toEqual({
      p_user_id: USER,
      p_endpoint: "session-message",
      p_limit: 20,
      p_window_seconds: 300,
    });
  });

  it("blocks with retryAfter when the SQL function returns allowed=false", async () => {
    const { client } = makeSupabaseStub({ resolveWith: [{ allowed: false, used: 20 }] });
    const result = await checkRateLimit(client, USER, RULE);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds!).toBeLessThanOrEqual(60);
  });

  it("handles a scalar (non-array) rpc result", async () => {
    const { client } = makeSupabaseStub({ resolveWith: { allowed: true, used: 1 } });
    const result = await checkRateLimit(client, USER, RULE);
    expect(result.allowed).toBe(true);
  });

  it("fails OPEN when the rpc call throws (limiter outage must not take triage down)", async () => {
    const { client } = makeSupabaseStub({ rejectWith: new Error("db down") });
    const result = await checkRateLimit(client, USER, RULE);
    expect(result.allowed).toBe(true);
  });

  it("fails OPEN when the rpc returns an error object", async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: "function missing" } }),
    };
    const result = await checkRateLimit(client as any, USER, RULE);
    expect(result.allowed).toBe(true);
  });

  it("treats a null rpc result as blocked (defensive: unknown state)", async () => {
    // data: null with no error means the function returned nothing unexpected —
    // row?.allowed === true is false, so this blocks with the limit values.
    const { client } = makeSupabaseStub({ resolveWith: null });
    const result = await checkRateLimit(client, USER, RULE);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60); // capped by RETRY_CAP_SECONDS
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After header and JSON body", async () => {
    const res = rateLimitResponse(
      { allowed: false, retryAfterSeconds: 45, limit: 20 },
      { "Access-Control-Allow-Origin": "http://localhost:5173" }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
  });
});
