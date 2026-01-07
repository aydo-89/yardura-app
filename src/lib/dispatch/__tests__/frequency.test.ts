import { describe, expect, it } from "vitest";
import { Frequency } from "@prisma/client";

import { resolveNextScheduledDate } from "@/lib/dispatch/frequency";
import { constructZonedDate, convertUtcToZonedParts, SERVICE_TIME_ZONE } from "@/lib/timezone";

const toYmd = (date: Date) => {
  const parts = convertUtcToZonedParts(date, SERVICE_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

describe("resolveNextScheduledDate", () => {
  it("preserves twice-weekly cadence after the primary day", () => {
    const monday = constructZonedDate(2025, 4, 7, 9, 0, 0, 0);
    const reference = constructZonedDate(2025, 4, 8, 9, 0, 0, 0);

    const result = resolveNextScheduledDate({
      frequency: Frequency.TWICE_WEEKLY,
      dayOfWeek: 1,
      currentNextVisitAt: monday,
      referenceDate: reference,
    });

    expect(toYmd(result)).toBe("2025-4-10");
  });

  it("returns the next primary day after the midweek visit", () => {
    const thursday = constructZonedDate(2025, 4, 10, 9, 0, 0, 0);
    const reference = constructZonedDate(2025, 4, 11, 9, 0, 0, 0);

    const result = resolveNextScheduledDate({
      frequency: Frequency.TWICE_WEEKLY,
      dayOfWeek: 1,
      currentNextVisitAt: thursday,
      referenceDate: reference,
    });

    expect(toYmd(result)).toBe("2025-4-14");
  });
});
