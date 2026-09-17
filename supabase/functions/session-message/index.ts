import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext, logOwnedChatTurn, insertOwnedSession, openSession } from "../_shared/scope.ts";
import Groq from "npm:groq-sdk@1";
import { checkRedFlags } from "../_shared/redFlagMatcher.ts";
import { runIntakeAgent, runExplainerAgent, runSufficiencyCheck } from "../_shared/agents.ts";
import { runTriageEngine } from "../_shared/triageEngine.ts";
import { buildEmergencyResponse } from "../_shared/responseBuilders.ts";
import { generateTierResponse } from "../_shared/generativeResponseBuilder.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

const RATE_LIMIT = { endpoint: "session-message", limit: 20, windowSeconds: 300 };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

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
    const { text, sessionId, skipClarification, groupId } = await req.json();
    const chatGroupId = groupId ?? sessionId;
    

    if (!text || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing 'text' or 'sessionId' in request body" }), {
        status: 400,
        headers,
      });
    }

    await logOwnedChatTurn(ctx, chatGroupId, "user", "text", text);

    const redFlag = await checkRedFlags(supabase, text, undefined, { groq });

    let tier: 1 | 2 | 3;
    let triage = null;
    let response;
    let explanation: string;

    if (redFlag.matched) {
      tier = 3;
      response = buildEmergencyResponse(redFlag.pattern!);
      explanation = await runExplainerAgent(groq, response);
    } else {
      const extracted = await runIntakeAgent(groq, text);

      if (!skipClarification && !extracted.sufficient && extracted.clarifyingQuestion) {
        await logOwnedChatTurn(ctx, chatGroupId, "assistant", "question", extracted.clarifyingQuestion);
        return new Response(
          JSON.stringify({
            sessionId,
            needsClarification: true,
            clarifyingQuestion: extracted.clarifyingQuestion,
          }),
          { status: 200, headers }
        );
      }

      triage = runTriageEngine(extracted, false, false);
      tier = triage.tier;

      if (tier === 3) {
        response = buildEmergencyResponse(triage.presentingComplaint);
      } else if (tier === 2) {
        response = await generateTierResponse(supabase, groq, extracted, 2);
      } else {
        response = await generateTierResponse(supabase, groq, extracted, 1);
      }
      explanation = await runExplainerAgent(groq, response);
    }

    const { error: insertError } = await insertOwnedSession(ctx, {
      id: sessionId,
      user_input_text: text,
      context_snapshot: text,
      tier,
      confidence: triage?.confidence ?? 100,
      matched_discriminators: triage?.matchedDiscriminators ?? [],
      final_response: response,
    });

    if (insertError) {
      console.error("Failed to log session:", insertError);
    }

    await openSession(ctx, sessionId);

    await logOwnedChatTurn(ctx, chatGroupId, "assistant", "result", explanation, null, null, { sessionId, tier, response });

    return new Response(
      JSON.stringify({ sessionId, tier, triage, response, explanation }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});