import { formatDecimal, formatDms } from "../astro/format.js";
import { quickInterpretationMarkdown } from "../astro/interpretations.js";

export function createMarkdown(workbook, mode = "full", customTemplate = "") {
  const chart = workbook.natal || workbook;
  if (mode === "custom" && customTemplate.trim()) return renderCustomTemplate(customTemplate, workbook);

  const sections = {
    natal: natalSection(chart),
    guide: quickInterpretationMarkdown(chart),
    tables: tablesSection(chart),
    rulers: rulersSection(chart),
    stats: statsSection(chart),
    classical: classicalSection(chart),
    predictive: workbook.predictive ? predictiveSection(workbook.predictive) : "",
    longTerm: workbook.longTerm ? longTermSection(workbook.longTerm) : "",
    relationship: workbook.relationship ? relationshipSection(workbook.relationship) : "",
  };

  const selected = mode === "natal" ? ["natal", "guide", "tables", "rulers", "stats"]
    : mode === "guide" ? ["natal", "guide"]
      : mode === "predictive" ? ["natal", "predictive", "longTerm"]
      : mode === "relationship" ? ["natal", "relationship"]
        : mode === "classical" ? ["natal", "classical"]
          : mode === "longTerm" ? ["natal", "longTerm"]
            : ["natal", "guide", "tables", "rulers", "stats", "classical", "predictive", "longTerm", "relationship"];

  return `${selected.map((key) => sections[key]).filter(Boolean).join("\n\n")}\n`;
}

export function createAiPrompt(workbook, mode = "natal") {
  const dataMode = mode === "predictive" ? "predictive"
    : mode === "relationship" ? "relationship"
      : mode === "classical" ? "classical"
        : "natal";
  const chart = workbook.natal || workbook;
  const profileName = chart.input?.profileName || "未命名星盘";
  const task = {
    natal: "请做一份本命盘解读",
    predictive: "请做一份行运与长期结构解读",
    relationship: "请做一份合盘关系分析",
    classical: "请做一份偏古典占星口径的结构分析",
  }[dataMode];
  const focus = {
    natal: [
      "先总结人格核心、情绪需求与行动模式。",
      "重点分析太阳、月亮、上升、命主星、宫位集中、主要相位与显著格局。",
      "最后给出事业、关系、成长建议。",
    ],
    predictive: [
      "先区分短期行运、次限、太阳弧、返照和长期结构。",
      "按重要性列出未来主题、时间窗口、机会与压力。",
      "最后给出可执行的观察重点和行动建议。",
    ],
    relationship: [
      "先分别概括两人的关系需求与互动风格。",
      "重点分析比较盘相位、组合盘/时空中点盘主题与潜在冲突。",
      "最后给出沟通、边界与长期相处建议。",
    ],
    classical: [
      "优先使用庙旺弱陷、昼夜、宫主飞宫、接纳、互容、福点等结构。",
      "请区分本质力量、偶然力量和相位触发。",
      "最后给出清晰的强弱判断与现实层面的建议。",
    ],
  }[dataMode];

  return [
    `你是一名严谨的占星分析助手。${task}。`,
    "",
    "要求：",
    "1. 只能依据下面的星盘资料分析，不要编造资料里没有的星体位置、宫位或相位。",
    "2. 先给结论摘要，再分主题展开，最后给可执行建议。",
    "3. 遇到不确定或资料不足时，请明确说明不确定性。",
    "4. 保持语言清晰、具体、尊重当事人，不做恐吓式断言。",
    ...focus.map((item, index) => `${index + 5}. ${item}`),
    "",
    `星盘对象：${profileName}`,
    "",
    "以下是结构化星盘资料：",
    "",
    createMarkdown(workbook, dataMode).trim(),
    "",
  ].join("\n");
}

export function createPlainText(workbook, mode = "full") {
  return createMarkdown(workbook, mode)
    .replace(/^#+\s*/gm, "")
    .replace(/\|/g, "\t")
    .replace(/---:?/g, "");
}

export function createCsv(workbook) {
  const chart = workbook.natal || workbook;
  const lines = [["section", "item", "value1", "value2", "value3", "value4", "value5", "value6", "value7", "value8"].join(",")];
  chart.bodies.forEach((body) => {
    lines.push(csv(["planet", body.name, body.formatted, `house ${body.house}`, formatDms(body.longitude), numberText(body.latitude, 6), numberText(body.distance, 6), numberText(body.speed, 6), body.dignitySummary || "", body.retrograde ? "R" : "D"]));
  });
  chart.houses.forEach((house) => lines.push(csv(["house", house.number, house.formatted, formatDms(house.longitude), "", "", "", ""])));
  chart.virtualPoints?.forEach((point) => {
    lines.push(csv(["virtualPoint", point.name, point.category, point.formatted, `house ${point.house}`, formatDms(point.longitude), point.formula || "", "", ""]));
  });
  chart.lots?.forEach((lot) => {
    lines.push(csv(["lot", lot.name, lot.formatted, `house ${lot.house}`, formatDms(lot.longitude), lot.formula || "", lot.source || "", ""]));
  });
  chart.aspects.forEach((aspect) => lines.push(csv(["aspect", aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText, aspect.applying ? "applying" : "separating", "", ""])));
  chart.pointAspects?.forEach((aspect) => lines.push(csv(["pointAspect", aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText, "", "", ""])));
  chart.keyRulers?.rows?.forEach((row) => lines.push(csv(["keyRuler", row.item, row.sign, row.ruler, row.placement, `house ${row.house}`, row.status, row.note, ""])));
  chart.houseRulers?.forEach((row) => {
    lines.push(csv(["houseRuler", `house ${row.house}`, row.cusp, row.traditionalRuler, row.traditionalPlacement, `house ${row.traditionalHouse}`, row.flightText, row.modernRulerText, row.modernFlightText]));
  });
  chart.houseRulerAspects?.forEach((aspect) => {
    lines.push(csv(["houseRulerAspect", `house ${aspect.house}`, aspect.rulerType, aspect.ruler, aspect.aspect, aspect.target, aspect.orbText, aspect.rulerPlacement, aspect.targetPlacement]));
  });
  chart.dispositorChains?.traditional?.forEach((row) => lines.push(csv(["dispositor", row.mode, row.body, row.placement, row.firstDispositor, row.chain, row.terminal || row.loop, row.status, ""])));
  chart.dispositorChains?.modern?.forEach((row) => lines.push(csv(["dispositor", row.mode, row.body, row.placement, row.firstDispositor, row.chain, row.terminal || row.loop, row.status, ""])));
  workbook.predictive?.transitAspects?.forEach((aspect) => lines.push(csv(["transit", aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText, "", "", ""])));
  workbook.longTerm?.events?.forEach((event) => lines.push(csv(["longTerm", event.exactTime, event.technique, event.eventType, event.locationName || "", event.source, event.aspect, event.target, event.sourcePosition, event.targetPosition, event.orbText])));
  workbook.relationship?.synastry?.forEach((aspect) => lines.push(csv(["synastry", aspect.planetA, aspect.aspect, aspect.planetB, aspect.orbText, "", "", ""])));
  return `${lines.join("\n")}\n`;
}

function natalSection(chart) {
  const core = getCore(chart);
  return [
    `# ${chart.input.profileName || "未命名星盘"}`,
    "",
    "## 出生资料",
    "",
    `- 档案名：${chart.input.profileName || ""}`,
    `- 标签：${chart.input.tags || ""}`,
    `- 出生时间：${chart.input.birthDate} ${chart.input.birthTime} UTC${formatTimezone(chart.input.timezone)}`,
    `- 出生地：${chart.input.locationName || ""}`,
    `- 坐标精度：${chart.input.coordinatePrecision || "未标注"}`,
    `- 经纬度：${formatDecimal(chart.input.latitude, 4)}, ${formatDecimal(chart.input.longitude, 4)}`,
    `- UTC 时间：${chart.utc.iso}`,
    `- 儒略日：${formatDecimal(chart.jdUt, 6)}`,
    "",
    "## 计算设置",
    "",
    `- 引擎：${chart.engine.name} ${chart.engine.version}`,
    `- 黄道：${chart.settings.zodiacModeName}`,
    `- 宫位制：${chart.settings.houseSystemName}`,
    `- 相位容许度：${chart.settings.aspectOrb}°`,
    `- 相位类型：${chart.settings.aspectAngles.join("° / ")}°`,
    `- 生成时间：${chart.engine.generatedAt}`,
    "",
    "## 核心三要素",
    "",
    `- 太阳：${core.sun?.formatted ?? ""}，第 ${core.sun?.house ?? ""} 宫`,
    `- 月亮：${core.moon?.formatted ?? ""}，第 ${core.moon?.house ?? ""} 宫`,
    `- 上升：${core.asc?.formatted ?? ""}`,
    chart.input.notes?.trim() ? `\n## 备注\n\n${chart.input.notes.trim()}` : "",
  ].filter(Boolean).join("\n");
}

function tablesSection(chart) {
  const pointRows = chart.virtualPoints?.length ? chart.virtualPoints : chart.angles;
  const pointAspectRows = chart.pointAspects || [];
  return [
    "## 行星落点",
    "",
    "| 星体 | 星座度数 | 宫位 | 黄经 | 纬度 | 距离(AU) | 速度 | 庙旺弱陷 | 状态 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...chart.bodies.map((body) => `| ${body.name} | ${body.formatted} | ${body.house} | ${formatDms(body.longitude)} | ${numberText(body.latitude, 5)} | ${numberText(body.distance, 6)} | ${numberText(body.speed, 5)} | ${body.dignitySummary || ""} | ${body.retrograde ? "逆行" : "顺行"} |`),
    "",
    "## 四轴 / 虚点",
    "",
    "| 点 | 类型 | 星座度数 | 宫位 | 黄经 | 公式 |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...pointRows.map((point) => `| ${point.name} (${point.key}) | ${point.category || "四轴/角点"} | ${point.formatted} | ${point.house || ""} | ${formatDms(point.longitude)} | ${point.formula || ""} |`),
    "",
    pointAspectRows.length ? "## 虚点相位" : "",
    pointAspectRows.length ? "" : "",
    pointAspectRows.length ? "| 星体 | 相位 | 虚点 | 容许度 |" : "",
    pointAspectRows.length ? "| --- | --- | --- | ---: |" : "",
    ...pointAspectRows.map((aspect) => `| ${aspect.planetA} | ${aspect.aspect} | ${aspect.planetB} | ${aspect.orbText} |`),
    "",
    "## 宫头",
    "",
    "| 宫位 | 星座度数 | 黄经 |",
    "| ---: | --- | ---: |",
    ...chart.houses.map((house) => `| ${house.number} | ${house.formatted} | ${formatDms(house.longitude)} |`),
    "",
    "## 主要相位",
    "",
    "| 星体 A | 相位 | 星体 B | 容许度 | 入出相 |",
    "| --- | --- | --- | ---: | --- |",
    ...chart.aspects.map((aspect) => `| ${aspect.planetA} | ${aspect.aspect} | ${aspect.planetB} | ${aspect.orbText} | ${aspect.applying ? "入相" : "出相"} |`),
  ].join("\n");
}

function statsSection(chart) {
  return [
    "## 统计与格局",
    "",
    `- 元素：火 ${chart.stats.elements.火} / 土 ${chart.stats.elements.土} / 风 ${chart.stats.elements.风} / 水 ${chart.stats.elements.水}`,
    `- 模式：基本 ${chart.stats.modes.基本} / 固定 ${chart.stats.modes.固定} / 变动 ${chart.stats.modes.变动}`,
    `- 宫位：角宫 ${chart.stats.houseEmphasis.angular} / 续宫 ${chart.stats.houseEmphasis.succedent} / 果宫 ${chart.stats.houseEmphasis.cadent}`,
    "",
    "### 群星",
    chart.stats.stelliums.length ? chart.stats.stelliums.map((item) => `- ${item.type}：${item.place}（${item.bodies.join("、")}）`).join("\n") : "- 未检测到 3 星以上群星",
    "",
    "### 相位格局",
    chart.stats.patterns.length ? chart.stats.patterns.map(patternMarkdown).join("\n") : "- 未检测到主要相位格局",
    "",
    "### 阿拉伯点",
    ...chart.lots.map((lot) => `- ${lot.name}：${lot.formatted}，第 ${lot.house} 宫（${lot.formula}${lot.source ? `；${lot.source}` : ""}）`),
    "",
    "### 中点",
    "| 点 A | 点 B | 中点 |",
    "| --- | --- | --- |",
    ...chart.midpoints.slice(0, 45).map((midpoint) => `| ${midpoint.pointA} | ${midpoint.pointB} | ${midpoint.formatted} |`),
    "",
    "### 中点触发",
    chart.midpointContacts.length ? "| 中点 | 相位 | 触发点 | 容许度 |" : "- 未检测到 1° 内的主要中点触发",
    chart.midpointContacts.length ? "| --- | --- | --- | ---: |" : "",
    ...chart.midpointContacts.slice(0, 45).map((item) => `| ${item.midpoint} | ${item.aspect} | ${item.target} | ${item.orbText} |`),
  ].join("\n");
}

function rulersSection(chart) {
  const chains = [
    ...(chart.dispositorChains?.traditional || []),
    ...(chart.dispositorChains?.modern || []),
  ];
  return [
    "## 飞星与定位星",
    "",
    "### 关键主星",
    "| 项目 | 星座 | 主星 | 主星位置 | 飞入宫位 | 状态 | 结构备注 |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...(chart.keyRulers?.rows || []).map((row) => `| ${row.item} | ${row.sign} | ${row.ruler} | ${row.placement} | ${row.house || ""} | ${row.status || ""} | ${row.note || ""} |`),
    "",
    `- 终定位星：${(chart.keyRulers?.finalDispositors || []).join("、") || "无单一终定位星"}`,
    `- 互容/闭环：${(chart.keyRulers?.mutualLoops || []).join("；") || "未检测到"}`,
    "",
    "### 宫主飞宫",
    "| 宫位 | 宫头 | 传统宫主 | 传统飞宫 | 现代宫主 | 现代飞宫 | 状态 |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
    ...(chart.houseRulers || []).map((row) => `| ${row.house} | ${row.cusp} | ${row.traditionalRuler} | ${row.flightText} | ${modernRulerDetail(row)} | ${row.modernFlightText} | ${row.traditionalStatus || ""} |`),
    "",
    "### 宫主星相位",
    chart.houseRulerAspects?.length ? "| 宫位 | 口径 | 宫主星 | 宫主位置 | 相位 | 目标 | 目标位置 | 容许度 |" : "- 未检测到宫主星与当前显示点位的相位",
    chart.houseRulerAspects?.length ? "| ---: | --- | --- | --- | --- | --- | --- | ---: |" : "",
    ...(chart.houseRulerAspects || []).slice(0, 180).map((row) => `| ${row.house} | ${row.rulerType} | ${row.ruler} | ${row.rulerPlacement} / ${row.rulerHouse || ""}宫 | ${row.aspect} | ${row.target} | ${row.targetPlacement}${row.targetHouse ? ` / ${row.targetHouse}宫` : ""} | ${row.orbText} |`),
    "",
    "### 定位星链",
    "| 口径 | 星体 | 位置 | 第一定位星 | 链条 | 终点/闭环 | 状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...chains.map((row) => `| ${row.mode} | ${row.body} | ${row.placement} / ${row.house || ""}宫 | ${row.firstDispositor} | ${row.chain} | ${row.terminal || row.loop} | ${row.status} |`),
  ].join("\n");
}

function patternMarkdown(item) {
  const evidence = item.evidence?.length
    ? `；证据：${item.evidence.map((edge) => `${edge.pointA} ${edge.aspect} ${edge.pointB}（${edge.orbText}）`).join("；")}`
    : "";
  return `- ${item.type}：${item.bodies.join("、")}${evidence}`;
}

function classicalSection(chart) {
  return [
    "## 古典占星",
    "",
    `- 昼夜：${chart.classical.sect}`,
    `- 互容：${chart.classical.mutualReceptions.length ? chart.classical.mutualReceptions.join("；") : "未检测到主要互容"}`,
    `- 接纳：${chart.classical.receptions.length ? chart.classical.receptions.join("；") : "未检测到主要接纳"}`,
    "",
    "| 星体 | 本质状态 | 界主 | 面主 | 得时/失时 | 太阳状态 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...chart.classical.rows.map((row) => `| ${row.planet} | ${row.dignity} | ${row.boundLord} | ${row.faceLord} | ${row.sect} | ${row.solarCondition || ""} |`),
    "",
    "### 现代庙旺弱陷",
    "",
    "| 星体 | 星座度数 | 状态 | 依据 |",
    "| --- | --- | --- | --- |",
    ...chart.modernDignities.map((row) => `| ${row.planet} | ${row.placement} | ${row.status} | ${row.note} |`),
    "",
    "## 恒星",
    "",
    "| 恒星 | 位置 | 星等 |",
    "| --- | --- | ---: |",
    ...chart.fixedStars.map((star) => `| ${star.name} | ${star.formatted} | ${star.magnitude?.toFixed?.(2) ?? ""} |`),
    "",
    "### 恒星合相",
    chart.fixedStarContacts.length ? "| 恒星 | 合相点 | 恒星位置 | 触发点位置 | 容许度 |" : "- 未检测到 1° 内的恒星合相",
    chart.fixedStarContacts.length ? "| --- | --- | --- | --- | ---: |" : "",
    ...chart.fixedStarContacts.map((item) => `| ${item.star} | ${item.target} | ${item.starPosition} | ${item.targetPosition} | ${item.orbText} |`),
  ].join("\n");
}

function predictiveSection(predictive) {
  return [
    "## 预测盘",
    "",
    "### 行运相位",
    "| 行运星 | 相位 | 本命星 | 容许度 |",
    "| --- | --- | --- | ---: |",
    ...predictive.transitAspects.slice(0, 80).map((aspect) => `| ${aspect.planetA} | ${aspect.aspect} | ${aspect.planetB} | ${aspect.orbText} |`),
    "",
    "### 次限盘",
    `- 次限太阳：${predictive.progressed.bodies.find((body) => body.key === "sun")?.formatted ?? ""}`,
    `- 次限月亮：${predictive.progressed.bodies.find((body) => body.key === "moon")?.formatted ?? ""}`,
    "",
    "### 太阳弧",
    `- 太阳弧太阳：${predictive.solarArc.bodies.find((body) => body.key === "sun")?.formatted ?? ""}`,
    "",
    "| 太阳弧点 | 相位 | 本命点 | 容许度 |",
    "| --- | --- | --- | ---: |",
    ...predictive.solarArcDirections.slice(0, 80).map((aspect) => `| ${aspect.planetA} | ${aspect.aspect} | ${aspect.planetB} | ${aspect.orbText} |`),
    "",
    "### 返照",
    `- 太阳返照 UTC：${predictive.solarReturn?.utc?.iso ?? ""}`,
    `- 月亮返照 UTC：${predictive.lunarReturn?.utc?.iso ?? ""}`,
    "",
    "### 行星时",
    `- 算法：${predictive.planetaryHours.method || "近似日出日落算法"}`,
    `- 日出：${predictive.planetaryHours.sunrise ? new Date(predictive.planetaryHours.sunrise).toISOString() : ""}`,
    `- 日落：${predictive.planetaryHours.sunset ? new Date(predictive.planetaryHours.sunset).toISOString() : ""}`,
    `- 当日主星：${predictive.planetaryHours.dayRuler}`,
    "",
    "### 重要相位时间线",
    "| 精确时间 UTC | 行运星 | 相位 | 本命星 | 容许度 |",
    "| --- | --- | --- | --- | ---: |",
    ...predictive.timeline.slice(0, 80).map((item) => `| ${item.exactTime || item.date} | ${item.planetA} | ${item.aspect} | ${item.planetB} | ${item.orbText} |`),
  ].join("\n");
}

function longTermSection(longTerm) {
  const lines = [
    "## 长期结构元数据",
    "",
    `- 年龄范围：${longTerm.settings.startAge}-${longTerm.settings.endAge} 岁`,
    `- 分段年数：${longTerm.settings.segmentYears}`,
    `- 容许度：${longTerm.settings.orb}°`,
    `- 地点模式：${locationModeText(longTerm.settings.locationMode)}`,
    longTerm.settings.relocations?.length ? `- 迁居计划：${longTerm.settings.relocations.map((item) => `${item.effectiveDate || item.year} ${item.locationName || ""}`).join("；")}` : "",
    "",
    "### 十年段索引",
    "| 年龄段 | 开始日期 | 结束日期 | 元数据节点 |",
    "| --- | --- | --- | ---: |",
    ...longTerm.segments.map((segment) => `| ${segment.label} | ${segment.startDate} | ${segment.endDate} | ${segment.eventCount} |`),
  ];
  for (const segment of longTerm.segments) {
    const events = longTerm.events.filter((event) => event.segmentIndex === segment.index);
    lines.push(
      "",
      `### ${segment.label}`,
      "| 年龄 | 精确时间 UTC | 技术 | 类型 | 地点 | 星体/点 | 相位 | 本命点/目标 | 星体位置 | 目标位置 | 宫位 | 容许度 |",
      "| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |",
      ...(events.length
        ? events.map((event) => `| ${event.age} | ${event.exactTime} | ${event.technique} | ${event.eventType} | ${event.locationName || ""} | ${event.source} | ${event.aspect || ""} | ${event.target || ""} | ${event.sourcePosition || ""} | ${event.targetPosition || ""} | ${event.natalHouse || ""} | ${event.orbText || ""} |`)
        : ["|  |  |  | 无筛选节点 |  |  |  |  |  |  |  |  |"]),
    );
  }
  return lines.join("\n");
}

function relationshipSection(relationship) {
  return [
    "## 关系盘",
    "",
    `- A：${relationship.personA.input.profileName || "A"}`,
    `- B：${relationship.personB.input.profileName || "B"}`,
    "",
    "### 比较盘相位",
    "| A 星体 | 相位 | B 星体 | 容许度 |",
    "| --- | --- | --- | ---: |",
    ...relationship.synastry.slice(0, 100).map((aspect) => `| ${aspect.planetA} | ${aspect.aspect} | ${aspect.planetB} | ${aspect.orbText} |`),
    "",
    "### 组合中点盘核心",
    `- 太阳：${relationship.composite.bodies.find((body) => body.key === "sun")?.formatted ?? ""}`,
    `- 月亮：${relationship.composite.bodies.find((body) => body.key === "moon")?.formatted ?? ""}`,
    "",
    "| 星体 | 星座度数 | 宫位 | 黄经 |",
    "| --- | --- | ---: | ---: |",
    ...relationship.composite.bodies.slice(0, 12).map((body) => `| ${body.name} | ${body.formatted} | ${body.house} | ${formatDms(body.longitude)} |`),
    "",
    "### 时空中点盘核心",
    `- 太阳：${relationship.davison.bodies.find((body) => body.key === "sun")?.formatted ?? ""}`,
    `- 月亮：${relationship.davison.bodies.find((body) => body.key === "moon")?.formatted ?? ""}`,
    "",
    "| 星体 | 星座度数 | 宫位 | 黄经 |",
    "| --- | --- | ---: | ---: |",
    ...relationship.davison.bodies.slice(0, 12).map((body) => `| ${body.name} | ${body.formatted} | ${body.house} | ${formatDms(body.longitude)} |`),
  ].join("\n");
}

function modernRulerDetail(row) {
  return (row.modernRulers || [])
    .map((item) => `${item.name}${item.placement ? ` ${item.placement} / ${item.house}宫` : ""}`)
    .join("；");
}

function renderCustomTemplate(template, workbook) {
  const chart = workbook.natal || workbook;
  const core = getCore(chart);
  const point = (key) => chart.virtualPoints?.find((item) => item.key === key)?.formatted || chart.angles?.find((item) => item.key === key)?.formatted || "";
  return template
    .replaceAll("{{name}}", chart.input.profileName || "")
    .replaceAll("{{birth}}", `${chart.input.birthDate} ${chart.input.birthTime}`)
    .replaceAll("{{place}}", chart.input.locationName || "")
    .replaceAll("{{sun}}", core.sun?.formatted || "")
    .replaceAll("{{moon}}", core.moon?.formatted || "")
    .replaceAll("{{asc}}", core.asc?.formatted || "")
    .replaceAll("{{mc}}", point("MC"))
    .replaceAll("{{ic}}", point("IC"))
    .replaceAll("{{vertex}}", point("Vertex"))
    .replaceAll("{{fortune}}", point("fortune"))
    .replaceAll("{{aspects}}", chart.aspects.map((aspect) => `${aspect.planetA}${aspect.aspect}${aspect.planetB} ${aspect.orbText}`).join("；"));
}

function getCore(chart) {
  return {
    sun: chart.bodies.find((body) => body.key === "sun"),
    moon: chart.bodies.find((body) => body.key === "moon"),
    asc: chart.angles.find((angle) => angle.key === "ASC"),
  };
}

function formatTimezone(offset) {
  const sign = offset >= 0 ? "+" : "";
  return `${sign}${offset}`;
}

function locationModeText(mode) {
  return {
    birth: "使用出生地",
    target: "使用预测地点",
    custom: "使用长期结构地点",
    yearly: "按迁居计划",
  }[mode] || mode || "";
}

function csv(values) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

function numberText(value, digits) {
  return Number.isFinite(Number(value)) ? formatDecimal(value, digits) : "";
}
