/**
 * JSON-mode LLM calls fail transiently with Groq's "json_validate_failed" /
 * "Failed to generate JSON" (400) when the model emits malformed JSON once.
 * A single retry fixes the overwhelming majority of these; without it the
 * error escaped as a raw 500 after the user's message was already logged.
 *
 * Pure module (no npm:/Deno specifiers) so it is unit-testable under vitest.
 */

export function isTransientJsonError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("json_validate_failed") || msg.includes("Failed to generate JSON");
}

type CompletionLike = { choices?: { message?: { content?: string } }[] };

/**
 * Runs `call` and parses its JSON content. On a transient JSON-generation
 * error it retries ONCE (with the caller's own retry callback, e.g. bumped
 * temperature). If the retry's content still fails JSON.parse, falls back to
 * `fallbackParse("{}")` so callers apply their existing empty-shape defaults.
 * Non-transient API errors propagate to the caller's error handling.
 */
export async function withJsonRetry<T>(
  call: () => Promise<CompletionLike>,
  parse: (raw: string) => T,
  fallbackParse: (raw: string) => T
): Promise<T> {
  try {
    const completion = await call();
    return parse(completion.choices?.[0]?.message?.content ?? "{}");
  } catch (err) {
    if (!isTransientJsonError(err)) throw err;
    console.warn("Transient JSON generation failure - retrying once:", String(err).slice(0, 200));
  }

  try {
    const completion = await call();
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    return parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("JSON still unparseable after retry - using empty-shape defaults");
      return fallbackParse("{}");
    }
    throw err;
  }
}
