import type { TriageResult } from "../types/index.js";
import { chestPainDiscriminator } from "./discriminators/chestPain.js";
import { breathingDifficultyDiscriminator } from "./discriminators/breathingDifficulty.js";
import { feverDiscriminator } from "./discriminators/fever.js";
import { rashDiscriminator } from "./discriminators/rash.js";
import { woundDiscriminator } from "./discriminators/wound.js";
import { abdominalPainDiscriminator } from "./discriminators/abdominalPain.js";
import { scoreConfidence } from "./confidenceScorer.js";
import type { ExtractedSymptoms } from "../agents/intakeAgent.js";

export function runTriageEngine(
  extracted: ExtractedSymptoms,
  hasImage: boolean,
  imageQualityGood: boolean
): TriageResult {
  const discriminators = [
    chestPainDiscriminator(extracted.rawText, extracted.symptoms),
    breathingDifficultyDiscriminator(extracted.rawText, extracted.symptoms),
    feverDiscriminator(extracted.rawText, extracted.symptoms),
    rashDiscriminator(extracted.rawText, extracted.symptoms),
    woundDiscriminator(extracted.rawText, extracted.symptoms),
    abdominalPainDiscriminator(extracted.rawText, extracted.symptoms),
  ];

  const matched = discriminators.filter((d) => d.matched);

  const highestTier = matched.length > 0
    ? (Math.max(...matched.map((d) => d.suggestedTier)) as 1 | 2 | 3)
    : 1;

  // Fallback: no discriminator matched (e.g. sore throat, headache-only, etc.)
  // Use the LLM-extracted complaint as-is, default to Tier 1 unless severity says otherwise.
  const presentingComplaint =
    matched.length > 0
      ? matched.find((d) => d.suggestedTier === highestTier)?.presentingComplaint ?? extracted.presentingComplaint
      : extracted.presentingComplaint;

  let tier = matched.length > 0 ? highestTier : (extracted.severity === "severe" ? 2 : 1);

  const confidence = scoreConfidence({
    hasStructuredText: extracted.symptoms.length > 0,
    hasImage,
    imageQualityGood,
    matchedDiscriminatorCount: matched.length,
    ambiguousSymptomLanguage: extracted.severity === "unknown",
  });

  if (confidence < 50) {
    tier = Math.min(3, tier + 1) as 1 | 2 | 3;
  }

  return {
    tier,
    confidence,
    matchedDiscriminators: matched.map((d) => d.presentingComplaint),
    presentingComplaint,
  };
}