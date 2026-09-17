import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type Groq from "npm:groq-sdk@1";

export type RedFlagMatch = {
  matched: boolean;
  pattern?: string;
  complaintArea?: string;
  /** True when the match came from the LLM paraphrase check, not a stored pattern. */
  viaLLM?: boolean;
};

type RedFlagRow = {
  pattern: string;
  complaint_area: string | null;
  applies_to: string | null;
};

/**
 * Normalization for substring matching: lowercase, straight apostrophes
 * ("won't"/"wont"), collapse whitespace. Punctuation (except apostrophes) is
 * stripped only from the PATIENT text — stored patterns are normalized the
 * same way, so "bleeding that won't stop" still matches "bleeding that wont
 * stop!!" while a hyphenated "face-drooping" still contains "face drooping".
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/'/g, "")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape regex metacharacters, then make the pattern tolerant of small
 * rewordings: whitespace runs match any gap ("difficulty  breathing"), and an
 * optional trailing "s" covers singular/plural ("seizures"). The regex is
 * global so repeated exec() calls advance through every occurrence. */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  return new RegExp(`${escaped}s?`, "g");
}

// A negation word in the window immediately BEFORE a red-flag phrase marks the
// mention as absent: "no chest pain", "denies difficulty breathing". (English
// symptom negation precedes the phrase; post-phrase negation like "chest pain
// that is not improving" is a GENUINE emergency, so it must not be suppressed.)
// Fail-safe direction: an unrecognized negation phrasing errs toward treating
// the phrase as a genuine red flag (over-triage), never the reverse.
const NEGATION_BEFORE_WINDOW = 25;
const NEGATION_BEFORE_PATTERN = /\b(no|not|none|never|without|denies|denied|negative for|rule out|ruled out)\b/i;

function isMentionNegated(text: string, matchIdx: number): boolean {
  const windowStart = Math.max(0, matchIdx - NEGATION_BEFORE_WINDOW);
  return NEGATION_BEFORE_PATTERN.test(text.slice(windowStart, matchIdx));
}

function matchAgainstText(pattern: string, text: string): boolean {
  // Fast path: plain substring with a negation-free window before it.
  let idx = text.indexOf(pattern);
  while (idx !== -1) {
    if (!isMentionNegated(text, idx)) return true;
    idx = text.indexOf(pattern, idx + 1);
  }
  // Regex fallback for spacing/plural variants ("throat  closing", "seizures").
  const re = patternToRegex(pattern);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!isMentionNegated(text, m.index)) return true;
    if (m.index === re.lastIndex) re.lastIndex++; // guard zero-length advances
  }
  return false;
}

function scanRow(row: RedFlagRow, normalizedText: string, normalizedVisual: string): boolean {
  const pattern = normalize(row.pattern);
  if (!pattern) return false;
  const checkText = row.applies_to === "both" || row.applies_to === "text";
  const checkVisual = row.applies_to === "both" || row.applies_to === "image";
  if (checkText && matchAgainstText(pattern, normalizedText)) return true;
  if (checkVisual && matchAgainstText(pattern, normalizedVisual)) return true;
  return false;
}

const RED_FLAG_LLM_SYSTEM_PROMPT = `You are the last-line safety net in a medical triage system. You are given a patient's message (and, when an image was analyzed, the vision model's findings). Your ONLY job is to decide whether the patient is describing a medical EMERGENCY right now — a red flag that requires immediate emergency care (call emergency services / go to the ER now).

Emergency red flags include (non-exhaustive): cardiac (chest pain/pressure, especially with sweating or arm/jaw pain), respiratory (difficulty breathing, choking, throat swelling/closing, inability to speak full sentences, blue lips), neurological (worst-ever or sudden severe headache, face drooping, one-sided weakness or numbness, slurred speech, seizure, loss of consciousness, stiff neck with high fever), trauma (uncontrolled bleeding, deep wound exposing bone), gastrointestinal (vomiting blood, coughing up blood, severe abdominal pain with a rigid abdomen), allergic (anaphylaxis, severe allergic reaction), and psychiatric (suicidal thoughts or intent).

The patient may phrase these in their own words — e.g. "swelling is blocking my airway", "I can't get any air", "my face went slack on one side", "blood is pouring out and it won't stop". Judge MEANING, not exact keywords.

Rules:
- isEmergency = true ONLY for symptoms that plausibly indicate one of the red flags above, happening NOW or just happened.
- NOT an emergency: denial of a red flag ("no chest pain"), past resolved symptoms ("had a seizure last year, never again"), a general question ("when should I worry about a headache?"), mild/moderate complaints that just need routine or soon-ish care (bad sore throat, fever, rash, sprain, vomiting without blood).
- If you are genuinely unsure, err on the side of caution: set isEmergency to true.

Respond ONLY with valid JSON matching this shape:
{
  "isEmergency": boolean,
  "matchedConcept": string | null,
  "reason": string
}`;

type RedFlagLLMOptions = {
  /** When provided, enables the LLM paraphrase fallback for emergencies phrased
   * in words that don't literally contain any stored red-flag pattern. */
  groq?: Groq;
  /** True when visual findings come from a captioned image analysis. */
  hasImage?: boolean;
};

async function runLLMRedFlagCheck(
  groq: Groq,
  text: string,
  visualFindings: string | undefined,
  hasImage: boolean
): Promise<RedFlagMatch> {
  const userContent = JSON.stringify({
    patientMessage: text || null,
    hasImage,
    visionFindings: visualFindings || null,
  });

  // gpt-oss-120b is the model proven to work from this project's edge functions.
  // It is a reasoning model: reasoning tokens count against max_tokens and can
  // exhaust a tight budget before any content is written, so we use
  // reasoning_effort "low" with a generous max_tokens (mirrors runExplainerAgent).
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: RED_FLAG_LLM_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0,
    max_tokens: 600,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  if (parsed.isEmergency === true) {
    return {
      matched: true,
      pattern: parsed.matchedConcept || "llm_detected_emergency",
      complaintArea: parsed.reason || "llm_safety_net",
      viaLLM: true,
    };
  }
  return { matched: false };
}

/**
 * Layered red-flag detection:
 *   1. Deterministic scan of stored DB patterns (negation-guarded substring +
 *      spacing/plural-tolerant regex). Fast, free, and covers most emergencies.
 *   2. Optional LLM paraphrase check (pass `groq` to enable) — catches
 *      emergencies phrased without any stored keyword, e.g. "swelling is
 *      blocking my airway" when only "throat closing" is stored.
 * The LLM check runs ONLY when the deterministic scan found nothing, so a
 * stored-pattern hit always wins and latency is only added on the miss path.
 * On any LLM failure we fail OPEN (proceed as non-emergency) — the call sites'
 * downstream discriminators/severity escalation still provide a safety net.
 */
export async function checkRedFlags(
  supabase: SupabaseClient,
  text: string | undefined,
  visualFindings: string | undefined,
  options: RedFlagLLMOptions = {}
): Promise<RedFlagMatch> {
  const { data: redFlags, error } = await supabase
    .from("red_flags")
    .select("pattern, complaint_area, applies_to");

  if (error) throw new Error(`Failed to load red flags: ${error.message}`);

  const normalizedText = normalize(text ?? "");
  const normalizedVisual = normalize(visualFindings ?? "");

  for (const flag of (redFlags ?? []) as RedFlagRow[]) {
    if (scanRow(flag, normalizedText, normalizedVisual)) {
      return { matched: true, pattern: flag.pattern, complaintArea: flag.complaint_area ?? undefined };
    }
  }

  if (options.groq) {
    try {
      return await runLLMRedFlagCheck(options.groq, text ?? "", visualFindings, options.hasImage ?? false);
    } catch (err) {
      // Fail open: an LLM outage must never block or falsely downgrade triage.
      console.error("LLM red-flag check failed (continuing without it):", String(err));
    }
  }

  return { matched: false };
}