import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext, logOwnedChatTurn, insertOwnedSession, openSession } from "../_shared/scope.ts";
import Groq from "npm:groq-sdk@1";
import { checkRedFlags } from "../_shared/redFlagMatcher.ts";
import { runIntakeAgent, runExplainerAgent, runSufficiencyCheck } from "../_shared/agents.ts";
import { runTriageEngine } from "../_shared/triageEngine.ts";
import { buildEmergencyResponse } from "../_shared/responseBuilders.ts";
import { generateTierResponse } from "../_shared/generativeResponseBuilder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authed = await requireAuthedContext(supabase, req);
  if (!authed.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: authed.error }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const ctx = authed.ctx;

  try {
    const { text, sessionId, skipClarification, groupId } = await req.json();
    const chatGroupId = groupId ?? sessionId;
    

    if (!text || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing 'text' or 'sessionId' in request body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    await logOwnedChatTurn(ctx, chatGroupId, "user", "text", text);

    const redFlag = await checkRedFlags(supabase, text, undefined);

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
          { status: 200, headers: corsHeaders }
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
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});