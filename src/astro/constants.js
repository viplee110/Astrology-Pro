export const ZODIAC_SIGNS = [
  { zh: "白羊座", en: "Aries", symbol: "♈", short: "Ar", element: "火", mode: "基本", ruler: "mars", exaltation: "sun" },
  { zh: "金牛座", en: "Taurus", symbol: "♉", short: "Ta", element: "土", mode: "固定", ruler: "venus", exaltation: "moon" },
  { zh: "双子座", en: "Gemini", symbol: "♊", short: "Ge", element: "风", mode: "变动", ruler: "mercury", exaltation: null },
  { zh: "巨蟹座", en: "Cancer", symbol: "♋", short: "Ca", element: "水", mode: "基本", ruler: "moon", exaltation: "jupiter" },
  { zh: "狮子座", en: "Leo", symbol: "♌", short: "Le", element: "火", mode: "固定", ruler: "sun", exaltation: null },
  { zh: "处女座", en: "Virgo", symbol: "♍", short: "Vi", element: "土", mode: "变动", ruler: "mercury", exaltation: "mercury" },
  { zh: "天秤座", en: "Libra", symbol: "♎", short: "Li", element: "风", mode: "基本", ruler: "venus", exaltation: "saturn" },
  { zh: "天蝎座", en: "Scorpio", symbol: "♏", short: "Sc", element: "水", mode: "固定", ruler: "mars", exaltation: null },
  { zh: "射手座", en: "Sagittarius", symbol: "♐", short: "Sg", element: "火", mode: "变动", ruler: "jupiter", exaltation: "southNode" },
  { zh: "摩羯座", en: "Capricorn", symbol: "♑", short: "Cp", element: "土", mode: "基本", ruler: "saturn", exaltation: "mars" },
  { zh: "水瓶座", en: "Aquarius", symbol: "♒", short: "Aq", element: "风", mode: "固定", ruler: "saturn", exaltation: "northNode" },
  { zh: "双鱼座", en: "Pisces", symbol: "♓", short: "Pi", element: "水", mode: "变动", ruler: "jupiter", exaltation: "venus" },
];

export const PLANET_DEFINITIONS = [
  { key: "sun", name: "太阳", en: "Sun", symbol: "☉", swe: "SE_SUN", category: "major", traditional: true },
  { key: "moon", name: "月亮", en: "Moon", symbol: "☽", swe: "SE_MOON", category: "major", traditional: true },
  { key: "mercury", name: "水星", en: "Mercury", symbol: "☿", swe: "SE_MERCURY", category: "major", traditional: true },
  { key: "venus", name: "金星", en: "Venus", symbol: "♀", swe: "SE_VENUS", category: "major", traditional: true },
  { key: "mars", name: "火星", en: "Mars", symbol: "♂", swe: "SE_MARS", category: "major", traditional: true },
  { key: "jupiter", name: "木星", en: "Jupiter", symbol: "♃", swe: "SE_JUPITER", category: "major", traditional: true },
  { key: "saturn", name: "土星", en: "Saturn", symbol: "♄", swe: "SE_SATURN", category: "major", traditional: true },
  { key: "uranus", name: "天王星", en: "Uranus", symbol: "♅", swe: "SE_URANUS", category: "outer" },
  { key: "neptune", name: "海王星", en: "Neptune", symbol: "♆", swe: "SE_NEPTUNE", category: "outer" },
  { key: "pluto", name: "冥王星", en: "Pluto", symbol: "♇", swe: "SE_PLUTO", category: "outer" },
  { key: "chiron", name: "凯龙星", en: "Chiron", symbol: "⚷", swe: "SE_CHIRON", category: "asteroid" },
  { key: "ceres", name: "谷神星", en: "Ceres", symbol: "⚳", swe: "SE_CERES", category: "asteroid" },
  { key: "pallas", name: "智神星", en: "Pallas", symbol: "⚴", swe: "SE_PALLAS", category: "asteroid" },
  { key: "juno", name: "婚神星", en: "Juno", symbol: "⚵", swe: "SE_JUNO", category: "asteroid" },
  { key: "vesta", name: "灶神星", en: "Vesta", symbol: "⚶", swe: "SE_VESTA", category: "asteroid" },
  { key: "meanNode", name: "北交点(平均)", en: "Mean Node", symbol: "☊", swe: "SE_MEAN_NODE", category: "point" },
  { key: "trueNode", name: "北交点(真实)", en: "True Node", symbol: "☊", swe: "SE_TRUE_NODE", category: "point" },
  { key: "southNode", name: "南交点", en: "South Node", symbol: "☋", swe: null, category: "point", derivedFrom: "meanNode", offset: 180 },
  { key: "lilith", name: "莉莉丝(平均)", en: "Mean Lilith", symbol: "⚸", swe: "SE_MEAN_APOG", category: "point" },
];

export const DEFAULT_BODY_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
  "meanNode",
  "lilith",
];

export const VIRTUAL_POINT_DEFINITIONS = [
  { key: "ASC", name: "上升", symbol: "ASC", category: "angle", default: true },
  { key: "MC", name: "天顶", symbol: "MC", category: "angle", default: true },
  { key: "DSC", name: "下降", symbol: "DSC", category: "angle", default: true },
  { key: "IC", name: "天底", symbol: "IC", category: "angle", default: true },
  { key: "Vertex", name: "宿命点", symbol: "Vx", category: "angle", default: true },
  { key: "AntiVertex", name: "反宿命点", symbol: "AVx", category: "angle", default: false },
  { key: "fortune", name: "福点", symbol: "⊗", category: "lot", default: true },
  { key: "spirit", name: "精神点", symbol: "Spirit", category: "lot", default: false },
  { key: "eros", name: "爱神点", symbol: "Eros", category: "lot", default: false },
  { key: "necessity", name: "必然点", symbol: "Nec.", category: "lot", default: false },
  { key: "courage", name: "勇气点", symbol: "Courage", category: "lot", default: false },
  { key: "victory", name: "胜利点", symbol: "Victory", category: "lot", default: false },
  { key: "nemesis", name: "报应点", symbol: "Nem.", category: "lot", default: false },
];

export const DEFAULT_POINT_KEYS = VIRTUAL_POINT_DEFINITIONS.filter((point) => point.default).map((point) => point.key);

export const ASPECT_DEFINITIONS = [
  { name: "合", en: "Conjunction", angle: 0, defaultOrb: 8, color: "#8a5a44" },
  { name: "半六合", en: "Semi-sextile", angle: 30, defaultOrb: 2, color: "#7a8070" },
  { name: "半刑", en: "Semi-square", angle: 45, defaultOrb: 2, color: "#a56a5f" },
  { name: "六合", en: "Sextile", angle: 60, defaultOrb: 4, color: "#4c6b5a" },
  { name: "刑", en: "Square", angle: 90, defaultOrb: 6, color: "#a44545" },
  { name: "拱", en: "Trine", angle: 120, defaultOrb: 6, color: "#2f6f8f" },
  { name: "补八分", en: "Sesquiquadrate", angle: 135, defaultOrb: 2, color: "#a56a5f" },
  { name: "梅花", en: "Quincunx", angle: 150, defaultOrb: 3, color: "#8363a1" },
  { name: "冲", en: "Opposition", angle: 180, defaultOrb: 8, color: "#a44545" },
];

export const DEFAULT_ASPECT_ANGLES = [0, 60, 90, 120, 150, 180];

export const HOUSE_SYSTEMS = {
  P: "Placidus",
  K: "Koch",
  W: "Whole Sign",
  E: "Equal",
  R: "Regiomontanus",
  C: "Campanus",
  O: "Porphyry",
  T: "Topocentric",
  B: "Alcabitius",
  M: "Morinus",
};

export const FIXED_STARS = [
  "Aldebaran",
  "Regulus",
  "Spica",
  "Sirius",
  "Antares",
  "Fomalhaut",
  "Algol",
  "Vega",
  "Betelgeuse",
  "Rigel",
  "Procyon",
  "Altair",
];

export const PLANETARY_HOUR_ORDER = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"];
export const WEEKDAY_RULERS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];
