#!/usr/bin/env python
"""End-to-end smoke test for the deployed SalusCare edge functions.

Usage (from saluscare-backend/):
    python scripts/smoke_test.py

Reads AUTH0_* and SUPABASE_URL from .env, fetches a fresh M2M token at
runtime (never printed), then exercises every endpoint including the
clarification protocol, the follow-up lifecycle, red flags, and the
image flow. Exits non-zero if any check fails.
"""

import base64
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

# Windows consoles default to cp1252 and crash printing arrows/curly quotes.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGE_FIXTURE = ROOT / "tests" / "fixtures" / "test-image.webp"

results: list[tuple[str, str, str]] = []  # (name, status, detail)

# Set when a call fails with Groq's daily token-budget (TPD) error. The free
# tier allows ~200k tokens per rolling 24h window and heavy testing re-consumes
# it — that is an environment limit, not a product failure, so affected checks
# are reported as SKIP instead of FAIL.
groq_budget_down = False


def is_groq_budget_error(body) -> bool:
    s = body if isinstance(body, str) else json.dumps(body)
    return "tokens per day" in s and ("rate_limit_exceeded" in s or "TPD" in s)


def is_budget_blocked(code: int, body) -> bool:
    """True when the response is Groq's daily-token-budget rejection.
    Groq sends 429; edge functions may wrap it as 500. Our own limiter's 429
    body ("Rate limit exceeded") does NOT match this signature."""
    return code in (429, 500) and is_groq_budget_error(body)


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip("\"'")
    return env


def get_token(env: dict) -> str:
    data = urllib.parse.urlencode({
        "client_id": env["AUTH0_CLIENT_ID"],
        "client_secret": env["AUTH0_CLIENT_SECRET"],
        "audience": env["AUTH0_AUDIENCE"],
        "grant_type": "client_credentials",
    }).encode()
    req = urllib.request.Request(
        f"https://{env['AUTH0_DOMAIN']}/oauth/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)["access_token"]


def call(base: str, token: str, method: str, path: str, body: dict | None = None,
         retries: int = 2) -> tuple[int, dict | list | str]:
    """HTTP call with retry on 429 (Groq/Supabase rate limits)."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    for attempt in range(retries + 1):
        req = urllib.request.Request(f"{base}/functions/v1/{path}", data=data,
                                     headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                raw = resp.read().decode("utf-8")
                try:
                    return resp.status, json.loads(raw)
                except json.JSONDecodeError:
                    return resp.status, raw
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < retries:
                wait = 15 * (attempt + 1)
                print(f"    (429 rate-limited, waiting {wait}s...)")
                time.sleep(wait)
                continue
            try:
                return e.code, json.loads(raw)
            except json.JSONDecodeError:
                return e.code, raw
    raise RuntimeError("unreachable")


def record(name: str, ok: bool, detail: str):
    status = "PASS" if ok else "FAIL"
    results.append((name, status, detail))
    print(f"  [{status}] {name} — {detail}")


def record_skip(name: str, detail: str):
    results.append((name, "SKIP", detail))
    print(f"  [SKIP] {name} — {detail}")


def summary() -> bool:
    print("\n" + "=" * 60)
    failed = [r for r in results if r[1] == "FAIL"]
    skipped = [r for r in results if r[1] == "SKIP"]
    for name, status, detail in results:
        print(f"  {status}  {name}")
    print("=" * 60)
    print(f"  {len(results) - len(failed) - len(skipped)} passed, {len(failed)} failed, {len(skipped)} skipped (Groq budget)")
    if skipped:
        print("  NOTE: Groq free tier = ~200k tokens / rolling 24h. Skipped checks are")
        print("        environment limits, not product failures — rerun after the window clears.")
    return not failed


def main() -> int:
    global groq_budget_down
    env = load_env()
    missing = [k for k in ("AUTH0_DOMAIN", "AUTH0_AUDIENCE", "AUTH0_CLIENT_ID",
                           "AUTH0_CLIENT_SECRET", "SUPABASE_URL") if not env.get(k)]
    if missing:
        print(f"Missing in .env: {missing}")
        return 2

    base = env["SUPABASE_URL"].rstrip("/")
    token = get_token(env)
    print(f"Token acquired ({len(token)} chars). Base: {base}\n")

    # Clear leftover rate-limit counters so reruns within the 5-minute window
    # are deterministic (counters table only; no user data involved).
    if env.get("SUPABASE_SERVICE_ROLE_KEY"):
        try:
            req = urllib.request.Request(
                f"{base}/rest/v1/rate_limit_hits?hit_id=gt.0", method="DELETE",
                headers={"apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
                         "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}"})
            urllib.request.urlopen(req, timeout=30)
            print("Rate-limit counters cleared.\n")
        except urllib.error.HTTPError as e:
            print(f"Note: could not clear counters (HTTP {e.code}) - reruns may 429 early.\n")

    # ── 1. Auth enforcement ────────────────────────────────────────────────
    req = urllib.request.Request(f"{base}/functions/v1/session-start", data=b"", method="POST")
    try:
        urllib.request.urlopen(req, timeout=30)
        record("401 without token", False, "endpoint accepted an unauthenticated request")
    except urllib.error.HTTPError as e:
        record("401 without token", e.code == 401, f"HTTP {e.code}")

    # ── 2. session-start ───────────────────────────────────────────────────
    code, body = call(base, token, "POST", "session-start")
    sid_main = body.get("sessionId") if isinstance(body, dict) else None
    record("session-start", code == 200 and bool(sid_main), f"HTTP {code}, sessionId={sid_main}")

    # ── 3. session-message: sufficient info → full triage result ──────────
    # skipClarification makes this deterministic: without it the intake agent
    # may legitimately ask a clarifying question instead of triaging.
    sid_worse: str | None = None
    sid_red: str | None = None
    sid_para: str | None = None
    sid_neg: str | None = None
    sid_img: str | None = None
    sid_img2: str | None = None
    code, body = call(base, token, "POST", "session-message", {
        "text": "I have a sore throat for the past two days, the pain is moderate and worse when I swallow",
        "sessionId": sid_main,
        "skipClarification": True,
    })
    if code >= 500 and is_groq_budget_error(body) or code == 429 and is_groq_budget_error(body):
        groq_budget_down = True
        record_skip("session-message triage", "Groq free-tier daily token budget exhausted (rolling 24h window)")
    else:
        ok = code == 200 and body.get("tier") in (1, 2, 3) and bool(body.get("response"))
        expl_len = len(body.get("explanation") or "")
        record("session-message triage", ok,
               f"HTTP {code}, tier={body.get('tier')}, explanation={expl_len} chars")

    # ── 4. session-history: turns logged, incl. assistant result ──────────
    if groq_budget_down:
        record_skip("session-history logs turns", "depends on the triage call above")
    else:
        code, body = call(base, token, "GET", f"session-history?sessionId={sid_main}")
        turns = body.get("turns", []) if isinstance(body, dict) else []
        roles = [t.get("role") for t in turns]
        record("session-history logs turns", code == 200 and "user" in roles and "assistant" in roles,
               f"HTTP {code}, turns={len(turns)}, roles={roles}")

    # ── 5. Follow-up lifecycle ─────────────────────────────────────────────
    sid_gq = str(uuid.uuid4())
    if groq_budget_down:
        record_skip("followup: general question answered", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-followup", {
            "text": "What foods should I avoid while my throat hurts?",
            "parentSessionId": sid_main, "newSessionId": sid_gq,
        })
        if is_budget_blocked(code, body):
            groq_budget_down = True
            record_skip("followup: general question answered", "Groq daily token budget exhausted")
        else:
            ok = code == 200 and body.get("isGeneralAnswer") is True and bool(body.get("answer"))
            record("followup: general question answered", ok,
                   f"HTTP {code}, isGeneralAnswer={body.get('isGeneralAnswer') if isinstance(body, dict) else '?'}")

    if groq_budget_down:
        record_skip("general question keeps parent open", "depends on the general-question call")
    else:
        code, body = call(base, token, "GET", "session-followups")
        open_ids = {f.get("sessionId") for f in body.get("followups", [])} if isinstance(body, dict) else set()
        record("general question keeps parent open", sid_main in open_ids,
               f"open: {[i[:8] for i in open_ids]}")

    sid_worse = str(uuid.uuid4())
    if groq_budget_down:
        record_skip("followup: worsened escalates tier", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-followup", {
            "text": "The sore throat is much worse today, I can barely swallow and the pain is severe",
            "parentSessionId": sid_main, "newSessionId": sid_worse,
        })
        tier = body.get("tier") if isinstance(body, dict) else None
        if is_budget_blocked(code, body):
            groq_budget_down = True
            record_skip("followup: worsened escalates tier", "Groq daily token budget exhausted")
        else:
            ok = code == 200 and tier in (2, 3)
            record("followup: worsened escalates tier", ok, f"HTTP {code}, tier={tier}")

    if groq_budget_down:
        record_skip("worsened closes parent, opens new", "depends on the worsened call")
    else:
        code, body = call(base, token, "GET", "session-followups")
        open_ids = {f.get("sessionId") for f in body.get("followups", [])} if isinstance(body, dict) else set()
        record("worsened closes parent, opens new", sid_main not in open_ids and sid_worse in open_ids,
               f"open: {[i[:8] for i in open_ids]}")

    sid_red = str(uuid.uuid4())
    # Deterministic red-flag layer: stored patterns ('difficulty breathing',
    # 'throat closing') are matched with negation-guarded, spacing/plural-tolerant
    # scanning, so exact keywords exercise the fast path.
    if groq_budget_down:
        record_skip("followup: red flag -> tier 3 emergency", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-followup", {
            "text": "Now I have severe difficulty breathing and my throat closing is happening, it feels like anaphylaxis",
            "parentSessionId": sid_worse, "newSessionId": sid_red,
        })
        record("followup: red flag -> tier 3 emergency", code == 200 and body.get("tier") == 3,
               f"HTTP {code}, tier={body.get('tier') if isinstance(body, dict) else '?'}")

    # Paraphrased emergency (contains no stored red-flag keyword): must be
    # caught by the LLM safety-net layer, not the deterministic scan.
    if groq_budget_down:
        record_skip("paraphrased emergency caught by LLM safety net", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-start")
        sid_para = body.get("sessionId") if isinstance(body, dict) else None
        code, body = call(base, token, "POST", "session-message", {
            "text": "the swelling is blocking my airway and I can't get any air",
            "sessionId": sid_para,
            "skipClarification": True,
        })
        record("paraphrased emergency caught by LLM safety net", code == 200 and body.get("tier") == 3,
               f"HTTP {code}, tier={body.get('tier') if isinstance(body, dict) else '?'}")

    # Negation guard: red-flag phrases mentioned in the negative must NOT
    # trigger the emergency path (regression: 'no chest pain' used to trip it).
    if groq_budget_down:
        record_skip("negated red flag does not trigger emergency", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-start")
        sid_neg = body.get("sessionId") if isinstance(body, dict) else None
        code, body = call(base, token, "POST", "session-message", {
            "text": "I had a scare yesterday but I have no chest pain now, no difficulty breathing, just mild fatigue since this morning",
            "sessionId": sid_neg,
            "skipClarification": True,
        })
        tier = body.get("tier") if isinstance(body, dict) else None
        record("negated red flag does not trigger emergency", code == 200 and tier in (1, 2),
               f"HTTP {code}, tier={tier}")

    # ── 6. session-image: with caption → vision fusion → full result ──────
    sid_img = str(uuid.uuid4())
    img_b64 = base64.b64encode(IMAGE_FIXTURE.read_bytes()).decode()
    if groq_budget_down:
        record_skip("session-image (captioned)", "Groq daily token budget exhausted")
    else:
        code, body = call(base, token, "POST", "session-image", {
            "imageBase64": img_b64,
            "imageMimeType": "image/webp",
            "text": "This is my skin, it has been irritated for two days and it is mildly itchy",
            "sessionId": sid_img,
        })
        if isinstance(body, dict) and body.get("needsClarification"):
            record("session-image (captioned)", True,
                   f"HTTP {code}, needsClarification (valid path): {body.get('clarifyingQuestion', '')[:60]}")
        else:
            vf = body.get("visualFindings") if isinstance(body, dict) else None
            ok = code == 200 and bool(body.get("response")) and vf is not None
            record("session-image (captioned)", ok,
                   f"HTTP {code}, tier={body.get('tier') if isinstance(body, dict) else '?'}, visualFindings={str(vf)[:60]}")

    # history should show the image turn with a re-signed URL
    if groq_budget_down:
        record_skip("image turn logged with signed URL", "depends on the captioned image call")
    else:
        code, body = call(base, token, "GET", f"session-history?sessionId={sid_img}")
        turns = body.get("turns", []) if isinstance(body, dict) else []
        img_turns = [t for t in turns if t.get("kind") == "image"]
        has_url = img_turns and bool(img_turns[0].get("imageUrl"))
        record("image turn logged with signed URL", code == 200 and bool(img_turns) and has_url,
               f"HTTP {code}, image turns={len(img_turns)}, signedUrl={'yes' if has_url else 'no'}")

    # ── 7. session-image: no caption → forced clarification ───────────────
    sid_img2 = str(uuid.uuid4())
    code, body = call(base, token, "POST", "session-image", {
        "imageBase64": img_b64, "imageMimeType": "image/webp", "sessionId": sid_img2,
    })
    ok = code == 200 and body.get("needsClarification") is True and bool(body.get("imageUrl"))
    record("session-image (no caption) asks clarification", ok,
           f"HTTP {code}, question={body.get('clarifyingQuestion', '')[:50] if isinstance(body, dict) else '?'}")

    # ── 8. Isolation probe: unknown session → empty, not an error ─────────
    code, body = call(base, token, "GET",
                      "session-history?sessionId=00000000-0000-0000-0000-000000000000")
    record("isolation probe returns empty", code == 200 and body.get("turns") == [],
           f"HTTP {code}, turns={body.get('turns') if isinstance(body, dict) else '?'}")

    # ── 9. CORS: preflight responses are origin-allowlisted ───────────────
    def options_call(path: str, origin: str | None):
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = origin
        req = urllib.request.Request(f"{base}/functions/v1/{path}", data=None,
                                     headers=headers, method="OPTIONS")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, resp.headers
        except urllib.error.HTTPError as e:
            return e.code, e.headers

    code, hdrs = options_call("session-start", "http://localhost:5173")
    acao = hdrs.get("Access-Control-Allow-Origin")
    record("CORS: localhost dev origin allowed", code in (200, 204) and acao == "http://localhost:5173",
           f"HTTP {code}, ACAO={acao}")

    code, hdrs = options_call("session-start", "https://evil.example.com")
    acao = hdrs.get("Access-Control-Allow-Origin")
    record("CORS: unknown origin gets no ACAO header", acao is None, f"HTTP {code}, ACAO={acao}")

    # ── 10. Rate limiting: burst session-start until 429 ──────────────────
    # Runs LAST so earlier checks are unaffected. Stops at the first 429 to
    # minimize consumption. A re-run within the 5-minute window may see an
    # immediate 429 (leftover hits) — that still proves the limiter exists.
    # If no 429 ever appears across the burst, rate limiting is missing.
    got_429_headers = None
    attempts = 0
    for i in range(40):
        attempts = i + 1
        try:
            req = urllib.request.Request(
                f"{base}/functions/v1/session-start", data=b"", method="POST",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                pass
        except urllib.error.HTTPError as e:
            if e.code == 429:
                got_429_headers = e.headers
                break
    retry_after = got_429_headers.get("Retry-After") if got_429_headers else None
    record("rate limit: 429 + Retry-After on burst", got_429_headers is not None and bool(retry_after),
           f"429 after {attempts} requests, Retry-After={retry_after}")

    print(f"\nSessions created this run: {sid_main}, {sid_worse}, {sid_red}, {sid_para}, {sid_neg}, {sid_img}, {sid_img2}")
    return 0 if summary() else 1


if __name__ == "__main__":
    sys.exit(main())
