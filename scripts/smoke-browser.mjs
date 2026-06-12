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
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(rootUrl).origin });
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
      hasLearn: Boolean(document.querySelector("a[href='./learn.html'], a[href=\"./learn.html\"]")),
      hasMethodology: Boolean(document.querySelector("a[href='./methodology.html'], a[href=\"./methodology.html\"]")),
      hasAiButtons: document.querySelectorAll("[data-ai-prompt]").length,
      quickActionCount: document.querySelectorAll("[data-quick-action]").length,
      mobileActionBarVisible: getComputedStyle(document.querySelector(".mobile-action-bar")).display !== "none",
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
      activeTab: document.querySelector(".tab-button.active")?.textContent,
      guideCards: document.querySelectorAll(".guide-card").length,
      resultActions: document.querySelector(".result-actions")?.innerText,
      markdownStart: document.querySelector("#markdown-output")?.value.slice(0, 220),
      horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
    }));

    await page.click(".result-actions [data-quick-action='copy-guide']");
    const resultActionToast = await page.locator(".toast").last().textContent({ timeout: 5000 }).catch(() => "");
    await page.waitForTimeout(1900);

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
    await page.waitForTimeout(1900);

    await page.click("#share-link-button");
    const shareToast = await page.locator(".toast").last().textContent({ timeout: 5000 }).catch(() => "");
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (shareUrl) {
      await page.goto(shareUrl, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForFunction(() => document.querySelector("#summary-grid")?.innerText.includes("太阳"), null, { timeout: 60000 });
    }
    const shared = await page.evaluate(() => ({
      hasChartHash: window.location.hash.startsWith("#chart="),
      summary: document.querySelector("#summary-grid")?.innerText,
      activeTab: document.querySelector(".tab-button.active")?.textContent,
      guideCards: document.querySelectorAll(".guide-card").length,
      horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
    }));

    await page.goto(`${rootUrl.replace(/\/$/, "")}/privacy.html`, { waitUntil: "networkidle", timeout: 30000 });
    const privacy = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent,
    }));

    await page.goto(`${rootUrl.replace(/\/$/, "")}/learn.html`, { waitUntil: "networkidle", timeout: 30000 });
    const learn = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent,
    }));

    await page.goto(`${rootUrl.replace(/\/$/, "")}/methodology.html`, { waitUntil: "networkidle", timeout: 30000 });
    const methodology = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent,
    }));

    results.push({ viewport: viewport.name, before, afterNatal, resultActionToast, guide, guideToast, toast, shareToast, shareUrl, shared, privacy, learn, methodology, consoleErrors, failedResponses });
    await page.close();
  }
} finally {
  await browser.close();
}

const failures = results.flatMap((result) => [
  ...result.consoleErrors.map((error) => `${result.viewport} console: ${error}`),
  ...result.failedResponses.map((response) => `${result.viewport} ${response.status}: ${response.url}`),
  result.before.hasLearn ? null : `${result.viewport}: missing learn link`,
  result.before.hasMethodology ? null : `${result.viewport}: missing methodology link`,
  result.before.hasAiButtons >= 4 ? null : `${result.viewport}: missing AI prompt buttons`,
  result.before.quickActionCount >= 6 ? null : `${result.viewport}: missing quick action buttons`,
  result.viewport === "mobile" && !result.before.mobileActionBarVisible ? `${result.viewport}: mobile action bar hidden` : null,
  result.viewport === "desktop" && result.before.mobileActionBarVisible ? `${result.viewport}: mobile action bar visible on desktop` : null,
  result.afterNatal.svgCount === 1 ? null : `${result.viewport}: chart SVG missing`,
  result.afterNatal.dataTabs?.includes("快速解释") ? null : `${result.viewport}: quick guide tab missing`,
  result.afterNatal.activeTab?.includes("快速解释") ? null : `${result.viewport}: quick guide is not the default result tab`,
  result.afterNatal.guideCards >= 8 ? null : `${result.viewport}: default guide cards missing`,
  result.afterNatal.resultActions?.includes("分享链接") ? null : `${result.viewport}: result actions missing share link`,
  result.resultActionToast?.includes("解释") ? null : `${result.viewport}: result action copy failed`,
  result.guide.cardCount >= 8 ? null : `${result.viewport}: quick guide cards missing`,
  result.guideToast?.includes("解释") ? null : `${result.viewport}: guide copy failed`,
  result.toast?.includes("AI 本命") ? null : `${result.viewport}: AI prompt copy failed`,
  result.shareToast?.includes("分享链接") ? null : `${result.viewport}: share link copy failed`,
  result.shareUrl?.includes("#chart=") ? null : `${result.viewport}: share URL missing chart hash`,
  result.shared?.summary?.includes("太阳") ? null : `${result.viewport}: shared chart failed to render`,
  result.shared?.activeTab?.includes("快速解释") ? null : `${result.viewport}: shared chart did not preserve guide tab`,
  result.shared?.guideCards >= 8 ? null : `${result.viewport}: shared guide cards missing`,
  result.shared?.horizontalOverflow ? `${result.viewport}: shared chart horizontal overflow` : null,
  result.afterNatal.horizontalOverflow ? `${result.viewport}: horizontal overflow` : null,
  result.privacy.h1 === "隐私政策" ? null : `${result.viewport}: privacy page failed`,
  result.learn.h1 === "星盘入门" ? null : `${result.viewport}: learn page failed`,
  result.methodology.h1 === "计算方法" ? null : `${result.viewport}: methodology page failed`,
].filter(Boolean));

console.log(JSON.stringify({ ok: failures.length === 0, failures, results }, null, 2));
if (failures.length) process.exit(1);
