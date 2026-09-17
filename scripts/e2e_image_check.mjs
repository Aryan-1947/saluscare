#!/usr/bin/env node
/**
 * Focused check for the storage-key bug: upload an UNCAPTIONED image through
 * the real UI as a user whose Auth0 sub contains '|' (google subs / auth0 subs
 * both do). The uncaptioned path is upload -> clarification, which needs NO
 * Groq tokens, so this works even when the LLM daily budget is exhausted.
 *
 * Expected: HTTP 200 needsClarification:true with a signed imageUrl —
 * NOT the old "Image upload failed: Invalid key" 500.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
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

    let imageUploadResponse = null;
    page.on("response", async (res) => {
      if (res.url().includes("/functions/v1/session-image")) {
        try {
          imageUploadResponse = { status: res.status(), body: await res.text() };
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

    // Wait for the ask page to be ready
    await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    record("session started (upload control available)", true);

    // Attach the fixture image WITHOUT any caption and submit
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(FIXTURE);
    await sleep(800); // let the preview render
    const sendBtn = await page.evaluateHandle(() => {
      // The send button is the last enabled button in the input bar area
      const btns = [...document.querySelectorAll("button")];
      return btns.reverse().find((b) => !b.disabled && b.querySelector("svg")) ?? btns[0];
    });
    await page.evaluate((el) => el?.click(), sendBtn);

    // Wait for the response (upload + clarify) — up to 60s
    const start = Date.now();
    while (!imageUploadResponse && Date.now() - start < 60000) await sleep(1000);

    if (!imageUploadResponse) {
      record("image upload round-trip", false, "no session-image response within 60s");
    } else {
      const body = (() => {
        try {
          return JSON.parse(imageUploadResponse.body);
        } catch {
          return {};
        }
      })();
      const ok =
        imageUploadResponse.status === 200 &&
        body.needsClarification === true &&
        typeof body.imageUrl === "string" &&
        body.imageUrl.length > 0;
      record(
        "image upload round-trip (pipe-sub)",
        ok,
        `HTTP ${imageUploadResponse.status}, needsClarification=${body.needsClarification}, imageUrl=${body.imageUrl ? "signed" : "missing"}`
      );
      if (!ok) {
        console.log("  [INFO] response body:", imageUploadResponse.body.slice(0, 300));
      } else {
        const safePrefix = new URL(body.imageUrl).pathname.includes("auth0-");
        record("storage path uses sanitized user prefix", safePrefix, "expect 'auth0-...' in URL path");
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
