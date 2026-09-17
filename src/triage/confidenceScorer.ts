export type ConfidenceInput = {
  hasStructuredText: boolean;
  hasImage: boolean;
  imageQualityGood: boolean;
  matchedDiscriminatorCount: number;
  ambiguousSymptomLanguage: boolean;
};

export function scoreConfidence(input: ConfidenceInput): number {
  let score = 50;

  if (input.hasStructuredText) score += 15;
  if (input.hasImage && input.imageQualityGood) score += 20;
  if (input.hasImage && !input.imageQualityGood) score -= 15;
  if (input.matchedDiscriminatorCount > 0) score += 10 * Math.min(input.matchedDiscriminatorCount, 2);
  if (input.ambiguousSymptomLanguage) score -= 20;

  return Math.max(0, Math.min(100, score));
}