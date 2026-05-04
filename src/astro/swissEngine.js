import SwissEph from "../../vendor/swisseph/src/swisseph.js";
import {
  ASPECT_DEFINITIONS,
  DEFAULT_ASPECT_ANGLES,
  DEFAULT_BODY_KEYS,
  DEFAULT_POINT_KEYS,
  FIXED_STARS,
  HOUSE_SYSTEMS,
  PLANET_DEFINITIONS,
  PLANETARY_HOUR_ORDER,
  WEEKDAY_RULERS,
  ZODIAC_SIGNS,
} from "./constants.js";
import { enrichChart, planetaryHoursForDate } from "./advanced.js";
import { formatDms, minAngle, normalizeDegree, toUtcParts, zodiacPlacement } from "./format.js";

const BODY_BY_KEY = new Map(PLANET_DEFINITIONS.map((body) => [body.key, body]));
const ASPECT_BY_ANGLE = new Map(ASPECT_DEFINITIONS.map((aspect) => [aspect.angle, aspect]));
const TROPICAL_YEAR = 365.2422;
const LONG_TERM_TRANSIT_KEYS = ["jupiter", "saturn", "uranus", "neptune", "pluto"];
const LONG_TERM_TARGET_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
const LONG_TERM_ANGLE_KEYS = ["ASC", "MC"];
const LONG_TERM_ASPECTS = [0, 60, 90, 120, 180];

export class SwissChartEngine {
  constructor() {
    this.swe = null;
    this.version = "";
  }

  async init() {
    this.swe = new SwissEph();
    await this.swe.initSwissEph();
    this.version = this.swe.version?.() ?? "unknown";
    return this;
  }

  destroy() {
    this.swe?.close?.();
  }

  calculateNatal(input, options = {}) {
    return this.calculateChart(input, options, "natal");
  }

  calculateChart(input, options = {}, type = "chart") {
    if (!this.swe) throw new Error("Swiss Ephemeris 尚未初始化");
    const utc = toUtcParts(input.birthDate, input.birthTime, Number(input.timezone));
    const jdUt = this.swe.julday(utc.year, utc.month, utc.day, utc.hour);
    return this.calculateChartAtJulianDay(jdUt, input, options, type, utc);
  }

  calculateChartAtJulianDay(jdUt, input, options = {}, type = "chart", utc = null, overrideBodies = null) {
    const isSidereal = input.zodiacMode === "sidereal-lahiri";
    if (isSidereal) this.swe.set_sid_mode(this.swe.SE_SIDM_LAHIRI, 0, 0);

    const positionFlags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (isSidereal ? this.swe.SEFLG_SIDEREAL : 0);
    const houseFlags = isSidereal ? this.swe.SEFLG_SIDEREAL : 0;
    const housesRaw = houseFlags
      ? this.swe.houses_ex(jdUt, houseFlags, input.latitude, input.longitude, input.houseSystem)
      : this.swe.houses(jdUt, input.latitude, input.longitude, input.houseSystem);

    const houses = Array.from({ length: 12 }, (_, index) => {
      const longitude = normalizeDegree(housesRaw.cusps[index + 1]);
      return { number: index + 1, longitude, ...zodiacPlacement(longitude) };
    });

    const angles = [
      buildAngle("上升", "ASC", housesRaw.ascmc[this.swe.SE_ASC]),
      buildAngle("天顶", "MC", housesRaw.ascmc[this.swe.SE_MC]),
      buildAngle("下降", "DSC", housesRaw.ascmc[this.swe.SE_ASC] + 180),
      buildAngle("天底", "IC", housesRaw.ascmc[this.swe.SE_MC] + 180),
      buildAngle("宿命点", "Vertex", housesRaw.ascmc[this.swe.SE_VERTEX]),
      buildAngle("反宿命点", "AntiVertex", housesRaw.ascmc[this.swe.SE_VERTEX] + 180),
    ];

    const selectedKeys = options.bodyKeys?.length ? options.bodyKeys : DEFAULT_BODY_KEYS;
    const selectedPointKeys = Array.isArray(options.pointKeys) ? options.pointKeys : DEFAULT_POINT_KEYS;
    const bodies = overrideBodies || this.calculateBodies(jdUt, positionFlags, houses, selectedKeys);
    const aspects = calculateAspects(bodies, {
      maxOrb: Number(options.aspectOrb ?? input.aspectOrb ?? 6),
      aspectAngles: options.aspectAngles?.length ? options.aspectAngles : DEFAULT_ASPECT_ANGLES,
    });

    return enrichChart({
      type,
      input: { ...input },
      utc: utc || this.revjulToUtc(jdUt),
      jdUt,
      settings: {
        houseSystem: input.houseSystem,
        houseSystemName: HOUSE_SYSTEMS[input.houseSystem] ?? input.houseSystem,
        zodiacMode: input.zodiacMode,
        zodiacModeName: isSidereal ? "Sidereal Lahiri" : "Tropical",
        aspectOrb: Number(options.aspectOrb ?? input.aspectOrb ?? 6),
        aspectAngles: options.aspectAngles?.length ? options.aspectAngles : DEFAULT_ASPECT_ANGLES,
        bodyKeys: selectedKeys,
        pointKeys: selectedPointKeys,
        patternParticipants: options.patternParticipants || "core",
        lotFormulaSet: options.lotFormulaSet || "paulus",
      },
      engine: {
        name: "Swiss Ephemeris WASM",
        version: this.version,
        flags: positionFlags,
        generatedAt: new Date().toISOString(),
      },
      houses,
      angles,
      bodies,
      aspects,
      fixedStars: this.calculateFixedStars(jdUt, positionFlags),
      stats: calculateStats(bodies),
    });
  }

  calculateSuite(natalInput, targetInput, partnerInput, options = {}) {
    const natal = this.calculateNatal(natalInput, options);
    const predictive = this.calculatePredictive(natalInput, targetInput, options, natal);
    const relationship = partnerInput?.birthDate ? this.calculateRelationship(natalInput, partnerInput, options, natal) : null;
    const longTerm = this.calculateLongTermStructure(natalInput, options, natal);
    return { natal, predictive, relationship, longTerm };
  }

  calculatePredictive(natalInput, targetInput, options = {}, natal = null) {
    const base = natal || this.calculateNatal(natalInput, options);
    const transit = this.calculateChart(targetInput, options, "transit");
    const transitAspects = calculateInterAspects(transit.bodies, base.bodies, options, "行运", "本命");
    const progressed = this.calculateSecondaryProgression(natalInput, targetInput, options, base);
    const solarArc = this.calculateSolarArc(base, progressed, natalInput, options);
    const solarArcDirections = calculateInterAspects(solarArc.bodies, base.bodies, { ...options, aspectOrb: 1 }, "太阳弧", "本命");
    const solarReturn = this.findReturnChart(base, targetInput, options, "sun", 365.25);
    const lunarReturn = this.findReturnChart(base, targetInput, options, "moon", 27.32);
    const ephemeris = this.calculateEphemeris(targetInput, options);
    const timeline = this.calculateTransitTimeline(base, targetInput, options);
    const planetaryHours = this.calculatePlanetaryHours(targetInput);

    return { transit, transitAspects, progressed, solarArc, solarArcDirections, solarReturn, lunarReturn, ephemeris, timeline, planetaryHours };
  }

  calculateLongTermStructure(natalInput, options = {}, natal = null) {
    const base = natal || this.calculateNatal(natalInput, options);
    const startAge = Number(options.longTermStartAge ?? 0);
    const endAge = Number(options.longTermEndAge ?? 80);
    const segmentYears = Number(options.longTermSegmentYears ?? 10);
    const orb = Number(options.longTermOrb ?? 0.25);
    const aspectAngles = (options.longTermAspectAngles?.length ? options.longTermAspectAngles : LONG_TERM_ASPECTS)
      .filter((angle) => LONG_TERM_ASPECTS.includes(angle));
    const segments = buildLongTermSegments(natalInput.birthDate, startAge, endAge, segmentYears);
    const events = [];

    for (const segment of segments) {
      const startJd = this.jdForInput(inputAtAge(natalInput, segment.startAge));
      const endJd = this.jdForInput(inputAtAge(natalInput, segment.endAge));
      events.push(...this.calculateLongTermTransits(base, startJd, endJd, segment.index, { ...options, aspectAngles, longTermOrb: orb }));
    }

    events.push(...this.calculateLongTermProgressions(natalInput, base, segments, { ...options, longTermOrb: orb }));
    events.push(...this.calculateLongTermSolarArc(natalInput, base, segments, { ...options, aspectAngles, longTermOrb: orb }));
    events.push(...this.calculateLongTermSolarReturns(natalInput, base, segments, options));

    const sortedEvents = sortLongTermEvents(dedupeLongTermEvents(events));
    const hydratedSegments = segments.map((segment) => ({
      ...segment,
      eventCount: sortedEvents.filter((event) => event.segmentIndex === segment.index).length,
    }));
    return {
      settings: {
        startAge,
        endAge,
        segmentYears,
        orb,
        aspectAngles,
        locationMode: options.longTermLocationMode || "birth",
        location: options.longTermLocation || null,
        relocations: options.longTermRelocations || [],
      },
      segments: hydratedSegments,
      events: sortedEvents,
    };
  }

  calculateLongTermTransits(natal, startJd, endJd, segmentIndex, options) {
    const rows = [];
    const flags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (natal.input.zodiacMode === "sidereal-lahiri" ? this.swe.SEFLG_SIDEREAL : 0);
    const targets = longTermTargets(natal);
    const definitions = ASPECT_DEFINITIONS.filter((definition) => options.aspectAngles.includes(definition.angle));
    for (const transitKey of LONG_TERM_TRANSIT_KEYS) {
      const step = transitKey === "jupiter" || transitKey === "saturn" ? 5 : 15;
      const sourceName = BODY_BY_KEY.get(transitKey)?.name || transitKey;
      for (const target of targets) {
        for (const aspectDefinition of definitions) {
          let prevOrb = this.orbAt(startJd, transitKey, target.longitude, aspectDefinition.angle, flags);
          for (let jd = startJd + step; jd <= endJd; jd += step) {
            const currentOrb = this.orbAt(jd, transitKey, target.longitude, aspectDefinition.angle, flags);
            const nextOrb = this.orbAt(Math.min(jd + step, endJd), transitKey, target.longitude, aspectDefinition.angle, flags);
            if (currentOrb <= prevOrb && currentOrb <= nextOrb && currentOrb <= 2) {
              const refined = this.refineMinimum(jd - step, jd + step, transitKey, target.longitude, aspectDefinition.angle, flags);
              if (refined.orb <= Number(options.longTermOrb || 0.25)) {
                const sourceLongitude = this.longitudeAt(refined.jd, transitKey, flags);
                rows.push(longTermEvent({
                  natal,
                  segmentIndex,
                  jd: refined.jd,
                  technique: "行运",
                  eventType: "精确相位",
                  source: sourceName,
                  sourceKey: transitKey,
                  sourcePosition: zodiacPlacement(sourceLongitude).formatted,
                  aspect: aspectDefinition.name,
                  aspectAngle: aspectDefinition.angle,
                  target,
                  orb: refined.orb,
                }));
              }
            }
            prevOrb = currentOrb;
          }
        }
      }
    }
    return rows;
  }

  calculateLongTermProgressions(natalInput, natal, segments, options) {
    const rows = [];
    let previousMoon = null;
    let previousSun = null;
    const flags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (natal.input.zodiacMode === "sidereal-lahiri" ? this.swe.SEFLG_SIDEREAL : 0);
    for (let age = Math.max(segments[0].startAge, 1); age <= segments.at(-1).endAge; age += 1 / 12) {
      const segmentIndex = segmentIndexForAge(age, segments);
      if (segmentIndex < 0) continue;
      const targetInput = inputAtAge(natalInput, age);
      const eventJd = this.jdForInput(targetInput);
      const progressedJd = natal.jdUt + age;
      const moonLongitude = this.longitudeAt(progressedJd, "moon", flags);
      const sunLongitude = this.longitudeAt(progressedJd, "sun", flags);
      const progressedMoon = {
        key: "moon",
        name: "月亮",
        longitude: moonLongitude,
        house: findHouse(moonLongitude, natal.houses),
        ...zodiacPlacement(moonLongitude),
      };
      const progressedSun = {
        key: "sun",
        name: "太阳",
        longitude: sunLongitude,
        house: findHouse(sunLongitude, natal.houses),
        ...zodiacPlacement(sunLongitude),
      };
      if (progressedMoon && previousMoon) {
        if (progressedMoon.signIndex !== previousMoon.signIndex) {
          rows.push(longTermEvent({
            natal,
            segmentIndex,
            jd: eventJd,
            technique: "次限",
            eventType: "次限月亮换星座",
            source: "次限月亮",
            sourceKey: "progressedMoon",
            sourcePosition: progressedMoon.formatted,
            targetName: progressedMoon.sign.zh,
            targetKey: `sign-${progressedMoon.signIndex}`,
            natalHouse: progressedMoon.house,
          }));
        }
        if (progressedMoon.house !== previousMoon.house) {
          rows.push(longTermEvent({
            natal,
            segmentIndex,
            jd: eventJd,
            technique: "次限",
            eventType: "次限月亮换宫",
            source: "次限月亮",
            sourceKey: "progressedMoon",
            sourcePosition: progressedMoon.formatted,
            targetName: `第 ${progressedMoon.house} 宫`,
            targetKey: `house-${progressedMoon.house}`,
            natalHouse: progressedMoon.house,
          }));
        }
      }
      if (progressedSun && previousSun && progressedSun.signIndex !== previousSun.signIndex) {
        rows.push(longTermEvent({
          natal,
          segmentIndex,
          jd: eventJd,
          technique: "次限",
          eventType: "次限太阳换星座",
          source: "次限太阳",
          sourceKey: "progressedSun",
          sourcePosition: progressedSun.formatted,
          targetName: progressedSun.sign.zh,
          targetKey: `sign-${progressedSun.signIndex}`,
          natalHouse: progressedSun.house,
        }));
      }
      previousMoon = progressedMoon;
      previousSun = progressedSun;
    }
    return rows;
  }

  calculateLongTermSolarArc(natalInput, natal, segments, options) {
    const rows = [];
    const targets = longTermTargets(natal);
    const definitions = ASPECT_DEFINITIONS.filter((definition) => options.aspectAngles.includes(definition.angle));
    const natalSun = natal.bodies.find((body) => body.key === "sun");
    if (!natalSun) return rows;
    const flags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (natal.input.zodiacMode === "sidereal-lahiri" ? this.swe.SEFLG_SIDEREAL : 0);
    const seen = new Set();
    for (let age = Math.max(segments[0].startAge, 1); age <= segments.at(-1).endAge; age += 1 / 12) {
      const segmentIndex = segmentIndexForAge(age, segments);
      if (segmentIndex < 0) continue;
      const targetInput = inputAtAge(natalInput, age);
      const eventJd = this.jdForInput(targetInput);
      const progressedSunLongitude = this.longitudeAt(natal.jdUt + age, "sun", flags);
      const arc = normalizeDegree(progressedSunLongitude - natalSun.longitude);
      const sources = natal.bodies
        .filter((body) => LONG_TERM_TARGET_KEYS.includes(body.key))
        .map((body) => {
          const longitude = normalizeDegree(body.longitude + arc);
          return { ...body, longitude, ...zodiacPlacement(longitude) };
        });
      for (const source of sources) {
        for (const target of targets) {
          for (const aspectDefinition of definitions) {
            if (source.key === target.key && aspectDefinition.angle === 0) continue;
            const orb = Math.abs(minAngle(source.longitude, target.longitude) - aspectDefinition.angle);
            if (orb > Number(options.longTermOrb || 0.25)) continue;
            const key = `${source.key}:${target.key}:${aspectDefinition.angle}:${Math.round(age)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push(longTermEvent({
              natal,
              segmentIndex,
              jd: eventJd,
              technique: "太阳弧",
              eventType: "方向相位",
              source: `太阳弧${source.name}`,
              sourceKey: `solarArc-${source.key}`,
              sourcePosition: source.formatted,
              aspect: aspectDefinition.name,
              aspectAngle: aspectDefinition.angle,
              target,
              orb,
            }));
          }
        }
      }
    }
    return rows;
  }

  calculateLongTermSolarReturns(natalInput, natal, segments, options) {
    const rows = [];
    const endAge = segments.at(-1).endAge;
    for (let age = Math.max(1, segments[0].startAge); age <= endAge; age += 1) {
      const segmentIndex = segmentIndexForAge(age, segments);
      if (segmentIndex < 0) continue;
      const targetInput = inputForLongTermLocation(inputAtAge(natalInput, age), age, options);
      const solarReturn = this.findReturnChart(natal, targetInput, options, "sun", 365.25);
      if (!solarReturn) continue;
      const asc = solarReturn.angles.find((angle) => angle.key === "ASC");
      const mc = solarReturn.angles.find((angle) => angle.key === "MC");
      const moon = solarReturn.bodies.find((body) => body.key === "moon");
      const sun = solarReturn.bodies.find((body) => body.key === "sun");
      rows.push(longTermEvent({
        natal,
        segmentIndex,
        jd: solarReturn.jdUt,
        technique: "太阳返照",
        eventType: "年度返照",
        source: "太阳返照盘",
        sourceKey: "solarReturn",
        sourcePosition: `ASC ${asc?.formatted || ""} / MC ${mc?.formatted || ""}`,
        targetName: `太阳第 ${sun?.house ?? ""} 宫 / 月亮${moon?.formatted || ""}`,
        targetKey: `solar-return-${age}`,
        natalHouse: sun?.house || "",
        locationName: targetInput.locationName,
        latitude: targetInput.latitude,
        longitude: targetInput.longitude,
        timezone: targetInput.timezone,
      }));
    }
    return rows;
  }

  calculateSecondaryProgression(natalInput, targetInput, options, natal) {
    const target = this.calculateChart(targetInput, options, "target");
    const ageDays = target.jdUt - natal.jdUt;
    const ageYears = ageDays / TROPICAL_YEAR;
    const progressedJd = natal.jdUt + ageYears;
    return this.calculateChartAtJulianDay(progressedJd, natalInput, options, "secondaryProgression");
  }

  calculateSolarArc(natal, progressed, natalInput, options) {
    const natalSun = natal.bodies.find((body) => body.key === "sun");
    const progressedSun = progressed.bodies.find((body) => body.key === "sun");
    const arc = normalizeDegree(progressedSun.longitude - natalSun.longitude);
    const bodies = natal.bodies.map((body) => {
      const longitude = normalizeDegree(body.longitude + arc);
      return { ...body, longitude, house: body.house, ...zodiacPlacement(longitude), derived: true };
    });
    return this.calculateChartAtJulianDay(natal.jdUt, natalInput, options, "solarArc", natal.utc, bodies);
  }

  calculateRelationship(natalInput, partnerInput, options = {}, natal = null) {
    const personA = natal || this.calculateNatal(natalInput, options);
    const personB = this.calculateNatal(partnerInput, options);
    const synastry = calculateInterAspects(personA.bodies, personB.bodies, options, "A", "B");
    const composite = this.calculateComposite(personA, personB, natalInput, options);
    const davison = this.calculateDavison(personA, personB, natalInput, partnerInput, options);
    return { personA, personB, synastry, composite, davison };
  }

  calculateComposite(personA, personB, input, options) {
    const bodies = personA.bodies
      .map((bodyA) => {
        const bodyB = personB.bodies.find((body) => body.key === bodyA.key);
        if (!bodyB) return null;
        const longitude = midpoint(bodyA.longitude, bodyB.longitude);
        return { ...bodyA, longitude, speed: 0, retrograde: false, house: findHouse(longitude, personA.houses), ...zodiacPlacement(longitude) };
      })
      .filter(Boolean);
    return this.calculateChartAtJulianDay((personA.jdUt + personB.jdUt) / 2, input, options, "composite", null, bodies);
  }

  calculateDavison(personA, personB, inputA, inputB, options) {
    const midpointInput = {
      ...inputA,
      profileName: `${inputA.profileName || "A"} × ${inputB.profileName || "B"} 时空中点盘`,
      latitude: (Number(inputA.latitude) + Number(inputB.latitude)) / 2,
      longitude: (Number(inputA.longitude) + Number(inputB.longitude)) / 2,
      timezone: inputA.timezone,
    };
    return this.calculateChartAtJulianDay((personA.jdUt + personB.jdUt) / 2, midpointInput, options, "davison");
  }

  calculateBodies(jdUt, flags, houses, selectedKeys) {
    const bodies = [];
    for (const definition of PLANET_DEFINITIONS) {
      if (!selectedKeys.includes(definition.key)) continue;
      if (definition.derivedFrom) {
        const source = bodies.find((body) => body.key === definition.derivedFrom);
        if (!source) continue;
        const longitude = normalizeDegree(source.longitude + definition.offset);
        bodies.push({
          ...definition,
          id: null,
          longitude,
          latitude: -source.latitude,
          distance: source.distance,
          speed: source.speed,
          retrograde: source.retrograde,
          house: findHouse(longitude, houses),
          ...zodiacPlacement(longitude),
        });
        continue;
      }

      const planetId = this.swe[definition.swe];
      const result = this.swe.calc_ut(jdUt, planetId, flags);
      const longitude = normalizeDegree(result[0]);
      bodies.push({
        ...definition,
        id: planetId,
        longitude,
        latitude: result[1],
        distance: result[2],
        speed: result[3],
        retrograde: result[3] < 0,
        house: findHouse(longitude, houses),
        ...zodiacPlacement(longitude),
      });
    }
    return bodies;
  }

  calculateFixedStars(jdUt, flags) {
    return FIXED_STARS.map((name) => {
      try {
        const result = this.swe.fixstar2_ut(name, jdUt, flags);
        if (!result) return null;
        const longitude = normalizeDegree(result[0]);
        const magnitude = this.swe.fixstar2_mag(name);
        return { name, longitude, latitude: result[1], magnitude, ...zodiacPlacement(longitude) };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  calculateEphemeris(targetInput, options) {
    const rows = [];
    const [year, month] = targetInput.birthDate.split("-").map(Number);
    const days = new Date(year, month, 0).getDate();
    for (let day = 1; day <= days; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const chart = this.calculateChart({ ...targetInput, birthDate: date, birthTime: "12:00" }, options, "ephemeris");
      rows.push({ date, bodies: chart.bodies.slice(0, 10).map((body) => ({ key: body.key, name: body.name, formatted: body.formatted, retrograde: body.retrograde })) });
    }
    return rows;
  }

  calculateTransitTimeline(natal, targetInput, options) {
    const rows = [];
    const selectedAngles = options.aspectAngles?.length ? options.aspectAngles : DEFAULT_ASPECT_ANGLES;
    const target = this.calculateChart(targetInput, options, "timelineStart");
    const flags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (targetInput.zodiacMode === "sidereal-lahiri" ? this.swe.SEFLG_SIDEREAL : 0);
    const transitKeys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].filter((key) => options.bodyKeys?.includes(key) ?? true);
    const natalBodies = natal.bodies.filter((body) => ["major", "outer"].includes(body.category)).slice(0, 10);
    const definitions = ASPECT_DEFINITIONS.filter((definition) => selectedAngles.includes(definition.angle));
    const startJd = target.jdUt;
    const endJd = startJd + Number(options.timelineDays || 90);

    for (const transitKey of transitKeys) {
      const step = transitKey === "moon" ? 0.25 : 1;
      const transitName = BODY_BY_KEY.get(transitKey)?.name || transitKey;
      for (const natalBody of natalBodies) {
        for (const aspectDefinition of definitions) {
          let prevJd = startJd;
          let prevOrb = this.orbAt(prevJd, transitKey, natalBody.longitude, aspectDefinition.angle, flags);
          for (let jd = startJd + step; jd <= endJd; jd += step) {
            const currentOrb = this.orbAt(jd, transitKey, natalBody.longitude, aspectDefinition.angle, flags);
            const nextOrb = this.orbAt(Math.min(jd + step, endJd), transitKey, natalBody.longitude, aspectDefinition.angle, flags);
            if (currentOrb <= prevOrb && currentOrb <= nextOrb && currentOrb <= 2) {
              const refined = this.refineMinimum(jd - step, jd + step, transitKey, natalBody.longitude, aspectDefinition.angle, flags);
              if (refined.orb <= Number(options.timelineOrb || 0.25)) {
                const date = this.revjulToUtc(refined.jd).iso;
                rows.push({
                  date: date.slice(0, 10),
                  exactTime: date,
                  planetA: transitName,
                  keyA: transitKey,
                  aspect: aspectDefinition.name,
                  angle: aspectDefinition.angle,
                  planetB: natalBody.name,
                  keyB: natalBody.key,
                  orb: refined.orb,
                  orbText: formatDms(refined.orb),
                });
              }
            }
            prevJd = jd;
            prevOrb = currentOrb;
          }
        }
      }
    }
    return dedupeTimeline(rows).sort((a, b) => a.exactTime.localeCompare(b.exactTime)).slice(0, 250);
  }

  calculatePlanetaryHours(targetInput) {
    const fallback = planetaryHoursForDate({
      date: targetInput.birthDate,
      latitude: targetInput.latitude,
      longitude: targetInput.longitude,
      timezone: targetInput.timezone,
    });
    try {
      const startUtc = toUtcParts(targetInput.birthDate, "00:00", Number(targetInput.timezone));
      const startJd = this.swe.julday(startUtc.year, startUtc.month, startUtc.day, startUtc.hour) - 0.05;
      const sunrise = this.swe.rise_trans(startJd, this.swe.SE_SUN, targetInput.longitude, targetInput.latitude, 0, this.swe.SE_CALC_RISE)?.[0];
      const sunset = Number.isFinite(sunrise)
        ? this.swe.rise_trans(sunrise + 0.01, this.swe.SE_SUN, targetInput.longitude, targetInput.latitude, 0, this.swe.SE_CALC_SET)?.[0]
        : null;
      const nextSunrise = Number.isFinite(sunset)
        ? this.swe.rise_trans(sunset + 0.01, this.swe.SE_SUN, targetInput.longitude, targetInput.latitude, 0, this.swe.SE_CALC_RISE)?.[0]
        : null;
      if (![sunrise, sunset, nextSunrise].every(Number.isFinite) || !(sunrise < sunset && sunset < nextSunrise)) return fallback;

      const weekday = new Date(`${targetInput.birthDate}T12:00:00`).getDay();
      const dayRuler = WEEKDAY_RULERS[weekday];
      const startIndex = PLANETARY_HOUR_ORDER.indexOf(dayRuler);
      return {
        sunrise: jdToIso(sunrise),
        sunset: jdToIso(sunset),
        dayRuler: planetDisplayName(dayRuler),
        method: "Swiss Ephemeris rise_trans",
        hours: [
          ...buildPlanetaryHourRows(jdToMillis(sunrise), jdToMillis(sunset), startIndex, "白昼"),
          ...buildPlanetaryHourRows(jdToMillis(sunset), jdToMillis(nextSunrise), (startIndex + 12) % 7, "夜间"),
        ],
      };
    } catch {
      return fallback;
    }
  }

  orbAt(jd, transitKey, natalLongitude, angle, flags) {
    const longitude = this.longitudeAt(jd, transitKey, flags);
    return Math.abs(minAngle(longitude, natalLongitude) - angle);
  }

  refineMinimum(low, high, transitKey, natalLongitude, angle, flags) {
    let left = low;
    let right = high;
    for (let index = 0; index < 32; index += 1) {
      const third = (right - left) / 3;
      const a = left + third;
      const b = right - third;
      if (this.orbAt(a, transitKey, natalLongitude, angle, flags) < this.orbAt(b, transitKey, natalLongitude, angle, flags)) right = b;
      else left = a;
    }
    const jd = (left + right) / 2;
    return { jd, orb: this.orbAt(jd, transitKey, natalLongitude, angle, flags) };
  }

  longitudeAt(jd, key, flags) {
    if (key === "southNode") return normalizeDegree(this.longitudeAt(jd, "meanNode", flags) + 180);
    const definition = BODY_BY_KEY.get(key);
    if (!definition?.swe) return 0;
    return normalizeDegree(this.swe.calc_ut(jd, this.swe[definition.swe], flags)[0]);
  }

  findReturnChart(natal, targetInput, options, bodyKey, period) {
    const natalBody = natal.bodies.find((body) => body.key === bodyKey);
    const definition = BODY_BY_KEY.get(bodyKey);
    if (!natalBody || !definition) return null;

    const target = this.calculateChart(targetInput, options, "returnTarget");
    const flags = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | (targetInput.zodiacMode === "sidereal-lahiri" ? this.swe.SEFLG_SIDEREAL : 0);
    const planetId = this.swe[definition.swe];
    let best = { jd: target.jdUt, diff: 999 };
    const step = bodyKey === "moon" ? 0.25 : 1;
    for (let jd = target.jdUt - period / 2; jd <= target.jdUt + period / 2; jd += step) {
      const longitude = normalizeDegree(this.swe.calc_ut(jd, planetId, flags)[0]);
      const diff = minAngle(longitude, natalBody.longitude);
      if (diff < best.diff) best = { jd, diff };
    }

    let low = best.jd - step;
    let high = best.jd + step;
    for (let index = 0; index < 28; index += 1) {
      const third = (high - low) / 3;
      const left = low + third;
      const right = high - third;
      const leftDiff = minAngle(normalizeDegree(this.swe.calc_ut(left, planetId, flags)[0]), natalBody.longitude);
      const rightDiff = minAngle(normalizeDegree(this.swe.calc_ut(right, planetId, flags)[0]), natalBody.longitude);
      if (leftDiff < rightDiff) high = right;
      else low = left;
    }
    const jd = (low + high) / 2;
    return this.calculateChartAtJulianDay(jd, targetInput, options, bodyKey === "sun" ? "solarReturn" : "lunarReturn");
  }

  jdForInput(input) {
    const utc = toUtcParts(input.birthDate, input.birthTime || "12:00", Number(input.timezone));
    return this.swe.julday(utc.year, utc.month, utc.day, utc.hour);
  }

  revjulToUtc(jdUt) {
    const value = this.swe.revjul(jdUt, this.swe.SE_GREG_CAL);
    const hour = Math.floor(value.hour);
    const minute = Math.floor((value.hour - hour) * 60);
    const second = Math.round((((value.hour - hour) * 60) - minute) * 60);
    const iso = new Date(Date.UTC(value.year, value.month - 1, value.day, hour, minute, second)).toISOString();
    return { ...value, iso };
  }
}

function buildAngle(name, key, value) {
  const longitude = normalizeDegree(value);
  return { name, key, longitude, ...zodiacPlacement(longitude) };
}

function calculateAspects(bodies, options) {
  const aspects = [];
  const angles = options.aspectAngles?.length ? options.aspectAngles : DEFAULT_ASPECT_ANGLES;
  const definitions = ASPECT_DEFINITIONS.filter((definition) => angles.includes(definition.angle));
  for (let first = 0; first < bodies.length - 1; first += 1) {
    for (let second = first + 1; second < bodies.length; second += 1) {
      const a = bodies[first];
      const b = bodies[second];
      const separation = minAngle(a.longitude, b.longitude);
      for (const aspectDefinition of definitions) {
        const orb = Math.abs(separation - aspectDefinition.angle);
        const allowedOrb = Math.min(Number(options.maxOrb ?? 6), aspectDefinition.defaultOrb ?? Number(options.maxOrb ?? 6));
        if (orb <= allowedOrb) {
          const futureSeparation = minAngle(a.longitude + a.speed * 0.01, b.longitude + b.speed * 0.01);
          const futureOrb = Math.abs(futureSeparation - aspectDefinition.angle);
          aspects.push(formatAspect(a, b, aspectDefinition, separation, orb, futureOrb < orb));
        }
      }
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb);
}

function calculateInterAspects(bodiesA, bodiesB, options, labelA, labelB) {
  const aspects = [];
  const angles = options.aspectAngles?.length ? options.aspectAngles : DEFAULT_ASPECT_ANGLES;
  const definitions = ASPECT_DEFINITIONS.filter((definition) => angles.includes(definition.angle));
  for (const a of bodiesA) {
    for (const b of bodiesB) {
      if (labelA === labelB && a.key === b.key) continue;
      const separation = minAngle(a.longitude, b.longitude);
      for (const aspectDefinition of definitions) {
        const orb = Math.abs(separation - aspectDefinition.angle);
        const allowedOrb = Math.min(Number(options.aspectOrb ?? 6), aspectDefinition.defaultOrb ?? Number(options.aspectOrb ?? 6));
        if (orb <= allowedOrb) {
          aspects.push({ ...formatAspect(a, b, aspectDefinition, separation, orb, false), labelA, labelB });
        }
      }
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb);
}

function formatAspect(a, b, aspectDefinition, separation, orb, applying) {
  return {
    planetA: a.name,
    planetB: b.name,
    keyA: a.key,
    keyB: b.key,
    aspect: aspectDefinition.name,
    aspectEn: aspectDefinition.en,
    angle: aspectDefinition.angle,
    separation,
    orb,
    orbText: formatDms(orb),
    applying,
    color: aspectDefinition.color,
  };
}

function findHouse(longitude, houses) {
  for (let index = 0; index < houses.length; index += 1) {
    const start = houses[index].longitude;
    const end = houses[(index + 1) % houses.length].longitude;
    if (degreeInArc(longitude, start, end)) return houses[index].number;
  }
  return 1;
}

function degreeInArc(value, start, end) {
  const degree = normalizeDegree(value);
  const normalizedStart = normalizeDegree(start);
  const normalizedEnd = normalizeDegree(end);
  if (normalizedStart < normalizedEnd) return degree >= normalizedStart && degree < normalizedEnd;
  return degree >= normalizedStart || degree < normalizedEnd;
}

function calculateStats(bodies) {
  const elements = { 火: 0, 土: 0, 风: 0, 水: 0 };
  const modes = { 基本: 0, 固定: 0, 变动: 0 };
  const houseEmphasis = { angular: 0, succedent: 0, cadent: 0 };
  bodies.filter((body) => ["major", "outer"].includes(body.category)).slice(0, 10).forEach((body) => {
    elements[ZODIAC_SIGNS[body.signIndex].element] += 1;
    modes[ZODIAC_SIGNS[body.signIndex].mode] += 1;
    if ([1, 4, 7, 10].includes(body.house)) houseEmphasis.angular += 1;
    if ([2, 5, 8, 11].includes(body.house)) houseEmphasis.succedent += 1;
    if ([3, 6, 9, 12].includes(body.house)) houseEmphasis.cadent += 1;
  });
  return { elements, modes, houseEmphasis };
}

function buildLongTermSegments(birthDate, startAge, endAge, segmentYears) {
  const rows = [];
  let index = 0;
  for (let age = startAge; age < endAge; age += segmentYears) {
    const segmentEnd = Math.min(age + segmentYears, endAge);
    rows.push({
      index,
      label: `${formatAge(age)}-${formatAge(segmentEnd)} 岁`,
      startAge: age,
      endAge: segmentEnd,
      startDate: dateAtAge(birthDate, age),
      endDate: dateAtAge(birthDate, segmentEnd),
    });
    index += 1;
  }
  return rows;
}

function inputAtAge(input, age) {
  return {
    ...input,
    profileName: `${input.profileName || "本命盘"} ${formatAge(age)}岁`,
    birthDate: dateAtAge(input.birthDate, age),
    birthTime: input.birthTime || "12:00",
  };
}

function dateAtAge(birthDate, age) {
  const wholeYears = Math.floor(age);
  const fractionalYear = age - wholeYears;
  const date = new Date(`${birthDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + wholeYears);
  if (fractionalYear) date.setUTCDate(date.getUTCDate() + Math.round(fractionalYear * TROPICAL_YEAR));
  return date.toISOString().slice(0, 10);
}

function segmentIndexForAge(age, segments) {
  const lastIndex = segments.length - 1;
  const index = segments.findIndex((segment, currentIndex) => (
    age >= segment.startAge && (age < segment.endAge || (currentIndex === lastIndex && age <= segment.endAge))
  ));
  return index;
}

function longTermTargets(natal) {
  return [
    ...natal.bodies.filter((body) => LONG_TERM_TARGET_KEYS.includes(body.key)),
    ...natal.angles.filter((angle) => LONG_TERM_ANGLE_KEYS.includes(angle.key)),
  ];
}

function longTermEvent({
  natal,
  segmentIndex,
  jd,
  technique,
  eventType,
  source,
  sourceKey,
  sourcePosition = "",
  aspect = "",
  aspectAngle = "",
  target = null,
  targetName = "",
  targetKey = "",
  targetPosition = "",
  natalHouse = "",
  orb = null,
  locationName = "",
  latitude = "",
  longitude = "",
  timezone = "",
}) {
  const exactTime = jdToIso(jd);
  const age = (jd - natal.jdUt) / TROPICAL_YEAR;
  return {
    segmentIndex,
    age: Number(age.toFixed(2)),
    year: new Date(exactTime).getUTCFullYear(),
    date: exactTime.slice(0, 10),
    exactTime,
    technique,
    eventType,
    source,
    sourceKey,
    sourcePosition,
    aspect,
    aspectAngle,
    target: target?.name || targetName,
    targetKey: target?.key || targetKey,
    targetPosition: target?.formatted || targetPosition,
    natalHouse: target?.house ?? natalHouse,
    targetLongitude: target?.longitude ?? "",
    orb: Number.isFinite(Number(orb)) ? Number(orb) : "",
    orbText: Number.isFinite(Number(orb)) ? formatDms(Number(orb)) : "",
    locationName,
    latitude,
    longitude,
    timezone,
  };
}

function inputForLongTermLocation(input, age, options) {
  const mode = options.longTermLocationMode || "birth";
  if (mode === "yearly") {
    const relocation = relocationForDate(input.birthDate, options.longTermRelocations || []);
    return relocation ? applyLocation(input, relocation) : input;
  }
  if (mode === "custom" || mode === "target") return applyLocation(input, options.longTermLocation);
  return input;
}

function relocationForDate(dateValue, relocations) {
  const eventTime = Date.parse(`${dateValue}T00:00:00Z`);
  return relocations
    .filter((item) => relocationTime(item) <= eventTime && isFiniteLocation(item))
    .sort((a, b) => relocationTime(b) - relocationTime(a))[0] || null;
}

function applyLocation(input, location) {
  if (!isFiniteLocation(location)) return input;
  return {
    ...input,
    locationName: location.locationName || input.locationName,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    timezone: Number(location.timezone),
  };
}

function isFiniteLocation(location) {
  return location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) && Number.isFinite(Number(location.timezone));
}

function relocationTime(location) {
  const date = location.effectiveDate || `${location.year}-01-01`;
  return Date.parse(`${date}T00:00:00Z`);
}

function sortLongTermEvents(events) {
  return events.sort((a, b) => a.exactTime.localeCompare(b.exactTime) || a.technique.localeCompare(b.technique));
}

function dedupeLongTermEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const monthKey = event.exactTime.slice(0, 7);
    const key = [event.segmentIndex, event.technique, event.eventType, event.sourceKey, event.aspectAngle, event.targetKey, monthKey].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatAge(age) {
  return Number.isInteger(age) ? String(age) : age.toFixed(1);
}

function buildPlanetaryHourRows(start, end, startIndex, phase) {
  const length = (end - start) / 12;
  return Array.from({ length: 12 }, (_, index) => {
    const ruler = PLANETARY_HOUR_ORDER[(startIndex + index) % 7];
    return {
      phase,
      number: index + 1,
      ruler: planetDisplayName(ruler),
      start: new Date(start + length * index).toISOString(),
      end: new Date(start + length * (index + 1)).toISOString(),
    };
  });
}

function planetDisplayName(key) {
  return BODY_BY_KEY.get(key)?.name || key;
}

function jdToMillis(jd) {
  return Math.round((jd - 2440587.5) * 86400000);
}

function jdToIso(jd) {
  return new Date(jdToMillis(jd)).toISOString();
}

function midpoint(a, b) {
  let diff = normalizeDegree(b - a);
  if (diff > 180) diff -= 360;
  return normalizeDegree(a + diff / 2);
}

function addDays(date, days) {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}

function dedupeTimeline(rows) {
  const kept = [];
  for (const row of rows) {
    const jdLike = Date.parse(row.exactTime);
    const exists = kept.some((item) => {
      if (`${item.keyA}:${item.keyB}:${item.angle}` !== `${row.keyA}:${row.keyB}:${row.angle}`) return false;
      return Math.abs(Date.parse(item.exactTime) - jdLike) < 36 * 3600000;
    });
    if (!exists) kept.push(row);
  }
  return kept;
}
