import type { PlaceSearchParams, PlaceSearchResult } from "./types";
import { searchPlacesWithZips } from "./queries";

function sanitizeParams(params: PlaceSearchParams): PlaceSearchParams {
  const limit = params.limit ?? undefined;
  return {
    query: params.query,
    state: params.state,
    limit,
    searchType: params.searchType,
  };
}

export function createPostgisZipRepository() {
  return {
    async searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
      const normalized = sanitizeParams(params);
      return searchPlacesWithZips(normalized);
    },
  };
}
