import { describe, expect, it } from "vitest";
import { buildTriageContext } from "../supabase/functions/_shared/triageContext.ts";

describe("buildTriageContext", () => {
  it("returns short context unchanged", () => {
    const ctx = "itching on my neck. from last few hours";
    expect(buildTriageContext(ctx)).toBe(ctx);
  });

  it("keeps the original complaint (head) and latest state (tail) when trimming", () => {
    const head = "itching on my neck";
    const filler = Array.from({ length: 40 }, (_, i) => `filler sentence number ${i} with padding text`).join(". ");
    const tail = "rash is spreading and slightly painful today";
    const full = `${head}. ${filler}. ${tail}`;

    const result = buildTriageContext(full);

    expect(result.startsWith(head)).toBe(true);
    expect(result.endsWith(tail)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(400);
    expect(result).toContain(" ... ");
  });

  it("falls back to a plain tail-slice when there is no sentence boundary", () => {
    const full = "a".repeat(1000);
    expect(buildTriageContext(full)).toBe("a".repeat(400));
  });

  it("caps output at maxChars even for a very long first sentence", () => {
    const full = `${"b".repeat(1000)}. more text`;
    expect(buildTriageContext(full).length).toBeLessThanOrEqual(400);
  });

  it("honors a custom maxChars", () => {
    const full = `head. ${"x".repeat(200)}`;
    const result = buildTriageContext(full, 50);
    expect(result.startsWith("head")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("matches the old behavior for chains short enough to fit", () => {
    const ctx = "hey i have itching on my neck. from last few hours. yes a little bit of swelling";
    expect(buildTriageContext(ctx)).toBe(ctx);
  });
});
