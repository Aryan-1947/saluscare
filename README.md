# SalusCare Backend

AI-powered symptom triage backend built on Supabase Edge Functions (Deno) with
Groq LLMs and Auth0 authentication. Eight endpoints power the frontend: session
lifecycle, text/image triage, follow-up chains, history, the active follow-ups
dashboard feed, and doctor-visit summaries.

## Architecture

```
supabase/functions/
  session-start/       -> creates a session id + greeting
  session-message/     -> text triage: red flags -> intake -> discriminators -> tier 1/2/3
  session-image/       -> image upload to storage -> vision agent -> same triage pipeline
  session-followup/    -> follow-up lifecycle: general question | symptom update | red flag
  session-history/     -> chat turns for a session (re-signs image URLs on read)
  session-followups/   -> user's open sessions ("Active Follow-ups" dashboard)
  session-summaries/   -> list of assessments with summaries (history page)
  session-summary/     -> LLM-written doctor-visit handover note for a session
  _shared/             -> agents, triage engine, discriminators, red flags, CORS, rate limiting, auth
```

Request flow for triage (`session-message` / `session-image` / `session-followup`):

1. **Auth** - Auth0 JWT verified against JWKS (`_shared/auth0Verify.ts`).
2. **Rate limit** - per-user sliding window (`_shared/rateLimiter.ts` + SQL `check_rate_limit`).
3. **Red-flag screen** - deterministic DB pattern scan (negation-guarded), then an
   LLM safety net for paraphrased emergencies (`_shared/redFlagMatcher.ts`).
4. **Intake agent** - extracts structured symptoms, decides sufficiency, may ask
   one clarifying question.
5. **Follow-up classifier** (`session-followup`) - routes each incoming message
   to the general-question agent or the symptom-update chain.
6. **Triage engine** - deterministic discriminators set the tier (1 self-care,
   2 specialist, 3 emergency); confidence < 50 escalates one tier.
7. **Response builders** - knowledge-base lookup with category fallback, then
   explainer/follow-up agents write the closing note (static fallback if the
   LLM returns empty twice).

## Setup

```bash
npm install
cp .env.example .env   # if present; otherwise create .env with the keys below
```

Required `.env` keys (backend, for the smoke test):

| Key | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Public anon key (red-flags REST reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (smoke-test cleanup only) |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Auth0 API audience |
| `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` | M2M credentials for the smoke test |
| `GROQ_API_KEY` | Groq API key (also set as an edge function secret) |

## Testing

```bash
npm test                      # 132 unit tests (vitest) - no network needed
python scripts/smoke_test.py  # 18-check end-to-end test against DEPLOYED functions
```

The smoke test exercises: auth enforcement, full triage, history logging, the
complete follow-up lifecycle (general question → worsening → red flag),
paraphrased + negated red flags, image flow (captioned/uncaptioned), CORS
preflight, and the rate limiter (429 + Retry-After). It fetches a fresh M2M
token, retries on 429s, and exits non-zero on any failure.

Typecheck: `npx tsc -p tsconfig.ci.json` (the functions themselves are Deno
code and are type-checked at deploy time).

## Deploy

```bash
npx supabase login                 # once; stores an access token
npx supabase link --project-ref <ref>   # once per clone (already linked here)

npx supabase functions deploy session-start
npx supabase functions deploy session-message
npx supabase functions deploy session-image
npx supabase functions deploy session-followup
npx supabase functions deploy session-history
npx supabase functions deploy session-followups
npx supabase functions deploy session-summaries
npx supabase functions deploy session-summary

npx supabase db push               # apply supabase/migrations/*.sql
```

### Secrets

```bash
npx supabase secrets set GROQ_API_KEY=...           # required by all triage functions
npx supabase secrets set AUTH0_DOMAIN=...           # required by all functions
npx supabase secrets set AUTH0_AUDIENCE=...
npx supabase secrets set ALLOWED_ORIGINS=https://your-frontend.example.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
`ALLOWED_ORIGINS` is a comma-separated CORS allowlist; localhost dev origins
(5173/3000) are always allowed. Browser calls from any other origin are
rejected at the CORS layer.

`config.toml` sets `verify_jwt = false` for all functions on purpose - Auth0
tokens (not Supabase JWTs) are verified in code by `_shared/auth0Verify.ts`.

## Security model

- **Identity**: user id always comes from the verified token (`sub`), never
  from request bodies.
- **Data isolation**: every query is scoped by `auth0_user_id`; tables have RLS
  enabled with no client policies (service role + in-code scoping only).
  Storage paths are namespaced `{auth0_user_id}/{sessionId}/{uuid}.ext` with
  owner-scoped storage policies; the bucket is private with a 10 MB cap and an
  image-MIME allowlist.
- **Abuse prevention**: per-user per-endpoint rate limits backed by an atomic
  SQL function; blocked requests return `429` + `Retry-After`. The limiter
  fails open so an outage can't take triage down.
- **Red flags fail safe**: negation guards only suppress clearly negated
  mentions; unknown phrasings escalate (deterministic scan) or are judged by
  the LLM safety net, which errs toward emergency.

## Rate limits (per user, per endpoint)

| Endpoint | Limit | Window |
| --- | --- | --- |
| session-message | 20 | 5 min |
| session-followup | 20 | 5 min |
| session-image | 10 | 5 min |
| session-start | 30 | 5 min |
| session-followups | 60 | 5 min |
| session-history | 120 | 5 min |
| session-summary | 10 | 5 min |
| session-summaries | 60 | 5 min |
