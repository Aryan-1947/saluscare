import type { ExtractedSymptoms, TriageResult } from "./types.ts";
import {
  chestPainDiscriminator,
  breathingDifficultyDiscriminator,
  feverDiscriminator,
  rashDiscriminator,
  woundDiscriminator,
  abdominalPainDiscriminator,
  coughDiscriminator,
  headacheDiscriminator,
  neckDiscriminator,
} from "./discriminators.ts";
import { scoreConfidence } from "./confidenceScorer.ts";

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
    coughDiscriminator(extracted.rawText, extracted.symptoms),
    headacheDiscriminator(extracted.rawText, extracted.symptoms),
    neckDiscriminator(extracted.rawText, extracted.symptoms),
  ];

  const matched = discriminators.filter((d) => d.matched);
  const highestTier = matched.length > 0 ? (Math.max(...matched.map((d) => d.suggestedTier)) as 1 | 2 | 3) : 1;

  // Discriminators still fully control the numeric tier (urgency escalation) — that stays deterministic and unchanged.
  // But the DISPLAYED complaint name always comes from the LLM's own contextual understanding, never from a
  // discriminator's crude keyword match — this prevents cases like a burn being mislabeled "minor cut" just
  // because it shared a keyword with the wound discriminator's trigger list.
  const presentingComplaint = extracted.presentingComplaint;

  let tier = matched.length > 0 ? highestTier : extracted.severity === "severe" ? 2 : 1;

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