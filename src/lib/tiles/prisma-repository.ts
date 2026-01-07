import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

import type { TileMetricRecord, TileRecord, TileTerritorySummary, TileWithContext } from "./types";
import type { TileQueryOptions, TileRepository } from "./repository";

const DEFAULT_METRIC_LIMIT = 12;

type PrismaTileWithRelations = Prisma.ServiceTileGetPayload<{
  include: {
    tileMetrics: true;
    territory: true;
  };
}>;

function resolveMetricsLimit(options?: TileQueryOptions): number {
  const limit = options?.metricsLimit ?? DEFAULT_METRIC_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_METRIC_LIMIT;
  return Math.min(Math.floor(limit), 52);
}

function mapTileRecord(tile: PrismaTileWithRelations): TileRecord {
  return {
    id: tile.id,
    orgId: tile.orgId,
    slug: tile.slug,
    name: tile.name,
    status: tile.status,
    minCertifiedScoopers: tile.minCertifiedScoopers,
    minCustomerUnits: tile.minCustomerUnits,
    coverageRadiusMeters: tile.coverageRadiusMeters ?? null,
    goLiveDate: tile.goLiveDate ?? null,
    notes: tile.notes ?? null,
    territoryId: tile.territoryId ?? null,
    geometryGeoJSON: null,
  };
}

function mapTerritory(territory: PrismaTileWithRelations["territory"]): TileTerritorySummary | null {
  if (!territory) return null;
  return {
    id: territory.id,
    name: territory.name ?? null,
  };
}

function mapMetrics(
  metrics: PrismaTileWithRelations["tileMetrics"],
  limit: number,
): TileMetricRecord[] {
  return metrics
    .slice(0, limit)
    .map((metric) => ({
      id: metric.id,
      tileId: metric.tileId,
      weekOf: metric.weekOf,
      activeScoopers: metric.activeScoopers,
      scheduledStops: metric.scheduledStops,
      completedStops: metric.completedStops,
    }));
}

function mapTileWithContext(
  tile: PrismaTileWithRelations,
  limit: number,
): TileWithContext {
  return {
    tile: mapTileRecord(tile),
    metrics: mapMetrics(tile.tileMetrics, limit),
    territory: mapTerritory(tile.territory),
  };
}

export function createPrismaTileRepository(): TileRepository {
  return {
    async listTiles(orgId, options) {
      const metricsLimit = resolveMetricsLimit(options);
      const tiles = await prisma.serviceTile.findMany({
        where: { orgId },
        include: {
          tileMetrics: {
            orderBy: { weekOf: "desc" },
            take: metricsLimit,
          },
          territory: true,
        },
        orderBy: { name: "asc" },
      });
      return tiles.map((tile) => mapTileWithContext(tile, metricsLimit));
    },

    async getTileById(tileId, options) {
      const metricsLimit = resolveMetricsLimit(options);
      const tile = await prisma.serviceTile.findUnique({
        where: { id: tileId },
        include: {
          tileMetrics: {
            orderBy: { weekOf: "desc" },
            take: metricsLimit,
          },
          territory: true,
        },
      });
      return tile ? mapTileWithContext(tile, metricsLimit) : null;
    },

    async getTileBySlug(orgId, slug, options) {
      const metricsLimit = resolveMetricsLimit(options);
      const tile = await prisma.serviceTile.findFirst({
        where: { orgId, slug },
        include: {
          tileMetrics: {
            orderBy: { weekOf: "desc" },
            take: metricsLimit,
          },
          territory: true,
        },
      });
      return tile ? mapTileWithContext(tile, metricsLimit) : null;
    },

    async listTileMetrics(tileId, limit) {
      const metricsLimit = resolveMetricsLimit({ metricsLimit: limit });
      const metrics = await prisma.tileMetricSnapshot.findMany({
        where: { tileId },
        orderBy: { weekOf: "desc" },
        take: metricsLimit,
      });
      return mapMetrics(metrics as any, metricsLimit);
    },

    async findTileByZip(_orgId, _zip, _options) {
      return null;
    },

    async createTileWithZips() {
      throw new Error("createTileWithZips is not supported by the Prisma tile repository");
    },
  } satisfies TileRepository;
}
