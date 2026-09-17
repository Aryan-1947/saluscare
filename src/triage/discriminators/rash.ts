import type { DiscriminatorResult } from "./chestPain.js";
import { isNegated } from "./negationUtils.js";

export function rashDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const mentionsRash =
    (text.includes("rash") && !isNegated(text, "rash")) || extractedSymptoms.includes("rash");

  if (!mentionsRash) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  const spreading = text.includes("spreading");
  const withFever = text.includes("fever") && !isNegated(text, "fever");
  const painful = text.includes("painful") || text.includes("blistering");

  if (spreading && withFever) {
    return { matched: true, presentingComplaint: "spreading rash with fever", suggestedTier: 3 };
  }

  if (painful || spreading) {
    return { matched: true, presentingComplaint: "concerning rash", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "rash", suggestedTier: 1 };
}