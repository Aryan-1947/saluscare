import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { verifyAuth0Token } from "./auth0Verify.ts";

// ---------------------------------------------------------------------------
// Per-user data isolation helpers.
//
// verifyAuth0Token proves WHO the caller is; these helpers make sure every
// query is scoped to that identity. Rules:
//   1. The user id ALWAYS comes from the verified token (`sub`) — never from
//      the request body, query string, or any client-supplied field.
//   2. Every SELECT gets `.eq("auth0_user_id", userId)`.
//   3. Every INSERT carries `auth0_user_id: userId`.
//
// Migration 20260917120000 added the auth0_user_id columns + RLS lockdown.
// ---------------------------------------------------------------------------

export type AuthedContext = {
  supabase: SupabaseClient;
  userId: string;
};

export async function requireAuthedContext(
  supabase: SupabaseClient,
  req: Request
): Promise<{ ok: true; ctx: AuthedContext } | { ok: false; error: string; status: number }> {
  const auth = await verifyAuth0Token(req);
  if (!auth.valid || !auth.userId) {
    return { ok: false, error: auth.error ?? "Unauthorized", status: 401 };
  }
  return { ok: true, ctx: { supabase, userId: auth.userId } };
}

// Fetch a session row only if it belongs to the authenticated user.
// Returns null when it doesn't exist OR isn't owned by the caller —
// both cases are treated as 404 so ownership can't be probed.
export async function getOwnedSession(
  ctx: AuthedContext,
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await ctx.supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("auth0_user_id", ctx.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// Insert a session row stamped with the owner. Kept in one place so a new
// endpoint can't accidentally forget the ownership column.
export async function insertOwnedSession(
  ctx: AuthedContext,
  row: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await ctx.supabase
    .from("sessions")
    .insert({ ...row, auth0_user_id: ctx.userId });
  return { error: error?.message ?? null };
}

// Insert a chat turn stamped with the owner.
export async function logOwnedChatTurn(
  ctx: AuthedContext,
  groupId: string,
  role: "user" | "assistant",
  kind: "text" | "image" | "question" | "answer" | "result",
  content: string | null,
  imageUrl: string | null = null,
  imagePath: string | null = null,
  result: unknown = null
) {
  const { error } = await ctx.supabase.from("chat_turns").insert({
    group_id: groupId,
    role,
    kind,
    content,
    image_url: imageUrl,
    image_path: imagePath,
    result,
    auth0_user_id: ctx.userId,
  });
  if (error) console.error("Failed to log chat turn:", error.message);
}

// Insert a session_history row stamped with the owner.
export async function insertOwnedSessionHistory(
  ctx: AuthedContext,
  parentSessionId: string,
  sessionId: string,
  changeType: string
) {
  const { error } = await ctx.supabase.from("session_history").insert({
    parent_session_id: parentSessionId,
    session_id: sessionId,
    change_type: changeType,
    auth0_user_id: ctx.userId,
  });
  if (error) console.error("Failed to log session history:", error.message);
}

// ---------------------------------------------------------------------------
// Session lifecycle status (see migration 20260917130000).
// A session is 'open' while it still awaits a follow-up; a follow-up closes
// the parent ('closed_followed_up', or 'closed_emergency' when the update
// triaged tier 3) and opens the new one.
// ---------------------------------------------------------------------------

export type SessionStatus = "open" | "closed_followed_up" | "closed_emergency";

// New sessions open by default. Failure to stamp a status is logged but not
// fatal — the metric treats NULL as inactive.
export async function openSession(ctx: AuthedContext, sessionId: string) {
  const { error } = await ctx.supabase
    .from("sessions")
    .update({ status: "open" as SessionStatus })
    .eq("id", sessionId)
    .eq("auth0_user_id", ctx.userId);
  if (error) console.error("Failed to set session status:", error.message);
}

// Close the parent session and open the follow-up, as one pair of writes.
export async function transitionSessionStatus(
  ctx: AuthedContext,
  parentSessionId: string,
  newSessionId: string,
  parentStatus: Exclude<SessionStatus, "open"> = "closed_followed_up"
) {
  const { error: closeError } = await ctx.supabase
    .from("sessions")
    .update({ status: parentStatus })
    .eq("id", parentSessionId)
    .eq("auth0_user_id", ctx.userId);
  if (closeError) {
    console.error("Failed to close parent session:", closeError.message);
    return;
  }
  await openSession(ctx, newSessionId);
}

export type FollowupSummary = {
  sessionId: string;
  complaintText: string | null;
  tier: number;
  createdAt: string;
};

// The real "Active Follow-ups" list: this user's open sessions, newest first.
export async function getOpenSessions(
  ctx: AuthedContext,
  limit = 50
): Promise<FollowupSummary[]> {
  const { data, error } = await ctx.supabase
    .from("sessions")
    .select("id, user_input_text, tier, created_at")
    .eq("auth0_user_id", ctx.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list open sessions:", error.message);
    return [];
  }

  return (data ?? []).map((s: any) => ({
    sessionId: s.id,
    complaintText: s.user_input_text ?? null,
    tier: s.tier ?? 1,
    createdAt: s.created_at,
  }));
}
