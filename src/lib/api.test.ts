import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

// The api module reads BASE_URL from import.meta.env at module load; the
// fetch layer below is exercised via global fetch stubbing.
const TOKEN = "test-token";

type FetchCall = { url: string; init: RequestInit };

type HeadersLike = Record<string, string>;

function stubFetch(status: number, body: unknown): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      init,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function authHeader(init: RequestInit): string {
  const headers = init.headers as HeadersLike;
  return headers.Authorization;
}

describe("api client", () => {
  it("sends bearer auth and posts a JSON body to session-message", async () => {
    const { calls, restore } = stubFetch(200, { sessionId: "s1", tier: 1 });
    try {
      await api.sessionMessage(TOKEN, "headache for two days", "s1", true);
      const call = calls[0];
      expect(call.url).toContain("/session-message");
      expect(call.init.method).toBe("POST");
      expect(authHeader(call.init)).toBe(`Bearer ${TOKEN}`);
      expect(JSON.parse(String(call.init.body))).toEqual({
        text: "headache for two days",
        sessionId: "s1",
        skipClarification: true,
      });
    } finally {
      restore();
    }
  });

  it("sessionHistory uses GET with a sessionId query param", async () => {
    const { calls, restore } = stubFetch(200, { groupId: "g1", turns: [] });
    try {
      await api.sessionHistory(TOKEN, "g1");
      const call = calls[0];
      expect(call.init.method).toBe("GET");
      expect(call.url).toContain("sessionId=g1");
    } finally {
      restore();
    }
  });

  it("throws the server's error message on non-2xx responses", async () => {
    const { restore } = stubFetch(429, { error: "Rate limit exceeded" });
    try {
      await expect(api.sessionStart(TOKEN)).rejects.toThrow("Rate limit exceeded");
    } finally {
      restore();
    }
  });

  it("falls back to the HTTP status when the error body is not JSON", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("not json", { status: 500 })) as unknown as typeof fetch;
    try {
      await expect(api.sessionStart(TOKEN)).rejects.toThrow("Request failed with status 500");
    } finally {
      globalThis.fetch = original;
    }
  });
});
