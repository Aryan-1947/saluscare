import { describe, it, expect } from "vitest";
import { diffSymptomState } from "../supabase/functions/_shared/symptomDiff.ts";
import { scoreConfidence } from "../supabase/functions/_shared/confidenceScorer.ts";
import { runTriageEngine } from "../supabase/functions/_shared/triageEngine.ts";
import type { ExtractedSymptoms } from "../supabase/functions/_shared/types.ts";

describe("diffSymptomState", () => {
  it("returns new_red_flag when a red flag matched", () => {
    expect(diffSymptomState("mild fever", "now I have chest pain", true)).toBe("new_red_flag");
  });

  it("detects worsening language", () => {
    expect(diffSymptomState("rash", "it is spreading and worse", false)).toBe("worsened");
    expect(diffSymptomState("pain", "the pain increased", false)).toBe("worsened");
  });

  it("detects improvement language", () => {
    expect(diffSymptomState("fever", "fever is gone", false)).toBe("improved");
    expect(diffSymptomState("cough", "much better today", false)).toBe("improved");
  });

  it("defaults to unchanged", () => {
    expect(diffSymptomState("fever", "still have it", false)).toBe("unchanged");
  });
});

describe("scoreConfidence", () => {
  it("baseline is 50 without any signals", () => {
    expect(
      scoreConfidence({
        hasStructuredText: false,
        hasImage: false,
        imageQualityGood: false,
        matchedDiscriminatorCount: 0,
        ambiguousSymptomLanguage: false,
      })
    ).toBe(50);
  });

  it("structured text and a good image raise confidence", () => {
    const score = scoreConfidence({
      hasStructuredText: true,
      hasImage: true,
      imageQualityGood: true,
      matchedDiscriminatorCount: 1,
      ambiguousSymptomLanguage: false,
    });
    expect(score).toBe(95);
  });

  it("a bad image lowers confidence", () => {
    const score = scoreConfidence({
      hasStructuredText: true,
      hasImage: true,
      imageQualityGood: false,
      matchedDiscriminatorCount: 0,
      ambiguousSymptomLanguage: false,
    });
    expect(score).toBe(50); // 50 + 15 - 15
  });

  it("ambiguous language subtracts", () => {
    const score = scoreConfidence({
      hasStructuredText: true,
      hasImage: false,
      imageQualityGood: false,
      matchedDiscriminatorCount: 0,
      ambiguousSymptomLanguage: true,
    });
    expect(score).toBe(45);
  });

  it("clamps to the documented [0, 100] range", () => {
    // 50 - 15 (bad image) - 20 (ambiguous) = 15 — within range, unclamped.
    const low = scoreConfidence({
      hasStructuredText: false,
      hasImage: true,
      imageQualityGood: false,
      matchedDiscriminatorCount: 0,
      ambiguousSymptomLanguage: true,
    });
    expect(low).toBe(15);

    // 50 + 15 + 20 + 10*2 (capped at 2) = 100 — exactly at the top.
    const high = scoreConfidence({
      hasStructuredText: true,
      hasImage: true,
      imageQualityGood: true,
      matchedDiscriminatorCount: 5,
      ambiguousSymptomLanguage: false,
    });
    expect(high).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// runTriageEngine — the deterministic tier decision layer.
// ---------------------------------------------------------------------------

function extracted(overrides: Partial<ExtractedSymptoms> = {}): ExtractedSymptoms {
  return {
    symptoms: [],
    presentingComplaint: "fever",
    duration: "2 days",
    severity: "mild",
    category: "general_infection",
    sufficient: true,
    clarifyingQuestion: null,
    isChild: false,
    isElderly: false,
    isPregnant: false,
    rawText: "mild fever since yesterday",
    ...overrides,
  };
}

describe("runTriageEngine", () => {
  it("uses the highest matched discriminator tier", () => {
    const result = runTriageEngine(
      extracted({ rawText: "chest pain and spreading rash with fever" }),
      false,
      false
    );
    expect(result.tier).toBe(3);
    expect(result.matchedDiscriminators.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to tier 1 when nothing matches and severity is mild", () => {
    const result = runTriageEngine(extracted({ rawText: "slightly tired" }), false, false);
    expect(result.tier).toBe(1);
  });

  it("falls back to tier 2 when nothing matches but severity is severe", () => {
    const result = runTriageEngine(
      extracted({ rawText: "something unknown", severity: "severe" }),
      false,
      false
    );
    expect(result.tier).toBe(2);
  });

  it("escalates one tier when confidence is below 50", () => {
    // Ambiguous language (-20) and no structured text: 50-20=30 < 50.
    const result = runTriageEngine(
      extracted({ rawText: "mild fever", severity: "unknown", symptoms: [] }),
      false,
      false
    );
    expect(result.confidence).toBeLessThan(50);
    expect(result.tier).toBe(2); // 1 -> escalated
  });

  it("never escalates past tier 3", () => {
    const result = runTriageEngine(
      extracted({ rawText: "crushing chest pain", severity: "unknown", symptoms: [] }),
      false,
      false
    );
    expect(result.tier).toBe(3);
  });

  it("reports the LLM's presenting complaint, not the keyword label", () => {
    const result = runTriageEngine(
      extracted({
        rawText: "burned my hand",
        presentingComplaint: "thermal burn on hand",
      }),
      false,
      false
    );
    // The wound discriminator matched (burn branch) but the displayed
    // complaint must come from the intake agent's contextual naming.
    expect(result.presentingComplaint).toBe("thermal burn on hand");
  });
});
