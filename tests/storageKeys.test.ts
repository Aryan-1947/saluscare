import { describe, expect, it } from "vitest";
import {
  storageSafeId,
  assertUuid,
  safeImageExtension,
  buildImagePath,
} from "../supabase/functions/_shared/storageKeys.ts";

describe("storageSafeId", () => {
  it("sanitizes the pipe in Auth0 google subs (the production bug)", () => {
    const out = storageSafeId("google-oauth2|109663469011315511395");
    expect(out).toBe("google-oauth2-109663469011315511395");
    expect(out).not.toContain("|");
  });

  it("sanitizes the pipe in auth0 subs", () => {
    expect(storageSafeId("auth0|6aabc3fc16eadce708d1064b")).toBe("auth0-6aabc3fc16eadce708d1064b");
  });

  it("leaves already-safe ids unchanged (M2M client subs)", () => {
    expect(storageSafeId("client@clients")).toBe("client-clients"); // @ is not storage-safe either
    expect(storageSafeId("user-abc-123")).toBe("user-abc-123");
  });

  it("collapses consecutive invalid characters into one dash", () => {
    expect(storageSafeId("a||b---c")).toBe("a-b-c");
  });

  it("trims leading/trailing dashes and handles empty input", () => {
    expect(storageSafeId("||id||")).toBe("id");
    expect(storageSafeId("")).toBe("unknown-user");
    expect(storageSafeId("///")).toBe("unknown-user");
  });
});

describe("assertUuid", () => {
  it("accepts and lowercases a valid UUID", () => {
    expect(assertUuid("8CA87C97-B601-46E4-8E98-95CFF2CBD014")).toBe(
      "8ca87c97-b601-46e4-8e98-95cff2cbd014"
    );
  });

  it("rejects non-UUIDs", () => {
    expect(() => assertUuid("../../etc/passwd")).toThrow(/Invalid sessionId/);
    expect(() => assertUuid("not-a-uuid")).toThrow(/Invalid sessionId/);
    expect(() => assertUuid("")).toThrow(/Invalid sessionId/);
  });
});

describe("safeImageExtension", () => {
  it("maps known mime types", () => {
    expect(safeImageExtension("image/jpeg")).toBe("jpg");
    expect(safeImageExtension("image/png")).toBe("png");
    expect(safeImageExtension("image/webp")).toBe("webp");
    expect(safeImageExtension("image/heic")).toBe("heic");
  });

  it("falls back to jpg for unknown or missing types", () => {
    expect(safeImageExtension("application/json")).toBe("jpg");
    expect(safeImageExtension(undefined)).toBe("jpg");
    expect(safeImageExtension("")).toBe("jpg");
  });

  it("strips mime parameters", () => {
    expect(safeImageExtension("image/png; charset=utf-8")).toBe("png");
  });
});

describe("buildImagePath", () => {
  it("builds a fully sanitized path from a google-oauth2 sub", () => {
    const path = buildImagePath(
      "google-oauth2|109663469011315511395",
      "8CA87C97-B601-46E4-8E98-95CFF2CBD014",
      "image/jpeg"
    );
    const parts = path.split("/");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("google-oauth2-109663469011315511395");
    expect(parts[1]).toBe("8ca87c97-b601-46e4-8e98-95cff2cbd014");
    expect(parts[2]).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    // No character that Supabase Storage rejects.
    expect(path).toMatch(/^[a-z0-9_\-/.]+$/);
  });

  it("rejects a non-UUID session id", () => {
    expect(() => buildImagePath("auth0|123", "garbage", "image/png")).toThrow(/Invalid sessionId/);
  });
});
