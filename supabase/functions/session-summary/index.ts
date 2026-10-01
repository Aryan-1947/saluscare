import { createClient } from "npm:@supabase/supabase-js@2";
import Groq from "npm:groq-sdk@1";
import { requireAuthedContext } from "../_shared/scope.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { withJsonRetry } from "../_shared/jsonRetry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL = "openai/gpt-oss-120b";
const RATE_LIMIT = { endpoint: "session-summary", limit: 10, windowSeconds: 300 };

// Narrative prompt: the LLM writes like a clinician documenting a visit, not a
// chat log. It must ONLY use information present in the transcript.
const SYSTEM_PROMPT = `You are a medical scribe preparing a concise clinical handover note for the doctor who will see this patient next.

You will receive a chronological transcript of an AI health-triage conversation. Write the handover in Markdown:

## Summary
2-4 sentence narrative: who presents, main complaint and how long, how it evolved during the session (including any escalation, e.g. from self-care to emergency), and the current most-severe state.

## Symptom Timeline
Bullet list, each "- <time/context>: <what happened>" — onset, severity changes, new symptoms, escalation points. Use the transcript's own timestamps/context phrases.

## Assessment Outcome
- Final triage tier (Self Care / Specialist Referral / Emergency Care) and what triggered it.
- Any red flags detected (verbatim from the transcript).
- AI-suggested condition(s), clearly framed as the triage system's impression.

## Advice Given
Compact summary of self-care measures, foods, first-aid, specialist type - only what the transcript shows.

## Flags for the Doctor
Anything the doctor should probe: symptoms that suggest escalation, unanswered clarifications, medication mentions, recurring issues.

Rules:
- ONLY use information present in the transcript. NEVER invent medications, doses, conditions, or timeline points.
- If the transcript is too thin for a section, write "Not documented in this conversation." under it.
- No medical recommendations, no treatment plans - you document what happened, the doctor decides.
- Be concise: the whole note should read in under 60 seconds.`;

type ChatTurnRow = {
  role: string;
  kind: string;
  content: string | null;
  image_url: string | null;
  result: unknown;
  created_at: string;
};

/** Compress a chat_turns row into a compact transcript line. */
function turnToTranscriptLine(t: ChatTurnRow): string {
  const ts = new Date(t.created_at).toISOString().replace("T", " ").slice(0, 16);
  const marker = `[${ts}]`;

  if (t.role === "user") {
    if (t.kind === "image") {
      return `${marker} PATIENT: shared a photo${t.content ? ` with note: "${t.content}"` : ""}`;
    }
    return `${marker} PATIENT: ${t.content ?? ""}`;
  }

  if (t.kind === "question" || t.kind === "answer") {
    return `${marker} TRIAGE ASSISTANT: ${t.content ?? ""}`;
  }

  if (t.kind === "result" && t.result && typeof t.result === "object") {
    const r = t.result as {
      tier?: number;
      response?: Record<string, unknown>;
      triage?: { presentingComplaint?: string } | null;
    };
    const tierLabel = r.tier === 3 ? "EMERGENCY" : r.tier === 2 ? "SPECIALIST REFERRAL" : "SELF CARE";
    const complaint = r.triage?.presentingComplaint ?? "not recorded";
    const resp = r.response ?? {};
    const bits: string[] = [];
    for (const key of [
      "conditionSummary",
      "likelyCondition",
      "likelyCauses",
      "whySpecialistNeeded",
      "recommendedSpecialist",
      "message",
      "matchedRedFlag",
      "expectedRecoveryTime",
    ]) {
      const v = resp[key];
      if (typeof v === "string" && v.trim()) bits.push(`${key}: ${v}`);
    }
    for (const key of ["warningSigns", "emergencyWatchFor", "foodsToAvoid", "foodsToEat", "homeRemedies", "interimCareSteps"]) {
      const v = resp[key];
      if (Array.isArray(v) && v.length > 0) {
        bits.push(`${key}: ${v.slice(0, 6).join("; ")}`);
        if (v.length > 6) bits[bits.length - 1] += ` (+${v.length - 6} more)`;
      }
    }
    return `${marker} SYSTEM RESULT: tier=${tierLabel}; complaint=${complaint}${bits.length ? " | " + bits.join(" | ") : ""}`;
  }

  return "";
}

/** Plain-text fallback used when the LLM call fails: still useful, still safe. */
function deterministicFallbackSummary(turns: ChatTurnRow[]): string {
  const results = turns.filter((t) => t.kind === "result" && t.result);
  const first = turns.find((t) => t.role === "user");
  const lastResult = [...results].pop() as ChatTurnRow | undefined;
  const lastR = (lastResult?.result ?? {}) as { tier?: number };
  const tier = lastR.tier === 3 ? "EMERGENCY" : lastR.tier === 2 ? "SPECIALIST REFERRAL" : "SELF CARE";

  return [
    "## Summary",
    `Patient presented${first?.content ? ` with: "${first.content}"` : ""}. The conversation contains ${turns.length} exchanges and ${results.length} completed assessment(s).`,
    "",
    "## Assessment Outcome",
    `- Final triage tier: ${tier}`,
    "",
    "## Symptom Timeline",
    ...turns
      .filter((t) => t.role === "user" && t.content)
      .slice(0, 8)
      .map((t) => `- ${new Date(t.created_at).toISOString().slice(0, 16).replace("T", " ")}: ${t.content}`),
    "",
    "## Advice Given",
    "Not documented in this conversation.",
    "",
    "## Flags for the Doctor",
    "Auto-generated note: the narrative generator was unavailable; sections above are extracted directly from the conversation log.",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = corsHeadersFor(req.headers.get("origin"));

  const authed = await requireAuthedContext(supabase, req);
  if (!authed.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: authed.error }), {
      status: 401,
      headers,
    });
  }
  const ctx = authed.ctx;

  const rl = await checkRateLimit(supabase, ctx.userId, RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl, headers);

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing 'sessionId' in request body" }), {
        status: 400,
        headers,
      });
    }

    // User-scoped load of the whole conversation group.
    const { data: turns, error } = await supabase
      .from("chat_turns")
      .select("role, kind, content, image_url, result, created_at")
      .eq("auth0_user_id", ctx.userId)
      .eq("group_id", sessionId)
     .order("created_at", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
    if (!turns || turns.length === 0) {
      return new Response(JSON.stringify({ error: "No conversation found for this session." }), {
        status: 404,
        headers,
      } as ResponseInit);
      }

    // Compact the transcript so the prompt stays small regardless of session length.
    const transcript = (turns as ChatTurnRow[])
      .map(turnToTranscriptLine)
      .filter(Boolean)
      .join("\n");

    // The report must never hard-fail: any LLM problem (transient JSON,
    // network, quota) degrades to the deterministic extraction instead of a 500.
    let finalNarrative: string;
    try {
      const narrative = await withJsonRetry(
        () =>
          groq.chat.completions.create({
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Transcript:\n\n${transcript}` },
            ],
            temperature: 0.2,
            max_completion_tokens: 1600,
          }),
        (raw) => raw,
        (raw) => raw
      );

      const text = (narrative ?? "").trim();
      finalNarrative = text.length > 40 ? text : deterministicFallbackSummary(turns as ChatTurnRow[]);
    } catch (llmErr) {
      console.error("Summary narrative generation failed - using deterministic fallback:", String(llmErr));
      finalNarrative = deterministicFallbackSummary(turns as ChatTurnRow[]);
    }

    const lastResultTurn = [...(turns as ChatTurnRow[])].reverse().find(
      (t) => t.kind === "result" && t.result
    );
    const lastR = (lastResultTurn?.result ?? {}) as { tier?: number };
    const tier = lastR.tier === 3 ? 3 : lastR.tier === 2 ? 2 : 1;

    return new Response(
      JSON.stringify({
        sessionId,
        generatedAt: new Date().toISOString(),
        narrative: finalNarrative,
        meta: {
          turnCount: turns.length,
          assessmentCount: (turns as ChatTurnRow[]).filter((t) => t.kind === "result").length,
          finalTier: tier,
          startedAt: turns[0].created_at,
          lastActivityAt: turns[turns.length - 1].created_at,
        },
      }),
      { status: 200, headers }
    );
    }
    catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});
