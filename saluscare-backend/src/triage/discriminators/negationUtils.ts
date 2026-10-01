const NEGATION_WORDS = ["no", "not", "none", "without", "denies", "negative for"];

export function isNegated(text: string, keyword: string): boolean {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;

  const windowStart = Math.max(0, idx - 20);
  const preceding = text.slice(windowStart, idx);

  return NEGATION_WORDS.some((neg) => preceding.includes(neg));
}