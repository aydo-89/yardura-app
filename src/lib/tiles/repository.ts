import { createPrismaTileRepository } from "./prisma-repository";
import { createPostgisTileRepository } from "./postgis-repository";
import { getPostgisPool } from "@/lib/geo/postgis";
import type {
  CreateTileWithZipsInput,
  TileMetricRecord,
  TileWithContext,
} from "./types";

export interface TileQueryOptions {
  metricsLimit?: number;
}

export interface TileRepository {
  listTiles(orgId: string, options?: TileQueryOptions): Promise<TileWithContext[]>;
  getTileById(tileId: string, options?: TileQueryOptions): Promise<TileWithContext | null>;
  getTileBySlug(
    orgId: string,
    slug: string,
    options?: TileQueryOptions,
  ): Promise<TileWithContext | null>;
  listTileMetrics(tileId: string, limit?: number): Promise<TileMetricRecord[]>;
  findTileByZip(
    orgId: string,
    zip: string,
    options?: TileQueryOptions,
  ): Promise<TileWithContext | null>;
  createTileWithZips(input: CreateTileWithZipsInput): Promise<TileWithContext>;
}

let cachedRepository: TileRepository | null = null;

function normalizeBooleanFlag(value: string | undefined | null): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return undefined;
}

function shouldUsePostgis(): boolean {
  const explicit = normalizeBooleanFlag(process.env.ENABLE_POSTGIS_TILES);
  if (explicit !== undefined) {
    return explicit;
  }
  // Default to PostGIS so Studio, readiness, and admin APIs share the same dataset.
  return true;
}

function tryCreatePostgisRepository(): TileRepository | null {
  try {
    // Ensure the pool is initialised early so we surface configuration errors fast.
    getPostgisPool();
    return createPostgisTileRepository();
  } catch (error) {
    console.warn(
      "Failed to initialise PostGIS tile repository; falling back to Prisma tiles repository.",
      error,
    );
    return null;
  }
}

export function getTileRepository(): TileRepository {
  if (cachedRepository) return cachedRepository;

  if (shouldUsePostgis()) {
    const postgisRepo = tryCreatePostgisRepository();
    if (postgisRepo) {
      cachedRepository = postgisRepo;
      return cachedRepository;
    }
  }

  cachedRepository = createPrismaTileRepository();
  return cachedRepository;
}

export function resetTileRepository(): void {
  cachedRepository = null;
}
