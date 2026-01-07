import type { Feature } from "geojson";

export interface DraftTile {
  tileId: string;
  slug: string;
  name: string;
  status: string;
  zipCount: number;
  areaSqMeters: number;
  population: number | null;
  coveragePercent: number | null;
  zips: string[];
  geometry: Feature | null;
}

export interface DraftListPayload {
  orgId: string;
  tiles: DraftTile[];
}

export interface DraftResponse {
  ok: true;
  data: DraftListPayload;
}

export interface GeneratedTileSummary {
  tileId: string;
  slug: string;
  name: string;
}

export interface GenerationMetadata {
  placeId: string;
  placeName: string;
  placeState: string | null;
  placeAreaSqMeters: number;
  placeGeometry: Feature | null;
  tileCount: number;
  tiles: GeneratedTileSummary[];
}

export interface GenerateResponse {
  ok: true;
  data: {
    orgId: string;
    generation: GenerationMetadata;
    drafts: DraftTile[];
  };
}
