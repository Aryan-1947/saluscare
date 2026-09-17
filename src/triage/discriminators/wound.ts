import type { DiscriminatorResult } from "./chestPain.js";
import { isNegated } from "./negationUtils.js";

export function woundDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const mentionsWound =
    (text.includes("cut") || text.includes("wound") || text.includes("laceration")) &&
    !isNegated(text, "cut") &&
    !isNegated(text, "wound");

  if (!mentionsWound && !extractedSymptoms.includes("wound")) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  const deep = text.includes("deep") || text.includes("bone");
  const bleedingHeavy = text.includes("won't stop bleeding") || text.includes("heavy bleeding");

  if (deep || bleedingHeavy) {
    return { matched: true, presentingComplaint: "deep wound", suggestedTier: 3 };
  }

  const infected = text.includes("pus") || text.includes("infected") || text.includes("red streaks");

  if (infected) {
    return { matched: true, presentingComplaint: "infected wound", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "minor cut", suggestedTier: 1 };
}