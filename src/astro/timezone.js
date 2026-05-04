export function offsetForLocalTime(timeZone, dateValue, timeValue) {
  if (!timeZone || !dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) return null;

  const localWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcGuess = localWallTime;

  for (let index = 0; index < 4; index += 1) {
    const offsetMinutes = offsetMinutesAtUtc(timeZone, new Date(utcGuess));
    utcGuess = localWallTime - offsetMinutes * 60 * 1000;
  }

  return offsetMinutesAtUtc(timeZone, new Date(utcGuess)) / 60;
}

function offsetMinutesAtUtc(timeZone, date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const timeZoneName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = timeZoneName.match(/^GMT(?:(?<sign>[+-])(?<hour>\d{1,2})(?::(?<minute>\d{2}))?)?$/);
  if (!match) {
    throw new Error(`无法解析时区偏移：${timeZoneName}`);
  }

  const sign = match.groups.sign === "-" ? -1 : 1;
  const hour = Number(match.groups.hour || 0);
  const minute = Number(match.groups.minute || 0);
  return sign * (hour * 60 + minute);
}
