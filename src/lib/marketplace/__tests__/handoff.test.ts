import { describe, expect, it } from "vitest";

import { incrementHandoffMetadata } from "@/lib/marketplace/handoff";

function buildMetadata(count: number, windowStart: string) {
  return {
    handoff: {
      visit: {
        windowStart,
        count,
      },
    },
  };
}

describe("incrementHandoffMetadata", () => {
  it("initializes handoff metadata when absent", () => {
    const now = new Date("2025-03-01T12:00:00Z");

    const result = incrementHandoffMetadata(null, "visit", now, 3);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(1);
    expect(result.metadata).toMatchObject({
      handoff: {
        visit: {
          count: 1,
        },
      },
    });
  });

  it("blocks handoffs once the limit is reached within the quarter", () => {
    const now = new Date("2025-03-10T12:00:00Z");
    const metadata = buildMetadata(3, now.toISOString());

    const result = incrementHandoffMetadata(metadata as any, "visit", now, 3);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(3);
  });

  it("resets the counter when a new quarter begins", () => {
    const lastQuarter = new Date("2025-01-05T00:00:00Z").toISOString();
    const metadata = buildMetadata(3, lastQuarter);

    const now = new Date("2025-04-02T00:00:00Z");

    const result = incrementHandoffMetadata(metadata as any, "visit", now, 3);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(1);
  });
});
