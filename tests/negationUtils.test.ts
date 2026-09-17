import { describe, it, expect } from "vitest";
import { isNegated } from "../supabase/functions/_shared/negationUtils.ts";

describe("isNegated", () => {
  it("detects a simple negation before the keyword", () => {
    expect(isNegated("no chest pain", "chest pain")).toBe(true);
  });

  it("detects clinical negation phrasing", () => {
    expect(isNegated("patient denies chest pain", "chest pain")).toBe(true);
    expect(isNegated("negative for chest pain", "chest pain")).toBe(true);
    expect(isNegated("currently not experiencing chest pain", "chest pain")).toBe(true);
  });

  it("returns false when the keyword is affirmed", () => {
    expect(isNegated("I have severe chest pain", "chest pain")).toBe(false);
    expect(isNegated("chest pain since morning", "chest pain")).toBe(false);
  });

  it("returns false when the keyword is absent", () => {
    expect(isNegated("mild fever", "chest pain")).toBe(false);
  });

  it("only looks at the 20 characters before the keyword", () => {
    // Negation far outside the window -> not negated.
    const far = "x".repeat(30) + " no " + "y".repeat(30) + " chest pain";
    expect(isNegated(far, "chest pain")).toBe(false);

    // Negation inside the window (space-delimited, so \b applies) -> negated.
    const near = "x".repeat(15) + " no " + "y".repeat(5) + " chest pain";
    expect(isNegated(near, "chest pain")).toBe(true);
  });

  it("does not treat words containing 'no' as negation", () => {
    // Regression guard for the cannot/"no" substring bug.
    expect(isNegated("i cannot breathe", "breathe")).toBe(false);
    expect(isNegated("another headache", "headache")).toBe(false);
    expect(isNegated("nothing else matters", "else")).toBe(false);
  });
});
