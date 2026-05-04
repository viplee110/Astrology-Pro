import { ASPECT_DEFINITIONS, ZODIAC_SIGNS } from "../astro/constants.js";

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

export function renderChartWheel(container, chart) {
  const size = 860;
  const center = size / 2;
  const outer = 382;
  const zodiac = 344;
  const house = 286;
  const planetAnchor = 260;
  const planetLanes = [270, 238, 206, 174, 142];
  const aspect = 168;
  const mc = chart.angles.find((angle) => angle.key === "MC");
  const wheelRotation = mc?.longitude ?? 0;

  const aspectColor = new Map(ASPECT_DEFINITIONS.map((item) => [item.name, item.color]));
  const bodyByKey = new Map(chart.bodies.map((body) => [body.key, body]));
  const planetLayout = layoutRadialLabels(chart.bodies, planetLanes, 9);
  const houseLines = chart.houses.map((item) => {
    const tooltip = [
      `第 ${item.number} 宫宫头`,
      item.formatted,
      `黄经 ${dms(item.longitude)}`,
    ].join("\n");
    return interactiveLine(point(center, house - 2, item.longitude, wheelRotation), point(center, outer, item.longitude, wheelRotation), "#b9aa98", 1, "house-cusp-line", tooltip);
  }).join("");
  const signLines = Array.from({ length: 12 }, (_, index) => {
    const sign = ZODIAC_SIGNS[index];
    const tooltip = [`${sign.zh} 0°`, `元素 ${sign.element} / 模式 ${sign.mode}`].join("\n");
    return interactiveLine(point(center, zodiac, index * 30, wheelRotation), point(center, outer, index * 30, wheelRotation), "#ded7ca", 1, "sign-cusp-line", tooltip);
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
      return interactiveLine(point(center, aspect, a.longitude, wheelRotation), point(center, aspect, b.longitude, wheelRotation), aspectColor.get(item.aspect) ?? "#888", 1, "aspect-line", tooltip);
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
    return hoverText("zodiac-label", p, sign.symbol, tooltip);
  }).join("");

  const houseLabels = chart.houses
    .map((houseItem, index) => {
      const next = chart.houses[(index + 1) % chart.houses.length];
      const p = point(center, 307, midpointArc(houseItem.longitude, next.longitude), wheelRotation);
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
      return `${leader}${hoverGlyph("planet-label", p, `${body.symbol}${retro}`, tooltip, 24)}`;
    })
    .join("");

  const virtualPointLabels = (chart.virtualPoints || [])
    .filter((pointItem) => !["ASC", "MC", "DSC", "IC"].includes(pointItem.key))
    .map((pointItem, index) => {
      const p = point(center, 122 - (index % 3) * 18, pointItem.longitude, wheelRotation);
      const label = pointItem.symbol || pointItem.key;
      const tooltip = [
        pointItem.name,
        `${pointItem.formatted}${pointItem.house ? ` / 第 ${pointItem.house} 宫` : ""}`,
        `黄经 ${dms(pointItem.longitude)}`,
        pointItem.formula ? `公式 ${pointItem.formula}` : "",
      ].filter(Boolean).join("\n");
      return hoverGlyph("virtual-point-label", p, label, tooltip, 22);
    })
    .join("");

  const angleLabels = chart.angles
    .filter((angle) => ["ASC", "MC", "DSC", "IC"].includes(angle.key))
    .map((angle) => {
      const p = point(center, outer + 24, angle.longitude, wheelRotation);
      const tooltip = [
        `${angle.name} (${angle.key})`,
        angle.formatted,
        `黄经 ${dms(angle.longitude)}`,
      ].join("\n");
      return hoverGlyph("angle-label", p, angle.key, tooltip, 22);
    })
    .join("");

  container.innerHTML = `
    <div class="chart-tooltip" role="status" aria-hidden="true"></div>
    <svg class="chart-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="星盘轮盘">
      <circle cx="${center}" cy="${center}" r="${outer}" fill="#fffaf1" stroke="#9f8c76" stroke-width="2" />
      <circle cx="${center}" cy="${center}" r="${zodiac}" fill="none" stroke="#ded7ca" stroke-width="1" />
      <circle cx="${center}" cy="${center}" r="${house}" fill="none" stroke="#cbbdaa" stroke-width="1" />
      <circle cx="${center}" cy="${center}" r="${aspect}" fill="#fffdf8" stroke="#ded7ca" stroke-width="1" />
      ${signLines}
      ${houseLines}
      ${aspectLines}
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

function line(from, to, color, width, className = "") {
  return `<line class="${className}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="${width}" />`;
}

function interactiveLine(from, to, color, width, className, tooltip) {
  return `
    <g class="chart-hover-target" data-tooltip="${escapeAttr(tooltip)}">
      <line class="aspect-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />
      ${line(from, to, color, width, className)}
    </g>
  `;
}

function hoverText(className, p, value, tooltip, radius = 18) {
  return `
    <g class="chart-hover-target" data-tooltip="${escapeAttr(tooltip)}">
      <circle class="label-hit" cx="${p.x}" cy="${p.y}" r="${radius}" />
      <text class="${className}" x="${p.x}" y="${p.y}">${escapeHtml(value)}</text>
    </g>
  `;
}

function hoverGlyph(className, p, value, tooltip, radius = 24) {
  return `
    <g class="chart-hover-target" data-tooltip="${escapeAttr(tooltip)}">
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
  const hide = () => {
    tooltip.classList.remove("open");
    tooltip.setAttribute("aria-hidden", "true");
  };
  container.addEventListener("pointermove", (event) => {
    const target = event.target.closest?.("[data-tooltip]");
    if (!target || !container.contains(target)) {
      hide();
      return;
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
