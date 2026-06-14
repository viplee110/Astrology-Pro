const PLANET_MEANINGS = {
  sun: "核心意志、生命力、自我认同与想要成为的样子。",
  moon: "情绪反应、安全感、习惯模式与亲密中的真实需求。",
  mercury: "思维、表达、学习方式、信息处理与沟通节奏。",
  venus: "关系偏好、审美、愉悦感、金钱态度与吸引力模式。",
  mars: "行动力、欲望、竞争方式、边界感与处理冲突的方式。",
  jupiter: "成长、信念、机会、扩张方式与人生中的保护性资源。",
  saturn: "责任、限制、结构、长期课题与需要成熟面对的领域。",
  uranus: "独立、突变、创新、反常规冲动与需要自由的部分。",
  neptune: "想象、灵感、理想化、共情与容易模糊边界的领域。",
  pluto: "深层欲望、控制、危机、转化与需要诚实面对的力量。",
  chiron: "敏感伤口、修复能力，以及从脆弱处发展出的疗愈经验。",
  meanNode: "人生发展方向、关系牵引与需要学习的新经验。",
  trueNode: "人生发展方向、关系牵引与需要学习的新经验。",
  southNode: "熟悉的惯性、旧经验、天赋资源与容易停留的舒适区。",
  lilith: "被压抑的本能、边界议题、禁忌感与不愿被驯服的部分。",
};

const SIGN_MEANINGS = {
  白羊座: "直接、主动、快速启动，重视自主和即时行动。",
  金牛座: "稳定、务实、重感官与积累，追求安全和可持续。",
  双子座: "好奇、灵活、信息敏感，擅长连接、表达和切换视角。",
  巨蟹座: "保护、记忆、情感归属，重视家、安全感和照顾关系。",
  狮子座: "创造、自信、表达欲，渴望被看见并活出个人热度。",
  处女座: "分析、改进、服务意识，重视秩序、细节和可操作性。",
  天秤座: "关系、审美、公平协商，擅长平衡和看见他人立场。",
  天蝎座: "深度、洞察、强烈情感，关注信任、控制和转化。",
  射手座: "探索、信念、远方和意义感，追求更大的视野。",
  摩羯座: "目标、结构、责任和成就，重视长期建设。",
  水瓶座: "独立、群体、理念和革新，倾向跳出既定框架。",
  双鱼座: "共情、想象、融合和灵性，容易感受整体氛围。",
};

const HOUSE_MEANINGS = {
  1: "自我呈现、身体状态、人生入口和主动性。",
  2: "金钱、资源、安全感、自我价值与可持续积累。",
  3: "学习、表达、手足邻里、短途移动和日常信息。",
  4: "家庭、根基、内在安全感、居住环境和私人生活。",
  5: "创造、恋爱、子女、舞台感、游戏和个人表达。",
  6: "工作流程、健康习惯、服务、技能训练和日常秩序。",
  7: "伴侣、合作、公开关系、契约和一对一互动。",
  8: "亲密、共享资源、债务税务、危机和深层转化。",
  9: "高等学习、远行、出版、信念系统和人生意义。",
  10: "事业、名望、社会角色、目标和长期责任。",
  11: "朋友、社群、团队、愿景、人脉和未来计划。",
  12: "潜意识、隐秘压力、疗愈、退隐、精神世界和释放。",
};

const ASPECT_MEANINGS = {
  合: "两股能量合并放大，表现强烈，既可能成为天赋，也可能缺少距离感。",
  六合: "提供顺手的机会和协作空间，需要主动使用才会显现。",
  刑: "带来张力、摩擦和推动力，常要求学习新的处理方式。",
  拱: "能量流动自然，是容易发挥的资源，但也可能因为太顺而被忽略。",
  冲: "形成拉扯、投射和关系镜像，需要在两端之间建立平衡。",
  梅花: "提示不适配和调整成本，需要细致校准生活方式或心理姿态。",
  半六合: "轻微连接，像提示音，适合用来观察细小的互补关系。",
  半刑: "细微但持续的摩擦，容易表现为小压力或不耐烦。",
  补八分: "较尖锐的内在张力，常推动人寻找更成熟的出口。",
};

const ELEMENT_MEANINGS = {
  火: "行动、热情、直觉和启动能力。",
  土: "现实感、耐心、物质建设和稳定执行。",
  风: "思考、沟通、社交和概念连接。",
  水: "情绪、感受、共情和内在流动。",
};

const MODE_MEANINGS = {
  基本: "启动、开创和推动局面的能力。",
  固定: "稳定、坚持、维持和抗压能力。",
  变动: "适应、调整、学习和转换能力。",
};

const ANGLE_MEANINGS = {
  ASC: "上升是别人最先接触到的气质，也是你进入世界的方式。",
  MC: "天顶指向事业形象、社会角色与长期想被认可的方向。",
  DSC: "下降显示你在亲密关系与合作中容易被吸引的特质。",
  IC: "天底关乎内在根基、家庭感和最私密的安全需求。",
};

export function createQuickInterpretation(chart) {
  const coreKeys = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
  const corePlacements = coreKeys
    .map((key) => chart.bodies.find((body) => body.key === key))
    .filter(Boolean)
    .map((body) => placementInsight(body));
  const angles = ["ASC", "MC", "DSC", "IC"]
    .map((key) => chart.angles.find((angle) => angle.key === key))
    .filter(Boolean)
    .map((angle) => ({
      title: `${angle.name}：${angle.formatted}`,
      text: `${ANGLE_MEANINGS[angle.key] || "重要角点。"} ${signText(angle)}。`,
    }));
  const topAspects = chart.aspects
    .slice(0, 8)
    .map((aspect) => ({
      title: `${aspect.planetA} ${aspect.aspect} ${aspect.planetB}`,
      text: `${ASPECT_MEANINGS[aspect.aspect] || "这是一个需要结合双方星体性质理解的相位。"} 容许度 ${aspect.orbText}，${aspect.applying ? "入相，主题正在靠近或增强。" : "出相，主题更像已经形成的经验模式。"}`,
    }));

  return {
    overview: overviewInsights(chart),
    corePlacements,
    angles,
    topAspects,
    houseFocus: houseFocusInsights(chart),
    patternInsights: patternInsights(chart),
    disclaimer: "这些解释是入门提示，只说明结构倾向，不替代完整占星判断，也不应作为重大决策依据。",
  };
}

export function createPlacementInsight(body) {
  return placementInsight(body);
}

export function createAspectInsight(aspect) {
  return {
    title: `${aspect.planetA} ${aspect.aspect} ${aspect.planetB}`,
    text: `${ASPECT_MEANINGS[aspect.aspect] || "这是一个需要结合双方星体性质理解的相位。"} 容许度 ${aspect.orbText}，${aspect.applying ? "入相，主题正在靠近或增强。" : "出相，主题更像已经形成的经验模式。"}`,
  };
}

export function createAngleInsight(angle) {
  return {
    title: `${angle.name}：${angle.formatted}`,
    text: `${ANGLE_MEANINGS[angle.key] || "重要角点。"} ${signText(angle)}。`,
  };
}

export function houseMeaning(houseNumber) {
  return HOUSE_MEANINGS[Number(houseNumber)] || "";
}

export function quickInterpretationMarkdown(chart) {
  const guide = createQuickInterpretation(chart);
  const blocks = [
    "# 快速星象解释",
    "",
    "## 总览",
    ...guide.overview.map((item) => `- ${item}`),
    "",
    "## 核心落点",
    ...guide.corePlacements.map((item) => `- ${item.title}：${item.text}`),
    "",
    "## 四轴提示",
    ...guide.angles.map((item) => `- ${item.title}：${item.text}`),
    "",
    "## 重点相位",
    ...guide.topAspects.map((item) => `- ${item.title}：${item.text}`),
    "",
    "## 宫位与格局",
    ...(guide.houseFocus.length ? guide.houseFocus.map((item) => `- ${item}`) : ["- 当前没有明显的宫位集中。"]),
    ...(guide.patternInsights.length ? guide.patternInsights.map((item) => `- ${item}`) : ["- 当前没有检测到主要相位格局。"]),
    "",
    `> ${guide.disclaimer}`,
    "",
  ];
  return blocks.join("\n");
}

function placementInsight(body) {
  const planet = PLANET_MEANINGS[body.key] || `${body.name}代表这一类生命经验。`;
  return {
    title: `${body.name}在${body.sign.zh}第 ${body.house} 宫`,
    text: `${planet} ${SIGN_MEANINGS[body.sign.zh] || ""} 落在第 ${body.house} 宫，主题会集中到${HOUSE_MEANINGS[body.house] || "对应生活领域"} ${body.retrograde ? "逆行会让这个主题更偏向内在反思、反复修正或非线性发展。" : ""}`.trim(),
  };
}

function overviewInsights(chart) {
  const strongestElement = strongest(chart.stats.elements);
  const strongestMode = strongest(chart.stats.modes);
  const sun = chart.bodies.find((body) => body.key === "sun");
  const moon = chart.bodies.find((body) => body.key === "moon");
  const asc = chart.angles.find((angle) => angle.key === "ASC");
  const lines = [];
  if (sun && moon && asc) {
    lines.push(`核心三要素是太阳${sun.sign.zh}、月亮${moon.sign.zh}、上升${asc.sign.zh}：自我表达、情绪需求和外在呈现之间需要一起看。`);
  }
  if (strongestElement) {
    lines.push(`元素上${strongestElement.key}元素较突出，强调${stripEnd(ELEMENT_MEANINGS[strongestElement.key])}。这不是好坏判断，而是能量使用习惯。`);
  }
  if (strongestMode) {
    lines.push(`模式上${strongestMode.key}特质较强，说明盘主更常通过${stripEnd(MODE_MEANINGS[strongestMode.key])}来应对人生情境。`);
  }
  if (chart.stats.stelliums?.length) {
    lines.push(`检测到${chart.stats.stelliums.map((item) => `${item.place}${item.type}`).join("、")}，这些领域会比平均情况更集中、更有存在感。`);
  }
  return lines;
}

function houseFocusInsights(chart) {
  return chart.stats.stelliums
    ?.filter((item) => item.type === "宫位群星")
    .map((item) => {
      const house = Number(item.place.match(/\d+/)?.[0]);
      return `${item.place}集中：${HOUSE_MEANINGS[house] || "这个宫位的主题"} 相关经验会更容易成为人生重点。`;
    }) || [];
}

function patternInsights(chart) {
  return chart.stats.patterns?.slice(0, 6).map((pattern) => {
    const note = {
      "大三角": "资源流动顺畅，适合主动把天赋落地。",
      "T 三角": "张力集中，需要找到出口点和行动策略。",
      "大十字": "多方向压力并存，成熟后可形成强韧结构。",
      "风筝": "顺畅资源中带有明确目标，适合聚焦输出。",
      "神秘矩形": "对立关系中有可调和的结构，适合协商和整合。",
      "上帝手指": "需要细致调整，常有特殊化、非典型的发展路径。",
    }[pattern.type] || "这是一个需要结合参与星体进一步判断的格局。";
    return `${pattern.type}：${pattern.bodies.join("、")}。${note}`;
  }) || [];
}

function strongest(record) {
  const entries = Object.entries(record || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length || entries[0][1] <= 0) return null;
  return { key: entries[0][0], value: entries[0][1] };
}

function signText(point) {
  return `${point.sign.zh}带来${SIGN_MEANINGS[point.sign.zh] || "对应星座特质"}`;
}

function stripEnd(value) {
  return String(value || "").replace(/[。；;.\s]+$/u, "");
}
