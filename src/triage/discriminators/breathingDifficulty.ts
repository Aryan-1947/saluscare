import type { DiscriminatorResult } from "./chestPain.js";
import { isNegated } from "./negationUtils.js";

export function breathingDifficultyDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const mentionsBreathing =
    (text.includes("breath") && !isNegated(text, "breath")) ||
    extractedSymptoms.includes("breathing_difficulty");

  if (!mentionsBreathing) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  const severe =
    text.includes("cannot breathe") || text.includes("can't breathe") || text.includes("gasping");
  const wheezing = text.includes("wheez");

  if (severe) {
    return { matched: true, presentingComplaint: "severe breathing difficulty", suggestedTier: 3 };
  }

  if (wheezing) {
    return { matched: true, presentingComplaint: "breathing difficulty with wheezing", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "mild breathing difficulty", suggestedTier: 2 };
}