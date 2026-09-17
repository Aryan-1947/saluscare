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
