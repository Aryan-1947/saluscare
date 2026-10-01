import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function logChatTurn(
  supabase: SupabaseClient,
  groupId: string,
  role: "user" | "assistant",
  kind: "text" | "image" | "question" | "answer" | "result",
  content: string | null,
  imageUrl: string | null = null,
  result: unknown = null
) {
  const { error } = await supabase.from("chat_turns").insert({
    group_id: groupId,
    role,
    kind,
    content,
    image_url: imageUrl,
    result,
  });
  if (error) console.error("Failed to log chat turn:", error.message);
}