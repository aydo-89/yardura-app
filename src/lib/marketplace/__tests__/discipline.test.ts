import { describe, expect, it } from "vitest";

import {
  incrementStrikeMetadata,
  peekStrikeCount,
} from "@/lib/marketplace/discipline";

function buildMetadata(count: number, windowStart: string) {
  return {
    discipline: {
      strikes: {
        windowStart,
        count,
      },
    },
  };
}

describe("incrementStrikeMetadata", () => {
  it("initializes strike metadata when absent", () => {
    const now = new Date("2025-03-01T12:00:00Z");

    const result = incrementStrikeMetadata(null, now, { limit: 3, reason: "visit_handoff" });

    expect(result.currentCount).toBe(1);
    expect(result.metadata).toMatchObject({
      discipline: {
        strikes: {
          count: 1,
        },
      },
    });
  });

  it("caps the strike count at the limit", () => {
    const now = new Date("2025-03-10T12:00:00Z");
    const metadata = buildMetadata(3, now.toISOString());

    const result = incrementStrikeMetadata(metadata as any, now, { limit: 3, reason: "skip" });

    expect(result.currentCount).toBe(3);
    expect(result.reachedLimit).toBe(true);
  });

  it("resets the counter when a new quarter begins", () => {
    const lastQuarter = new Date("2025-01-05T00:00:00Z").toISOString();
    const metadata = buildMetadata(3, lastQuarter);
    const now = new Date("2025-04-02T00:00:00Z");

    const result = incrementStrikeMetadata(metadata as any, now, { limit: 3 });

    expect(result.currentCount).toBe(1);
  });
});

describe("peekStrikeCount", () => {
  it("returns zero when the strike window has rolled over", () => {
    const lastQuarter = new Date("2025-04-01T00:00:00Z").toISOString();
    const metadata = buildMetadata(2, lastQuarter);
    const now = new Date("2025-07-02T00:00:00Z");

    const result = peekStrikeCount(metadata as any, now);

    expect(result.count).toBe(0);
  });
});
