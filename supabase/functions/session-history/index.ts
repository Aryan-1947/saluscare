import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext } from "../_shared/scope.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RATE_LIMIT = { endpoint: "session-history", limit: 120, windowSeconds: 300 };

// Signed URL lifetime. 24h keeps images viewable within a typical revisit
// window without making the URLs effectively permanent.
const IMAGE_URL_EXPIRY_SECONDS = 60 * 60 * 24;

async function resignImageUrls(
  turns: { image_path: string | null }[]
): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>();
  const paths = turns
    .map((t) => t.image_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length === 0) return urlByPath;

  const { data, error } = await supabase.storage
    .from("symptom-images")
    .createSignedUrls(paths, IMAGE_URL_EXPIRY_SECONDS);

  if (error || !data) {
    console.error("Failed to re-sign image URLs:", error?.message);
    return urlByPath;
  }

  for (const item of data) {
    if (item.path && item.signedUrl) {
      urlByPath.set(item.path, item.signedUrl);
    }
  }
  return urlByPath;
}

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
    const url = new URL(req.url);
    const groupId = url.searchParams.get("sessionId");

    if (!groupId) {
      return new Response(JSON.stringify({ error: "Missing 'sessionId' query parameter" }), {
        status: 400,
        headers,
      });
    }

    // User-scoped: a group_id that belongs to another user is indistinguishable
    // from one that doesn't exist — ownership can't be probed through this API.
    const { data: chatTurns, error: chatTurnsError } = await supabase
      .from("chat_turns")
      .select("role, kind, content, image_url, image_path, result, created_at")
      .eq("auth0_user_id", ctx.userId)
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (chatTurnsError) {
      return new Response(JSON.stringify({ error: chatTurnsError.message }), {
        status: 500,
        headers,
      });
    }

    if (chatTurns && chatTurns.length > 0) {
      const freshUrls = await resignImageUrls(chatTurns);

      return new Response(
        JSON.stringify({
          groupId,
          turns: chatTurns.map((t) => ({
            role: t.role,
            kind: t.kind,
            content: t.content,
            // Prefer a freshly-signed URL; fall back to whatever was logged.
            imageUrl: (t.image_path && freshUrls.get(t.image_path)) || t.image_url || null,
            result: t.result,
            createdAt: t.created_at,
          })),
        }),
        { status: 200, headers }
      );
    }

    // ------------------------------------------------------------------
    // Legacy fallback (sessions created before chat_turns logging).
    // Scoped to the caller, and no longer walks the entire table.
    // ------------------------------------------------------------------
    const { data: legacyRows, error: legacyError } = await supabase
      .from("session_history")
      .select("parent_session_id, session_id")
      .eq("auth0_user_id", ctx.userId);

    if (legacyError) {
      return new Response(JSON.stringify({ error: legacyError.message }), {
        status: 500,
        headers,
      });
    }

    const historyRows = legacyRows ?? [];
    const isKnownRoot = historyRows.some((h) => h.parent_session_id === groupId || h.session_id === groupId);
    if (!isKnownRoot) {
      return new Response(JSON.stringify({ groupId, turns: [] }), { status: 200, headers });
    }

    // Build the root -> leaf chain from this user's rows only.
    const chainSessionIds = new Set<string>([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const h of historyRows) {
        if (chainSessionIds.has(h.parent_session_id) && !chainSessionIds.has(h.session_id)) {
          chainSessionIds.add(h.session_id);
          changed = true;
        }
      }
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, user_input_text, tier, confidence, final_response, created_at")
      .eq("auth0_user_id", ctx.userId)
      .in("id", Array.from(chainSessionIds))
      .order("created_at", { ascending: true });

    if (sessionsError) {
      return new Response(JSON.stringify({ error: sessionsError.message }), {
        status: 500,
        headers,
      });
    }

    const legacyTurns = (sessions ?? []).map((s: any) => ({
      role: "user" as const,
      kind: "text" as const,
      content: s.user_input_text,
      imageUrl: null,
      result: {
        sessionId: s.id,
        tier: s.tier,
        response: s.final_response,
      },
      createdAt: s.created_at,
    }));

    return new Response(JSON.stringify({ groupId, turns: legacyTurns }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});
