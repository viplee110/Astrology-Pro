import { createRequire } from "node:module";

const rootUrl = process.env.SMOKE_URL || "http://localhost:4173";
const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  if (!playwrightNodeModules) throw error;
  const normalizedRoot = playwrightNodeModules.replace(/\\/g, "/").replace(/\/?$/, "/");
  const roots = [
    normalizedRoot,
    `${normalizedRoot}.pnpm/node_modules/`,
  ];
  let lastError = error;
  for (const root of roots) {
    try {
      const requireFromDeps = createRequire(`${root}package.json`);
      ({ chromium } = requireFromDeps("playwright-core"));
      lastError = null;
      break;
    } catch (candidateError) {
      try {
        const requireFromDeps = createRequire(`${root}package.json`);
        ({ chromium } = requireFromDeps("playwright"));
        lastError = null;
        break;
      } catch {
        lastError = candidateError;
      }
    }
  }
  if (lastError) throw lastError;
}

const browser = await chromium.launch({ headless: true, executablePath });
const results = [];

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1050 },
    { name: "mobile", width: 390, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const consoleErrors = [];
    const failedResponses = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });

    await page.goto(rootUrl, { waitUntil: "networkidle", timeout: 60000 });
    const before = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent,
      hasPrivacy: Boolean(document.querySelector("a[href='./privacy.html'], a[href=\"./privacy.html\"]")),
      hasAiButtons: document.querySelectorAll("[data-ai-prompt]").length,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }));

    await page.click("#calculate-natal");
    await page.waitForFunction(() => document.querySelector("#summary-grid")?.innerText.includes("太阳"), null, { timeout: 60000 });

    const afterNatal = await page.evaluate(() => ({
      summary: document.querySelector("#summary-grid")?.innerText,
      meta: document.querySelector("#chart-meta")?.innerText,
      svgCount: document.querySelectorAll("svg.chart-svg").length,
      dataTabs: document.querySelector("#data-tabs")?.innerText,
      markdownStart: document.querySelector("#markdown-output")?.value.slice(0, 220),
      horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
    }));

    await page.click("[data-tab='guide']");
    const guide = await page.evaluate(() => ({
      cardCount: document.querySelectorAll(".guide-card").length,
      text: document.querySelector("#data-panel")?.innerText.slice(0, 500),
    }));

    await page.click("[data-copy-mode='guide']");
    const guideToast = await page.locator(".toast").last().textContent({ timeout: 5000 }).catch(() => "");
    await page.waitForTimeout(1900);

    await page.click("[data-ai-prompt='natal']");
    const toast = await page.locator(".toast").last().textContent({ timeout: 5000 }).catch(() => "");

    await page.goto(`${rootUrl.replace(/\/$/, "")}/privacy.html`, { waitUntil: "networkidle", timeout: 30000 });
    const privacy = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent,
    }));

    results.push({ viewport: viewport.name, before, afterNatal, guide, guideToast, toast, privacy, consoleErrors, failedResponses });
    await page.close();
  }
} finally {
  await browser.close();
}

const failures = results.flatMap((result) => [
  ...result.consoleErrors.map((error) => `${result.viewport} console: ${error}`),
  ...result.failedResponses.map((response) => `${result.viewport} ${response.status}: ${response.url}`),
  result.before.hasAiButtons >= 4 ? null : `${result.viewport}: missing AI prompt buttons`,
  result.afterNatal.svgCount === 1 ? null : `${result.viewport}: chart SVG missing`,
  result.afterNatal.dataTabs?.includes("快速解释") ? null : `${result.viewport}: quick guide tab missing`,
  result.guide.cardCount >= 8 ? null : `${result.viewport}: quick guide cards missing`,
  result.guideToast?.includes("解释") ? null : `${result.viewport}: guide copy failed`,
  result.toast?.includes("AI 本命") ? null : `${result.viewport}: AI prompt copy failed`,
  result.afterNatal.horizontalOverflow ? `${result.viewport}: horizontal overflow` : null,
  result.privacy.h1 === "隐私政策" ? null : `${result.viewport}: privacy page failed`,
].filter(Boolean));

console.log(JSON.stringify({ ok: failures.length === 0, failures, results }, null, 2));
if (failures.length) process.exit(1);
