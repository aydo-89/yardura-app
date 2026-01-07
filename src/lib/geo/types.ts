export interface GeoJSONFeature<TProps = Record<string, unknown>> {
  type: "Feature";
  geometry: any;
  properties?: TProps | null;
}

export type GeoJSONPolygonFeature<TProps = Record<string, unknown>> = GeoJSONFeature<TProps>;

export interface PlaceZipFeature {
  zip: string;
  state?: string;
  population?: number | null;
  areaSqMeters?: number | null;
  coverageRatio?: number | null;
  geometry: any;
}

export interface PlaceCoverageStats {
  zipCount: number;
  population: number | null;
  totalAreaSqMeters: number | null;
  coveredAreaSqMeters?: number | null;
  coverageRatio?: number | null;
  coveragePercent?: number | null;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  state: string;
  type?: string | null;
  population?: number | null;
  countyName?: string | null;
  geometry: any;
  bbox?: any;
  zips: PlaceZipFeature[];
  stats: PlaceCoverageStats;
}

export interface PlaceSearchParams {
  query: string;
  state?: string;
  limit?: number;
  searchType?: "city" | "county";
}
