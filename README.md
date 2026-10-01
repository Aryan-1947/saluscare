# SalusCare

> **AI-powered symptom triage** — chat about your symptoms (or send a photo),
> answer a few follow-ups, and get a clear assessment: **self-care**,
> **see a specialist**, or **seek emergency care**. Then export a doctor-ready
> PDF summary of the whole conversation.

**🔗 Live app:** [saluscare-ten.vercel.app](https://saluscare-ten.vercel.app)
**📦 Repo:** [github.com/Aryan-1947/saluscare](https://github.com/Aryan-1947/saluscare)

> ⚠️ **Disclaimer:** SalusCare is an informational triage assistant, *not* a
> doctor. It never prescribes medication or dosages, and it aggressively
> escalates anything that smells like an emergency. When in doubt, see a real
> clinician.

---

## What does it actually do?

1. **You describe how you feel** in plain language — *"my period is brown and
   clotted for 2 months"*, *"sharp pain in my side since yesterday"*, or just
   send a photo of the affected area.
2. **A safety-first pipeline checks for emergencies before anything else.** A
   deterministic red-flag scan (with negation guards, so *"no chest pain"*
   doesn't trigger a false alarm) plus an LLM safety net that catches
   paraphrased emergencies. Anything dangerous jumps straight to **Emergency
   Care** guidance.
3. **An AI intake agent asks smart follow-up questions** — one at a time —
   until it knows enough (location, duration, severity, associated symptoms).
4. **A deterministic triage engine assigns a tier** — 1 self-care / 2
   specialist referral / 3 emergency — using explicit medical discriminators,
   not vibes. Low-confidence cases automatically escalate a tier.
5. **You get a full explanation**: likely condition categories, what to watch
   for, diet/home-care advice, and which red flags should make you seek care
   immediately.
6. **Every conversation becomes a session** you can revisit, continue later,
   or export as a clean **Doctor Visit Summary PDF** to hand over at an
   appointment.

## Feature highlights

| | |
|---|---|
| 💬 **Conversational triage** | WhatsApp-style chat, voice dictation, drag-and-drop image attach |
| 🚨 **Red-flag safety net** | Deterministic DB-backed screening + LLM paraphrase net, fails *toward* emergency |
| 🖼 **Image triage** | Uploads go to private storage, analyzed by a vision model, folded into the same pipeline |
| 🔁 **Follow-up sessions** | Come back days later; the assistant remembers context and detects worsening/red-flag updates |
| 🩺 **Doctor Visit Summary** | LLM-written handover note (markdown modal) + PDF export with embedded fonts and real bold/italic |
| 🕘 **Session history** | Read-only transcripts, resume gates, emergency sessions stay locked |
| 🔐 **Real auth** | Auth0 SPA (PKCE); the user id always comes from the verified token, never the request body |
| 🛡 **Abuse prevention** | Per-user, per-endpoint rate limits (429 + `Retry-After`), CORS allowlist, private storage with owner-scoped policies |

## Architecture

```
                 ┌────────────────────────────────────────┐
                 │   React 19 SPA  (Vercel CDN)           │
                 │   Tailwind 4 · zustand · Auth0 PKCE    │
                 └───────────────┬────────────────────────┘
                                 │  HTTPS + Auth0 access token
                                 ▼
    ┌────────────────────────────────────────────────────────────┐
    │  Supabase Edge Functions (Deno)  — 8 endpoints             │
    │                                                            │
    │  1. verify Auth0 JWT (JWKS)     2. per-user rate limit     │
    │  3. red-flag screen (deterministic + LLM safety net)       │
    │  4. intake agent (Groq LLM)  → structured symptoms         │
    │  5. triage engine (deterministic discriminators + tiers)   │
    │  6. explainer / follow-up agents → advice + conditions     │
    └───────────────┬───────────────────────────┬────────────────┘
                    ▼                           ▼
        Supabase Postgres            Supabase Storage
        (sessions, turns,            (private image bucket,
         summaries, rate limits)      owner-scoped paths)
```

**Why hybrid AI + deterministic?** The LLM never decides the triage tier by
itself. Groq models extract structure and write the explanation; the *decision*
comes from a hand-written discriminator table a developer can read, test, and
audit (`tests/triageEngine.test.ts` — 15 tests). AI for language, code for
judgment.

## Repo layout

```
saluscare/
├── saluscare-frontend/     React SPA (this is what's deployed on Vercel)
│   ├── src/pages/          AskPage (chat), SessionDetailPage, SessionsPage, …
│   ├── src/components/     chat UI, ResultCard, DoctorSummaryModal, landing
│   ├── src/lib/            API client, PDF export (doctorSummaryPdf.ts)
│   └── vercel.json         SPA rewrite so /session/... survives refresh
│
├── saluscare-backend/      Supabase Edge Functions (Deno) + tests
│   ├── supabase/functions/ session-start · session-message · session-image
│   │                       session-followup · session-history · session-followups
│   │                       session-summaries · session-summary
│   ├── supabase/_shared/   agents, triage engine, red-flag matcher, auth,
│   │                       rate limiter, CORS, storage keys
│   ├── tests/              132 vitest unit tests (no network needed)
│   └── supabase/config.toml  verify_jwt = false (Auth0 tokens verified in code)
│
└── .github/workflows/      CI: lint + build + test for BOTH apps on every push
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 | Fast DX, modern defaults |
| State | zustand, TanStack Query | Minimal boilerplate |
| Auth | Auth0 (SPA + PKCE) | No passwords in our DB |
| AI | Groq (Llama models, vision-capable) | Fast inference, JSON-mode outputs with retry |
| Backend | Supabase Edge Functions (Deno) | Serverless, zero infra |
| Data | Supabase Postgres + RLS, Storage | Row-level security, private buckets |
| PDF | jsPDF with embedded Roboto TTFs | Text stays selectable/copyable (see `src/lib/doctorSummaryPdf.ts` for why) |
| Hosting | Vercel (frontend) · Supabase (backend) | Push-to-deploy, free tiers |

## Run it locally

**Prerequisites:** Node 22+, a [Supabase](https://supabase.com) project, an
[Auth0](https://auth0.com) tenant, and a [Groq](https://groq.com) API key.

**1. Backend**

```bash
cd saluscare-backend
npm install
npm test                 # 132 unit tests — proves the core works with zero setup
```

For the edge functions, create `.env` (see the
[backend README](./saluscare-backend/README.md#setup) for the full key table),
then either run them locally (`npx supabase functions serve`) or deploy:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy session-message   # (repeat per function)
npx supabase secrets set GROQ_API_KEY=... AUTH0_DOMAIN=... AUTH0_AUDIENCE=...
```

**2. Frontend**

```bash
cd saluscare-frontend
npm install
npm run dev             # http://localhost:5173
```

Create `saluscare-frontend/.env`:

| Key | Example |
|---|---|
| `VITE_AUTH0_DOMAIN` | `dev-xxxx.us.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | your SPA application's client id |
| `VITE_AUTH0_AUDIENCE` | your Auth0 API identifier |
| `VITE_SUPABASE_FUNCTIONS_URL` | `https://<ref>.supabase.co/functions/v1` |

All four are **public client config** (safe to ship in the browser bundle).
Server secrets (`GROQ_API_KEY`, service-role key, Auth0 M2M secret) live only
in Supabase secrets — never in the frontend.

## Testing

| Suite | Command | Count |
|---|---|---|
| Frontend units | `cd saluscare-frontend && npm test` | 33 |
| Backend units | `cd saluscare-backend && npm test` | 132 |
| Backend end-to-end | `cd saluscare-backend && python scripts/smoke_test.py` | 18 checks vs deployed functions |
| CI | GitHub Actions — both apps on every push | ✅ |

## Deployment (current production)

- **Frontend** — Vercel, git-connected to `main`, Root Directory
  `saluscare-frontend`. Every push auto-deploys; PRs get preview URLs.
- **Edge functions** — deployed per-function:
  `npx supabase functions deploy <name>` (all 8 are live, `verify_jwt = false`
  because Auth0 tokens are verified in-code against the JWKS).
- **Secrets** — `GROQ_API_KEY`, `AUTH0_*`, `ALLOWED_ORIGINS` in Supabase
  secrets; only `VITE_*` public config in Vercel.

## Security model (short version)

- Identity comes **only** from the verified Auth0 token (`sub`) — never from
  request bodies. Postgres RLS is enabled with **no client policies**; access
  is service-role + in-code user scoping.
- Image storage paths are namespaced per user; the bucket is private with a
  10 MB cap and MIME allowlist.
- Rate limiting is an atomic SQL function, per user per endpoint; it fails
  *open* so an outage can't take triage down.
- Red-flag matching fails *safe*: unknown phrasings escalate, negations only
  suppress clearly negated mentions, and the LLM safety net errs toward
  emergency.

Full details: [backend README → Security model](./saluscare-backend/README.md#security-model)

---

Built as a full-stack healthcare AI project. Feedback and PRs welcome — but
remember: **this is a demo of engineering, not a medical device.** 🩺
