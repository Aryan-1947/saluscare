import { createClient } from "npm:@supabase/supabase-js@2";
import {
  requireAuthedContext,
  getOwnedSession,
  insertOwnedSession,
  insertOwnedSessionHistory,
  logOwnedChatTurn,
  transitionSessionStatus,
} from "../_shared/scope.ts";
import Groq from "npm:groq-sdk@1";
import { checkRedFlags } from "../_shared/redFlagMatcher.ts";
import { runIntakeAgent, runExplainerAgent, runFollowupAgent, classifyFollowupMessage, runGeneralQuestionAgent } from "../_shared/agents.ts";
import { runTriageEngine } from "../_shared/triageEngine.ts";
import { diffSymptomState } from "../_shared/symptomDiff.ts";
import { buildTriageContext } from "../_shared/triageContext.ts";
import { buildEmergencyResponse } from "../_shared/responseBuilders.ts";
import { generateTierResponse } from "../_shared/generativeResponseBuilder.ts";
import { logChatTurn } from "../_shared/chatLog.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

const RATE_LIMIT = { endpoint: "session-followup", limit: 20, windowSeconds: 300 };

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
    const { text, parentSessionId, newSessionId, recentExchanges, groupId } = await req.json();
    const chatGroupId = groupId ?? parentSessionId;
    

    if (!text || !parentSessionId || !newSessionId) {
      return new Response(
        JSON.stringify({ error: "Missing 'text', 'parentSessionId', or 'newSessionId' in request body" }),
        { status: 400, headers }
      );
    }

    // Scoped: only the owner of the parent session can follow up on it.
    // A session owned by someone else is indistinguishable from a missing one.
    let priorSession: Record<string, any> | null;
    try {
      priorSession = await getOwnedSession(ctx, parentSessionId);
    } catch (fetchErr) {
      return new Response(JSON.stringify({ error: "Prior session lookup failed" }), {
        status: 500,
        headers,
      });
    }

    if (!priorSession) {
      return new Response(JSON.stringify({ error: "Prior session not found" }),{ status: 404,
        headers,
      });
    }

    // Window the accumulated context to head (original complaint) + tail
    // (most recent symptom state) - a bare tail-slice eventually drops the
    // original complaint on long follow-up chains. Pure helper, unit-tested.
    const fullContext = String(priorSession.context_snapshot ?? priorSession.user_input_text ?? "");
    const priorContext = buildTriageContext(fullContext);
    const combinedText = `${priorContext}. Patient update: ${text}`;

    // Red-flag check runs on the combined context, before anything else
    await logOwnedChatTurn(ctx, chatGroupId, "user", "text", text);  

    const redFlagCheck = await checkRedFlags(supabase, combinedText, undefined, { groq });
    if (redFlagCheck.matched) {
      const response = buildEmergencyResponse(redFlagCheck.pattern!);
      const explanation = await runExplainerAgent(groq, response);

      const { error: redFlagInsertError } = await insertOwnedSession(ctx, {
        id: newSessionId,
        user_input_text: text,
        tier: 3,
        confidence: 100,
        matched_discriminators: [],
        final_response: response,
      });
      if (redFlagInsertError) console.error("Failed to log session:", redFlagInsertError);
      // The red flag ends the chain: close parent as emergency-opened, open the new session.
      await transitionSessionStatus(ctx, parentSessionId, newSessionId, "closed_emergency");
      await insertOwnedSessionHistory(ctx, parentSessionId, newSessionId, "new_red_flag");

      await logOwnedChatTurn(ctx, chatGroupId, "assistant", "result", explanation, null, null, { sessionId: newSessionId, tier: 3, response });
      return new Response(
        JSON.stringify({ sessionId: newSessionId, tier: 3, response, explanation }),
        { status: 200, headers }
      );
    }

    const messageType = await classifyFollowupMessage(groq, text);

    if (messageType === "general_question") {
      const answer = await runGeneralQuestionAgent(groq, priorSession, text, recentExchanges);
      await logOwnedChatTurn(ctx, chatGroupId, "assistant", "answer", answer);
      // A general question isn't a symptom update - the assessment is still
      // awaiting a real follow-up, so the parent stays open.
      return new Response(
        JSON.stringify({
          sessionId: parentSessionId,
          isGeneralAnswer: true,
          answer,
        }),
        { status: 200, headers }
      );
    }

    // Detect if the patient is explicitly saying they haven't followed prior advice yet
    const nonComplianceSignals = ["didn't go", "didnt go", "haven't seen", "havent seen", "haven't been", "havent been", "didn't visit", "didnt visit", "still haven't", "still havent", "didn't see", "didnt see"];
    const isNonCompliant = nonComplianceSignals.some((s) => text.toLowerCase().includes(s));

    // Symptom update - extract using the COMBINED context, not the new message alone
    const extracted = await runIntakeAgent(groq, combinedText);
    const triage = runTriageEngine(extracted, false, false);

    const changeType = diffSymptomState(priorSession.user_input_text ?? "", text, false);

    let effectiveTier = triage.tier;
    const priorTier = priorSession.tier as number;

    if (changeType === "worsened" && priorTier < 3) {
      effectiveTier = Math.max(triage.tier, Math.min(3, priorTier + 1)) as 1 | 2 | 3;
    } else if (changeType === "improved") {
      effectiveTier = Math.min(triage.tier, priorTier) as 1 | 2 | 3;
    } else {
      effectiveTier = Math.max(triage.tier, priorTier) as 1 | 2 | 3;
    }

    const tier = effectiveTier;
    let response;

    if (tier === 3) {
      response = buildEmergencyResponse(triage.presentingComplaint);
    } else if (tier === 2) {
      response = await generateTierResponse(supabase, groq, extracted, 2);
    } else {
      response = await generateTierResponse(supabase, groq, extracted, 1);
    }

    const explanation = await runFollowupAgent(groq, priorSession, text, changeType, response, isNonCompliant);

    const { error: insertError } = await insertOwnedSession(ctx, {
      id: newSessionId,
      user_input_text: text,
      context_snapshot: combinedText,
      tier,
      confidence: triage.confidence,
      matched_discriminators: triage.matchedDiscriminators,
      final_response: response,
    });
    if (insertError) console.error("Failed to log session:", insertError);

    // The parent assessment got its follow-up: close it, open the new one.
    await transitionSessionStatus(ctx, parentSessionId, newSessionId);
    await insertOwnedSessionHistory(ctx, parentSessionId, newSessionId, changeType);

    await logOwnedChatTurn(ctx, chatGroupId, "assistant", "result", explanation, null, null, { sessionId: newSessionId, tier, response });

    return new Response(
      JSON.stringify({ sessionId: newSessionId, tier, changeType, triage, response, explanation }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});