import assert from "node:assert/strict";
import { DEFAULT_ASPECT_ANGLES, DEFAULT_BODY_KEYS, DEFAULT_POINT_KEYS } from "../src/astro/constants.js";
import { minAngle, toUtcParts } from "../src/astro/format.js";
import { SwissChartEngine } from "../src/astro/swissEngine.js";
import { createAiPrompt, createMarkdown } from "../src/export/markdown.js";

const SAMPLE_INPUT = {
  profileName: "验证样例",
  subjectType: "self",
  tags: "verify",
  birthDate: "1995-08-12",
  birthTime: "14:35",
  locationName: "上海，中国",
  timezone: 8,
  latitude: 31.2304,
  longitude: 121.4737,
  coordinatePrecision: "城市级",
  houseSystem: "P",
  zodiacMode: "tropical",
  notes: "",
};

const SAMPLE_TARGET = {
  ...SAMPLE_INPUT,
  profileName: "验证样例行运",
  birthDate: "2026-06-13",
  birthTime: "12:00",
};

const SAMPLE_PARTNER = {
  ...SAMPLE_INPUT,
  profileName: "验证合盘对象",
  birthDate: "1996-02-20",
  birthTime: "09:15",
};

const OPTIONS = {
  aspectAngles: DEFAULT_ASPECT_ANGLES,
  aspectOrb: 6,
  bodyKeys: DEFAULT_BODY_KEYS,
  pointKeys: DEFAULT_POINT_KEYS,
  patternParticipants: "core",
  lotFormulaSet: "paulus",
  timelineDays: 30,
  timelineOrb: 0.5,
  longTermStartAge: 20,
  longTermEndAge: 30,
  longTermSegmentYears: 5,
  longTermOrb: 0.5,
};

const engine = await new SwissChartEngine().init();

try {
  verifyUtcConversion();
  const natal = engine.calculateNatal(SAMPLE_INPUT, OPTIONS);
  verifyNatalShape(natal);
  verifyAgainstDirectSwiss(natal);
  verifyZodiacModeReset();

  const predictive = engine.calculatePredictive(SAMPLE_INPUT, SAMPLE_TARGET, OPTIONS, natal);
  assert.ok(predictive.transit.bodies.length >= 10, "transit chart should contain core bodies");
  assert.ok(Array.isArray(predictive.transitAspects), "transit aspects should be an array");

  const relationship = engine.calculateRelationship(SAMPLE_INPUT, SAMPLE_PARTNER, OPTIONS, natal);
  assert.ok(relationship.personB.bodies.length >= 10, "relationship personB should contain core bodies");
  assert.ok(Array.isArray(relationship.synastry), "synastry should be an array");

  const workbook = { natal, predictive, relationship, longTerm: engine.calculateLongTermStructure(SAMPLE_INPUT, OPTIONS, natal) };
  verifyExports(workbook);

  const summary = {
    engine: natal.engine,
    utc: natal.utc.iso,
    sun: pick(natal, "sun"),
    moon: pick(natal, "moon"),
    asc: natal.angles.find((angle) => angle.key === "ASC")?.formatted,
    aspects: natal.aspects.length,
    predictiveAspects: predictive.transitAspects.length,
    relationshipAspects: relationship.synastry.length,
  };
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
} finally {
  engine.destroy();
}

function verifyUtcConversion() {
  const utc = toUtcParts(SAMPLE_INPUT.birthDate, SAMPLE_INPUT.birthTime, SAMPLE_INPUT.timezone);
  assert.equal(utc.iso, "1995-08-12T06:35:00.000Z", "Shanghai UTC+8 conversion should be exact");
}

function verifyNatalShape(chart) {
  assert.equal(chart.type, "natal");
  assert.equal(chart.utc.iso, "1995-08-12T06:35:00.000Z");
  assert.ok(chart.jdUt > 2449900 && chart.jdUt < 2450100, "Julian day should be in expected 1995 range");
  assert.equal(chart.houses.length, 12, "chart should contain 12 houses");
  assert.ok(chart.bodies.length >= 10, "chart should contain core bodies");
  assert.ok(chart.angles.some((angle) => angle.key === "ASC"), "ASC should exist");
  assert.ok(chart.angles.some((angle) => angle.key === "MC"), "MC should exist");
  assert.ok(chart.virtualPoints.some((point) => point.key === "fortune"), "Part of Fortune should exist");

  for (const body of chart.bodies) {
    assert.ok(Number.isFinite(body.longitude), `${body.key} longitude should be finite`);
    assert.ok(body.longitude >= 0 && body.longitude < 360, `${body.key} longitude should be normalized`);
    assert.ok(body.house >= 1 && body.house <= 12, `${body.key} house should be 1-12`);
    assert.ok(body.formatted.includes("座"), `${body.key} should have a Chinese zodiac placement`);
  }

  for (let index = 1; index < chart.aspects.length; index += 1) {
    assert.ok(chart.aspects[index - 1].orb <= chart.aspects[index].orb, "aspects should be sorted by orb");
  }
}

function verifyAgainstDirectSwiss(chart) {
  const swe = engine.swe;
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  const bodyMap = new Map(chart.bodies.map((body) => [body.key, body]));
  const directBodies = [
    ["sun", swe.SE_SUN],
    ["moon", swe.SE_MOON],
    ["mercury", swe.SE_MERCURY],
    ["venus", swe.SE_VENUS],
    ["mars", swe.SE_MARS],
    ["jupiter", swe.SE_JUPITER],
    ["saturn", swe.SE_SATURN],
  ];

  for (const [key, id] of directBodies) {
    const direct = swe.calc_ut(chart.jdUt, id, flags);
    assertApprox(bodyMap.get(key).longitude, direct[0], 0.000001, `${key} longitude should match direct Swiss Ephemeris`);
    assertLinearApprox(bodyMap.get(key).speed, direct[3], 0.000001, `${key} speed should match direct Swiss Ephemeris`);
  }

  const housesRaw = swe.houses(chart.jdUt, SAMPLE_INPUT.latitude, SAMPLE_INPUT.longitude, SAMPLE_INPUT.houseSystem);
  const asc = chart.angles.find((angle) => angle.key === "ASC");
  const mc = chart.angles.find((angle) => angle.key === "MC");
  assertApprox(asc.longitude, housesRaw.ascmc[swe.SE_ASC], 0.000001, "ASC should match direct Swiss Ephemeris houses");
  assertApprox(mc.longitude, housesRaw.ascmc[swe.SE_MC], 0.000001, "MC should match direct Swiss Ephemeris houses");
}

function verifyZodiacModeReset() {
  const tropicalA = engine.calculateNatal(SAMPLE_INPUT, OPTIONS);
  const sidereal = engine.calculateNatal({ ...SAMPLE_INPUT, zodiacMode: "sidereal-lahiri" }, OPTIONS);
  const tropicalB = engine.calculateNatal(SAMPLE_INPUT, OPTIONS);
  const tropicalSunA = pickRaw(tropicalA, "sun").longitude;
  const tropicalSunB = pickRaw(tropicalB, "sun").longitude;
  const siderealSun = pickRaw(sidereal, "sun").longitude;

  assertApprox(tropicalSunA, tropicalSunB, 0.000001, "tropical calculation should remain stable after sidereal mode");
  assert.ok(minAngle(tropicalSunA, siderealSun) > 20, "sidereal Lahiri Sun should differ materially from tropical Sun");
}

function verifyExports(workbook) {
  const markdown = createMarkdown(workbook, "full");
  const prompt = createAiPrompt(workbook, "natal");
  assert.ok(markdown.includes("## 出生资料"), "markdown should include birth data");
  assert.ok(markdown.includes("## 行星落点"), "markdown should include planet table");
  assert.ok(prompt.includes("不要编造资料里没有的星体位置"), "AI prompt should constrain hallucination");
  assert.ok(prompt.includes("以下是结构化星盘资料"), "AI prompt should include chart data marker");
}

function pick(chart, key) {
  const body = pickRaw(chart, key);
  return `${body.formatted} / ${body.house}宫`;
}

function pickRaw(chart, key) {
  const body = chart.bodies.find((item) => item.key === key);
  assert.ok(body, `${key} should exist`);
  return body;
}

function assertApprox(actual, expected, tolerance, message) {
  const delta = minAngle(actual, expected);
  assert.ok(delta <= tolerance, `${message}; delta=${delta}`);
}

function assertLinearApprox(actual, expected, tolerance, message) {
  const delta = Math.abs(actual - expected);
  assert.ok(delta <= tolerance, `${message}; delta=${delta}`);
}
