# SalusCare Frontend

AI-powered symptom triage web app — React 19 + TypeScript + Vite + Tailwind CSS 4.
Talk to a triage assistant in chat, attach photos of symptoms, get a tiered
assessment (self-care / specialist / emergency), and export a doctor-visit
summary as a PDF.

## Features

- **Conversational triage** — WhatsApp-style chat with streaming results,
  voice input, and drag-and-drop image attach
- **Red-flag safety net** — deterministic emergency screening before the LLM
  ever sees the message (handled by the backend)
- **Session history** — resume past assessments or browse read-only transcripts
- **Doctor visit summary** — markdown modal + PDF download (jspdf with embedded
  Roboto; see `src/lib/doctorSummaryPdf.ts` for why)
- **Landing page** — themeable (light/dark), animated, filterable feature
  carousel
- **Speech recognition** — mic dictation via the Web Speech API

## Getting started

```bash
npm install
cp .env.example .env   # if present; otherwise create .env with the keys below
npm run dev            # http://localhost:5173
```

Required `.env` keys:

| Key | Purpose |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA application ID |
| `VITE_AUTH0_AUDIENCE` | Auth0 API audience |
| `VITE_SUPABASE_FUNCTIONS_URL` | Supabase edge functions base URL (`https://<ref>.supabase.co/functions/v1`) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check then production build to `dist/` |
| `npm test` | Vitest suite (unit tests, jsdom) |
| `npm run lint` | ESLint |

## Architecture

```
src/
  pages/            AskPage (chat), SessionDetailPage, SessionsPage, Landing, Login
  components/
    ask/            chat UI, ResultCard, DoctorSummaryModal, EcgMonitor
    landing/        hero, carousel, FAQ, footer
    layout/         Navbar, AppLayout (auth-gated shell)
  lib/              api client, PDF export, session log helpers
  hooks/            useApi (auth'd fetch), useSpeechRecognition
  stores/           zustand stores (theme, ...)
  types/            shared API response types
```

The frontend is a pure client: every request carries an Auth0 access token to
the backend edge functions (see the `saluscare-backend/` sibling folder for the
API, triage engine, and deployment). No secrets live in this bundle — all
`VITE_*` vars are public client configuration.

## Backend companion

This app pairs with [`saluscare-backend/`](../saluscare-backend) — Supabase
Edge Functions doing red-flag screening, LLM triage (Groq), rate limiting, and
storage. Its README covers API architecture and deployment.
