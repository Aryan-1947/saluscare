export type ChangeType = "improved" | "unchanged" | "worsened" | "new_red_flag";

export function diffSymptomState(
  priorText: string,
  followUpText: string,
  newRedFlagMatched: boolean
): ChangeType {
  const t = followUpText.toLowerCase();

  if (newRedFlagMatched) return "new_red_flag";

  const worseWords = ["worse", "worsen", "worsened", "increased", "spreading", "more painful", "new symptom"];
  const betterWords = ["better", "improved", "improving", "gone", "resolved", "reduced"];

  const isWorse = worseWords.some((w) => t.includes(w));
  const isBetter = betterWords.some((w) => t.includes(w));

  if (isWorse) return "worsened";
  if (isBetter) return "improved";
  return "unchanged";
}