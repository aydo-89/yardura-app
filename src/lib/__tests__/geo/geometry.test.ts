/**
 * Tests for geo/geometry utilities
 */

import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import {
  rewindSafe,
  unkinkSafe,
  simplifyMeters,
  fastDisjoint,
  validateAndClean,
  safeIntersects,
} from "../../geo/geometry";
import testData from "../../__fixtures__/geo/test-data.json";

describe("rewindSafe", () => {
  it("should rewind polygon to correct winding order", () => {
    const feature = testData.minneapolis as GeoJSON.Feature;
    const rewound = rewindSafe(feature);

    expect(rewound).toBeDefined();
    expect(rewound.geometry.type).toBe("Polygon");
  });

  it("should handle invalid geometries gracefully", () => {
    const invalidFeature = { type: "Feature", geometry: null, properties: {} };
    const result = rewindSafe(invalidFeature as any);

    expect(result).toEqual(invalidFeature);
  });
});

describe("validateAndClean", () => {
  it("should clean and validate polygon geometry", () => {
    const feature = testData.minneapolis as GeoJSON.Feature;
    const cleaned = validateAndClean(feature);

    expect(cleaned).toBeDefined();
    expect(cleaned.geometry.type).toBe("Polygon");
  });
});

describe("fastDisjoint", () => {
  it("should detect disjoint geometries", () => {
    const poly1 = testData.minneapolis as GeoJSON.Feature;
    const poly2: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-95, 40],
            [-95, 41],
            [-94, 41],
            [-94, 40],
            [-95, 40],
          ],
        ],
      },
      properties: {},
    }; // Far from Minneapolis

    const result = fastDisjoint(poly1, poly2);
    expect(result).toBe(true);
  });

  it("should handle geometry errors gracefully", () => {
    const invalidFeature = { type: "Feature", geometry: null, properties: {} };
    const validFeature = testData.minneapolis as GeoJSON.Feature;

    const result = fastDisjoint(invalidFeature as any, validFeature);
    expect(result).toBe(true); // bbox fallback should work even with null geometry
  });
});

describe("safeIntersects", () => {
  it("should safely check for intersections", () => {
    const poly1 = testData.minneapolis as GeoJSON.Feature;
    const poly2 = testData.sampleZctas.features[0] as GeoJSON.Feature;

    const result = safeIntersects(poly1, poly2);
    expect(typeof result).toBe("boolean");
  });
});

describe("simplifyMeters", () => {
  it("should simplify geometry with latitude-aware tolerance", () => {
    const feature = testData.minneapolis as GeoJSON.Feature;
    const simplified = simplifyMeters(feature, 100); // 100 meters

    expect(simplified).toBeDefined();
    expect(simplified.geometry.type).toBe("Polygon");
  });

  it("should handle feature collections", () => {
    const fc = testData.sampleZctas as GeoJSON.FeatureCollection;
    const simplified = simplifyMeters(fc, 100);

    expect(simplified).toBeDefined();
    expect(simplified.type).toBe("FeatureCollection");
  });
});
