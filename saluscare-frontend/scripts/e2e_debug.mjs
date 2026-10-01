#!/usr/bin/env node
/** Debug variant: capture every functions-v1 request/response and UI error text. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];
const APP = "http://localhost:5173";
const EMAIL = "salus-e2e-test-2026@example.com";
const PASSWORD = "Salus-E2E-Test!2026x";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const executablePath = CHROME_PATHS.find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/functions/v1/") || url.includes("oauth/token")) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {}
      console.log(`NET ${res.status()} ${res.request().method()} ${url}`);
      if (body) console.log(`     body: ${body.replace(/\n/g, " ")}`);
    }
  });
  page.on("requestfailed", (req) => {
    console.log(`NET FAILED ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on("pageerror", (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

  // Login
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
  console.log("URL after login:", page.url());

  // Inspect session-start result
  const uiText = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n/g, " | "));
  console.log("UI TEXT:", uiText);

  const sessionError = await page.evaluate(() =>
    document.body.innerText.includes("Could not start a session")
  );
  console.log("startSession error shown:", sessionError);

  // Try sending a message and watch what happens
  const hasTextarea = await page.evaluate(() => Boolean(document.querySelector("textarea")));
  console.log("textarea present:", hasTextarea);
  if (hasTextarea) {
    const disabled = await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      const send = [...document.querySelectorAll("button")].pop();
      return { taDisabled: ta.disabled, sendDisabled: send?.disabled };
    });
    console.log("input state:", JSON.stringify(disabled));

    await page.type("textarea", "I have a mild headache since this morning", { delay: 5 });
    await page.keyboard.press("Enter");
    await sleep(15000);
    const after = await page.evaluate(() => document.body.innerText.slice(0, 600).replace(/\n/g, " | "));
    console.log("UI AFTER SEND:", after);
  }
} finally {
  await browser.close();
}
