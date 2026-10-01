import { describe, it, expect, vi } from "vitest";
import { isTransientJsonError, withJsonRetry } from "../supabase/functions/_shared/jsonRetry.ts";

describe("isTransientJsonError", () => {
  it("recognizes Groq json_validate_failed errors", () => {
    const err = new Error(
      '400 {"error":{"code":"json_validate_failed","message":"Failed to generate JSON."}}'
    );
    expect(isTransientJsonError(err)).toBe(true);
  });

  it("recognizes plain Failed to generate JSON errors", () => {
    expect(isTransientJsonError(new Error("Failed to generate JSON. Please adjust your prompt."))).toBe(true);
  });

  it("rejects non-transient errors", () => {
    expect(isTransientJsonError(new Error("rate_limit_exceeded"))).toBe(false);
    expect(isTransientJsonError(new Error("fetch failed"))).toBe(false);
    expect(isTransientJsonError("json_validate_failed")).toBe(true); // stringified errors too
  });
});

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("withJsonRetry", () => {
  it("returns the parsed result on first success without retrying", async () => {
    const call = vi.fn(async () => completion('{"a":1}'));
    const result = await withJsonRetry(call, (raw) => JSON.parse(raw), () => ({ a: 0 }));
    expect(result).toEqual({ a: 1 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries once on a transient JSON error and then succeeds", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error('400 {"code":"json_validate_failed"}'))
      .mockResolvedValueOnce(completion('{"ok":true}'));
    const result = await withJsonRetry(call, (raw) => JSON.parse(raw), () => ({ ok: false }));
    expect(result).toEqual({ ok: true });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("propagates non-transient errors immediately without retrying", async () => {
    const call = vi.fn().mockRejectedValue(new Error("rate_limit_exceeded"));
    await expect(withJsonRetry(call, (raw) => JSON.parse(raw), () => ({}))).rejects.toThrow(
      "rate_limit_exceeded"
    );
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("falls back to empty-shape defaults when the retry is still unparseable", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to generate JSON."))
      .mockResolvedValueOnce(completion("not json at all {"));
    const result = await withJsonRetry(call, (raw) => JSON.parse(raw), () => ({ defaulted: true }));
    expect(result).toEqual({ defaulted: true });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("propagates a non-transient error thrown by the retry itself", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error("json_validate_failed"))
      .mockRejectedValueOnce(new Error("service unavailable"));
    await expect(withJsonRetry(call, (raw) => JSON.parse(raw), () => ({}))).rejects.toThrow(
      "service unavailable"
    );
    expect(call).toHaveBeenCalledTimes(2);
  });
});
