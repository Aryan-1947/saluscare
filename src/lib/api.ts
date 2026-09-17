const BASE_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

async function callFunction<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const { method = "POST", body, query } = options;

  let url = `${BASE_URL}/${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  sessionStart: (token: string) =>
    callFunction<{ sessionId: string; greeting: string }>("session-start", token),

  sessionMessage: (token: string, text: string, sessionId: string, skipClarification?: boolean) =>
    callFunction("session-message", token, { body: { text, sessionId, skipClarification } }),

  sessionImage: (
    token: string,
    imageBase64: string,
    imageMimeType: string,
    text: string | undefined,
    sessionId: string
  ) =>
    callFunction("session-image", token, {
      body: { imageBase64, imageMimeType, text, sessionId },
    }),

  sessionFollowup: (
    token: string,
    text: string,
    parentSessionId: string,
    newSessionId: string,
    recentExchanges?: { question: string; answer: string }[]
  ) =>
    callFunction("session-followup", token, {
      body: { text, parentSessionId, newSessionId, recentExchanges },
    }),

  sessionHistory: (token: string, sessionId: string) =>
    callFunction("session-history", token, { method: "GET", query: { sessionId } }),
};