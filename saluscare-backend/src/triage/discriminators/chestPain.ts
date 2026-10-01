import { isNegated } from "./negationUtils.js";

export type DiscriminatorResult = {
  matched: boolean;
  presentingComplaint: string;
  suggestedTier: 1 | 2 | 3;
};

export function chestPainDiscriminator(
  symptomText: string,
  extractedSymptoms: string[]
): DiscriminatorResult {
  const text = symptomText.toLowerCase();
  const hasCrushing = text.includes("crushing") || text.includes("pressure");
  const hasRadiating = text.includes("arm") || text.includes("jaw") || text.includes("shoulder");
  const hasSweating = text.includes("sweating") || text.includes("sweat");

  const mentionsChestPain =
    (text.includes("chest pain") && !isNegated(text, "chest pain")) ||
    extractedSymptoms.includes("chest_pain");

  if (!mentionsChestPain) {
    return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  }

  if (hasCrushing || (hasRadiating && hasSweating)) {
    return { matched: true, presentingComplaint: "chest pain (severe)", suggestedTier: 3 };
  }

  if (hasRadiating || hasSweating) {
    return { matched: true, presentingComplaint: "chest pain", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "mild chest discomfort", suggestedTier: 2 };
}