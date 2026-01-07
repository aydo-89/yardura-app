import { Frequency } from "@prisma/client";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  getZonedWeekday,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";

const DAYS_PER_WEEK = 7;

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function startOfDay(date: Date): Date {
  const parts = convertUtcToZonedParts(date, SERVICE_TIME_ZONE);
  return constructZonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0, SERVICE_TIME_ZONE);
}

export function addDays(date: Date, days: number): Date {
  const zoned = cloneDate(date);
  zoned.setUTCDate(zoned.getUTCDate() + days);
  return zoned;
}

function addMonths(date: Date, months: number): Date {
  const zoned = cloneDate(date);
  zoned.setUTCMonth(zoned.getUTCMonth() + months);
  return zoned;
}

function addFrequencyInterval(date: Date, frequency: Frequency): Date {
  switch (frequency) {
    case "ONE_TIME":
      return addDays(date, 365 * 100);
    case "WEEKLY":
      return addDays(date, DAYS_PER_WEEK);
    case "BI_WEEKLY":
      return addDays(date, DAYS_PER_WEEK * 2);
    case "TWICE_WEEKLY":
      return addDays(date, Math.floor(DAYS_PER_WEEK / 2));
    case "DAILY":
      return addDays(date, 1);
    case "MONTHLY":
      return addMonths(date, 1);
    default:
      return addDays(date, DAYS_PER_WEEK);
  }
}

function alignToDayOfWeek(date: Date, dayOfWeek?: number | null): Date {
  if (typeof dayOfWeek !== "number" || Number.isNaN(dayOfWeek)) {
    return date;
  }

  const normalized = ((dayOfWeek % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const currentWeekday = getZonedWeekday(date, SERVICE_TIME_ZONE);
  const delta = (normalized - currentWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return delta === 0 ? date : addDays(date, delta);
}

export function resolveNextScheduledDate(options: {
  frequency: Frequency;
  dayOfWeek?: number | null;
  currentNextVisitAt?: Date | null;
  referenceDate?: Date;
}): Date {
  const { frequency, dayOfWeek, referenceDate } = options;
  let candidate = options.currentNextVisitAt
    ? startOfDay(options.currentNextVisitAt)
    : startOfDay(referenceDate ?? new Date());

  const reference = startOfDay(referenceDate ?? new Date());

  if (frequency === Frequency.TWICE_WEEKLY) {
    if (!options.currentNextVisitAt) {
      candidate = alignToDayOfWeek(candidate, dayOfWeek);
    }
    while (candidate < reference) {
      candidate = resolveSubsequentVisitDate(candidate, frequency, dayOfWeek);
    }
    return candidate;
  }

  if (frequency !== Frequency.MONTHLY && frequency !== Frequency.DAILY) {
    candidate = alignToDayOfWeek(candidate, dayOfWeek);
  }

  while (candidate < reference) {
    candidate = addFrequencyInterval(candidate, frequency);
    if (frequency !== Frequency.MONTHLY && frequency !== Frequency.DAILY) {
      candidate = alignToDayOfWeek(candidate, dayOfWeek);
    }
  }

  return candidate;
}

export function resolveSubsequentVisitDate(
  previousDate: Date,
  frequency: Frequency,
  dayOfWeek?: number | null,
): Date {
  const normalizedPrevious = startOfDay(previousDate);

  if (frequency === Frequency.TWICE_WEEKLY) {
    const normalizedDayOfWeek =
      typeof dayOfWeek === "number" ? ((dayOfWeek % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK : null;
    const previousWeekday = getZonedWeekday(normalizedPrevious, SERVICE_TIME_ZONE);
    if (normalizedDayOfWeek !== null && previousWeekday === normalizedDayOfWeek) {
      return addDays(normalizedPrevious, 3);
    }
    const aligned = alignToDayOfWeek(addDays(normalizedPrevious, 1), dayOfWeek);
    return aligned;
  }

  if (frequency === Frequency.DAILY) {
    return addDays(normalizedPrevious, 1);
  }

  if (frequency === Frequency.MONTHLY) {
    return addMonths(normalizedPrevious, 1);
  }

  const next = addFrequencyInterval(normalizedPrevious, frequency);
  return alignToDayOfWeek(next, dayOfWeek);
}
