import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlacesWithZips } from "../queries";
import type { PlaceSearchResult } from "../types";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("../postgis", () => ({
  query: queryMock,
  describePostgisPool: vi.fn(() => "postgis://mock"),
}));

describe("searchPlacesWithZips", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns empty array when the query is blank", async () => {
    const result = await searchPlacesWithZips({ query: "   " });
    expect(result).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("maps PostGIS rows into typed place search results", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          place_id: "123",
          name: "Minneapolis",
          state: "MN",
          type: "City",
          population: 429954,
          geom_geojson: JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }),
          bbox_geojson: JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }),
          zips_json: JSON.stringify([
            {
              zip: "55401",
              state: "MN",
              population: 1000,
              areaSqMeters: 100,
              coverageRatio: 0.8,
              geometry: JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]] }),
            },
            {
              zip: "55403",
              state: "MN",
              population: 2000,
              areaSqMeters: 200,
              coverageRatio: 0.5,
              geometry: JSON.stringify({ type: "Polygon", coordinates: [[[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5], [0.5, 0]]] }),
            },
          ]),
          stats_json: JSON.stringify({
            zipCount: 2,
            population: 3000,
            totalAreaSqMeters: 5000,
            coveredAreaSqMeters: 4000,
          }),
          place_area_geo: 5500,
        },
      ],
    });

    const [result] = (await searchPlacesWithZips({ query: "Min", state: "mn", limit: 50 })) as PlaceSearchResult[];

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [, params] = queryMock.mock.calls[0];
    expect(params).toEqual(["Min%", "MN", 25]);

    expect(result.placeId).toBe("123");
    expect(result.name).toBe("Minneapolis");
    expect(result.state).toBe("MN");
    expect(result.population).toBe(429954);
    expect(result.geometry).toMatchObject({ type: "Polygon" });
    expect(result.bbox).toMatchObject({ type: "Polygon" });
    expect(result.zips).toHaveLength(2);
    expect(result.zips[0]).toMatchObject({ zip: "55401", coverageRatio: 0.8 });
    expect(result.stats).toMatchObject({
      zipCount: 2,
      population: 3000,
      totalAreaSqMeters: 5000,
      coveredAreaSqMeters: 4000,
      coveragePercent: 72.73,
    });
  });

  it("provides safe defaults when PostGIS returns null aggregates", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          place_id: "999",
          name: "Nowhere",
          state: "MN",
          type: null,
          population: null,
          geom_geojson: null,
          bbox_geojson: null,
          zips_json: null,
          stats_json: null,
          place_area_geo: null,
        },
      ],
    });

    const [result] = await searchPlacesWithZips({ query: "Now" });

    expect(result.zips).toEqual([]);
    expect(result.stats).toEqual({
      zipCount: 0,
      population: 0,
      totalAreaSqMeters: 0,
      coveredAreaSqMeters: 0,
      coverageRatio: null,
      coveragePercent: null,
    });
  });
});
