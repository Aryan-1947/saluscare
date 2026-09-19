import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext } from "../_shared/scope.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RATE_LIMIT = { endpoint: "session-start", limit: 30, windowSeconds: 300 };

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

  const rl = await checkRateLimit(supabase, authed.ctx.userId, RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl, headers);

  try {
    const sessionId = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        sessionId,
        greeting:
          "Hi, I'm here to help you understand your symptoms. Describe what you're experiencing, or share a photo if it helps - whichever feels easier.",
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});
