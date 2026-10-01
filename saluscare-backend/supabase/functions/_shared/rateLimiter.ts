import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Per-user rate limiting for edge functions.
//
// Every triage request fires multiple paid Groq calls (intake, response
// builder, explainer, and now the red-flag safety net), so an automated or
// buggy client can run up a real API bill. This is a sliding-window counter
// stored in Postgres - no extra infra, atomic via a single SQL function, and
// scoped per user + endpoint.
//
// Design notes:
//   - check_rate_limit is a SECURITY DEFINER SQL function doing the window
//     count + conditional insert in ONE statement, so concurrent requests
//     cannot race past the limit.
//   - Fail-open on limiter errors: an outage of the limiter must never take
//     triage down; abuse prevention degrades gracefully.
//   - The window is fixed-width (counts hits in the trailing N seconds).
// ---------------------------------------------------------------------------

export type RateLimitRule = {
  /** Unique key per endpoint, e.g. "session-message". */
  endpoint: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Requests counted in the current window (when allowed). */
  used?: number;
  limit?: number;
  /** Seconds until the window resets / retry is sensible (when blocked). */
  retryAfterSeconds?: number;
};

const RETRY_CAP_SECONDS = 60;

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_endpoint: rule.endpoint,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    const allowed = row?.allowed === true;

    if (allowed) {
      return { allowed: true, used: Number(row.used ?? 0), limit: rule.limit };
    }

    // Fixed-width window: retry is sensible when the oldest hit ages out.
    return {
      allowed: false,
      used: Number(row?.used ?? rule.limit),
      limit: rule.limit,
      retryAfterSeconds: Math.min(rule.windowSeconds, RETRY_CAP_SECONDS),
    };
  } catch (err) {
    console.error(`Rate limiter error (${rule.endpoint}), failing open:`, String(err));
    return { allowed: true };
  }
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      detail: `Too many requests. Limit: ${result.limit} per window. Please retry shortly.`,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Retry-After": String(result.retryAfterSeconds ?? 30),
      },
    }
  );
}
