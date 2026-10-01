import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedContext } from "../_shared/scope.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RATE_LIMIT = { endpoint: "session-summaries", limit: 60, windowSeconds: 300 };

// GET /session-summaries?ids=<uuid>[,<uuid>...]
//
// Batched summaries for the "Session History" list. The frontend previously
// issued one /session-history call PER session (each pulling full turns and
// re-signing image URLs), which made the list take seconds and render
// progressively. This endpoint answers in ONE request with a single scoped
// query and no storage/Groq work.
//
// Response: { summaries: [{ sessionId, complaintText, tier, lastActivityAt }] }
// Only sessions owned by the caller are returned - unknown/foreign ids are
// silently omitted (ownership can't be probed).
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
    const idsParam = url.searchParams.get("ids") ?? "";
    const requested = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
      .slice(0, 100); // hard cap: the history list holds at most 50 roots

    if (requested.length === 0) {
      return new Response(JSON.stringify({ summaries: [] }), { status: 200, headers });
    }

    // One scoped query for all requested sessions.
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id, user_input_text, tier, created_at")
      .eq("auth0_user_id", ctx.userId)
      .in("id", requested);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }

    // Follow-up chains: a root assessment spawns child sessions
    // (session_history rows). The list should reflect the LATEST state of the
    // chain - the leaf's tier and the leaf's activity time - while keeping the
    // root's original complaint as the stable summary text.
    const { data: historyRows, error: historyError } = await supabase
      .from("session_history")
      .select("parent_session_id, session_id")
      .eq("auth0_user_id", ctx.userId);

    if (historyError) {
      return new Response(JSON.stringify({ error: historyError.message }), { status: 500, headers });
    }

    const childrenOf = new Map<string, string[]>();
    for (const h of historyRows ?? []) {
      const list = childrenOf.get((h as any).parent_session_id) ?? [];
      list.push((h as any).session_id);
      childrenOf.set((h as any).parent_session_id, list);
    }

    // Leaf ids this chain walk needs session rows for.
    const leafIds = new Set<string>();
    const leafOf = new Map<string, string>();
    for (const rootId of requested) {
      let current = rootId;
      const visited = new Set<string>([current]);
      for (;;) {
        const kids = childrenOf.get(current) ?? [];
        const next = kids.find((k) => !visited.has(k));
        if (!next) break;
        visited.add(next);
        current = next;
      }
      leafOf.set(rootId, current);
      if (current !== rootId) leafIds.add(current);
    }

    // Fetch leaf rows for their tier/created_at (scoped again).
    let leafById = new Map<string, any>();
    if (leafIds.size > 0) {
      const { data: leafRows, error: leafError } = await supabase
        .from("sessions")
        .select("id, tier, created_at")
        .eq("auth0_user_id", ctx.userId)
        .in("id", Array.from(leafIds));
      if (leafError) {
        return new Response(JSON.stringify({ error: leafError.message }), { status: 500, headers });
      }
      leafById = new Map((leafRows ?? []).map((l: any) => [l.id, l]));
    }

    // Latest activity per root from chat turns (fallback: leaf created_at).
    const { data: turns, error: turnsError } = await supabase
      .from("chat_turns")
      .select("group_id, created_at")
      .eq("auth0_user_id", ctx.userId)
      .in("group_id", requested)
      .order("created_at", { ascending: false });

    if (turnsError) {
      return new Response(JSON.stringify({ error: turnsError.message }), { status: 500, headers });
    }

    const lastActivity = new Map<string, string>();
    for (const t of turns ?? []) {
      const gid = (t as any).group_id as string;
      if (!lastActivity.has(gid)) lastActivity.set(gid, (t as any).created_at);
    }

    const summaries = (sessions ?? []).map((s: any) => {
      const leaf = leafById.get(leafOf.get(s.id) ?? s.id);
      return {
        sessionId: s.id,
        complaintText: s.user_input_text ?? "Assessment",
        tier: leaf?.tier ?? s.tier ?? 1,
        lastActivityAt:
          lastActivity.get(s.id) ?? leaf?.created_at ?? s.created_at,
      };
    });

    return new Response(JSON.stringify({ summaries }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
});
