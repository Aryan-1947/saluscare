const NEGATION_WORDS = ["no", "not", "none", "without", "denies", "negative for"];

// Word-boundary matching matters: a naive substring check makes "cannot"
// read as "can" + "no", so "I cannot breathe" was being classified as a
// NEGATION of breathing difficulty — the single most dangerous false negative
// in the system. \b anchors fix "cannot", "another", "notable", etc.
const NEGATION_PATTERNS = NEGATION_WORDS.map(
  (neg) => new RegExp(`\\b${neg}\\b`)
);

export function isNegated(text: string, keyword: string): boolean {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  const windowStart = Math.max(0, idx - 20);
  const preceding = text.slice(windowStart, idx);
  return NEGATION_PATTERNS.some((pattern) => pattern.test(preceding));
}
