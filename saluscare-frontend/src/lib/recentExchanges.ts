export type Exchange = { question: string; answer: string };

export type ExchangeTurn =
  | { role: "user"; kind: "text"; content: string }
  | { role: "user"; kind: "image"; content: string; caption?: string }
  | { role: "assistant"; kind: "question"; content: string }
  | { role: "assistant"; kind: "answer"; content: string }
  | { role: "assistant"; kind: "result"; content: unknown };

/**
 * Extract the most recent assistant-`answer` turns paired with the user text
 * turn immediately before each, scanning newest-first.
 *
 * Mirrors what both chat pages need when calling the follow-up endpoint: the
 * backend's general-question agent uses these exchanges for conversational
 * continuity ("can I still eat that?"). Image turns and result cards never
 * participate as questions, and dangling answers without a preceding user
 * text turn are skipped.
 */
export function buildRecentExchanges(turns: ExchangeTurn[], max = 3): Exchange[] {
  const exchanges: Exchange[] = [];
  for (let i = turns.length - 1; i >= 0 && exchanges.length < max; i--) {
    const turn = turns[i];
    if (!(turn.role === "assistant" && turn.kind === "answer")) continue;
    const prev = turns[i - 1];
    if (prev?.role === "user" && prev.kind === "text") {
      exchanges.unshift({ question: prev.content, answer: turn.content });
    }
  }
  return exchanges;
}
