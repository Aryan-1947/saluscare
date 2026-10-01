# SalusCare

AI-powered symptom triage assistant — describe your symptoms in chat (or send a
photo), get a tiered assessment (self-care / specialist referral / emergency)
with a safety-first red-flag screen, and export a doctor-visit summary as a PDF.

> Informational only — not a diagnosis. No medication dosages by design.

## Structure

This is a two-app monorepo:

| Folder | Stack | What it does |
| --- | --- | --- |
| [`saluscare-frontend/`](./saluscare-frontend) | React 19 · TypeScript · Vite · Tailwind 4 | Chat UI, session history, doctor summary PDF, landing page |
| [`saluscare-backend/`](./saluscare-backend) | Deno · Supabase Edge Functions · Groq · Auth0 | Red-flag screening, LLM triage pipeline, rate limiting, storage |

## Quick start

**Backend** (edge functions + secrets):

```bash
cd saluscare-backend
npm install
# create .env with SUPABASE_URL, keys and Auth0 credentials (see its README)
npx supabase functions serve          # local, or deploy per its README
npm test                              # 132 unit tests
```

**Frontend:**

```bash
cd saluscare-frontend
npm install
# create .env with VITE_AUTH0_* and VITE_SUPABASE_FUNCTIONS_URL (see its README)
npm run dev                           # http://localhost:5173
npm test                              # unit tests
```

## How a triage works (end to end)

1. The frontend sends your message + Auth0 token to a `session-*` edge function.
2. The backend verifies the token, rate-limits per user, and screens for
   emergency red flags deterministically (negation-guarded) before any LLM call.
3. If safe, an intake agent extracts structured symptoms and either asks one
   clarifying question or hands off to the triage engine.
4. Deterministic discriminators set the tier; low-confidence cases escalate.
5. The response comes back with condition suggestions, advice, and follow-ups —
   every turn is logged to the session history.

See [`saluscare-backend/README.md`](./saluscare-backend/README.md) for the full
architecture, security model, and deployment guide.

## Deployment status

- **Frontend:** deployed on Vercel (git-connected; every push to `main` auto-deploys
  `saluscare-frontend/` with the SPA rewrite from `saluscare-frontend/vercel.json`)
- **Edge functions:** 8/8 deployed on Supabase (`session-start`, `session-message`,
  `session-image`, `session-followup`, `session-history`, `session-followups`,
  `session-summaries`, `session-summary`)
