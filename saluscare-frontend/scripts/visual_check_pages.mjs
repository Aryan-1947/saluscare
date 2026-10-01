#!/usr/bin/env node
/**
 * Visual check for the inner-app pages (extends scripts/visual_check.mjs):
 * drives headless Chrome through Auth0 login, then asserts the recently
 * restyled surfaces in BOTH themes:
 *
 *   - App shell background (slate-blue light / deep navy dark)
 *   - Sessions page: tier accent stripes + icon tiles, hover lift, shimmer
 *   - Session detail: glass card parity with AskPage + result card render
 *   - Ask page: glass card + slate-blue shell
 *   - 404 page: glass card + med-cross backdrop in both themes
 *
 * The e2e account has no logged sessions, so the script seeds two fake
 * session roots and intercepts session-summaries / session-history with
 * fabricated responses. Auth0 stays real; no Groq tokens are spent.
 *
 * Usage: node scripts/visual_check_pages.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];
const APP = process.argv[2] ?? "http://localhost:5173";
const EMAIL = "salus-e2e-test-2026@example.com";
const PASSWORD = "Salus-E2E-Test!2026x";

const BG = {
  light: "rgb(238, 242, 247)", // #EEF2F7
  dark: "rgb(11, 15, 25)", // #0B0F19
};

const results = [];
function record(name, ok, detail = "") {
  results.push(ok);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem("salus-theme", t), theme);
}

/** Seed fake session roots + mock summaries/history (skips real backend). */
async function installMocks(page) {
  await page.evaluateOnNewDocument(() => {
    const ridA = "11111111-1111-4111-8111-111111111111";
    const ridB = "22222222-2222-4222-8222-222222222222";

    const tier1Response = {
      conditionSummary: "Tension-type headache",
      likelyCauses: "Muscle tension, screen strain, dehydration",
      homeRemedies: ["Rest in a dark room", "Stay hydrated"],
      firstAid: [{ text: "Apply a cool compress to the forehead", precaution: null }],
      recoveryPlan: [{ step: 1, instruction: "Rest and hydrate" }],
      foodsToEat: ["Water-rich foods"],
      foodsToAvoid: ["Alcohol"],
      thingsToAvoid: ["Prolonged screen time"],
      expectedRecoveryTime: "3-5 days",
      warningSigns: ["Sudden severe headache", "Fever with stiff neck"],
      followUpPrompt: "Let us know if the pain worsens.",
      usedCategoryFallback: false,
      needsWebSearchGrounding: false,
    };
    const tier2Response = {
      likelyCondition: "Acute otitis media",
      whySpecialistNeeded: "Possible bacterial infection needing assessment",
      recommendedSpecialist: "ENT specialist",
      specialistReason: "Ear pain with muffled hearing may need otoscopy",
      interimCareSteps: ["Avoid getting water in the ear"],
      safeHomeRemedies: ["Warm compress"],
      firstAid: [{ text: "Use paracetamol for pain", precaution: "Follow pack dosage" }],
      foodsToEat: ["Soft foods"],
      foodsToAvoid: ["Very cold drinks"],
      precautions: ["Do not insert cotton buds"],
      emergencyWatchFor: ["High fever", "Swelling behind the ear"],
      usedCategoryFallback: false,
      needsWebSearchGrounding: false,
    };

    const summaries = {
      summaries: [
        {
          sessionId: ridA,
          complaintText: "Throbbing headache behind the right eye for two days",
          tier: 1,
          lastActivityAt: new Date(Date.now() - 3600e3).toISOString(),
        },
        {
          sessionId: ridB,
          complaintText: "Persistent ear pain with muffled hearing since yesterday",
          tier: 2,
          lastActivityAt: new Date(Date.now() - 86400e3).toISOString(),
        },
      ],
    };

    const historyFor = (id) => ({
      groupId: id,
      turns: [
        {
          role: "user",
          kind: "text",
          content:
            id === ridB
              ? "Persistent ear pain with muffled hearing since yesterday"
              : "Throbbing headache behind the right eye for two days",
          imageUrl: null,
          result: null,
        },
        {
          role: "assistant",
          kind: "question",
          content: "On a scale of 1-10, how severe is the discomfort?",
          imageUrl: null,
          result: null,
        },
        {
          role: "assistant",
          kind: "result",
          content: null,
          imageUrl: null,
          result: {
            sessionId: id,
            tier: id === ridB ? 2 : 1,
            response: id === ridB ? tier2Response : tier1Response,
          },
        },
      ],
    });

    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      if (url.includes("/session-summaries")) {
        return new Response(JSON.stringify(summaries), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/session-history")) {
        const m = url.match(/sessionId=([0-9a-f-]+)/i);
        return new Response(JSON.stringify(historyFor(m ? m[1] : ridA)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input, init);
    };

    // The Auth0 user id is unknowable to this script, so serve the seeded
    // roots for ANY salus-sessions:<sub> key that has no real value yet.
    const realGet = window.localStorage.getItem.bind(window.localStorage);
    window.localStorage.getItem = (k) => {
      if (typeof k === "string" && k.startsWith("salus-sessions:") && !realGet(k)) {
        return JSON.stringify([
          { sessionId: ridA, startedAt: new Date(Date.now() - 3600e3).toISOString() },
          { sessionId: ridB, startedAt: new Date(Date.now() - 86400e3).toISOString() },
        ]);
      }
      return realGet(k);
    };
  });
}

// Computed bg color of the app shell (AppLayout / NotFoundPage wrapper).
async function shellBg(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".min-h-screen");
    return el ? getComputedStyle(el).backgroundColor : null;
  });
}

async function checkSessions(page, theme) {
  const bg = await shellBg(page);
  record(`${theme}: app shell bg is the new palette`, bg === BG[theme], bg ?? "no .min-h-screen");

  const shimmer = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of rules) if (r.selectorText?.includes("shimmer-skeleton")) return true;
    }
    return false;
  });
  record(`${theme}: shimmer skeleton utility defined`, shimmer);

  const state = await page.evaluate(() => ({
    rows: document.querySelectorAll("button[class*='rounded-[12px]']").length,
    stripes: document.querySelectorAll('span[aria-hidden="true"][class*="w-[3px]"]').length,
    tiles: document.querySelectorAll("div[class*='w-10'][class*='rounded-[10px]']").length,
    hasHeadache: document.body.innerText.includes("Throbbing headache behind the right eye"),
  }));
  record(`${theme}: seeded session rows render`, state.rows === 2, `${state.rows} rows`);
  record(`${theme}: tier accent stripes on rows`, state.stripes === 2, `${state.stripes} stripes`);
  record(`${theme}: tier icon tiles on rows`, state.tiles === 2, `${state.tiles} tiles`);
  record(`${theme}: mocked complaint text shown`, state.hasHeadache);

  const stripeColors = await page.evaluate(() =>
    [...document.querySelectorAll('span[aria-hidden="true"][class*="w-[3px]"]')].map(
      (el) => getComputedStyle(el).backgroundColor
    )
  );
  record(
    `${theme}: stripe color differs by tier`,
    new Set(stripeColors).size === 2,
    stripeColors.join(" vs ")
  );

  const row = await page.$("button[class*='rounded-[12px]']");
  if (row) {
    await page.evaluate(() => {
      document.querySelector("button[class*='rounded-[12px]']")?.scrollIntoView({ block: "center" });
    });
    await sleep(300);
    const box = await row.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
      await sleep(400);
      const hovered = await page.evaluate(
        () => document.querySelector("button[class*='rounded-[12px]']")?.matches(":hover") ?? false
      );
      record(`${theme}: session row hover responds`, hovered);
    } else {
      record(`${theme}: session row hover responds`, false, "row not visible");
    }
  }
}

async function checkSessionDetail(page, theme) {
  await page.evaluate(() => {
    document.querySelector("button[class*='rounded-[12px]']")?.click();
  });
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (/\/sessions\/.+/.test(page.url())) break;
    await sleep(300);
  }
  if (!/\/sessions\/.+/.test(page.url())) {
    record(`${theme}: session detail opens`, false, "row click did not navigate");
    return;
  }
  await sleep(1500);
  const state = await page.evaluate(() => ({
    glassCard: !!document.querySelector("div[class*='bg-white/60'][class*='backdrop-blur-xl']"),
    backButton: document.body.innerText.includes("Back to sessions"),
    userBubble: document.body.innerText.includes("Throbbing headache behind the right eye"),
    question: document.body.innerText.includes("On a scale of 1-10"),
    // Tier label renders through a `uppercase` class, and innerText reflects
    // rendered text, so match case-insensitively.
    resultBadge: ["Self Care", "Specialist Referral", "Emergency Care"].find((t) =>
      new RegExp(t, "i").test(document.body.innerText)
    ),
    conditionSummary: document.body.innerText.includes("Tension-type headache"),
    bg: getComputedStyle(document.querySelector(".min-h-screen") ?? document.body).backgroundColor,
  }));
  record(`${theme}: session detail opens`, true, page.url());
  record(`${theme}: session detail glass card present`, state.glassCard);
  record(`${theme}: session detail back link`, state.backButton);
  record(`${theme}: history bubbles render`, state.userBubble && state.question);
  record(`${theme}: result card badge renders`, !!state.resultBadge, state.resultBadge ?? "none");
  record(`${theme}: result card body renders`, state.conditionSummary);
  record(`${theme}: session detail shell bg`, state.bg === BG[theme], state.bg);
  await page.goto(`${APP}/sessions`, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => null);
  await sleep(800);
}

async function checkAskPage(page, theme) {
  await page.goto(`${APP}/ask`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1500);
  const state = await page.evaluate(() => ({
    bg: getComputedStyle(document.querySelector(".min-h-screen") ?? document.body).backgroundColor,
    glassCard: !!document.querySelector("div[class*='bg-white/60'][class*='backdrop-blur-xl']"),
  }));
  record(`${theme}: ask page shell bg`, state.bg === BG[theme], state.bg);
  record(`${theme}: ask page glass card`, state.glassCard);
}

async function check404(page, theme) {
  await page.goto(`${APP}/definitely-not-a-page`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1200);
  const state = await page.evaluate(() => ({
    heading: document.body.innerText.includes("404") && document.body.innerText.includes("Page not found"),
    medCross: !!document.querySelector(".med-cross"),
    gradientBorder: !!document.querySelector(".gradient-border"),
    bg: getComputedStyle(document.querySelector(".min-h-screen") ?? document.body).backgroundColor,
  }));
  record(`${theme}: 404 card renders`, state.heading);
  record(`${theme}: 404 med-cross backdrop`, state.medCross);
  record(`${theme}: 404 gradient-border card`, state.gradientBorder);
  record(`${theme}: 404 shell bg`, state.bg === BG[theme], state.bg);
}

async function login(page) {
  await page.goto(`${APP}/ask`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1500);

  const onLoginPage = await page.evaluate(() =>
    document.body.innerText.includes("Welcome to Salus Care")
  );
  record("protected route redirects to login", onLoginPage, `url=${page.url()}`);
  if (!onLoginPage) throw new Error("Expected to land on the login page");

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

  const back = page.url().startsWith(APP);
  record("Auth0 login returns to app", back, `url=${page.url()}`);
  if (!back) throw new Error("Login did not return to the app");
}

async function main() {
  const executablePath = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("Chrome not found");

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1400,900"],
  });
  const pageErrors = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await login(page);
    await page.waitForSelector("textarea", { timeout: 30000 }).catch(() => null);
    await installMocks(page);

    // ── Dark theme (default for a fresh profile) ─────────────────────────
    console.log("\n── Dark theme ──");
    await checkAskPage(page, "dark");
    await page.goto(`${APP}/sessions`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1800);
    await checkSessions(page, "dark");
    await checkSessionDetail(page, "dark");
    await check404(page, "dark");

    // ── Light theme ──────────────────────────────────────────────────────
    console.log("\n── Light theme ──");
    await setTheme(page, "light");
    await page.goto(`${APP}/sessions`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1800);
    await checkSessions(page, "light");
    await checkSessionDetail(page, "light");
    await checkAskPage(page, "light");
    await check404(page, "light");

    record("no unexpected JS errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ").slice(0, 200));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
