#!/usr/bin/env node
/**
 * Live integration check: does THIS frontend, as configured, talk to ITS backend?
 *
 * Reads VITE_SUPABASE_FUNCTIONS_URL (+ VITE_AUTH0_*) from the frontend .env and
 * verifies the three things a dev environment needs before the app can work:
 *
 *   1. CORS preflight from the local dev origin is accepted (ACAO echoed back).
 *   2. Endpoints are reachable and enforce auth (401 without a token).
 *   3. With credentials available (VITE_AUTH0_CLIENT_ID/SECRET -> M2M token),
 *      a real authenticated round-trip: session-start -> history.
 *
 * Usage (from saluscare-frontend/):
 *   node scripts/live_check.mjs
 *
 * Exits non-zero if any required check fails. M2M round-trip checks are
 * skipped (not failed) when no M2M credentials are configured.
 */

import fs from "node:fs";
import path from "node:path";

const results = [];
const UTF8 = { encoding: "utf-8" };

function loadEnv() {
  const env = {};
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, UTF8).split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const [k, ...rest] = t.split("=");
      env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name} — ${detail}`);
}

async function main() {
  const env = loadEnv();
  const base = (env.VITE_SUPABASE_FUNCTIONS_URL || "").replace(/\/$/, "");
  if (!base) {
    console.error("VITE_SUPABASE_FUNCTIONS_URL missing from .env — cannot run live checks.");
    return 2;
  }
  console.log(`Backend: ${base}\n`);

  // ── 1. CORS preflight from the Vite dev origin ─────────────────────────
  const devOrigin = env.VITE_DEV_ORIGIN || "http://localhost:5173";
  const preflight = await fetch(`${base}/session-start`, {
    method: "OPTIONS",
    headers: { Origin: devOrigin, "Access-Control-Request-Method": "POST" },
  }).catch(() => null);
  if (!preflight) {
    record("CORS preflight", false, "network error reaching functions URL");
  } else {
    const acao = preflight.headers.get("access-control-allow-origin");
    record(
      "CORS preflight from dev origin",
      preflight.status === 204 && acao === devOrigin,
      `HTTP ${preflight.status}, ACAO=${acao}`
    );
  }

  // ── 2. Auth enforcement: no token -> 401 ────────────────────────────────
  const unauth = await fetch(`${base}/session-start`, { method: "POST" }).catch(() => null);
  if (!unauth) {
    record("auth enforced", false, "network error reaching functions URL");
  } else {
    record("auth enforced (401 without token)", unauth.status === 401, `HTTP ${unauth.status}`);
  }

  // ── 3. Authenticated round-trip (needs M2M credentials) ────────────────
  const { VITE_AUTH0_DOMAIN: domain, VITE_AUTH0_AUDIENCE: audience, VITE_AUTH0_CLIENT_ID: clientId, VITE_AUTH0_CLIENT_SECRET: clientSecret } = env;
  if (!domain || !audience || !clientId || !clientSecret) {
    record("authenticated round-trip", true, "SKIPPED — no M2M credentials in frontend .env");
  } else {
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        audience,
        grant_type: "client_credentials",
      }),
    }).catch(() => null);
    if (!tokenRes || !tokenRes.ok) {
      record("authenticated round-trip", false, `M2M token fetch failed (HTTP ${tokenRes?.status ?? "network"})`);
      return finish();
    }
    const token = (await tokenRes.json()).access_token;

    const startRes = await fetch(`${base}/session-start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!startRes || !startRes.ok) {
      record("authenticated round-trip", false, `session-start failed (HTTP ${startRes?.status ?? "network"})`);
      return finish();
    }
    const { sessionId } = await startRes.json();
    record("session-start with token", true, `sessionId=${sessionId?.slice(0, 8)}`);

    const histRes = await fetch(`${base}/session-history?sessionId=${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    const histOk = histRes?.ok;
    const histBody = histOk ? await histRes.json() : null;
    record("history round-trip", Boolean(histOk && histBody?.turns), `HTTP ${histRes?.status ?? "network"}, turns=${histBody?.turns?.length ?? "?"}`);
  }

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
