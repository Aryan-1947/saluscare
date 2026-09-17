import type { DiscriminatorResult } from "./chestPain.js";
import { isNegated } from "./negationUtils.js";

export function feverDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const mentionsFever = text.includes("fever") && !isNegated(text, "fever");
  const explicitlyExtracted = extractedSymptoms.includes("fever");

  if (!mentionsFever && !explicitlyExtracted) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  const highFever = text.includes("high fever") || text.includes("104") || text.includes("40°");
  const stiffNeck = text.includes("stiff neck");
  const withRash = text.includes("rash") && !isNegated(text, "rash");

  if (highFever && (stiffNeck || withRash)) {
    return { matched: true, presentingComplaint: "high fever with concerning signs", suggestedTier: 3 };
  }

  if (highFever) {
    return { matched: true, presentingComplaint: "high fever", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "mild fever", suggestedTier: 1 };
}