#!/usr/bin/env node
/**
 * Visual check for the landing page polish (no backend / no login needed):
 * drives headless Chrome against the dev server and asserts the effects
 * are present in the DOM — spotlight cards, count-up stats, animated
 * gradient headline — and that the navbar hides app links on the landing
 * page. Exits non-zero on failure.
 *
 * Usage: node scripts/visual_check.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];
const APP = process.argv[2] ?? "http://localhost:5173";

const results = [];
function record(name, ok, detail = "") {
  results.push(ok);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    await page.goto(APP, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);

    record("landing page loads", page.url().startsWith(APP), `url=${page.url()}`);

    const hero = await page.evaluate(() => {
      const span = document.querySelector("h1 span.gradient-text");
      return {
        found: !!span,
        shimmer: span?.classList.contains("animate-gradient") ?? false,
      };
    });
    record("hero headline uses animated gradient", hero.found && hero.shimmer);

    const spotlights = await page.evaluate(
      () => document.querySelectorAll(".spotlight-card").length
    );
    record("spotlight cards mounted", spotlights >= 6, `${spotlights} cards`);

    // Hover the first feature card and confirm the spotlight fades in.
    // The card lives below the fold, so scroll it into view first — hovering
    // raw boundingBox coords of an off-screen element hits nothing.
    const card = await page.$(".spotlight-card");
    if (card) {
      await page.evaluate(() => {
        document
          .querySelector(".spotlight-card")
          ?.scrollIntoView({ behavior: "instant", block: "center" });
      });
      await sleep(800); // let the scroll + whileInView animations settle
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      await sleep(500);
      const state = await page.evaluate(() => {
        const el = document.querySelector(".spotlight-card");
        return {
          hovered: el?.matches(":hover") ?? false,
          opacity: getComputedStyle(el, "::before").opacity,
        };
      });
      record(
        "spotlight follows hover",
        state.hovered && state.opacity === "1",
        `hovered=${state.hovered} ::before opacity=${state.opacity}`
      );
    } else {
      record("spotlight follows hover", false, "no card found");
    }

    // Count-up stats: scroll the stats section into view, wait for the
    // animation to finish, then read the rendered values.
    await page.evaluate(() => {
      const sections = document.querySelectorAll("section");
      sections[1]?.scrollIntoView({ behavior: "instant" });
    });
    await sleep(3000);
    const statTexts = await page.evaluate(() =>
      [...document.querySelectorAll("span.gradient-text")].map((s) => s.textContent.trim())
    );
    const counted = statTexts.filter((t) => /^</.test(t) || /Tier$|\/7$/.test(t));
    record(
      "stats count up completes",
      counted.includes("<60s") && counted.includes("3-Tier") && counted.includes("24/7"),
      `values=${counted.join(", ")}`
    );

    // Navbar on the landing page must stay minimal: no app nav links.
    const navState = await page.evaluate(() => {
      const links = [...document.querySelectorAll("header nav a")].map((a) =>
        a.textContent?.trim()
      );
      const signIn = [...document.querySelectorAll("header button")].some((b) =>
        b.textContent?.includes("Sign In")
      );
      return { links, signIn };
    });
    record(
      "landing navbar has no Ask/Sessions links",
      !navState.links.some((l) => l === "Ask" || l === "Sessions"),
      navState.links.length ? `links=${navState.links.join(", ")}` : "no nav links"
    );
    record("landing navbar shows Sign In", navState.signIn);

    record(
      "no unexpected JS errors",
      pageErrors.length === 0,
      pageErrors.slice(0, 3).join(" | ").slice(0, 200)
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
