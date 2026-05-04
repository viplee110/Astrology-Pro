import {
  ASPECT_DEFINITIONS,
  DEFAULT_ASPECT_ANGLES,
  DEFAULT_POINT_KEYS,
  PLANETARY_HOUR_ORDER,
  VIRTUAL_POINT_DEFINITIONS,
  WEEKDAY_RULERS,
  ZODIAC_SIGNS,
} from "./constants.js";
import { formatDms, minAngle, normalizeDegree, zodiacPlacement } from "./format.js";

const TRADITIONAL_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
const MODERN_DIGNITY_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const FIXED_STAR_ORB = 1;
const MIDPOINT_ORB = 1;
const MIDPOINT_ASPECT_ANGLES = [0, 45, 90, 135, 180];
const LOT_SOURCE_COMMON = "通用传统（昼夜反转）";
const LOT_SOURCE_PAULUS = "Paulus / Hermetic 七点";
const LOT_SOURCE_VALENS = "Valens 四主点";
const ASPECT_PATTERN_ORDER = [
  "大六芒星",
  "大十字",
  "风筝",
  "神秘矩形",
  "摇篮",
  "大三角",
  "T 三角",
  "上帝手指",
  "雷神之锤",
  "小三角",
  "易三角",
];
const MODERN_SIGN_RULERS = [
  ["mars"],
  ["venus"],
  ["mercury"],
  ["moon"],
  ["sun"],
  ["mercury"],
  ["venus"],
  ["pluto", "mars"],
  ["jupiter"],
  ["saturn"],
  ["uranus", "saturn"],
  ["neptune", "jupiter"],
];
const EXALTATION_FALL = {
  sun: { exaltation: 0, fall: 6 },
  moon: { exaltation: 1, fall: 7 },
  mercury: { exaltation: 5, fall: 11 },
  venus: { exaltation: 11, fall: 5 },
  mars: { exaltation: 9, fall: 3 },
  jupiter: { exaltation: 3, fall: 9 },
  saturn: { exaltation: 6, fall: 0 },
};

const EGYPTIAN_BOUNDS = {
  0: [["jupiter", 6], ["venus", 14], ["mercury", 21], ["mars", 26], ["saturn", 30]],
  1: [["venus", 8], ["mercury", 15], ["jupiter", 22], ["saturn", 27], ["mars", 30]],
  2: [["mercury", 7], ["jupiter", 14], ["venus", 21], ["mars", 25], ["saturn", 30]],
  3: [["mars", 6], ["venus", 13], ["mercury", 20], ["jupiter", 27], ["saturn", 30]],
  4: [["jupiter", 6], ["venus", 13], ["saturn", 19], ["mercury", 25], ["mars", 30]],
  5: [["mercury", 7], ["venus", 13], ["jupiter", 18], ["mars", 24], ["saturn", 30]],
  6: [["saturn", 6], ["mercury", 14], ["jupiter", 21], ["venus", 28], ["mars", 30]],
  7: [["mars", 7], ["venus", 11], ["mercury", 19], ["jupiter", 24], ["saturn", 30]],
  8: [["jupiter", 12], ["venus", 17], ["mercury", 21], ["saturn", 26], ["mars", 30]],
  9: [["mercury", 7], ["jupiter", 14], ["venus", 22], ["saturn", 26], ["mars", 30]],
  10: [["mercury", 7], ["venus", 13], ["jupiter", 20], ["mars", 25], ["saturn", 30]],
  11: [["venus", 12], ["jupiter", 16], ["mercury", 19], ["mars", 28], ["saturn", 30]],
};

const DECAN_RULERS = [
  ["mars", "sun", "venus"],
  ["mercury", "moon", "saturn"],
  ["jupiter", "mars", "sun"],
  ["venus", "mercury", "moon"],
  ["saturn", "jupiter", "mars"],
  ["sun", "venus", "mercury"],
  ["moon", "saturn", "jupiter"],
  ["mars", "sun", "venus"],
  ["mercury", "moon", "saturn"],
  ["jupiter", "mars", "sun"],
  ["venus", "mercury", "moon"],
  ["saturn", "jupiter", "mars"],
];

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

export function enrichChart(chart) {
  const stelliums = detectStelliums(chart.bodies);
  const midpoints = calculateMidpoints(chart.bodies);
  const lots = calculateLots(chart);
  const selectedPointKeys = Array.isArray(chart.settings?.pointKeys) ? chart.settings.pointKeys : DEFAULT_POINT_KEYS;
  const virtualPoints = calculateVirtualPoints(chart, lots, selectedPointKeys);
  const patterns = detectAspectPatterns(chart.bodies, chart.aspects, chart.settings, virtualPoints);
  const classical = calculateClassical(chart);
  const modernDignities = calculateModernDignities(chart.bodies);
  const modernDignityByKey = new Map(modernDignities.map((row) => [row.key, row]));
  const bodies = chart.bodies.map((body) => ({
    ...body,
    dignitySummary: modernDignityByKey.get(body.key)?.status || "",
  }));
  const fixedStarContacts = calculateFixedStarContacts(chart.fixedStars || [], [...chart.bodies, ...chart.angles]);
  const midpointContacts = calculateMidpointContacts(midpoints, [...chart.bodies, ...chart.angles]);
  const pointAspects = calculatePointAspects(bodies, virtualPoints, chart.settings);
  const houseRulers = calculateHouseRulers(chart, bodies);
  const dispositorChains = calculateDispositorChains(bodies);
  const keyRulers = calculateKeyRulers(chart, houseRulers, bodies, dispositorChains);
  const houseRulerAspects = calculateHouseRulerAspects(houseRulers, bodies, virtualPoints, chart.settings);
  return {
    ...chart,
    bodies,
    stats: {
      ...chart.stats,
      stelliums,
      patterns,
    },
    midpoints,
    midpointContacts,
    lots,
    virtualPoints,
    pointAspects,
    houseRulers,
    houseRulerAspects,
    dispositorChains,
    keyRulers,
    classical,
    modernDignities,
    fixedStarContacts,
  };
}

export function detectStelliums(bodies) {
  const important = bodies.filter((body) => ["major", "outer"].includes(body.category));
  const bySign = groupBy(important, (body) => body.sign.zh);
  const byHouse = groupBy(important, (body) => String(body.house));
  return [
    ...Object.entries(bySign)
      .filter(([, items]) => items.length >= 3)
      .map(([key, items]) => ({ type: "星座群星", place: key, bodies: items.map((item) => item.name) })),
    ...Object.entries(byHouse)
      .filter(([, items]) => items.length >= 3)
      .map(([key, items]) => ({ type: "宫位群星", place: `第 ${key} 宫`, bodies: items.map((item) => item.name) })),
  ];
}

export function detectAspectPatterns(bodies, aspects, settings = {}, points = []) {
  const participants = patternParticipants(bodies, points, settings);
  const bodyMap = new Map(participants.map((body) => [body.key, body]));
  const aspectMap = buildPatternAspectMap(participants, aspects, settings);
  const keys = participants.map((body) => body.key);
  const patterns = [];

  forEachCombo(keys, 3, ([a, b, c]) => {
    const pairs = [[a, b], [a, c], [b, c]];
    const trines = matchingEdges(aspectMap, pairs, 120);
    const sextiles = matchingEdges(aspectMap, pairs, 60);
    const squares = matchingEdges(aspectMap, pairs, 90);
    const oppositions = matchingEdges(aspectMap, pairs, 180);
    const quincunxes = matchingEdges(aspectMap, pairs, 150);
    const sesquiquadrates = matchingEdges(aspectMap, pairs, 135);

    if (trines.length === 3) {
      patterns.push(pattern("大三角", [a, b, c], bodyMap, trines));
    }
    if (squares.length >= 2 && oppositions.length === 1) {
      patterns.push(pattern("T 三角", [a, b, c], bodyMap, [...squares, ...oppositions]));
    }
    if (quincunxes.length >= 2 && sextiles.length >= 1) {
      patterns.push(pattern("上帝手指", [a, b, c], bodyMap, [...quincunxes, ...sextiles]));
    }
    if (sextiles.length === 2 && trines.length === 1) {
      patterns.push(pattern("小三角", [a, b, c], bodyMap, [...sextiles, ...trines]));
    }
    if (oppositions.length === 1 && trines.length === 1 && sextiles.length === 1) {
      patterns.push(pattern("易三角", [a, b, c], bodyMap, [...oppositions, ...trines, ...sextiles]));
    }
    if (sesquiquadrates.length === 2 && squares.length === 1) {
      patterns.push(pattern("雷神之锤", [a, b, c], bodyMap, [...sesquiquadrates, ...squares]));
    }
  });

  forEachCombo(keys, 4, ([a, b, c, d]) => {
    const pairs = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]];
    const oppositions = matchingEdges(aspectMap, pairs, 180);
    const squares = matchingEdges(aspectMap, pairs, 90);
    const trines = matchingEdges(aspectMap, pairs, 120);
    const sextiles = matchingEdges(aspectMap, pairs, 60);

    if (oppositions.length >= 2 && squares.length >= 4) {
      patterns.push(pattern("大十字", [a, b, c, d], bodyMap, [...oppositions, ...squares]));
    }
    if (trines.length >= 3 && sextiles.length >= 2 && oppositions.length >= 1) {
      patterns.push(pattern("风筝", [a, b, c, d], bodyMap, [...trines, ...sextiles, ...oppositions]));
    }
    if (oppositions.length >= 2 && trines.length >= 2 && sextiles.length >= 2) {
      patterns.push(pattern("神秘矩形", [a, b, c, d], bodyMap, [...oppositions, ...trines, ...sextiles]));
    }
    if (oppositions.length === 1 && trines.length >= 2 && sextiles.length >= 3) {
      patterns.push(pattern("摇篮", [a, b, c, d], bodyMap, [...oppositions, ...trines, ...sextiles]));
    }
  });

  forEachCombo(keys, 6, (combo) => {
    const pairs = comboPairs(combo);
    const oppositions = matchingEdges(aspectMap, pairs, 180);
    const trines = matchingEdges(aspectMap, pairs, 120);
    const sextiles = matchingEdges(aspectMap, pairs, 60);
    if (sextiles.length >= 6 && trines.length >= 6 && oppositions.length >= 3) {
      patterns.push(pattern("大六芒星", combo, bodyMap, [...sextiles, ...trines, ...oppositions]));
    }
  });

  return uniquePatterns(patterns);
}

export function calculateMidpoints(bodies) {
  const core = bodies.filter((body) => ["major", "outer"].includes(body.category)).slice(0, 10);
  const rows = [];
  for (let i = 0; i < core.length - 1; i += 1) {
    for (let j = i + 1; j < core.length; j += 1) {
      const longitude = midpoint(core[i].longitude, core[j].longitude);
      rows.push({
        pointA: core[i].name,
        pointB: core[j].name,
        longitude,
        ...zodiacPlacement(longitude),
      });
    }
  }
  return rows;
}

export function calculateLots(chart) {
  const sun = chart.bodies.find((body) => body.key === "sun");
  const moon = chart.bodies.find((body) => body.key === "moon");
  const mercury = chart.bodies.find((body) => body.key === "mercury");
  const venus = chart.bodies.find((body) => body.key === "venus");
  const mars = chart.bodies.find((body) => body.key === "mars");
  const jupiter = chart.bodies.find((body) => body.key === "jupiter");
  const saturn = chart.bodies.find((body) => body.key === "saturn");
  const asc = chart.angles.find((angle) => angle.key === "ASC");
  const isDay = isDayChart(chart);
  if (!sun || !moon || !asc) return [];
  const fortune = normalizeDegree(isDay ? asc.longitude + moon.longitude - sun.longitude : asc.longitude + sun.longitude - moon.longitude);
  const spirit = normalizeDegree(isDay ? asc.longitude + sun.longitude - moon.longitude : asc.longitude + moon.longitude - sun.longitude);
  const formulaSet = chart.settings?.lotFormulaSet || "paulus";
  const rows = [
    lot("fortune", "福点", isDay ? "ASC + Moon - Sun" : "ASC + Sun - Moon", fortune, chart.houses, LOT_SOURCE_COMMON),
    lot("spirit", "精神点", isDay ? "ASC + Sun - Moon" : "ASC + Moon - Sun", spirit, chart.houses, LOT_SOURCE_COMMON),
  ];
  if (formulaSet === "valens") {
    const eros = normalizeDegree(isDay ? asc.longitude + spirit - fortune : asc.longitude + fortune - spirit);
    const necessity = normalizeDegree(isDay ? asc.longitude + fortune - spirit : asc.longitude + spirit - fortune);
    rows.push(lot("eros", "爱神点", isDay ? "ASC + Spirit - Fortune" : "ASC + Fortune - Spirit", eros, chart.houses, LOT_SOURCE_VALENS));
    rows.push(lot("necessity", "必然点", isDay ? "ASC + Fortune - Spirit" : "ASC + Spirit - Fortune", necessity, chart.houses, LOT_SOURCE_VALENS));
    return rows;
  }
  if (venus) {
    const eros = normalizeDegree(isDay ? asc.longitude + venus.longitude - spirit : asc.longitude + spirit - venus.longitude);
    rows.push(lot("eros", "爱神点", isDay ? "ASC + Venus - Spirit" : "ASC + Spirit - Venus", eros, chart.houses, LOT_SOURCE_PAULUS));
  }
  if (mercury) {
    const necessity = normalizeDegree(isDay ? asc.longitude + fortune - mercury.longitude : asc.longitude + mercury.longitude - fortune);
    rows.push(lot("necessity", "必然点", isDay ? "ASC + Fortune - Mercury" : "ASC + Mercury - Fortune", necessity, chart.houses, LOT_SOURCE_PAULUS));
  }
  if (mars) {
    const courage = normalizeDegree(isDay ? asc.longitude + fortune - mars.longitude : asc.longitude + mars.longitude - fortune);
    rows.push(lot("courage", "勇气点", isDay ? "ASC + Fortune - Mars" : "ASC + Mars - Fortune", courage, chart.houses, LOT_SOURCE_PAULUS));
  }
  if (jupiter) {
    const victory = normalizeDegree(isDay ? asc.longitude + jupiter.longitude - spirit : asc.longitude + spirit - jupiter.longitude);
    rows.push(lot("victory", "胜利点", isDay ? "ASC + Jupiter - Spirit" : "ASC + Spirit - Jupiter", victory, chart.houses, LOT_SOURCE_PAULUS));
  }
  if (saturn) {
    const nemesis = normalizeDegree(isDay ? asc.longitude + fortune - saturn.longitude : asc.longitude + saturn.longitude - fortune);
    rows.push(lot("nemesis", "报应点", isDay ? "ASC + Fortune - Saturn" : "ASC + Saturn - Fortune", nemesis, chart.houses, LOT_SOURCE_PAULUS));
  }
  return rows;
}

export function calculateVirtualPoints(chart, lots, selectedKeys) {
  const selected = new Set(selectedKeys);
  const anglesByKey = new Map(chart.angles.map((angle) => [angle.key, angle]));
  const lotsByKey = new Map(lots.map((lotRow) => [lotRow.key, lotRow]));
  return VIRTUAL_POINT_DEFINITIONS
    .filter((definition) => selected.has(definition.key))
    .map((definition) => {
      const source = definition.category === "angle" ? anglesByKey.get(definition.key) : lotsByKey.get(definition.key);
      if (!source || !Number.isFinite(Number(source.longitude))) return null;
      const longitude = normalizeDegree(source.longitude);
      return {
        key: definition.key,
        name: definition.name,
        symbol: definition.symbol,
        category: definition.category === "angle" ? "四轴/角点" : "阿拉伯点",
        longitude,
        house: angleHouse(definition.key) || source.house || houseForLongitude(longitude, chart.houses),
        formula: source.formula || "",
        ...zodiacPlacement(longitude),
      };
    })
    .filter(Boolean);
}

export function calculateHouseRulers(chart, bodies) {
  const bodyByKey = new Map(bodies.map((body) => [body.key, body]));
  return chart.houses.map((house) => {
    const signIndex = house.signIndex;
    const traditionalRulerKey = ZODIAC_SIGNS[signIndex].ruler;
    const modernRulerKeys = MODERN_SIGN_RULERS[signIndex] || [traditionalRulerKey];
    const traditionalRuler = bodyByKey.get(traditionalRulerKey);
    const modernRulers = modernRulerKeys.map((key) => rulerDetail(key, bodyByKey));
    return {
      house: house.number,
      cusp: house.formatted,
      cuspLongitude: house.longitude,
      signIndex,
      sign: house.sign.zh,
      traditionalRulerKey,
      traditionalRuler: planetName(traditionalRulerKey),
      traditionalPlacement: traditionalRuler?.formatted || "",
      traditionalHouse: traditionalRuler?.house || "",
      traditionalStatus: traditionalRuler?.dignitySummary || "",
      traditionalRetrograde: traditionalRuler ? traditionalRuler.retrograde : false,
      flightText: traditionalRuler ? `第 ${house.number} 宫主 ${planetName(traditionalRulerKey)} 飞第 ${traditionalRuler.house} 宫` : "",
      modernRulers,
      modernRulerKeys,
      modernRulerText: modernRulers.map((item) => item.name).join(" / "),
      modernFlightText: modernRulers
        .filter((item) => item.house)
        .map((item) => `第 ${house.number} 宫主 ${item.name} 飞第 ${item.house} 宫`)
        .join("；"),
    };
  });
}

function calculateHouseRulerAspects(houseRulers, bodies, points, settings = {}) {
  const bodyByKey = new Map(bodies.map((body) => [body.key, body]));
  const selectedAngles = settings.aspectAngles?.length ? settings.aspectAngles : DEFAULT_ASPECT_ANGLES;
  const maxOrb = Number(settings.aspectOrb ?? 6);
  const definitions = ASPECT_DEFINITIONS.filter((definition) => selectedAngles.includes(definition.angle));
  const targets = [...bodies, ...points];
  const contexts = [];
  const seenContext = new Set();
  for (const row of houseRulers) {
    addRulerContext(contexts, seenContext, row.house, "传统", row.traditionalRulerKey);
    for (const key of row.modernRulerKeys || []) {
      if (key !== row.traditionalRulerKey) addRulerContext(contexts, seenContext, row.house, "现代", key);
    }
  }
  const rows = [];
  for (const context of contexts) {
    const ruler = bodyByKey.get(context.rulerKey);
    if (!ruler) continue;
    for (const target of targets) {
      if (target.key === ruler.key) continue;
      for (const definition of definitions) {
        const separation = minAngle(ruler.longitude, target.longitude);
        const orb = Math.abs(separation - definition.angle);
        const allowedOrb = Math.min(maxOrb, definition.defaultOrb ?? maxOrb);
        if (orb <= allowedOrb) {
          rows.push({
            house: context.house,
            rulerType: context.rulerType,
            ruler: ruler.name,
            rulerKey: ruler.key,
            rulerPlacement: ruler.formatted,
            rulerHouse: ruler.house,
            aspect: definition.name,
            aspectAngle: definition.angle,
            target: target.name,
            targetKey: target.key,
            targetType: target.category || "星体",
            targetPlacement: target.formatted,
            targetHouse: target.house || "",
            orb,
            orbText: formatDms(orb),
          });
        }
      }
    }
  }
  return rows.sort((a, b) => a.house - b.house || a.orb - b.orb);
}

function calculateDispositorChains(bodies) {
  return {
    traditional: buildDispositorRows(bodies, "traditional"),
    modern: buildDispositorRows(bodies, "modern"),
  };
}

function buildDispositorRows(bodies, mode) {
  const bodyByKey = new Map(bodies.map((body) => [body.key, body]));
  return bodies.map((body) => buildDispositorRow(body, bodyByKey, mode));
}

function buildDispositorRow(body, bodyByKey, mode) {
  const chain = [body.key];
  const seen = new Map([[body.key, 0]]);
  let current = body;
  let loopStart = null;
  let missingKey = "";

  for (let guard = 0; guard < 24; guard += 1) {
    const nextKey = rulerForSign(current.signIndex, mode);
    if (!nextKey) break;
    const nextBody = bodyByKey.get(nextKey);
    if (!nextBody) {
      chain.push(nextKey);
      missingKey = nextKey;
      break;
    }
    if (seen.has(nextKey)) {
      chain.push(nextKey);
      loopStart = seen.get(nextKey);
      break;
    }
    chain.push(nextKey);
    seen.set(nextKey, chain.length - 1);
    current = nextBody;
  }

  const loopKeys = loopStart !== null ? chain.slice(loopStart, -1) : [];
  const terminalKey = loopKeys.length === 1 ? loopKeys[0] : "";
  return {
    mode: mode === "modern" ? "现代" : "传统",
    body: body.name,
    key: body.key,
    placement: body.formatted,
    house: body.house,
    firstDispositorKey: chain[1] || "",
    firstDispositor: chain[1] ? planetName(chain[1]) : "",
    chainKeys: chain,
    chain: chain.map((key) => planetName(key)).join(" → "),
    terminalKey,
    terminal: terminalKey ? planetName(terminalKey) : "",
    loopKeys,
    loop: loopKeys.map((key) => planetName(key)).join(" ↔ "),
    status: missingKey ? `${planetName(missingKey)} 未在当前显示星体中` : dispositorStatus(loopKeys),
  };
}

function calculateKeyRulers(chart, houseRulers, bodies, dispositorChains) {
  const bodyByKey = new Map(bodies.map((body) => [body.key, body]));
  const asc = chart.angles.find((angle) => angle.key === "ASC");
  const mc = chart.angles.find((angle) => angle.key === "MC");
  const sun = bodies.find((body) => body.key === "sun");
  const moon = bodies.find((body) => body.key === "moon");
  const rows = [
    keyRulerRow("命主星", asc?.signIndex, bodyByKey),
    keyRulerRow("天顶主星", mc?.signIndex, bodyByKey),
    houseRulerRow("第十宫主", 10, houseRulers, bodyByKey),
    houseRulerRow("太阳所在宫主", sun?.house, houseRulers, bodyByKey),
    houseRulerRow("月亮所在宫主", moon?.house, houseRulers, bodyByKey),
  ].filter(Boolean);

  const finalDispositors = uniqueValues(dispositorChains.traditional.filter((row) => row.terminal).map((row) => row.terminal));
  const mutualLoops = uniqueValues(dispositorChains.traditional.filter((row) => row.loopKeys.length > 1).map((row) => row.loop));
  return {
    rows,
    finalDispositors,
    mutualLoops,
  };
}

function calculatePointAspects(bodies, points, settings = {}) {
  const selectedAngles = settings.aspectAngles?.length ? settings.aspectAngles : DEFAULT_ASPECT_ANGLES;
  const maxOrb = Number(settings.aspectOrb ?? 6);
  const definitions = ASPECT_DEFINITIONS.filter((definition) => selectedAngles.includes(definition.angle));
  const rows = [];
  for (const body of bodies) {
    for (const point of points) {
      for (const definition of definitions) {
        const separation = minAngle(body.longitude, point.longitude);
        const orb = Math.abs(separation - definition.angle);
        const allowedOrb = Math.min(maxOrb, definition.defaultOrb ?? maxOrb);
        if (orb <= allowedOrb) {
          rows.push({
            planetA: body.name,
            keyA: body.key,
            aspect: definition.name,
            aspectEn: definition.en,
            angle: definition.angle,
            planetB: point.name,
            keyB: point.key,
            separation,
            orb,
            orbText: formatDms(orb),
            color: definition.color,
          });
        }
      }
    }
  }
  return rows.sort((a, b) => a.orb - b.orb);
}

export function calculateFixedStarContacts(fixedStars, targets, orb = FIXED_STAR_ORB) {
  return fixedStars
    .flatMap((star) => targets.map((target) => ({ star, target, orb: minAngle(star.longitude, target.longitude) })))
    .filter((row) => Number.isFinite(row.orb) && row.orb <= orb)
    .sort((a, b) => a.orb - b.orb)
    .map(({ star, target, orb: contactOrb }) => ({
      star: star.name,
      target: target.name || target.key,
      aspect: "合",
      orb: contactOrb,
      orbText: formatDms(contactOrb),
      starPosition: star.formatted,
      targetPosition: target.formatted,
    }));
}

export function calculateMidpointContacts(midpoints, targets, orb = MIDPOINT_ORB) {
  const aspectByAngle = new Map(ASPECT_DEFINITIONS.map((aspect) => [aspect.angle, aspect]));
  const rows = [];
  for (const midpointRow of midpoints) {
    for (const target of targets) {
      if (target.name === midpointRow.pointA || target.name === midpointRow.pointB) continue;
      const separation = minAngle(midpointRow.longitude, target.longitude);
      for (const angle of MIDPOINT_ASPECT_ANGLES) {
        const contactOrb = Math.abs(separation - angle);
        if (contactOrb <= orb) {
          const definition = aspectByAngle.get(angle) || { name: `${angle}°`, angle };
          rows.push({
            midpoint: `${midpointRow.pointA}/${midpointRow.pointB}`,
            target: target.name || target.key,
            aspect: definition.name,
            angle,
            orb: contactOrb,
            orbText: formatDms(contactOrb),
            midpointPosition: midpointRow.formatted,
            targetPosition: target.formatted,
          });
        }
      }
    }
  }
  return rows.sort((a, b) => a.orb - b.orb).slice(0, 120);
}

export function calculateClassical(chart) {
  const sun = chart.bodies.find((body) => body.key === "sun");
  const classicalBodies = chart.bodies.filter((body) => TRADITIONAL_KEYS.includes(body.key));
  const isDay = isDayChart(chart);
  const rows = classicalBodies.map((body) => {
    const sign = ZODIAC_SIGNS[body.signIndex];
    const oppositeSign = (body.signIndex + 6) % 12;
    const ruler = sign.ruler;
    const exalt = EXALTATION_FALL[body.key]?.exaltation;
    const fall = EXALTATION_FALL[body.key]?.fall;
    const dignity = [];
    if (ruler === body.key) dignity.push("入庙");
    if (ZODIAC_SIGNS[oppositeSign].ruler === body.key) dignity.push("失势");
    if (exalt === body.signIndex) dignity.push("擢升");
    if (fall === body.signIndex) dignity.push("落陷");

    const degree = body.degreeInSign;
    const boundLord = EGYPTIAN_BOUNDS[body.signIndex].find(([, end]) => degree < end)?.[0];
    const faceLord = DECAN_RULERS[body.signIndex][Math.min(2, Math.floor(degree / 10))];
    if (boundLord === body.key) dignity.push("入界");
    if (faceLord === body.key) dignity.push("入面");

    const sunDistance = sun && body.key !== "sun" ? minAngle(body.longitude, sun.longitude) : null;
    const solarCondition =
      sunDistance === null
        ? ""
        : sunDistance <= 0.283
          ? "日心"
          : sunDistance <= 8.5
            ? "灼伤"
            : sunDistance <= 17
              ? "光下"
              : "";

    const sectCondition = sectConditionFor(body.key, isDay);
    return {
      planet: body.name,
      key: body.key,
      dignity: dignity.length ? dignity.join("、") : "无主要本质尊贵",
      boundLord: planetName(boundLord),
      faceLord: planetName(faceLord),
      sect: sectCondition,
      solarCondition,
    };
  });

  return {
    sect: isDay ? "日生盘" : "夜生盘",
    rows,
    mutualReceptions: mutualReceptions(classicalBodies),
    receptions: calculateReceptions(chart.aspects, classicalBodies),
  };
}

export function calculateModernDignities(bodies) {
  return bodies
    .filter((body) => MODERN_DIGNITY_KEYS.includes(body.key))
    .map((body) => {
      const statuses = [];
      const signRulers = MODERN_SIGN_RULERS[body.signIndex] || [];
      const oppositeRulers = MODERN_SIGN_RULERS[(body.signIndex + 6) % 12] || [];
      const exalt = EXALTATION_FALL[body.key]?.exaltation;
      const fall = EXALTATION_FALL[body.key]?.fall;
      if (signRulers.includes(body.key)) statuses.push("入庙");
      if (oppositeRulers.includes(body.key)) statuses.push("失势");
      if (exalt === body.signIndex) statuses.push("擢升");
      if (fall === body.signIndex) statuses.push("落陷");
      return {
        planet: body.name,
        key: body.key,
        placement: body.formatted,
        status: statuses.length ? statuses.join("、") : "无主要庙旺弱陷",
        note: dignityNote(body.key, body.signIndex, statuses),
      };
    });
}

export function planetaryHoursForDate({ date, latitude, longitude, timezone }) {
  const sunrise = approximateSunEvent(date, latitude, longitude, timezone, true);
  const sunset = approximateSunEvent(date, latitude, longitude, timezone, false);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const dayRuler = WEEKDAY_RULERS[weekday];
  const startIndex = PLANETARY_HOUR_ORDER.indexOf(dayRuler);
  const dayHours = buildHours(sunrise, sunset, startIndex, "白昼");
  const nextSunrise = approximateSunEvent(addDays(date, 1), latitude, longitude, timezone, true);
  const nightHours = buildHours(sunset, nextSunrise, (startIndex + 12) % 7, "夜间");
  return { sunrise, sunset, dayRuler: planetName(dayRuler), hours: [...dayHours, ...nightHours] };
}

function buildHours(start, end, startIndex, phase) {
  const length = (end - start) / 12;
  return Array.from({ length: 12 }, (_, index) => {
    const ruler = PLANETARY_HOUR_ORDER[(startIndex + index) % 7];
    return {
      phase,
      number: index + 1,
      ruler: planetName(ruler),
      start: new Date(start + length * index).toISOString(),
      end: new Date(start + length * (index + 1)).toISOString(),
    };
  });
}

function approximateSunEvent(date, latitude, longitude, timezone, sunrise) {
  const day = new Date(`${date}T12:00:00Z`);
  const start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const n = Math.floor((start - Date.UTC(day.getUTCFullYear(), 0, 0)) / 86400000);
  const lngHour = longitude / 15;
  const t = n + ((sunrise ? 6 : 18) - lngHour) / 24;
  const m = 0.9856 * t - 3.289;
  let l = m + 1.916 * Math.sin(rad(m)) + 0.02 * Math.sin(rad(2 * m)) + 282.634;
  l = normalizeDegree(l);
  let ra = deg(Math.atan(0.91764 * Math.tan(rad(l))));
  ra = normalizeDegree(ra);
  const lQuadrant = Math.floor(l / 90) * 90;
  const raQuadrant = Math.floor(ra / 90) * 90;
  ra = (ra + lQuadrant - raQuadrant) / 15;
  const sinDec = 0.39782 * Math.sin(rad(l));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(latitude))) / (cosDec * Math.cos(rad(latitude)));
  if (cosH > 1 || cosH < -1) {
    return start + (sunrise ? 6 : 18) * 3600000 - timezone * 3600000;
  }
  let h = sunrise ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH));
  h /= 15;
  const localMeanTime = h + ra - 0.06571 * t - 6.622;
  const utcHour = normalizeHour(localMeanTime - lngHour);
  return start + utcHour * 3600000;
}

function isDayChart(chart) {
  const sun = chart.bodies.find((body) => body.key === "sun");
  const asc = chart.angles?.find((angle) => angle.key === "ASC");
  const dsc = chart.angles?.find((angle) => angle.key === "DSC");
  if (sun && asc && dsc) return degreeInArc(sun.longitude, dsc.longitude, asc.longitude);
  return sun ? [7, 8, 9, 10, 11, 12].includes(sun.house) : true;
}

function sectConditionFor(key, isDay) {
  if (key === "sun" || key === "jupiter" || key === "saturn") return isDay ? "得时" : "失时";
  if (key === "moon" || key === "venus" || key === "mars") return isDay ? "失时" : "得时";
  return "随相位/位置判断";
}

function mutualReceptions(bodies) {
  const byKey = new Map(bodies.map((body) => [body.key, body]));
  const rows = [];
  for (const body of bodies) {
    const ruler = ZODIAC_SIGNS[body.signIndex].ruler;
    const rulerBody = byKey.get(ruler);
    if (!rulerBody) continue;
    const rulerOfRuler = ZODIAC_SIGNS[rulerBody.signIndex].ruler;
    if (rulerOfRuler === body.key && body.key < ruler) {
      rows.push(`${body.name} 与 ${rulerBody.name} 互容`);
    }
  }
  return rows;
}

function calculateReceptions(aspects, bodies) {
  const byKey = new Map(bodies.map((body) => [body.key, body]));
  const rows = [];
  for (const aspect of aspects) {
    const a = byKey.get(aspect.keyA);
    const b = byKey.get(aspect.keyB);
    if (!a || !b) continue;
    const aLords = dignityLords(a);
    const bLords = dignityLords(b);
    if (aLords.includes(b.key)) rows.push(`${b.name} 接纳 ${a.name}（${a.name}在${b.name}尊贵中，${aspect.aspect}）`);
    if (bLords.includes(a.key)) rows.push(`${a.name} 接纳 ${b.name}（${b.name}在${a.name}尊贵中，${aspect.aspect}）`);
  }
  return [...new Set(rows)];
}

function dignityLords(body) {
  const sign = ZODIAC_SIGNS[body.signIndex];
  const lords = [sign.ruler];
  if (sign.exaltation) lords.push(sign.exaltation);
  const boundLord = EGYPTIAN_BOUNDS[body.signIndex].find(([, end]) => body.degreeInSign < end)?.[0];
  const faceLord = DECAN_RULERS[body.signIndex][Math.min(2, Math.floor(body.degreeInSign / 10))];
  if (boundLord) lords.push(boundLord);
  if (faceLord) lords.push(faceLord);
  return [...new Set(lords)];
}

function dignityNote(key, signIndex, statuses) {
  if (!statuses.length) return "";
  const rulers = MODERN_SIGN_RULERS[signIndex] || [];
  const notes = [];
  if (rulers.includes(key)) {
    notes.push(["uranus", "neptune", "pluto"].includes(key) ? "现代守护" : "守护星");
  }
  if (EXALTATION_FALL[key]?.exaltation === signIndex) notes.push("传统擢升");
  if (EXALTATION_FALL[key]?.fall === signIndex) notes.push("传统落陷");
  if ((MODERN_SIGN_RULERS[(signIndex + 6) % 12] || []).includes(key)) notes.push("对宫失势");
  return notes.join("、");
}

function rulerDetail(key, bodyByKey) {
  const body = bodyByKey.get(key);
  return {
    key,
    name: planetName(key),
    placement: body?.formatted || "",
    house: body?.house || "",
    status: body?.dignitySummary || "",
    retrograde: body ? body.retrograde : false,
  };
}

function addRulerContext(contexts, seen, house, rulerType, rulerKey) {
  if (!rulerKey) return;
  const key = `${house}:${rulerType}:${rulerKey}`;
  if (seen.has(key)) return;
  seen.add(key);
  contexts.push({ house, rulerType, rulerKey });
}

function rulerForSign(signIndex, mode) {
  if (!Number.isInteger(signIndex)) return "";
  if (mode === "modern") return MODERN_SIGN_RULERS[signIndex]?.[0] || ZODIAC_SIGNS[signIndex]?.ruler || "";
  return ZODIAC_SIGNS[signIndex]?.ruler || "";
}

function dispositorStatus(loopKeys) {
  if (!loopKeys.length) return "未形成闭环";
  if (loopKeys.length === 1) return "终定位星";
  if (loopKeys.length === 2) return "互容闭环";
  return "定位星闭环";
}

function keyRulerRow(label, signIndex, bodyByKey) {
  if (!Number.isInteger(signIndex)) return null;
  const rulerKey = ZODIAC_SIGNS[signIndex].ruler;
  const body = bodyByKey.get(rulerKey);
  return {
    item: label,
    sign: ZODIAC_SIGNS[signIndex].zh,
    rulerKey,
    ruler: planetName(rulerKey),
    placement: body?.formatted || "",
    house: body?.house || "",
    status: body?.dignitySummary || "",
    note: body ? `${planetName(rulerKey)} 在第 ${body.house} 宫` : "未在当前显示星体中",
  };
}

function houseRulerRow(label, house, houseRulers, bodyByKey) {
  const row = houseRulers.find((item) => item.house === house);
  if (!row) return null;
  const body = bodyByKey.get(row.traditionalRulerKey);
  return {
    item: label,
    sign: row.sign,
    rulerKey: row.traditionalRulerKey,
    ruler: row.traditionalRuler,
    placement: row.traditionalPlacement,
    house: row.traditionalHouse,
    status: body?.dignitySummary || "",
    note: body ? `第 ${row.house} 宫主 ${row.traditionalRuler} 飞第 ${body.house} 宫` : "未在当前显示星体中",
  };
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function lot(key, name, formula, longitude, houses, source = "") {
  return {
    key,
    name,
    formula,
    source,
    longitude,
    house: houseForLongitude(longitude, houses),
    ...zodiacPlacement(longitude),
  };
}

function angleHouse(key) {
  return { ASC: 1, MC: 10, DSC: 7, IC: 4 }[key] || "";
}

function houseForLongitude(longitude, houses) {
  for (let index = 0; index < houses.length; index += 1) {
    const start = houses[index].longitude;
    const end = houses[(index + 1) % houses.length].longitude;
    if (degreeInArc(longitude, start, end)) return houses[index].number;
  }
  return "";
}

function degreeInArc(value, start, end) {
  const normalized = normalizeDegree(value);
  if (start <= end) return normalized >= start && normalized < end;
  return normalized >= start || normalized < end;
}

function pairKey(a, b, angle) {
  return [a, b].sort().join(":") + `:${angle}`;
}

function patternParticipants(bodies, points, settings = {}) {
  const mode = settings.patternParticipants || "core";
  const baseBodies = mode === "core" ? bodies.filter((body) => ["major", "outer"].includes(body.category)) : bodies;
  const extras = mode === "points" ? points : [];
  const seen = new Set();
  return [...baseBodies, ...extras]
    .filter((item) => item?.key && Number.isFinite(Number(item.longitude)))
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .map((item) => ({
      key: item.key,
      name: item.name || item.key,
      longitude: normalizeDegree(Number(item.longitude)),
      category: item.category || "point",
    }));
}

function buildPatternAspectMap(participants, aspects, settings = {}) {
  const selectedAngles = settings.aspectAngles?.length ? settings.aspectAngles : DEFAULT_ASPECT_ANGLES;
  const maxOrb = Number(settings.aspectOrb ?? 6);
  const definitions = ASPECT_DEFINITIONS.filter((definition) => selectedAngles.includes(definition.angle));
  const aspectMap = new Map();

  for (const aspect of aspects || []) {
    if (selectedAngles.includes(aspect.angle)) {
      aspectMap.set(pairKey(aspect.keyA, aspect.keyB, aspect.angle), aspect);
    }
  }

  for (let first = 0; first < participants.length - 1; first += 1) {
    for (let second = first + 1; second < participants.length; second += 1) {
      const a = participants[first];
      const b = participants[second];
      const separation = minAngle(a.longitude, b.longitude);
      for (const definition of definitions) {
        const orb = Math.abs(separation - definition.angle);
        const allowedOrb = Math.min(maxOrb, definition.defaultOrb ?? maxOrb);
        if (orb <= allowedOrb) {
          aspectMap.set(pairKey(a.key, b.key, definition.angle), {
            keyA: a.key,
            keyB: b.key,
            planetA: a.name,
            planetB: b.name,
            aspect: definition.name,
            angle: definition.angle,
            separation,
            orb,
            orbText: formatDms(orb),
            color: definition.color,
          });
        }
      }
    }
  }

  return aspectMap;
}

function comboPairs(keys) {
  const pairs = [];
  for (let first = 0; first < keys.length - 1; first += 1) {
    for (let second = first + 1; second < keys.length; second += 1) {
      pairs.push([keys[first], keys[second]]);
    }
  }
  return pairs;
}

function matchingEdges(aspectMap, pairs, angle) {
  return pairs.map(([a, b]) => aspectMap.get(pairKey(a, b, angle))).filter(Boolean);
}

function pattern(type, keys, bodyMap, evidence = []) {
  const uniqueEvidence = [];
  const seen = new Set();
  for (const edge of evidence) {
    const key = pairKey(edge.keyA, edge.keyB, edge.angle);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEvidence.push({
      pointA: edge.planetA,
      aspect: edge.aspect,
      pointB: edge.planetB,
      angle: edge.angle,
      orb: edge.orb,
      orbText: edge.orbText,
    });
  }
  return {
    type,
    bodies: keys.map((key) => bodyMap.get(key)?.name || key),
    evidence: uniqueEvidence.sort((a, b) => a.angle - b.angle || a.orb - b.orb),
  };
}

function uniquePatterns(patterns) {
  const seen = new Set();
  return patterns.filter((item) => {
    const key = `${item.type}:${item.bodies.slice().sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => ASPECT_PATTERN_ORDER.indexOf(a.type) - ASPECT_PATTERN_ORDER.indexOf(b.type) || b.bodies.length - a.bodies.length);
}

function midpoint(a, b) {
  let diff = normalizeDegree(b - a);
  if (diff > 180) diff -= 360;
  return normalizeDegree(a + diff / 2);
}

function groupBy(items, selector) {
  return items.reduce((result, item) => {
    const key = selector(item);
    result[key] ||= [];
    result[key].push(item);
    return result;
  }, {});
}

function forEachCombo(items, size, callback, start = 0, combo = []) {
  if (combo.length === size) {
    callback(combo);
    return;
  }
  for (let index = start; index <= items.length - (size - combo.length); index += 1) {
    forEachCombo(items, size, callback, index + 1, [...combo, items[index]]);
  }
}

function planetName(key) {
  return PLANET_NAMES[key] || key || "";
}

function rad(value) {
  return (value * Math.PI) / 180;
}

function deg(value) {
  return (value * 180) / Math.PI;
}

function normalizeHour(value) {
  return ((value % 24) + 24) % 24;
}

function addDays(date, days) {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}
