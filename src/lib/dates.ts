// Началото на деня и седмицата по българско време, независимо къде работи сървърът.
const TIME_ZONE = "Europe/Sofia";

function sofiaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

// Разликата между софийско време и UTC в милисекунди за даден момент.
function sofiaOffset(date: Date): number {
  const p = sofiaParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function sofiaMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - sofiaOffset(guess));
}

export function startOfDay(now = new Date()): Date {
  const p = sofiaParts(now);
  return sofiaMidnight(p.year, p.month, p.day);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Седмицата започва в понеделник.
export function startOfWeek(now = new Date()): Date {
  const p = sofiaParts(now);
  const daysSinceMonday = WEEKDAYS.indexOf(p.weekday);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - daysSinceMonday));
  return sofiaMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}
