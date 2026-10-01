// Context windowing for follow-up triage.
//
// Each follow-up's context_snapshot accumulates the prior one, so on a long
// assessment chain a bare tail-slice eventually drops the ORIGINAL complaint
// and can cut mid-sentence. Keep the head (original complaint) and the tail
// (most recent symptom state) so both anchors survive; only the middle is
// trimmed. Output is capped at maxChars in all cases.

const SEPARATOR = " ... ";

export function buildTriageContext(fullContext: string, maxChars = 400): string {
  if (fullContext.length <= maxChars) return fullContext;

  // The first sentence approximates the original complaint ("itching on my
  // neck. from last few hours. ..."). With no sentence boundary at all, fall
  // back to the old plain tail-slice.
  const firstSentenceEnd = fullContext.indexOf(". ");
  if (firstSentenceEnd <= 0) return fullContext.slice(-maxChars);

  const head = fullContext.slice(0, firstSentenceEnd).slice(0, maxChars);
  const tailBudget = Math.max(maxChars - head.length - SEPARATOR.length, 0);
  if (tailBudget === 0) return head;
  return `${head}${SEPARATOR}${fullContext.slice(-tailBudget)}`;
}
