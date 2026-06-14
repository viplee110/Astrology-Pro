import {
  ASPECT_DEFINITIONS,
  DEFAULT_ASPECT_ANGLES,
  DEFAULT_BODY_KEYS,
  DEFAULT_POINT_KEYS,
  PLANET_DEFINITIONS,
  VIRTUAL_POINT_DEFINITIONS,
} from "./astro/constants.js";
import { formatDecimal, formatDms } from "./astro/format.js";
import {
  createAngleInsight,
  createAspectInsight,
  createPlacementInsight,
  createQuickInterpretation,
  houseMeaning,
} from "./astro/interpretations.js";
import { findPlaceByName, loadPlaces, placeMatches, timeZoneIdForPlace } from "./astro/places.js";
import { offsetForLocalTime } from "./astro/timezone.js";
import { SwissChartEngine } from "./astro/swissEngine.js";
import { exportWorkbook } from "./export/exporters.js";
import { createAiPrompt, createMarkdown } from "./export/markdown.js";
import { clearCharts, deleteChart, getChart, listCharts, saveChart } from "./storage/db.js";
import { renderChartWheel, renderSummary } from "./ui/chartWheel.js";

const els = {
  form: document.querySelector("#chart-form"),
  status: document.querySelector("#engine-status"),
  wheel: document.querySelector("#chart-wheel"),
  readingPanel: document.querySelector("#reading-panel"),
  summary: document.querySelector("#summary-grid"),
  markdown: document.querySelector("#markdown-output"),
  chartMeta: document.querySelector("#chart-meta"),
  copyButton: document.querySelector("#copy-button"),
  shareButton: document.querySelector("#share-link-button"),
  saveButton: document.querySelector("#save-button"),
  refreshSaved: document.querySelector("#refresh-saved"),
  clearSaved: document.querySelector("#clear-saved"),
  savedList: document.querySelector("#saved-list"),
  textMode: document.querySelector("#text-mode"),
  customTemplate: document.querySelector("#custom-template"),
  tabs: document.querySelector("#data-tabs"),
  dataPanel: document.querySelector("#data-panel"),
  aspectToggles: document.querySelector("#aspect-type-toggles"),
  bodyToggles: document.querySelector("#body-toggles"),
  pointToggles: document.querySelector("#point-toggles"),
};

let engine;
let places = [];
let currentWorkbook;
let currentMarkdown = "";
let currentTab = "guide";
let currentLongTermSegment = 0;
let currentNatalSignature = "";
let loadedShareHash = "";
let currentReadingSelection = null;
let readingWasManuallySelected = false;
let currentReadingText = "";

init();

async function init() {
  renderSettingToggles();
  setStatus("初始化地点库");
  toggleActions(false);
  places = await loadPlaces();
  setupLocationSearch({
    input: document.querySelector("#location-name"),
    dropdown: document.querySelector("#location-dropdown"),
    latitude: document.querySelector("#latitude"),
    longitude: document.querySelector("#longitude"),
    timezone: document.querySelector("#timezone"),
    precision: document.querySelector("#coordinate-precision"),
    date: document.querySelector("#birth-date"),
    time: document.querySelector("#birth-time"),
  });
  setupLocationSearch({
    input: document.querySelector("#target-location-name"),
    dropdown: document.querySelector("#target-location-dropdown"),
    latitude: document.querySelector("#target-latitude"),
    longitude: document.querySelector("#target-longitude"),
    timezone: document.querySelector("#target-timezone"),
    date: document.querySelector("#target-date"),
    time: document.querySelector("#target-time"),
  });
  setupLocationSearch({
    input: document.querySelector("#long-term-location-name"),
    dropdown: document.querySelector("#long-term-location-dropdown"),
    latitude: document.querySelector("#long-term-latitude"),
    longitude: document.querySelector("#long-term-longitude"),
    timezone: document.querySelector("#long-term-timezone"),
    date: document.querySelector("#target-date"),
    time: document.querySelector("#target-time"),
  });
  setupLocationSearch({
    input: document.querySelector("#relocation-location-name"),
    dropdown: document.querySelector("#relocation-location-dropdown"),
    latitude: document.querySelector("#relocation-latitude"),
    longitude: document.querySelector("#relocation-longitude"),
    timezone: document.querySelector("#relocation-timezone"),
    date: document.querySelector("#relocation-date"),
    time: document.querySelector("#target-time"),
  });
  setupLocationSearch({
    input: document.querySelector("#partner-location-name"),
    dropdown: document.querySelector("#partner-location-dropdown"),
    latitude: document.querySelector("#partner-latitude"),
    longitude: document.querySelector("#partner-longitude"),
    timezone: document.querySelector("#partner-timezone"),
    date: document.querySelector("#partner-date"),
    time: document.querySelector("#partner-time"),
  });
  setupRelocationBuilder();
  setupReadingMode();

  try {
    setStatus("初始化 Swiss Ephemeris");
    engine = await new SwissChartEngine().init();
    setStatus(`Swiss Ephemeris ${engine.version}`);
    toggleActions(true);
    renderEmptyState();
    await renderSavedList();
    await loadSharedChartFromHash();
  } catch (error) {
    console.error(error);
    setStatus("初始化失败", true);
    els.markdown.value = `Swiss Ephemeris 初始化失败：${error.message}`;
  }
}

function renderEmptyState() {
  els.wheel.innerHTML = `<p class="muted">填写资料后点击“计算本命”或对应栏目的计算按钮生成星盘。</p>`;
  els.readingPanel.hidden = true;
  els.readingPanel.innerHTML = "";
  els.summary.innerHTML = "";
  els.chartMeta.textContent = "";
  els.tabs.innerHTML = "";
  els.dataPanel.innerHTML = `<p class="muted">尚未计算。</p>`;
  els.markdown.value = "";
  currentWorkbook = null;
  currentMarkdown = "";
  currentReadingSelection = null;
  readingWasManuallySelected = false;
  currentReadingText = "";
  currentNatalSignature = "";
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await calculateAndRender("all");
});

document.querySelector("#calculate-natal").addEventListener("click", () => calculateAndRender("natal"));
document.querySelector("#calculate-predictive").addEventListener("click", () => calculateAndRender("predictive"));
document.querySelector("#calculate-relationship").addEventListener("click", () => calculateAndRender("relationship"));

els.copyButton.addEventListener("click", async () => {
  if (!currentMarkdown) {
    toast("请先计算星盘");
    return;
  }
  await navigator.clipboard.writeText(currentMarkdown);
  toast("已复制当前文字版");
});

document.querySelectorAll("[data-copy-mode]").forEach((button) => {
  button.addEventListener("click", async () => {
    await copyMarkdownMode(button.dataset.copyMode, `已复制${button.textContent.replace("复制", "")}`);
  });
});

document.querySelectorAll("[data-ai-prompt]").forEach((button) => {
  button.addEventListener("click", async () => {
    await copyAiPromptMode(button.dataset.aiPrompt, `已复制 ${button.textContent.trim()} Prompt`);
  });
});

els.saveButton.addEventListener("click", async () => {
  if (!currentWorkbook) {
    toast("请先计算星盘");
    return;
  }
  const record = await saveChart(currentWorkbook, currentMarkdown);
  currentWorkbook.natal.input.id = record.id;
  if (document.querySelector("#save-partner-profile")?.checked && currentWorkbook.relationship?.personB) {
    const partnerWorkbook = { natal: currentWorkbook.relationship.personB };
    await saveChart(partnerWorkbook, createMarkdown(partnerWorkbook, "natal"));
  }
  toast("已保存到本地档案");
  await renderSavedList();
});

els.refreshSaved.addEventListener("click", renderSavedList);

els.clearSaved?.addEventListener("click", async () => {
  const confirmed = confirm("确定清空本浏览器中的所有本地档案吗？此操作不会影响 GitHub 或 Vercel。");
  if (!confirmed) return;
  await clearCharts();
  await renderSavedList();
  toast("已清空本地档案");
});

els.textMode.addEventListener("change", updateMarkdown);
els.customTemplate.addEventListener("input", updateMarkdown);

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!currentWorkbook) {
      toast("请先计算星盘");
      return;
    }
    exportWorkbook(currentWorkbook, button.dataset.export, els.textMode.value);
  });
});

els.shareButton?.addEventListener("click", async () => {
  await copyShareLink();
});

document.querySelectorAll("[data-quick-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.quickAction;
    if (action === "calculate-natal") {
      await calculateAndRender("natal");
      return;
    }
    if (action === "copy-guide") {
      await copyMarkdownMode("guide", "已复制解释");
      return;
    }
    if (action === "share-link") {
      await copyShareLink();
      return;
    }
    if (action === "ai-natal") {
      await copyAiPromptMode("natal", "已复制 AI 本命 Prompt");
    }
  });
});

window.addEventListener("hashchange", () => {
  loadSharedChartFromHash();
});

async function copyMarkdownMode(mode, message) {
  if (!currentWorkbook) {
    toast("请先计算星盘");
    return;
  }
  await navigator.clipboard.writeText(createMarkdown(currentWorkbook, mode, els.customTemplate.value));
  toast(message);
}

async function copyAiPromptMode(mode, message) {
  if (!currentWorkbook) {
    toast("请先计算星盘");
    return;
  }
  await navigator.clipboard.writeText(createAiPrompt(currentWorkbook, mode));
  toast(message);
}

async function copyShareLink() {
  if (!currentWorkbook) {
    toast("请先计算星盘");
    return;
  }
  await navigator.clipboard.writeText(createShareUrl());
  toast("已复制分享链接");
}

async function calculateAndRender(scope = "all") {
  if (!engine) return;
  setStatus(scopeStatus(scope));
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const natalInput = readNatalInput();
    const targetInput = readTargetInput(natalInput);
    const partnerInput = readPartnerInput(natalInput);
    const options = readOptions();
    const signature = natalSignature(natalInput, options);
    const canPreserve = currentWorkbook && currentNatalSignature === signature;
    const preserved = canPreserve ? currentWorkbook : {};
    const natal = engine.calculateNatal(natalInput, options);

    if (scope === "natal") {
      currentWorkbook = { natal };
      currentTab = "guide";
    } else if (scope === "predictive") {
      const predictive = engine.calculatePredictive(natalInput, targetInput, options, natal);
      const longTerm = engine.calculateLongTermStructure(natalInput, options, natal);
      currentWorkbook = { natal, predictive, longTerm, relationship: preserved.relationship || null };
      currentTab = "predictive";
    } else if (scope === "relationship") {
      if (!partnerInput) {
        currentWorkbook = { natal, predictive: preserved.predictive || null, longTerm: preserved.longTerm || null, relationship: null };
        currentTab = "relationship";
        currentNatalSignature = signature;
        renderWorkbook();
        toast("请先填写合盘对象的出生日期和时间");
        setStatus(`Swiss Ephemeris ${engine.version}`);
        return;
      }
      const relationship = engine.calculateRelationship(natalInput, partnerInput, options, natal);
      currentWorkbook = { natal, predictive: preserved.predictive || null, longTerm: preserved.longTerm || null, relationship };
      currentTab = "relationship";
    } else {
      currentWorkbook = engine.calculateSuite(natalInput, targetInput, partnerInput, options);
      currentTab = currentTab || "natal";
    }

    currentNatalSignature = signature;
    renderWorkbook();
    setStatus(`Swiss Ephemeris ${engine.version}`);
  } catch (error) {
    console.error(error);
    setStatus("计算失败", true);
    toast(error.message);
  }
}

function renderWorkbook() {
  renderChartWheel(els.wheel, currentWorkbook.natal);
  ensureReadingSelection();
  enhanceWheelReadingTargets();
  renderReadingPanel();
  renderSummary(els.summary, currentWorkbook.natal);
  els.chartMeta.textContent = `${currentWorkbook.natal.settings.zodiacModeName} / ${currentWorkbook.natal.settings.houseSystemName}`;
  renderTabs();
  updateMarkdown();
  focusResultsOnSmallScreen();
}

function focusResultsOnSmallScreen() {
  if (!window.matchMedia("(max-width: 860px)").matches) return;
  requestAnimationFrame(() => {
    document.querySelector(".chart-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

async function loadSharedChartFromHash() {
  if (!engine) return;
  const encoded = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("chart");
  if (!encoded || encoded === loadedShareHash) return;
  loadedShareHash = encoded;
  try {
    const payload = decodeSharePayload(encoded);
    if (payload?.v !== 1 || !payload.input) throw new Error("Invalid share payload");
    fillForm({ ...payload.input, id: "", notes: "" });
    applyShareOptions(payload.options || {});
    const tab = shareTab(payload.tab);
    await calculateAndRender("natal");
    currentTab = tab;
    renderTabs();
    toast("已载入分享星盘");
  } catch (error) {
    console.warn(error);
    toast("分享链接无法读取");
  }
}

function createShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `chart=${encodeSharePayload({
    v: 1,
    kind: "natal",
    input: shareInput(readNatalInput()),
    options: shareOptions(readOptions()),
    tab: shareTab(currentTab),
  })}`;
  return url.toString();
}

function shareInput(input) {
  return {
    profileName: input.profileName,
    subjectType: input.subjectType,
    tags: input.tags,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    timezone: input.timezone,
    locationName: input.locationName,
    latitude: input.latitude,
    longitude: input.longitude,
    coordinatePrecision: input.coordinatePrecision,
    houseSystem: input.houseSystem,
    zodiacMode: input.zodiacMode,
    aspectOrb: input.aspectOrb,
  };
}

function shareOptions(options) {
  return {
    bodyKeys: options.bodyKeys,
    pointKeys: options.pointKeys,
    patternParticipants: options.patternParticipants,
    lotFormulaSet: options.lotFormulaSet,
    aspectAngles: options.aspectAngles,
  };
}

function shareTab(tab) {
  const allowed = new Set(["natal", "guide", "rulers", "stats", "classical"]);
  return allowed.has(tab) ? tab : "guide";
}

function applyShareOptions(options) {
  setCheckedValues("bodyKey", options.bodyKeys || DEFAULT_BODY_KEYS);
  setCheckedValues("pointKey", options.pointKeys || DEFAULT_POINT_KEYS);
  setCheckedValues("aspectAngle", options.aspectAngles || DEFAULT_ASPECT_ANGLES);
  setSelectValue("#pattern-participants", options.patternParticipants || "core");
  setSelectValue("#lot-formula-set", options.lotFormulaSet || "paulus");
}

function setCheckedValues(name, values) {
  const selected = new Set(values.map(String));
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function setSelectValue(selector, value) {
  const select = document.querySelector(selector);
  if (select && [...select.options].some((option) => option.value === value)) select.value = value;
}

function encodeSharePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeSharePayload(value) {
  const padded = String(value).replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function scopeStatus(scope) {
  return {
    natal: "计算本命中",
    predictive: "计算预测中",
    relationship: "计算合盘中",
    all: "计算全部中",
  }[scope] || "计算中";
}

function natalSignature(input, options) {
  return JSON.stringify({
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    timezone: input.timezone,
    latitude: input.latitude,
    longitude: input.longitude,
    houseSystem: input.houseSystem,
    zodiacMode: input.zodiacMode,
    bodyKeys: options.bodyKeys,
    pointKeys: options.pointKeys,
    patternParticipants: options.patternParticipants,
    lotFormulaSet: options.lotFormulaSet,
    aspectAngles: options.aspectAngles,
    aspectOrb: options.aspectOrb,
  });
}

function renderSettingToggles() {
  els.aspectToggles.innerHTML = ASPECT_DEFINITIONS.map(
    (aspect) => `
      <label class="toggle-item">
        <input type="checkbox" name="aspectAngle" value="${aspect.angle}" ${DEFAULT_ASPECT_ANGLES.includes(aspect.angle) ? "checked" : ""} />
        ${aspect.name} ${aspect.angle}°
      </label>
    `,
  ).join("");

  els.bodyToggles.innerHTML = PLANET_DEFINITIONS.map(
    (body) => `
      <label class="toggle-item">
        <input type="checkbox" name="bodyKey" value="${body.key}" ${DEFAULT_BODY_KEYS.includes(body.key) ? "checked" : ""} />
        ${body.symbol} ${body.name}
      </label>
    `,
  ).join("");

  els.pointToggles.innerHTML = VIRTUAL_POINT_DEFINITIONS.map(
    (point) => `
      <label class="toggle-item">
        <input type="checkbox" name="pointKey" value="${point.key}" ${DEFAULT_POINT_KEYS.includes(point.key) ? "checked" : ""} />
        ${point.symbol} ${point.name}
      </label>
    `,
  ).join("");
}

function readNatalInput() {
  const data = new FormData(els.form);
  return {
    id: document.querySelector("#profile-name").dataset.id || "",
    profileName: String(data.get("profileName") || "").trim(),
    subjectType: String(data.get("subjectType") || "self"),
    tags: String(data.get("tags") || "").trim(),
    birthDate: String(data.get("birthDate")),
    birthTime: String(data.get("birthTime")),
    timezone: Number(data.get("timezone")),
    locationName: String(data.get("locationName") || "").trim(),
    latitude: Number(data.get("latitude")),
    longitude: Number(data.get("longitude")),
    coordinatePrecision: String(data.get("coordinatePrecision") || ""),
    houseSystem: String(data.get("houseSystem")),
    zodiacMode: String(data.get("zodiacMode")),
    aspectOrb: Number(data.get("aspectOrb")),
    notes: String(data.get("notes") || ""),
  };
}

function readTargetInput(natalInput) {
  return {
    ...natalInput,
    profileName: `${natalInput.profileName || "本命盘"} 预测盘`,
    birthDate: document.querySelector("#target-date").value || new Date().toISOString().slice(0, 10),
    birthTime: document.querySelector("#target-time").value || "12:00",
    timezone: Number(document.querySelector("#target-timezone").value || natalInput.timezone),
    locationName: document.querySelector("#target-location-name").value || natalInput.locationName,
    latitude: Number(document.querySelector("#target-latitude").value || natalInput.latitude),
    longitude: Number(document.querySelector("#target-longitude").value || natalInput.longitude),
  };
}

function readPartnerInput(natalInput) {
  const date = document.querySelector("#partner-date").value;
  const time = document.querySelector("#partner-time").value;
  if (!date || !time) return null;
  return {
    ...natalInput,
    id: "",
    profileName: document.querySelector("#partner-name").value || "合盘对象",
    subjectType: "partner",
    birthDate: date,
    birthTime: time,
    timezone: Number(document.querySelector("#partner-timezone").value || 8),
    locationName: document.querySelector("#partner-location-name").value || natalInput.locationName,
    latitude: Number(document.querySelector("#partner-latitude").value || natalInput.latitude),
    longitude: Number(document.querySelector("#partner-longitude").value || natalInput.longitude),
    notes: "",
  };
}

function readOptions() {
  return {
    bodyKeys: [...document.querySelectorAll('input[name="bodyKey"]:checked')].map((item) => item.value),
    pointKeys: [...document.querySelectorAll('input[name="pointKey"]:checked')].map((item) => item.value),
    patternParticipants: document.querySelector("#pattern-participants").value || "core",
    lotFormulaSet: document.querySelector("#lot-formula-set").value || "paulus",
    aspectAngles: [...document.querySelectorAll('input[name="aspectAngle"]:checked')].map((item) => Number(item.value)),
    aspectOrb: Number(document.querySelector("#aspect-orb").value || 6),
    timelineDays: Number(document.querySelector("#timeline-days").value || 90),
    timelineOrb: Number(document.querySelector("#timeline-orb").value || 0.25),
    longTermStartAge: Number(document.querySelector("#long-term-start-age").value || 0),
    longTermEndAge: Number(document.querySelector("#long-term-end-age").value || 80),
    longTermSegmentYears: Number(document.querySelector("#long-term-segment-years").value || 10),
    longTermOrb: Number(document.querySelector("#long-term-orb").value || 0.25),
    longTermLocationMode: document.querySelector("#long-term-location-mode").value || "birth",
    longTermLocation: readLongTermLocation(),
    longTermRelocations: parseRelocationPlan(document.querySelector("#relocation-plan").value),
  };
}

function readLongTermLocation() {
  const mode = document.querySelector("#long-term-location-mode").value || "birth";
  if (mode === "target") {
    return {
      locationName: document.querySelector("#target-location-name").value,
      timezone: Number(document.querySelector("#target-timezone").value || 8),
      latitude: Number(document.querySelector("#target-latitude").value || 0),
      longitude: Number(document.querySelector("#target-longitude").value || 0),
    };
  }
  return {
    locationName: document.querySelector("#long-term-location-name").value,
    timezone: Number(document.querySelector("#long-term-timezone").value || 8),
    latitude: Number(document.querySelector("#long-term-latitude").value || 0),
    longitude: Number(document.querySelector("#long-term-longitude").value || 0),
  };
}

function setupRelocationBuilder() {
  const addButton = document.querySelector("#add-relocation");
  const plan = document.querySelector("#relocation-plan");
  if (!addButton || !plan) return;
  document.querySelector("#relocation-date").value ||= document.querySelector("#target-date").value || new Date().toISOString().slice(0, 10);
  addButton.addEventListener("click", async () => {
    const date = document.querySelector("#relocation-date").value;
    const locationName = document.querySelector("#relocation-location-name").value.trim();
    const latitude = Number(document.querySelector("#relocation-latitude").value);
    const longitude = Number(document.querySelector("#relocation-longitude").value);
    const timezone = Number(document.querySelector("#relocation-timezone").value);
    if (!date || !locationName || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timezone)) {
      toast("请先选择迁居日期和地点");
      return;
    }
    const line = `${date}|${locationName}|${latitude.toFixed(6)}|${longitude.toFixed(6)}|${timezone}`;
    const lines = relocationPlanLines().filter((item) => !item.startsWith(`${date}|`));
    lines.push(line);
    plan.value = `${lines.sort().join("\n")}\n`;
    document.querySelector("#long-term-location-mode").value = "yearly";
    renderRelocationList();
    toast("已加入迁居计划");
    if (currentWorkbook?.predictive || currentWorkbook?.longTerm) await calculateAndRender("predictive");
  });
  plan.addEventListener("input", renderRelocationList);
  renderRelocationList();
}

const READING_SELECTOR = "[data-body], [data-aspect-a], [data-house], [data-angle], [data-point]";

function setupReadingMode() {
  els.wheel.addEventListener("click", (event) => {
    activateReadingFromWheel(event.target);
  });
  els.wheel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest?.(READING_SELECTOR);
    if (!target) return;
    event.preventDefault();
    activateReadingFromWheel(target);
  });
  els.readingPanel.addEventListener("click", async (event) => {
    if (event.target.closest("[data-close-reading]")) {
      els.readingPanel.hidden = true;
      clearReadingSelectionHighlight();
      return;
    }
    if (event.target.closest("[data-copy-reading]")) {
      if (!currentReadingText) return;
      await navigator.clipboard.writeText(currentReadingText);
      toast("已复制阅读卡");
      return;
    }
    const button = event.target.closest("[data-reading-body], [data-reading-aspect-a], [data-reading-house], [data-reading-angle], [data-reading-point]");
    if (!button || !currentWorkbook) return;
    const nextSelection = readingSelectionFromDataset(button.dataset);
    if (!nextSelection) return;
    currentReadingSelection = nextSelection;
    readingWasManuallySelected = true;
    renderReadingPanel();
  });
}

function activateReadingFromWheel(target) {
  if (!currentWorkbook) return;
  const node = target.closest?.(READING_SELECTOR);
  if (!node || !els.wheel.contains(node)) return;
  const selection = readingSelectionFromDataset(node.dataset);
  if (!selection) return;
  currentReadingSelection = selection;
  readingWasManuallySelected = true;
  clearWheelTooltipState();
  renderReadingPanel();
}

function ensureReadingSelection() {
  const chart = currentWorkbook?.natal;
  if (!chart) return;
  if (isReadingSelectionValid(chart, currentReadingSelection)) return;
  const sun = chart.bodies.find((body) => body.key === "sun") || chart.bodies[0];
  currentReadingSelection = sun ? { type: "body", key: sun.key } : null;
  readingWasManuallySelected = false;
}

function enhanceWheelReadingTargets() {
  els.wheel.querySelectorAll(READING_SELECTOR).forEach((node) => {
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
    const title = node.dataset.tooltip?.split("\n")[0] || "星盘元素";
    node.setAttribute("aria-label", `查看${title}的解释`);
  });
}

function renderReadingPanel() {
  const chart = currentWorkbook?.natal;
  if (!chart || !currentReadingSelection) {
    els.readingPanel.hidden = true;
    currentReadingText = "";
    return;
  }
  const reading = createReadingCard(chart, currentReadingSelection);
  if (!reading) {
    els.readingPanel.hidden = true;
    currentReadingText = "";
    return;
  }
  currentReadingText = readingText(reading);
  els.readingPanel.hidden = false;
  els.readingPanel.classList.toggle("manual-selection", readingWasManuallySelected);
  els.readingPanel.innerHTML = `
    <div class="reading-header">
      <div>
        <span class="reading-kicker">${escapeHtml(reading.kicker)}</span>
        <h3>${escapeHtml(reading.title)}</h3>
        <p>${escapeHtml(reading.meta)}</p>
      </div>
      <div class="reading-actions">
        <button type="button" class="ghost-button small-button" data-copy-reading>复制此解释</button>
        <button type="button" class="ghost-button small-button" data-close-reading>关闭</button>
      </div>
    </div>
    <p class="reading-text">${escapeHtml(reading.text)}</p>
    ${reading.facts.length ? `<div class="reading-facts">${reading.facts.map(([label, value]) => `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`).join("")}</div>` : ""}
    ${reading.related.length ? `<div class="reading-related"><h4>${escapeHtml(reading.relatedTitle)}</h4>${reading.related.map(readingRelatedItem).join("")}</div>` : ""}
    <div class="reading-shortcuts" aria-label="快速阅读入口">
      ${readingShortcutButton("太阳", { type: "body", key: "sun" })}
      ${readingShortcutButton("月亮", { type: "body", key: "moon" })}
      ${readingShortcutButton("上升", { type: "angle", key: "ASC" })}
      ${readingShortcutButton("第 1 宫", { type: "house", house: 1 })}
    </div>
  `;
  highlightReadingSelection();
}

function createReadingCard(chart, selection) {
  if (selection.type === "body") return bodyReading(chart, selection.key);
  if (selection.type === "aspect") return aspectReading(chart, selection.keyA, selection.keyB);
  if (selection.type === "house") return houseReading(chart, selection.house);
  if (selection.type === "angle") return angleReading(chart, selection.key);
  if (selection.type === "point") return pointReading(chart, selection.key);
  return null;
}

function bodyReading(chart, key) {
  const body = chart.bodies.find((item) => item.key === key);
  if (!body) return null;
  const insight = createPlacementInsight(body);
  const relatedAspects = chart.aspects
    .filter((aspect) => aspect.keyA === body.key || aspect.keyB === body.key)
    .slice(0, 5);
  return {
    kicker: "行星落点",
    title: insight.title,
    meta: `${body.formatted} / 第 ${body.house} 宫${body.retrograde ? " / 逆行" : ""}`,
    text: insight.text,
    facts: compactFacts([
      ["星座", body.sign.zh],
      ["宫位", `第 ${body.house} 宫`],
      ["状态", body.dignitySummary || ""],
      ["速度", Number.isFinite(Number(body.speed)) ? Number(body.speed).toFixed(5) : ""],
    ]),
    relatedTitle: "相关相位",
    related: relatedAspects.map((aspect) => {
      const otherKey = aspect.keyA === body.key ? aspect.keyB : aspect.keyA;
      const other = chart.bodies.find((item) => item.key === otherKey);
      return {
        title: `${aspect.planetA} ${aspect.aspect} ${aspect.planetB}`,
        text: `${createAspectInsight(aspect).text}${other ? ` 也可以继续查看${other.name}的落点。` : ""}`,
        action: { type: "aspect", keyA: aspect.keyA, keyB: aspect.keyB, label: "查看相位" },
      };
    }),
  };
}

function aspectReading(chart, keyA, keyB) {
  const aspect = findAspect(chart, keyA, keyB);
  if (!aspect) return null;
  const insight = createAspectInsight(aspect);
  const bodyA = chart.bodies.find((body) => body.key === aspect.keyA);
  const bodyB = chart.bodies.find((body) => body.key === aspect.keyB);
  return {
    kicker: "相位解读",
    title: insight.title,
    meta: `容许度 ${aspect.orbText} / ${aspect.applying ? "入相" : "出相"}`,
    text: insight.text,
    facts: compactFacts([
      [aspect.planetA, bodyA ? `${bodyA.formatted} / 第 ${bodyA.house} 宫` : ""],
      [aspect.planetB, bodyB ? `${bodyB.formatted} / 第 ${bodyB.house} 宫` : ""],
      ["相位", aspect.aspect],
      ["容许度", aspect.orbText],
    ]),
    relatedTitle: "继续拆解",
    related: [bodyA, bodyB].filter(Boolean).map((body) => ({
      title: `${body.name}落点`,
      text: `${body.formatted} / 第 ${body.house} 宫。点开可以单独看这颗星体如何表达。`,
      action: { type: "body", key: body.key, label: `查看${body.name}` },
    })),
  };
}

function houseReading(chart, houseNumber) {
  const number = Number(houseNumber);
  const house = chart.houses.find((item) => Number(item.number) === number);
  if (!house) return null;
  const bodies = chart.bodies.filter((body) => Number(body.house) === number);
  const meaning = houseMeaning(number);
  return {
    kicker: "宫位主题",
    title: `第 ${number} 宫：${house.formatted}`,
    meta: `宫头 ${house.formatted} / 黄经 ${formatDms(house.longitude)}`,
    text: `第 ${number} 宫关注${stripEnd(meaning || "对应生活领域")}。${bodies.length ? `这里有${bodies.map((body) => body.name).join("、")}，说明这些经验会更容易通过第 ${number} 宫主题表现出来。` : "这里没有当前显示的星体，不代表主题不存在，而是需要看宫主星和相关相位。"}`,
    facts: compactFacts([
      ["宫头", house.formatted],
      ["黄经", formatDms(house.longitude)],
      ["落入星体", bodies.map((body) => body.name).join("、")],
    ]),
    relatedTitle: "宫内星体",
    related: bodies.map((body) => ({
      title: `${body.name}在第 ${number} 宫`,
      text: createPlacementInsight(body).text,
      action: { type: "body", key: body.key, label: `查看${body.name}` },
    })),
  };
}

function angleReading(chart, key) {
  const angle = chart.angles.find((item) => item.key === key);
  if (!angle) return null;
  const insight = createAngleInsight(angle);
  return {
    kicker: "四轴提示",
    title: insight.title,
    meta: `${angle.key} / ${angle.formatted}`,
    text: insight.text,
    facts: compactFacts([
      ["星座", angle.sign?.zh || ""],
      ["位置", angle.formatted],
      ["黄经", formatDms(angle.longitude)],
    ]),
    relatedTitle: "相关入口",
    related: [
      { title: "看第 1 宫", text: "上升和第 1 宫一起描述外在呈现、身体感和进入世界的方式。", action: { type: "house", house: 1, label: "查看第 1 宫" } },
      { title: "看太阳", text: "太阳能补充说明核心意志和自我认同。", action: { type: "body", key: "sun", label: "查看太阳" } },
    ],
  };
}

function pointReading(chart, key) {
  const point = chart.virtualPoints?.find((item) => item.key === key);
  if (!point) return null;
  return {
    kicker: "虚点 / 阿拉伯点",
    title: `${point.name}：${point.formatted}`,
    meta: `${point.category || "point"}${point.house ? ` / 第 ${point.house} 宫` : ""}`,
    text: `${point.name}位于${point.formatted}${point.house ? `，落在第 ${point.house} 宫` : ""}。这类点位更适合作为补充线索，建议结合宫位、宫主星和触发相位一起看。${point.formula ? ` 当前公式：${point.formula}。` : ""}`,
    facts: compactFacts([
      ["位置", point.formatted],
      ["宫位", point.house ? `第 ${point.house} 宫` : ""],
      ["公式", point.formula || ""],
    ]),
    relatedTitle: "相关入口",
    related: point.house ? [{ title: `第 ${point.house} 宫`, text: "查看这个点位所在宫位的生活主题。", action: { type: "house", house: point.house, label: `查看第 ${point.house} 宫` } }] : [],
  };
}

function readingRelatedItem(item) {
  return `
    <article class="reading-related-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
      ${item.action ? readingActionButton(item.action) : ""}
    </article>
  `;
}

function readingActionButton(action) {
  const attrs = readingActionAttrs(action);
  return `<button type="button" class="ghost-button small-button reading-action" ${attrs}>${escapeHtml(action.label)}</button>`;
}

function readingShortcutButton(label, selection) {
  return `<button type="button" class="ghost-button small-button" ${readingActionAttrs({ ...selection, label })}>${escapeHtml(label)}</button>`;
}

function readingActionAttrs(action) {
  if (action.type === "body") return `data-reading-body="${escapeHtml(action.key)}"`;
  if (action.type === "aspect") return `data-reading-aspect-a="${escapeHtml(action.keyA)}" data-reading-aspect-b="${escapeHtml(action.keyB)}"`;
  if (action.type === "house") return `data-reading-house="${escapeHtml(action.house)}"`;
  if (action.type === "angle") return `data-reading-angle="${escapeHtml(action.key)}"`;
  if (action.type === "point") return `data-reading-point="${escapeHtml(action.key)}"`;
  return "";
}

function readingSelectionFromDataset(dataset) {
  if (dataset.readingBody || dataset.body) return { type: "body", key: dataset.readingBody || dataset.body };
  if (dataset.readingAspectA || dataset.aspectA) return { type: "aspect", keyA: dataset.readingAspectA || dataset.aspectA, keyB: dataset.readingAspectB || dataset.aspectB };
  if (dataset.readingHouse || dataset.house) return { type: "house", house: Number(dataset.readingHouse || dataset.house) };
  if (dataset.readingAngle || dataset.angle) return { type: "angle", key: dataset.readingAngle || dataset.angle };
  if (dataset.readingPoint || dataset.point) return { type: "point", key: dataset.readingPoint || dataset.point };
  return null;
}

function isReadingSelectionValid(chart, selection) {
  if (!selection) return false;
  if (selection.type === "body") return chart.bodies.some((body) => body.key === selection.key);
  if (selection.type === "aspect") return Boolean(findAspect(chart, selection.keyA, selection.keyB));
  if (selection.type === "house") return chart.houses.some((house) => Number(house.number) === Number(selection.house));
  if (selection.type === "angle") return chart.angles.some((angle) => angle.key === selection.key);
  if (selection.type === "point") return chart.virtualPoints?.some((point) => point.key === selection.key);
  return false;
}

function findAspect(chart, keyA, keyB) {
  return chart.aspects.find((aspect) => (
    (aspect.keyA === keyA && aspect.keyB === keyB) ||
    (aspect.keyA === keyB && aspect.keyB === keyA)
  ));
}

function highlightReadingSelection() {
  clearReadingSelectionHighlight();
  const selection = currentReadingSelection;
  if (!selection) return;
  let selector = "";
  if (selection.type === "body") selector = `[data-body="${selection.key}"]`;
  if (selection.type === "aspect") selector = `.aspect-target[data-aspect-a="${selection.keyA}"][data-aspect-b="${selection.keyB}"], .aspect-target[data-aspect-a="${selection.keyB}"][data-aspect-b="${selection.keyA}"]`;
  if (selection.type === "house") selector = `[data-house="${selection.house}"]`;
  if (selection.type === "angle") selector = `[data-angle="${selection.key}"]`;
  if (selection.type === "point") selector = `[data-point="${selection.key}"]`;
  if (!selector) return;
  els.wheel.querySelectorAll(selector).forEach((node) => {
    node.classList.add("is-selected-reading");
  });
}

function clearReadingSelectionHighlight() {
  els.wheel.querySelectorAll(".is-selected-reading").forEach((node) => {
    node.classList.remove("is-selected-reading");
  });
}

function clearWheelTooltipState() {
  const tooltip = els.wheel.querySelector(".chart-tooltip");
  tooltip?.classList.remove("open");
  tooltip?.setAttribute("aria-hidden", "true");
  els.wheel.querySelectorAll(".is-related, .is-dimmed").forEach((node) => {
    node.classList.remove("is-related", "is-dimmed");
  });
}

function readingText(reading) {
  const facts = reading.facts.map(([label, value]) => `- ${label}：${value}`);
  const related = reading.related.map((item) => `- ${item.title}：${item.text}`);
  return [
    `# ${reading.title}`,
    reading.meta,
    "",
    reading.text,
    facts.length ? "\n## 关键资料" : "",
    ...facts,
    related.length ? "\n## 相关线索" : "",
    ...related,
  ].filter(Boolean).join("\n");
}

function compactFacts(items) {
  return items.filter(([, value]) => String(value || "").trim());
}

function stripEnd(value) {
  return String(value || "").replace(/[。；;.\s]+$/u, "");
}

function updateMarkdown() {
  if (!currentWorkbook) return;
  const mode = els.textMode.value;
  els.customTemplate.classList.toggle("open", mode === "custom");
  currentMarkdown = createMarkdown(currentWorkbook, mode, els.customTemplate.value);
  els.markdown.value = currentMarkdown;
}

function renderTabs() {
  const tabs = [
    ["natal", "本命数据"],
    ["guide", "快速解释"],
    ["rulers", "飞星/定位"],
    ["predictive", "行运/推运"],
    ["longTerm", "长期结构"],
    ["relationship", "关系盘"],
    ["stats", "统计/格局"],
    ["classical", "古典/恒星"],
    ["ephemeris", "星历/时间线"],
  ];
  els.tabs.innerHTML = tabs.map(([key, label]) => `<button type="button" class="tab-button ${key === currentTab ? "active" : ""}" data-tab="${key}">${label}</button>`).join("");
  els.tabs.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      currentTab = button.dataset.tab;
      renderTabs();
    });
  });
  renderDataPanel();
}

function renderDataPanel() {
  if (!currentWorkbook) return;
  const chart = currentWorkbook.natal;
  const predictive = currentWorkbook.predictive;
  const longTerm = currentWorkbook.longTerm;
  const relationship = currentWorkbook.relationship;
  if (currentTab === "natal") {
    els.dataPanel.innerHTML = [
      table(["星体", "星座度数", "宫位", "黄经", "纬度", "距离(AU)", "速度", "庙旺弱陷", "状态"], bodyTableRows(chart)),
      `<h3 class="subhead">四轴 / 虚点</h3>`,
      chart.virtualPoints?.length
        ? table(["点", "类型", "星座度数", "宫位", "黄经", "公式"], pointTableRows(chart))
        : `<p class="muted">未选择四轴/虚点。</p>`,
      chart.pointAspects?.length
        ? [`<h3 class="subhead">虚点相位</h3>`, table(["星体", "相位", "虚点", "容许度"], chart.pointAspects.map((aspect) => [aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText]))].join("")
        : "",
      `<h3 class="subhead">宫头</h3>`,
      table(["宫位", "位置", "黄经"], chart.houses.map((house) => [house.number, house.formatted, formatDms(house.longitude)])),
      `<h3 class="subhead">相位</h3>`,
      table(["A", "相位", "B", "容许度", "入出相"], chart.aspects.map((aspect) => [aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText, aspect.applying ? "入相" : "出相"])),
    ].join("");
  }
  if (currentTab === "guide") {
    const guide = createQuickInterpretation(chart);
    els.dataPanel.innerHTML = [
      `<div class="guide-grid"><article class="guide-card guide-card-wide"><strong>总览</strong>${guide.overview.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article></div>`,
      `<h3 class="subhead">核心落点</h3>`,
      `<div class="guide-grid">${guide.corePlacements.map((item) => guideCard(item.title, item.text)).join("")}</div>`,
      `<h3 class="subhead">四轴提示</h3>`,
      `<div class="guide-grid">${guide.angles.map((item) => guideCard(item.title, item.text)).join("")}</div>`,
      `<h3 class="subhead">重点相位</h3>`,
      `<div class="guide-grid">${guide.topAspects.map((item) => guideCard(item.title, item.text)).join("")}</div>`,
      `<h3 class="subhead">宫位与格局</h3>`,
      guide.houseFocus.length || guide.patternInsights.length
        ? `<div class="guide-grid">${[...guide.houseFocus, ...guide.patternInsights].map((item) => guideCard("结构提示", item)).join("")}</div>`
        : `<p class="muted">当前没有明显的宫位集中或主要相位格局。</p>`,
      `<p class="muted">${escapeHtml(guide.disclaimer)}</p>`,
    ].join("");
    return;
  }
  if (currentTab === "predictive") {
    if (!predictive) {
      els.dataPanel.innerHTML = `<p class="muted">尚未计算预测。请在左侧“预测设置”里补充目标时间/地点后点击“计算预测”。</p>`;
      return;
    }
    els.dataPanel.innerHTML = [
      `<h3 class="subhead">行运触发本命</h3>`,
      table(["行运星", "相位", "本命星", "容许度"], predictive.transitAspects.slice(0, 120).map((a) => [a.planetA, a.aspect, a.planetB, a.orbText])),
      `<h3 class="subhead">次限 / 太阳弧 / 返照</h3>`,
      table(["项目", "太阳", "月亮", "UTC"], [
        ["次限盘", bodyText(predictive.progressed, "sun"), bodyText(predictive.progressed, "moon"), predictive.progressed.utc.iso],
        ["太阳弧", bodyText(predictive.solarArc, "sun"), bodyText(predictive.solarArc, "moon"), predictive.solarArc.utc.iso],
        ["太阳返照", bodyText(predictive.solarReturn, "sun"), bodyText(predictive.solarReturn, "moon"), predictive.solarReturn?.utc?.iso || ""],
        ["月亮返照", bodyText(predictive.lunarReturn, "sun"), bodyText(predictive.lunarReturn, "moon"), predictive.lunarReturn?.utc?.iso || ""],
      ]),
      `<h3 class="subhead">太阳弧方向</h3>`,
      table(["太阳弧点", "相位", "本命点", "容许度"], predictive.solarArcDirections.slice(0, 80).map((a) => [a.planetA, a.aspect, a.planetB, a.orbText])),
      `<h3 class="subhead">长期结构索引</h3>`,
      longTerm?.segments?.length ? table(["年龄段", "开始日期", "结束日期", "元数据节点"], longTerm.segments.map((segment) => [segment.label, segment.startDate, segment.endDate, segment.eventCount])) : `<p class="muted">暂无长期结构数据。</p>`,
    ].join("");
  }
  if (currentTab === "relationship") {
    els.dataPanel.innerHTML = relationship
      ? [
          table(["A 星体", "相位", "B 星体", "容许度"], relationship.synastry.slice(0, 160).map((a) => [a.planetA, a.aspect, a.planetB, a.orbText])),
          `<h3 class="subhead">组合中点盘 / 时空中点盘</h3>`,
          table(["盘型", "太阳", "月亮", "上升"], [
            ["组合中点盘", bodyText(relationship.composite, "sun"), bodyText(relationship.composite, "moon"), angleText(relationship.composite, "ASC")],
            ["时空中点盘", bodyText(relationship.davison, "sun"), bodyText(relationship.davison, "moon"), angleText(relationship.davison, "ASC")],
          ]),
          `<h3 class="subhead">组合中点盘行星</h3>`,
          table(["星体", "星座度数", "宫位", "黄经", "纬度", "距离(AU)", "速度", "庙旺弱陷", "状态"], bodyTableRows(relationship.composite).slice(0, 12)),
          `<h3 class="subhead">时空中点盘行星</h3>`,
          table(["星体", "星座度数", "宫位", "黄经", "纬度", "距离(AU)", "速度", "庙旺弱陷", "状态"], bodyTableRows(relationship.davison).slice(0, 12)),
        ].join("")
      : `<p class="muted">填写合盘对象出生资料后会生成比较盘、组合中点盘、时空中点盘。</p>`;
  }
  if (currentTab === "rulers") {
    renderRulerPanel(chart);
  }
  if (currentTab === "longTerm") {
    renderLongTermPanel(longTerm);
  }
  if (currentTab === "stats") {
    els.dataPanel.innerHTML = [
      `<div class="pill-list">
        <span class="pill">火 ${chart.stats.elements.火}</span><span class="pill">土 ${chart.stats.elements.土}</span><span class="pill">风 ${chart.stats.elements.风}</span><span class="pill">水 ${chart.stats.elements.水}</span>
        <span class="pill">基本 ${chart.stats.modes.基本}</span><span class="pill">固定 ${chart.stats.modes.固定}</span><span class="pill">变动 ${chart.stats.modes.变动}</span>
      </div>`,
      `<h3 class="subhead">群星</h3>`,
      chart.stats.stelliums.length ? `<div class="pill-list">${chart.stats.stelliums.map((item) => `<span class="pill">${item.type}：${item.place} ${item.bodies.join("、")}</span>`).join("")}</div>` : `<p class="muted">未检测到群星。</p>`,
      `<h3 class="subhead">相位格局</h3>`,
      chart.stats.patterns.length ? table(["格局", "参与点", "关键相位证据"], chart.stats.patterns.map((item) => [item.type, item.bodies.join("、"), patternEvidenceText(item)])) : `<p class="muted">未检测到主要相位格局。</p>`,
      `<h3 class="subhead">中点</h3>`,
      table(["点 A", "点 B", "中点"], chart.midpoints.slice(0, 80).map((mid) => [mid.pointA, mid.pointB, mid.formatted])),
      `<h3 class="subhead">中点触发</h3>`,
      chart.midpointContacts.length ? table(["中点", "相位", "触发点", "容许度"], chart.midpointContacts.slice(0, 80).map((item) => [item.midpoint, item.aspect, item.target, item.orbText])) : `<p class="muted">未检测到 1° 内的主要中点触发。</p>`,
      `<h3 class="subhead">阿拉伯点</h3>`,
      table(["名称", "位置", "宫位", "公式", "体系/来源"], chart.lots.map((lot) => [lot.name, lot.formatted, lot.house, lot.formula, lot.source || ""])),
    ].join("");
  }
  if (currentTab === "classical") {
    els.dataPanel.innerHTML = [
      `<p class="muted">${chart.classical.sect}；互容：${chart.classical.mutualReceptions.join("；") || "未检测到主要互容"}；接纳：${chart.classical.receptions.join("；") || "未检测到主要接纳"}</p>`,
      table(["星体", "本质状态", "界主", "面主", "得时/失时", "太阳状态"], chart.classical.rows.map((row) => [row.planet, row.dignity, row.boundLord, row.faceLord, row.sect, row.solarCondition])),
      `<h3 class="subhead">现代庙旺弱陷</h3>`,
      table(["星体", "星座度数", "状态", "依据"], chart.modernDignities.map((row) => [row.planet, row.placement, row.status, row.note])),
      `<h3 class="subhead">恒星</h3>`,
      table(["恒星", "位置", "星等"], chart.fixedStars.map((star) => [star.name, star.formatted, star.magnitude?.toFixed?.(2) ?? ""])),
      `<h3 class="subhead">恒星合相</h3>`,
      chart.fixedStarContacts.length ? table(["恒星", "合相点", "恒星位置", "触发点位置", "容许度"], chart.fixedStarContacts.map((item) => [item.star, item.target, item.starPosition, item.targetPosition, item.orbText])) : `<p class="muted">未检测到 1° 内的恒星合相。</p>`,
    ].join("");
  }
  if (currentTab === "ephemeris") {
    if (!predictive) {
      els.dataPanel.innerHTML = `<p class="muted">尚未计算预测，因此没有星历/时间线数据。</p>`;
      return;
    }
    const ephemerisKeys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
    els.dataPanel.innerHTML = [
      `<h3 class="subhead">星历表</h3>`,
      table(["日期", "太阳", "月亮", "水星", "金星", "火星", "木星", "土星", "天王", "海王", "冥王"], predictive.ephemeris.map((row) => [row.date, ...ephemerisKeys.map((key) => ephemerisBodyText(row, key))])),
      `<h3 class="subhead">重要行运时间线</h3>`,
      table(["精确时间 UTC", "行运星", "相位", "本命星", "容许度"], predictive.timeline.slice(0, 160).map((item) => [item.exactTime || item.date, item.planetA, item.aspect, item.planetB, item.orbText])),
      `<h3 class="subhead">行星时</h3>`,
      `<p class="muted">${predictive.planetaryHours.method || "近似日出日落算法"}；日出 ${new Date(predictive.planetaryHours.sunrise).toISOString()}；日落 ${new Date(predictive.planetaryHours.sunset).toISOString()}</p>`,
      table(["阶段", "序号", "主星", "开始 UTC", "结束 UTC"], predictive.planetaryHours.hours.map((hour) => [hour.phase, hour.number, hour.ruler, hour.start, hour.end])),
    ].join("");
  }
}

function renderRulerPanel(chart) {
  const chains = [
    ...(chart.dispositorChains?.traditional || []),
    ...(chart.dispositorChains?.modern || []),
  ];
  els.dataPanel.innerHTML = [
    `<h3 class="subhead">关键主星</h3>`,
    table(["项目", "星座", "主星", "主星位置", "飞入宫位", "状态", "结构备注"], (chart.keyRulers?.rows || []).map((row) => [
      row.item,
      row.sign,
      row.ruler,
      row.placement,
      row.house ? `第 ${row.house} 宫` : "",
      row.status,
      row.note,
    ])),
    `<div class="pill-list">
      <span class="pill">终定位星：${(chart.keyRulers?.finalDispositors || []).join("、") || "无单一终定位星"}</span>
      <span class="pill">互容/闭环：${(chart.keyRulers?.mutualLoops || []).join("；") || "未检测到"}</span>
    </div>`,
    `<h3 class="subhead">宫主飞宫</h3>`,
    table(["宫位", "宫头", "传统宫主", "传统飞宫", "现代宫主", "现代飞宫", "状态"], (chart.houseRulers || []).map((row) => [
      row.house,
      row.cusp,
      row.traditionalRuler,
      row.flightText,
      modernRulerDetail(row),
      row.modernFlightText,
      row.traditionalStatus,
    ])),
    `<h3 class="subhead">宫主星相位</h3>`,
    chart.houseRulerAspects?.length
      ? table(["宫位", "口径", "宫主星", "宫主位置", "相位", "目标", "目标位置", "容许度"], chart.houseRulerAspects.slice(0, 180).map((row) => [
          row.house,
          row.rulerType,
          row.ruler,
          `${row.rulerPlacement} / ${row.rulerHouse || ""}宫`,
          row.aspect,
          row.target,
          `${row.targetPlacement}${row.targetHouse ? ` / ${row.targetHouse}宫` : ""}`,
          row.orbText,
        ]))
      : `<p class="muted">未检测到宫主星与当前显示点位的相位。</p>`,
    `<h3 class="subhead">定位星链</h3>`,
    table(["口径", "星体", "位置", "第一定位星", "链条", "终点/闭环", "状态"], chains.map((row) => [
      row.mode,
      row.body,
      `${row.placement} / ${row.house || ""}宫`,
      row.firstDispositor,
      row.chain,
      row.terminal || row.loop,
      row.status,
    ])),
  ].join("");
}

function renderLongTermPanel(longTerm) {
  if (!longTerm?.segments?.length) {
    els.dataPanel.innerHTML = `<p class="muted">暂无长期结构数据。</p>`;
    return;
  }
  currentLongTermSegment = Math.min(currentLongTermSegment, longTerm.segments.length - 1);
  const selected = longTerm.segments[currentLongTermSegment];
  const events = longTerm.events.filter((event) => event.segmentIndex === selected.index);
  els.dataPanel.innerHTML = [
    `<div class="segment-picker">${longTerm.segments.map((segment) => `<button type="button" class="tab-button ${segment.index === selected.index ? "active" : ""}" data-segment-index="${segment.index}">${escapeHtml(segment.label)} · ${segment.eventCount}</button>`).join("")}</div>`,
    `<h3 class="subhead">分段索引</h3>`,
    table(["年龄段", "开始日期", "结束日期", "元数据节点"], longTerm.segments.map((segment) => [segment.label, segment.startDate, segment.endDate, segment.eventCount])),
    `<h3 class="subhead">${escapeHtml(selected.label)} 元数据</h3>`,
    events.length
      ? table(["年龄", "精确时间 UTC", "技术", "类型", "地点", "星体/点", "相位", "本命点/目标", "星体位置", "目标位置", "宫位", "容许度"], events.map((event) => [
          event.age,
          event.exactTime,
          event.technique,
          event.eventType,
          event.locationName,
          event.source,
          event.aspect,
          event.target,
          event.sourcePosition,
          event.targetPosition,
          event.natalHouse,
          event.orbText,
        ]))
      : `<p class="muted">这个年龄段没有筛选出的关键元数据。</p>`,
  ].join("");
  els.dataPanel.querySelectorAll("[data-segment-index]").forEach((button) => {
    button.addEventListener("click", () => {
      currentLongTermSegment = Number(button.dataset.segmentIndex);
      renderLongTermPanel(longTerm);
    });
  });
}

async function renderSavedList() {
  const records = await listCharts();
  if (!records.length) {
    els.savedList.innerHTML = `<p class="muted">暂无保存档案</p>`;
    return;
  }
  els.savedList.innerHTML = records.map((record) => `
    <div class="saved-item">
      <div><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml((record.tags || []).join(" / "))} · ${new Date(record.updatedAt).toLocaleString()}</span></div>
      <div class="saved-actions">
        <button class="ghost-button" data-load-id="${record.id}" type="button">载入</button>
        <button class="ghost-button" data-history-id="${record.id}" type="button">历史</button>
        <button class="danger-button" data-delete-id="${record.id}" data-title="${escapeHtml(record.title)}" type="button">删除</button>
      </div>
    </div>
  `).join("");
  els.savedList.querySelectorAll("[data-load-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = await getChart(button.dataset.loadId);
      if (!record) return;
      fillForm(record.chart.input);
      await calculateAndRender();
      toast("已载入档案");
    });
  });
  els.savedList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const title = button.dataset.title || "这条档案";
      const confirmed = window.confirm(`确定删除「${title}」吗？这会从本地浏览器档案库中移除，无法撤销。`);
      if (!confirmed) return;
      await deleteChart(button.dataset.deleteId);
      toast("已删除档案");
      await renderSavedList();
    });
  });
  els.savedList.querySelectorAll("[data-history-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = await getChart(button.dataset.historyId);
      if (!record) return;
      showHistory(record);
    });
  });
}

function showHistory(record) {
  els.tabs.querySelectorAll(".tab-button").forEach((button) => button.classList.remove("active"));
  els.dataPanel.innerHTML = [
    `<h3 class="subhead">${escapeHtml(record.title)} 的保存历史</h3>`,
    table(["保存时间", "出生资料", "地点", "JD"], (record.history || []).slice().reverse().map((item) => [item.at, item.birth, item.place, item.jdUt?.toFixed?.(6) || ""])),
  ].join("");
}

function fillForm(input) {
  document.querySelector("#profile-name").value = input.profileName || "";
  document.querySelector("#profile-name").dataset.id = input.id || "";
  document.querySelector("#subject-type").value = input.subjectType || "self";
  document.querySelector("#tags").value = input.tags || "";
  document.querySelector("#birth-date").value = input.birthDate || "";
  document.querySelector("#birth-time").value = input.birthTime || "";
  document.querySelector("#timezone").value = input.timezone ?? 8;
  document.querySelector("#location-name").value = input.locationName || "";
  document.querySelector("#latitude").value = input.latitude ?? "";
  document.querySelector("#longitude").value = input.longitude ?? "";
  document.querySelector("#coordinate-precision").value = input.coordinatePrecision || "城市级";
  document.querySelector("#house-system").value = input.houseSystem || "P";
  document.querySelector("#zodiac-mode").value = input.zodiacMode || "tropical";
  document.querySelector("#aspect-orb").value = input.aspectOrb ?? 6;
  document.querySelector("#notes").value = input.notes || "";
}

function setupLocationSearch(config) {
  const renderOptions = (query) => {
    const matchedPlaces = places
      .filter((place) => placeMatches(place, query))
      .sort((a, b) => scorePlace(a, query) - scorePlace(b, query))
      .slice(0, 120);
    config.dropdown.innerHTML = matchedPlaces.map((place) => `
      <button class="location-option" type="button" role="option" data-place-name="${escapeHtml(place.name)}">
        <strong>${escapeHtml(place.name)}</strong>
        <span>${escapeHtml(place.level || "城市")} · ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)} · UTC${formatTimezone(place.timezone)}</span>
      </button>
    `).join("");
  };
  const open = () => {
    renderOptions(config.input.value);
    config.dropdown.classList.add("open");
    config.input.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    config.dropdown.classList.remove("open");
    config.input.setAttribute("aria-expanded", "false");
  };
  const apply = (place) => {
    config.input.value = place.name;
    config.latitude.value = Number(place.latitude).toFixed(6);
    config.longitude.value = Number(place.longitude).toFixed(6);
    const offset = offsetForLocalTime(timeZoneIdForPlace(place), config.date.value, config.time.value);
    config.timezone.value = offset ?? place.timezone;
    if (config.precision) config.precision.value = place.level === "区县" ? "区县级" : "城市级";
  };
  config.input.addEventListener("focus", open);
  config.input.addEventListener("click", open);
  config.input.addEventListener("input", () => {
    open();
    const place = findPlaceByName(config.input.value, places);
    if (place) apply(place);
  });
  config.dropdown.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-place-name]");
    if (!button) return;
    event.preventDefault();
    const place = findPlaceByName(button.dataset.placeName, places);
    if (!place) return;
    apply(place);
    close();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".location-field")) close();
  });
  [config.date, config.time].forEach((node) => {
    node.addEventListener("input", () => {
      const place = findPlaceByName(config.input.value, places);
      if (place) apply(place);
    });
  });
  renderOptions("");
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function guideCard(title, text) {
  return `<article class="guide-card"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`;
}

function patternEvidenceText(pattern) {
  if (!pattern.evidence?.length) return "";
  return pattern.evidence.map((edge) => `${edge.pointA} ${edge.aspect} ${edge.pointB}（${edge.orbText}）`).join("；");
}

function bodyTableRows(chart) {
  return chart.bodies.map((body) => [
    body.name,
    body.formatted,
    body.house,
    formatDms(body.longitude),
    decimalText(body.latitude, 5),
    decimalText(body.distance, 6),
    decimalText(body.speed, 5),
    body.dignitySummary || "",
    body.retrograde ? "逆行" : "顺行",
  ]);
}

function pointTableRows(chart) {
  return (chart.virtualPoints || []).map((point) => [
    point.name,
    point.category,
    point.formatted,
    point.house,
    formatDms(point.longitude),
    point.formula,
  ]);
}

function modernRulerDetail(row) {
  return (row.modernRulers || [])
    .map((item) => `${item.name}${item.placement ? ` ${item.placement} / ${item.house}宫` : ""}`)
    .join("；");
}

function bodyText(chart, key) {
  return chart?.bodies?.find((body) => body.key === key)?.formatted || "";
}

function angleText(chart, key) {
  return chart?.angles?.find((angle) => angle.key === key)?.formatted || "";
}

function ephemerisBodyText(row, key) {
  const body = row.bodies.find((item) => item.key === key);
  return body ? `${body.formatted}${body.retrograde ? " R" : ""}` : "";
}

function parseRelocationPlan(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseRelocationLine(line))
    .filter(Boolean)
    .sort((a, b) => a.year - b.year);
}

function parseRelocationLine(line) {
  const pipeParts = line.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    const effective = parseEffectiveDate(pipeParts[0]);
    if (!effective) return null;
    if (pipeParts.length >= 5) {
      return {
        ...effective,
        locationName: pipeParts[1],
        latitude: Number(pipeParts[2]),
        longitude: Number(pipeParts[3]),
        timezone: Number(pipeParts[4]),
      };
    }
    return relocationFromPlace(effective, pipeParts[1]);
  }
  const matched = line.match(/^(\d{4}(?:-\d{2}-\d{2})?)\s+(.+)$/);
  if (!matched) return null;
  const effective = parseEffectiveDate(matched[1]);
  return effective ? relocationFromPlace(effective, matched[2].trim()) : null;
}

function relocationFromPlace(effective, name) {
  const place = findPlaceByName(name, places);
  if (!place) return { ...effective, locationName: name };
  return {
    ...effective,
    locationName: place.name,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    timezone: offsetForLocalTime(timeZoneIdForPlace(place), effective.effectiveDate || `${effective.year}-07-01`, "12:00") ?? place.timezone,
  };
}

function parseEffectiveDate(value) {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { effectiveDate: trimmed, year: Number(trimmed.slice(0, 4)) };
  }
  if (/^\d{4}$/.test(trimmed)) {
    return { effectiveDate: `${trimmed}-01-01`, year: Number(trimmed) };
  }
  return null;
}

function renderRelocationList() {
  const list = document.querySelector("#relocation-list");
  if (!list) return;
  const rows = relocationPlanLines();
  list.innerHTML = rows.length
    ? rows.map((line, index) => {
        const parsed = parseRelocationLine(line);
        const label = parsed ? `${parsed.effectiveDate} · ${parsed.locationName || ""} · ${parsed.latitude ?? ""}, ${parsed.longitude ?? ""} · UTC${parsed.timezone ?? ""}` : line;
        return `<div class="relocation-item"><span>${escapeHtml(label)}</span><button type="button" class="danger-button" data-remove-relocation="${index}">删除</button></div>`;
      }).join("")
    : `<p class="muted">暂无迁居计划</p>`;
  list.querySelectorAll("[data-remove-relocation]").forEach((button) => {
    button.addEventListener("click", async () => {
      const lines = relocationPlanLines();
      lines.splice(Number(button.dataset.removeRelocation), 1);
      document.querySelector("#relocation-plan").value = lines.length ? `${lines.join("\n")}\n` : "";
      renderRelocationList();
      if (currentWorkbook?.predictive || currentWorkbook?.longTerm) await calculateAndRender("predictive");
    });
  });
}

function relocationPlanLines() {
  return String(document.querySelector("#relocation-plan")?.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function decimalText(value, digits) {
  return Number.isFinite(Number(value)) ? formatDecimal(value, digits) : "";
}

function scorePlace(place, query) {
  const normalized = query.trim().toLowerCase();
  let score = place.level === "地级市/州/盟/地区" ? 10 : 30;
  if (!normalized) return score;
  const haystacks = [place.name, ...(place.keywords || [])].map((item) => item.toLowerCase());
  if (haystacks.some((item) => item === normalized)) score -= 20;
  if (haystacks.some((item) => item.startsWith(normalized))) score -= 10;
  if (place.name.toLowerCase().includes(normalized)) score -= 5;
  return score;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function toggleActions(enabled) {
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled && button.id !== "refresh-saved";
  });
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 1800);
}

function formatTimezone(offset) {
  return `${offset >= 0 ? "+" : ""}${offset}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
