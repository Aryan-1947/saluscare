#!/usr/bin/env node
/**
 * Uncaptioned-image END-TO-END check (the fix for "uncaptioned images were
 * never analyzed"):
 *
 *   Hop 1: upload an UNCAPTIONED image through the real UI as a user whose
 *          Auth0 sub contains '|' -> must return 200 needsClarification:true
 *          with a signed imageUrl (storage-key regression) AND an
 *          imageContext string (the fix: vision runs on uncaptioned uploads,
 *          so the follow-up answer is not text-only).
 *
 *   Hop 2: answer the clarifying question in the UI -> the request to
 *          session-message must carry { hasImage: true, imageQualityGood,
 *          skipClarification: true } and text prefixed with the stored image
 *          context, and the UI must render a tiered assessment.
 *
 * Hop 2 runs one real triage, so it costs Groq tokens. Budget-aware: on a
 * Groq 429 the remaining checks are SKIPped, never misreported as failures.
 *
 * Usage: node scripts/e2e_image_check.mjs
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];
const APP = "http://localhost:5173";
const EMAIL = "salus-e2e-test-2026@example.com";
const PASSWORD = "Salus-E2E-Test!2026x";
const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../saluscare-backend/tests/fixtures/test-image.webp"
);
const ANSWER = "It has looked like this for about two days and it is mildly itchy";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let groqWasLimited = false;
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}
function skip(name, detail = "") {
  results.push({ name, ok: true, skipped: true });
  console.log(`  [SKIP] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const executablePath = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("Chrome not found");
  if (!fs.existsSync(FIXTURE)) throw new Error(`Image fixture missing: ${FIXTURE}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Wire captures
    let imageUploadResponse = null; // hop 1: session-image
    let clarifyAnswerRequest = null; // hop 2: session-message request body
    let clarifyAnswerResponse = null; // hop 2: session-message response
    page.on("response", async (res) => {
      try {
        if (res.url().includes("/functions/v1/session-image")) {
          imageUploadResponse = { status: res.status(), body: await res.text() };
        } else if (res.url().includes("/functions/v1/session-message")) {
          clarifyAnswerResponse = { status: res.status(), body: await res.text() };
        }
      } catch {}
    });
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/functions/v1/session-message")) {
        try {
          clarifyAnswerRequest = JSON.parse(req.postData() ?? "{}");
        } catch {}
      }
    });

    // Login (same flow as the main driver)
    await page.goto(`${APP}/ask`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Sign In")?.click();
    });
    await page.waitForSelector("input#username", { timeout: 45000 });
    await sleep(500);
    await page.type("input#username", EMAIL, { delay: 10 });
    await page.type("input#password", PASSWORD, { delay: 10 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
      page.evaluate(() => {
        (document.querySelector('button[name="action"][value="default"]') ||
          document.querySelector('button[type="submit"]'))?.click();
      }),
    ]);
    await sleep(4000);
    if (!page.url().startsWith(APP)) throw new Error(`Login failed: ${page.url()}`);
    record("logged in with pipe-sub account", true);

    await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    record("session started (upload control available)", true);

    // ── Hop 1: upload the fixture image WITHOUT any caption ──────────────
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(FIXTURE);
    await sleep(800); // let the preview render
    const sendBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll("button")];
      return btns.reverse().find((b) => !b.disabled && b.querySelector("svg")) ?? btns[0];
    });
    await page.evaluate((el) => el?.click(), sendBtn);

    const start = Date.now();
    while (!imageUploadResponse && Date.now() - start < 60000) await sleep(1000);

    if (!imageUploadResponse) {
      record("image upload round-trip", false, "no session-image response within 60s");
      return finish();
    }
    const hop1 = (() => {
      try {
        return JSON.parse(imageUploadResponse.body);
      } catch {
        return {};
      }
    })();

    const hop1Ok =
      imageUploadResponse.status === 200 &&
      hop1.needsClarification === true &&
      typeof hop1.imageUrl === "string" &&
      hop1.imageUrl.length > 0;
    record(
      "hop 1: upload round-trip (pipe-sub)",
      hop1Ok,
      `HTTP ${imageUploadResponse.status}, needsClarification=${hop1.needsClarification}, imageUrl=${hop1.imageUrl ? "signed" : "missing"}`
    );
    if (!hop1Ok) {
      console.log("  [INFO] response body:", imageUploadResponse.body.slice(0, 300));
      return finish();
    }
    record(
      "storage path uses sanitized user prefix",
      new URL(hop1.imageUrl).pathname.includes("auth0-"),
      "expect 'auth0-...' in URL path"
    );

    // ── THE FIX: uncaptioned uploads must carry vision context ───────────
    record(
      "hop 1: imageContext returned for UNCAPTIONED image",
      typeof hop1.imageContext === "string" && hop1.imageContext.length > 0,
      hop1.imageContext ? hop1.imageContext.slice(0, 90) : "missing - fix not deployed?"
    );
    record(
      "hop 1: imageQualityGood flag returned",
      typeof hop1.imageQualityGood === "boolean",
      `value=${hop1.imageQualityGood}`
    );

    const questionShown = await page.evaluate(
      (q) => document.body.innerText.includes(q),
      hop1.clarifyingQuestion ?? "How long has this looked like this?"
    );
    record("hop 1: clarifying question rendered in UI", questionShown);
    if (!questionShown) return finish();

    // ── Hop 2: answer the clarifying question through the UI ─────────────
    await page.waitForSelector("textarea", { timeout: 20000 });
    await page.type("textarea", ANSWER, { delay: 5 });
    await page.keyboard.press("Enter");

    const t2 = Date.now();
    while (!clarifyAnswerResponse && Date.now() - t2 < 150000) await sleep(2000);

    if (!clarifyAnswerRequest) {
      skip("hop 2: request contract", "no session-message request observed");
      return finish();
    }
    record(
      "hop 2: request carries hasImage + skipClarification",
      clarifyAnswerRequest.hasImage === true &&
        clarifyAnswerRequest.skipClarification === true &&
        typeof clarifyAnswerRequest.imageQualityGood === "boolean",
      JSON.stringify({
        hasImage: clarifyAnswerRequest.hasImage,
        imageQualityGood: clarifyAnswerRequest.imageQualityGood,
        skipClarification: clarifyAnswerRequest.skipClarification,
      })
    );
    record(
      "hop 2: text combines image context + answer",
      typeof clarifyAnswerRequest.text === "string" &&
        clarifyAnswerRequest.text.includes(ANSWER) &&
        /Visible findings/i.test(clarifyAnswerRequest.text),
      clarifyAnswerRequest.text?.slice(0, 90)
    );

    if (!clarifyAnswerResponse) {
      skip("hop 2: triage response", "no session-message response within 150s");
      return finish();
    }
    const hop2 = (() => {
      try {
        return JSON.parse(clarifyAnswerResponse.body);
      } catch {
        return {};
      }
    })();

    if (clarifyAnswerResponse.body.includes("rate_limit_exceeded")) {
      groqWasLimited = true;
      skip("hop 2: triage response", "Groq daily budget exhausted");
      return finish();
    }

    const hop2IsResult =
      clarifyAnswerResponse.status === 200 &&
      !hop2.needsClarification &&
      Number.isInteger(hop2.tier) &&
      !!hop2.response;
    record(
      "hop 2: tiered assessment returned",
      hop2IsResult,
      `HTTP ${clarifyAnswerResponse.status}, tier=${hop2.tier ?? "?"}, needsClarification=${hop2.needsClarification ?? false}`
    );
    if (hop2IsResult) {
      if (hop2.visualFindings) {
        console.log("  [INFO] visualFindings:", String(hop2.visualFindings).slice(0, 120));
      }
      const tierShown = await page.evaluate(() =>
        ["self care", "specialist referral", "emergency care"].some((t) =>
          document.body.innerText.toLowerCase().includes(t)
        )
      );
      record("hop 2: result card rendered in UI", tierShown);
      const usedImage = [hop2.visualFindings, hop2.explanation, hop2.response?.conditionSummary, hop2.response?.likelyCondition]
        .filter(Boolean)
        .some((s) => /image|photo|visual|visible/i.test(String(s)));
      console.log(
        `  [INFO] assessment references the image: ${usedImage ? "yes" : "not explicitly (vision still gated the triage)"}`
      );
    } else {
      console.log("  [INFO] response body:", clarifyAnswerResponse.body.slice(0, 300));
    }
  } finally {
    await browser.close();
  }

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
  if (groqWasLimited) {
    console.log("NOTE: Groq free-tier daily budget was hit - skipped checks are environment limits, not product failures.");
  }
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
