import type { DiscriminatorResult } from "./chestPain.js";
import { isNegated } from "./negationUtils.js";

export function abdominalPainDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const mentionsAbdominal =
    (text.includes("stomach") || text.includes("abdominal") || text.includes("belly")) &&
    !isNegated(text, "stomach") &&
    !isNegated(text, "abdominal");

  if (!mentionsAbdominal && !extractedSymptoms.includes("abdominal_pain")) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  const severe = text.includes("severe") || text.includes("rigid") || text.includes("can't move");
  const vomitingBlood = text.includes("vomiting blood") || text.includes("blood in stool");

  if (severe || vomitingBlood) {
    return { matched: true, presentingComplaint: "severe abdominal pain", suggestedTier: 3 };
  }

  const moderate = text.includes("moderate") || text.includes("persistent");

  if (moderate) {
    return { matched: true, presentingComplaint: "abdominal pain", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "mild abdominal discomfort", suggestedTier: 1 };
}