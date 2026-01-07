export const SERVICE_TIME_ZONE = "America/Chicago" as const;

export function isValidTimeZone(value?: string | null): value is string {
  if (!value || typeof value !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

type NumericDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }
  return formatterCache.get(timeZone)!;
}

function extractParts(date: Date, timeZone: string): NumericDateTimeParts {
  const formatter = getDateTimeFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number.parseInt(value, 10) : 0;
  };

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
    second: lookup("second"),
  };
}

export function getTimeZoneOffset(date: Date, timeZone: string = SERVICE_TIME_ZONE): number {
  const parts = extractParts(date, timeZone);
  const utcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (utcEquivalent - date.getTime()) / 60000;
}

export function constructZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0,
  timeZone: string = SERVICE_TIME_ZONE,
): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offsetMinutes = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offsetMinutes * 60_000);
}

export function constructZonedDateFromParts(
  parts: NumericDateTimeParts,
  timeZone: string = SERVICE_TIME_ZONE,
): Date {
  return constructZonedDate(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
    timeZone,
  );
}

export function convertUtcToZonedParts(
  date: Date,
  timeZone: string = SERVICE_TIME_ZONE,
): NumericDateTimeParts {
  return extractParts(date, timeZone);
}

export function getZonedWeekday(date: Date, timeZone: string = SERVICE_TIME_ZONE): number {
  const parts = convertUtcToZonedParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function formatZonedDate(
  date: Date,
  pattern: Intl.DateTimeFormatOptions,
  timeZone: string = SERVICE_TIME_ZONE,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...pattern,
    timeZone,
  });
  return formatter.format(date);
}
