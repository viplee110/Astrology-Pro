import { ZODIAC_SIGNS } from "./constants.js";

export function normalizeDegree(value) {
  return ((value % 360) + 360) % 360;
}

export function minAngle(a, b) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
}

export function zodiacPlacement(longitude) {
  const normalized = normalizeDegree(longitude);
  const signIndex = Math.floor(normalized / 30);
  const degreeInSign = normalized - signIndex * 30;
  return {
    signIndex,
    sign: ZODIAC_SIGNS[signIndex],
    degreeInSign,
    formatted: `${ZODIAC_SIGNS[signIndex].zh} ${formatDms(degreeInSign)}`,
  };
}

export function formatDms(value) {
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

export function formatDecimal(value, digits = 4) {
  return Number(value).toFixed(digits);
}

export function toUtcParts(dateValue, timeValue, timezoneOffset) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - timezoneOffset * 60 * 60 * 1000;
  const utc = new Date(utcMillis);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    hour: utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600,
    iso: utc.toISOString(),
  };
}

export function filenameSafe(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "chart";
}
