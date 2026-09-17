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
  return windowHasNegation(text, idx);
}

/** Checks the 20 characters immediately preceding a keyword occurrence for a
 * negation word. Any negation phrase ending at the keyword is fully contained
 * in this window, since all phrases here are far shorter than 20 chars. */
export function windowHasNegation(text: string, keywordIdx: number): boolean {
  const windowStart = Math.max(0, keywordIdx - 20);
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text.slice(windowStart, keywordIdx)));
}
