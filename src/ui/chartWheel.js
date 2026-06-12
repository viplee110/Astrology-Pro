import { ZODIAC_SIGNS } from "../astro/constants.js";

const PLANET_NAMES = {
  sun: "太阳",
  moon: "月亮",
  mercury: "水星",
  venus: "金星",
  mars: "火星",
  jupiter: "木星",
  saturn: "土星",
  uranus: "天王星",
  neptune: "海王星",
  pluto: "冥王星",
  northNode: "北交点",
  southNode: "南交点",
};

const ASPECT_KIND = {
  合: "conjunction",
  六合: "supportive",
  刑: "dynamic",
  拱: "supportive",
  冲: "dynamic",
  梅花: "adjusting",
  半六合: "minor",
  半刑: "minor",
  补八分: "minor",
};

const ASPECT_STYLE = {
  conjunction: { color: "#7f6aa3", width: 1.7 },
  supportive: { color: "#4f8e7c", width: 1.35 },
  dynamic: { color: "#b96a64", width: 1.45 },
  adjusting: { color: "#b68a4a", width: 1.25 },
  minor: { color: "#8993a7", width: 1 },
};

const ANGLE_STYLE = {
  ASC: "#8b5a2b",
  MC: "#7b4f77",
  DSC: "#54718f",
  IC: "#8a6d3b",
};

export function renderChartWheel(container, chart) {
  const size = 900;
  const center = size / 2;
  const outer = 398;
  const zodiac = 358;
  const house = 296;
  const planetAnchor = 278;
  const planetLanes = [278, 252, 226, 200, 174, 148, 122];
  const aspect = 154;
  const mc = chart.angles.find((angle) => angle.key === "MC");
  const wheelRotation = mc?.longitude ?? 0;

  const bodyByKey = new Map(chart.bodies.map((body) => [body.key, body]));
  const planetLayout = layoutRadialLabels(chart.bodies, planetLanes, 11);
  const signBands = ZODIAC_SIGNS.map((sign, index) => annularSector(center, zodiac, outer, index * 30, index * 30 + 30, wheelRotation, index % 2 ? "#fff6e8" : "#fbefe0", `sign-band sign-band-${index}`, `${sign.zh} 区间`)).join("");
  const degreeTicks = Array.from({ length: 36 }, (_, index) => {
    const longitude = index * 10;
    const isMajor = index % 3 === 0;
    const from = point(center, outer - (isMajor ? 14 : 8), longitude, wheelRotation);
    const to = point(center, outer, longitude, wheelRotation);
    return line(from, to, isMajor ? "#c9b69f" : "#e7dccd", isMajor ? 1.2 : 0.8, isMajor ? "degree-tick degree-tick-major" : "degree-tick");
  }).join("");
  const houseLines = chart.houses.map((item) => {
    const tooltip = [
      `第 ${item.number} 宫宫头`,
      item.formatted,
      `黄经 ${dms(item.longitude)}`,
    ].join("\n");
    return interactiveLine(point(center, house - 2, item.longitude, wheelRotation), point(center, outer, item.longitude, wheelRotation), "#b9aa98", 0.9, "house-cusp-line", tooltip);
  }).join("");
  const signLines = Array.from({ length: 12 }, (_, index) => {
    const sign = ZODIAC_SIGNS[index];
    const tooltip = [`${sign.zh} 0°`, `元素 ${sign.element} / 模式 ${sign.mode}`].join("\n");
    return interactiveLine(point(center, zodiac, index * 30, wheelRotation), point(center, outer, index * 30, wheelRotation), "#d9cbbb", 1, "sign-cusp-line", tooltip);
  }).join("");
  const aspectLines = chart.aspects
    .filter((item) => item.orb <= 4)
    .map((item) => {
      const a = bodyByKey.get(item.keyA);
      const b = bodyByKey.get(item.keyB);
      if (!a || !b) return "";
      const tooltip = [
        `${item.planetA} ${item.aspect} ${item.planetB}`,
        `${a.formatted} / ${b.formatted}`,
        `容许度 ${item.orbText}`,
        item.applying ? "入相" : "出相",
      ].join("\n");
      const style = aspectStyle(item.aspect, item.orb);
      return interactiveLine(
        point(center, aspect, a.longitude, wheelRotation),
        point(center, aspect, b.longitude, wheelRotation),
        style.color,
        style.width,
        `aspect-line aspect-${style.kind}`,
        tooltip,
        `data-aspect-a="${escapeAttr(a.key)}" data-aspect-b="${escapeAttr(b.key)}"`,
        "chart-hover-target aspect-target",
      );
    })
    .join("");

  const angleLines = chart.angles
    .filter((angle) => ["ASC", "MC", "DSC", "IC"].includes(angle.key))
    .map((angle) => {
      const tooltip = [
        `${angle.name} (${angle.key})`,
        angle.formatted,
        `黄经 ${dms(angle.longitude)}`,
      ].join("\n");
      return interactiveLine(point(center, 78, angle.longitude, wheelRotation), point(center, outer + 10, angle.longitude, wheelRotation), ANGLE_STYLE[angle.key] || "#7a4f2b", 1.8, `angle-axis angle-axis-${angle.key}`, tooltip);
    })
    .join("");

  const signLabels = ZODIAC_SIGNS.map((sign, index) => {
    const p = point(center, 365, index * 30 + 15, wheelRotation);
    const tooltip = [
      sign.zh,
      `元素 ${sign.element} / 模式 ${sign.mode}`,
      `传统守护 ${planetName(sign.ruler)}`,
      sign.exaltation ? `擢升 ${planetName(sign.exaltation)}` : "",
    ].filter(Boolean).join("\n");
      return hoverText("zodiac-label", p, textSymbol(sign.symbol), tooltip);
    }).join("");

  const houseLabels = chart.houses
    .map((houseItem, index) => {
      const next = chart.houses[(index + 1) % chart.houses.length];
      const p = point(center, 318, midpointArc(houseItem.longitude, next.longitude), wheelRotation);
      const tooltip = [
        `第 ${houseItem.number} 宫`,
        `宫头 ${houseItem.formatted}`,
        `黄经 ${dms(houseItem.longitude)}`,
      ].join("\n");
      return hoverText("house-label", p, houseItem.number, tooltip);
    })
    .join("");

  const planetLabels = chart.bodies
    .map((body) => {
      const laneRadius = planetLayout.get(body.key) || planetLanes[0];
      const p = point(center, laneRadius, body.longitude, wheelRotation);
      const anchor = point(center, planetAnchor + 13, body.longitude, wheelRotation);
      const retro = body.retrograde ? "℞" : "";
      const tooltip = [
        body.name,
        `${body.formatted} / 第 ${body.house} 宫`,
        `黄经 ${dms(body.longitude)}`,
        Number.isFinite(Number(body.speed)) ? `速度 ${Number(body.speed).toFixed(5)}` : "",
        body.dignitySummary ? `状态 ${body.dignitySummary}` : "",
        body.retrograde ? "逆行" : "顺行",
      ].filter(Boolean).join("\n");
      const leader = Math.abs(laneRadius - planetLanes[0]) > 4 ? leaderLine(anchor, point(center, laneRadius + 13, body.longitude, wheelRotation)) : "";
      return `${leader}${hoverGlyph("planet-label", p, `${body.symbol}${retro}`, tooltip, 24, `data-body="${escapeAttr(body.key)}"`)}`;
    })
    .join("");

  const virtualPointLabels = (chart.virtualPoints || [])
    .filter((pointItem) => !["ASC", "MC", "DSC", "IC"].includes(pointItem.key))
    .map((pointItem, index) => {
      const p = point(center, 96 - (index % 3) * 16, pointItem.longitude, wheelRotation);
      const label = pointItem.symbol || pointItem.key;
      const tooltip = [
        pointItem.name,
        `${pointItem.formatted}${pointItem.house ? ` / 第 ${pointItem.house} 宫` : ""}`,
        `黄经 ${dms(pointItem.longitude)}`,
        pointItem.formula ? `公式 ${pointItem.formula}` : "",
      ].filter(Boolean).join("\n");
      return hoverGlyph("virtual-point-label", p, label, tooltip, 20);
    })
    .join("");

  const angleLabels = chart.angles
    .filter((angle) => ["ASC", "MC", "DSC", "IC"].includes(angle.key))
    .map((angle) => {
      const p = point(center, outer + 27, angle.longitude, wheelRotation);
      const tooltip = [
        `${angle.name} (${angle.key})`,
        angle.formatted,
        `黄经 ${dms(angle.longitude)}`,
      ].join("\n");
      return hoverGlyph("angle-label", p, angle.key, tooltip, 25);
    })
    .join("");

  container.innerHTML = `
    <div class="chart-tooltip" role="status" aria-hidden="true"></div>
    <svg class="chart-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="星盘轮盘">
      <defs>
        <radialGradient id="wheel-bg" cx="50%" cy="50%" r="56%">
          <stop offset="0%" stop-color="#fffdf8" />
          <stop offset="68%" stop-color="#fffaf1" />
          <stop offset="100%" stop-color="#f6ecdc" />
        </radialGradient>
      </defs>
      <circle cx="${center}" cy="${center}" r="${outer}" fill="url(#wheel-bg)" stroke="#9f8c76" stroke-width="2.2" />
      ${signBands}
      <circle cx="${center}" cy="${center}" r="${outer}" fill="none" stroke="#9f8c76" stroke-width="2.2" />
      <circle cx="${center}" cy="${center}" r="${zodiac}" fill="none" stroke="#ded7ca" stroke-width="1" />
      <circle cx="${center}" cy="${center}" r="${house}" fill="none" stroke="#cbbdaa" stroke-width="1" />
      <circle cx="${center}" cy="${center}" r="${aspect}" fill="#fffdf8" stroke="#ded7ca" stroke-width="1" />
      ${degreeTicks}
      ${signLines}
      ${houseLines}
      ${aspectLines}
      ${angleLines}
      ${signLabels}
      ${houseLabels}
      ${planetLabels}
      ${virtualPointLabels}
      ${angleLabels}
    </svg>
  `;
  setupWheelTooltip(container);
}

export function renderSummary(container, chart) {
  const sun = chart.bodies.find((body) => body.key === "sun");
  const moon = chart.bodies.find((body) => body.key === "moon");
  const asc = chart.angles.find((angle) => angle.key === "ASC");
  container.innerHTML = [
    summaryCell("太阳", `${sun?.formatted ?? ""} / ${sun?.house ?? ""}宫`),
    summaryCell("月亮", `${moon?.formatted ?? ""} / ${moon?.house ?? ""}宫`),
    summaryCell("上升", asc?.formatted ?? ""),
  ].join("");
}

function summaryCell(label, value) {
  return `<div class="summary-cell"><span>${label}</span><strong>${value}</strong></div>`;
}

function point(center, radius, longitude, rotation = 0) {
  const angle = ((longitude - rotation - 90) * Math.PI) / 180;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function line(from, to, color, width, className = "", attrs = "") {
  return `<line class="${className}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="${width}" ${attrs} />`;
}

function interactiveLine(from, to, color, width, className, tooltip, attrs = "", groupClass = "chart-hover-target") {
  return `
    <g class="${groupClass}" data-tooltip="${escapeAttr(tooltip)}" ${attrs}>
      <line class="aspect-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />
      ${line(from, to, color, width, className)}
    </g>
  `;
}

function hoverText(className, p, value, tooltip, radius = 18, attrs = "") {
  return `
    <g class="chart-hover-target" data-tooltip="${escapeAttr(tooltip)}" ${attrs}>
      <circle class="label-hit" cx="${p.x}" cy="${p.y}" r="${radius}" />
      <text class="${className}" x="${p.x}" y="${p.y}">${escapeHtml(value)}</text>
    </g>
  `;
}

function hoverGlyph(className, p, value, tooltip, radius = 24, attrs = "") {
  return `
    <g class="chart-hover-target" data-tooltip="${escapeAttr(tooltip)}" ${attrs}>
      <circle class="label-hit" cx="${p.x}" cy="${p.y}" r="${radius}" />
      <text class="${className}" x="${p.x}" y="${p.y}">${escapeHtml(value)}</text>
    </g>
  `;
}

function leaderLine(from, to) {
  return `<line class="planet-leader-line" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
}

function setupWheelTooltip(container) {
  const tooltip = container.querySelector(".chart-tooltip");
  if (!tooltip) return;
  let activeHighlight = "";
  const hide = () => {
    tooltip.classList.remove("open");
    tooltip.setAttribute("aria-hidden", "true");
    clearHighlight(container);
    activeHighlight = "";
  };
  container.addEventListener("pointermove", (event) => {
    const target = event.target.closest?.("[data-tooltip]");
    if (!target || !container.contains(target)) {
      hide();
      return;
    }
    const highlightKey = highlightToken(target);
    if (highlightKey !== activeHighlight) {
      applyHighlight(container, target);
      activeHighlight = highlightKey;
    }
    tooltip.textContent = target.dataset.tooltip || "";
    tooltip.classList.add("open");
    tooltip.setAttribute("aria-hidden", "false");
    const bounds = container.getBoundingClientRect();
    const width = tooltip.offsetWidth || 220;
    const height = tooltip.offsetHeight || 90;
    const x = clamp(event.clientX - bounds.left + 14, 8, Math.max(8, bounds.width - width - 8));
    const y = clamp(event.clientY - bounds.top + 14, 8, Math.max(8, bounds.height - height - 8));
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  });
  container.addEventListener("pointerleave", hide);
  container.addEventListener("pointerdown", (event) => {
    const target = event.target.closest?.("[data-tooltip]");
    if (!target) hide();
  });
}

function highlightToken(target) {
  if (target.dataset.body) return `body:${target.dataset.body}`;
  if (target.dataset.aspectA || target.dataset.aspectB) return `aspect:${target.dataset.aspectA || ""}:${target.dataset.aspectB || ""}`;
  return "";
}

function applyHighlight(container, target) {
  clearHighlight(container);
  const related = new Set([target.dataset.body, target.dataset.aspectA, target.dataset.aspectB].filter(Boolean));
  if (target.dataset.body) {
    container.querySelectorAll(".aspect-target").forEach((node) => {
      if (node.dataset.aspectA === target.dataset.body || node.dataset.aspectB === target.dataset.body) {
        related.add(node.dataset.aspectA);
        related.add(node.dataset.aspectB);
      }
    });
  }
  if (!related.size) return;
  container.querySelectorAll("[data-body]").forEach((node) => {
    const isRelated = related.has(node.dataset.body);
    node.classList.toggle("is-related", isRelated);
    node.classList.toggle("is-dimmed", !isRelated);
  });
  container.querySelectorAll(".aspect-target").forEach((node) => {
    const isRelated = related.has(node.dataset.aspectA) || related.has(node.dataset.aspectB);
    node.classList.toggle("is-related", isRelated);
    node.classList.toggle("is-dimmed", !isRelated);
  });
}

function clearHighlight(container) {
  container.querySelectorAll(".is-related, .is-dimmed").forEach((node) => {
    node.classList.remove("is-related", "is-dimmed");
  });
}

function aspectStyle(name, orb) {
  const kind = ASPECT_KIND[name] || "minor";
  const base = ASPECT_STYLE[kind] || ASPECT_STYLE.minor;
  const precisionBoost = Number(orb) <= 1 ? 0.25 : 0;
  return { ...base, kind, width: base.width + precisionBoost };
}

function annularSector(center, innerRadius, outerRadius, startLongitude, endLongitude, rotation, fill, className, tooltip) {
  const outerStart = point(center, outerRadius, startLongitude, rotation);
  const outerEnd = point(center, outerRadius, endLongitude, rotation);
  const innerEnd = point(center, innerRadius, endLongitude, rotation);
  const innerStart = point(center, innerRadius, startLongitude, rotation);
  const largeArc = endLongitude - startLongitude > 180 ? 1 : 0;
  const d = [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
  return `<path class="${className}" d="${d}" fill="${fill}" data-tooltip="${escapeAttr(tooltip)}" />`;
}

function planetName(key) {
  return PLANET_NAMES[key] || key || "";
}

function dms(value) {
  const normalized = Math.abs(value);
  const degrees = Math.floor(normalized);
  const minutesFloat = (normalized - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  const safeSeconds = seconds === 60 ? 0 : seconds;
  const extraMinute = seconds === 60 ? 1 : 0;
  const safeMinutes = minutes + extraMinute === 60 ? 0 : minutes + extraMinute;
  const extraDegree = minutes + extraMinute === 60 ? 1 : 0;
  const sign = value < 0 ? "-" : "";
  return `${sign}${String(degrees + extraDegree).padStart(2, "0")}°${String(safeMinutes).padStart(2, "0")}′${String(safeSeconds).padStart(2, "0")}″`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textSymbol(value) {
  return `${value}\uFE0E`;
}

function midpointArc(start, end) {
  const normalizedStart = ((start % 360) + 360) % 360;
  let normalizedEnd = ((end % 360) + 360) % 360;
  if (normalizedEnd < normalizedStart) normalizedEnd += 360;
  return (normalizedStart + (normalizedEnd - normalizedStart) / 2) % 360;
}

function layoutRadialLabels(bodies, lanes, minGap) {
  const used = lanes.map(() => []);
  const sorted = [...bodies].sort((a, b) => a.longitude - b.longitude);
  const result = new Map();
  for (const body of sorted) {
    let selectedLane = 0;
    let selectedScore = -1;
    for (let index = 0; index < lanes.length; index += 1) {
      const nearest = used[index].length ? Math.min(...used[index].map((longitude) => minAngle(longitude, body.longitude))) : 360;
      if (nearest >= minGap) {
        selectedLane = index;
        selectedScore = nearest;
        break;
      }
      if (nearest > selectedScore) {
        selectedLane = index;
        selectedScore = nearest;
      }
    }
    used[selectedLane].push(body.longitude);
    result.set(body.key, lanes[selectedLane]);
  }
  return result;
}

function minAngle(a, b) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
}

function normalizeDegree(value) {
  return ((value % 360) + 360) % 360;
}
