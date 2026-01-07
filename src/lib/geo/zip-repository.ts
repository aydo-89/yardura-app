import type { PlaceSearchParams, PlaceSearchResult } from "./types";
import { createPostgisZipRepository } from "./postgis-zip-repository";
import { createLegacyZipRepository } from "./legacy-zip-repository";

export interface ZipRepository {
  searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult[]>;
}

let cachedRepository: ZipRepository | null = null;

function usePostgis(): boolean {
  return process.env.ENABLE_POSTGIS_GEO === "true";
}

export function getZipRepository(): ZipRepository {
  if (cachedRepository) return cachedRepository;
  cachedRepository = usePostgis()
    ? createPostgisZipRepository()
    : createLegacyZipRepository();
  return cachedRepository;
}

export function resetZipRepository(): void {
  cachedRepository = null;
}
