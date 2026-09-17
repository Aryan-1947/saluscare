import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext, logOwnedChatTurn, insertOwnedSession, openSession } from "../_shared/scope.ts";
import Groq from "npm:groq-sdk@1";
import { checkRedFlags } from "../_shared/redFlagMatcher.ts";
import { runIntakeAgent, runExplainerAgent } from "../_shared/agents.ts";
import { runVisionFusionAgent } from "../_shared/visionAgent.ts";
import { runTriageEngine } from "../_shared/triageEngine.ts";
import { buildEmergencyResponse } from "../_shared/responseBuilders.ts";
import { generateTierResponse } from "../_shared/generativeResponseBuilder.ts";
import { logChatTurn } from "../_shared/chatLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
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
    const { imageBase64, imageMimeType, text, sessionId, groupId } = await req.json();
    const chatGroupId = groupId ?? sessionId;

    if (!imageBase64 || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing 'imageBase64' or 'sessionId' in request body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Upload image to Supabase Storage, namespaced per user so storage-level
    // policies can also scope access if direct client reads are ever enabled.
    const fileExt = (imageMimeType ?? "image/jpeg").split("/")[1] ?? "jpg";
    const filePath = `${ctx.userId}/${sessionId}/${crypto.randomUUID()}.${fileExt}`;
    const binaryData = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("symptom-images")
      .upload(filePath, binaryData, { contentType: imageMimeType ?? "image/jpeg" });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Image upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("symptom-images")
      .createSignedUrl(filePath, 3600);

    if (signedUrlError || !signedUrlData) {
      return new Response(JSON.stringify({ error: "Failed to generate image URL" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const imageUrl = signedUrlData.signedUrl;

    await logOwnedChatTurn(ctx, chatGroupId, "user", "image", text || null, imageUrl, filePath);

    // If no caption text provided, ask a clarifying question instead of triaging on image alone
    if (!text || text.trim().length === 0) {
      await logChatTurn(supabase, chatGroupId, "assistant", "question", "How long has this looked like this?");
      return new Response(
        JSON.stringify({
          sessionId,
          needsClarification: true,
          clarifyingQuestion: "How long has this looked like this?",
          imageUrl,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const vision = await runVisionFusionAgent(groq, imageUrl, text);

    const redFlag = await checkRedFlags(supabase, text, vision.visualFindings, { groq, hasImage: true });

    let tier: 1 | 2 | 3;
    let triage = null;
    let response;
    let explanation: string;

    if (redFlag.matched) {
      tier = 3;
      response = buildEmergencyResponse(redFlag.pattern!);
      explanation = await runExplainerAgent(groq, response);
    } else {
      const extracted = await runIntakeAgent(groq, `${text}. Visible findings: ${vision.visualFindings}`);

      if (!extracted.sufficient && extracted.clarifyingQuestion) {
        await logOwnedChatTurn(ctx, chatGroupId, "assistant", "question", extracted.clarifyingQuestion);
        return new Response(
          JSON.stringify({
            sessionId,
            needsClarification: true,
            clarifyingQuestion: extracted.clarifyingQuestion,
            imageUrl,
            imageContext: `${text}. Visible findings: ${vision.visualFindings}`,
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      triage = runTriageEngine(extracted, true, vision.imageQualityGood);
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
      image_url: imageUrl,
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
      JSON.stringify({ sessionId, tier, triage, visualFindings: vision.visualFindings, response, explanation }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});