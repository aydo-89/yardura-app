import type { DraftTile, GenerateResponse } from "@/lib/tiles/studio-types";
import type { Feature } from "geojson";

type ApiError = {
  ok?: false;
  error?: string;
  message?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  return body;
}

export interface DraftTilesResponse {
  tiles: DraftTile[];
  total: number;
  page: number;
  limit: number;
}

export async function deleteServiceTile(slug: string): Promise<void> {
  const response = await fetch(`/api/admin/service-tiles/${slug}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const body = await readJson<{ error?: string; message?: string }>(response).catch(() => ({}));
    const message = ('error' in body && body.error) || ('message' in body && body.message) || "Failed to delete service tile";
    throw new Error(message);
  }
}

export async function fetchDraftTiles(options?: {
  page?: number;
  limit?: number;
}): Promise<DraftTilesResponse> {
  const params = new URLSearchParams();
  if (options?.page) {
    params.set("page", String(options.page));
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const response = await fetch(`/api/admin/tiles/drafts${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  const body = await readJson<
    { ok: boolean; data?: { tiles?: DraftTile[]; total?: number; page?: number; limit?: number } } &
      ApiError
  >(response);

  if (!response.ok || body.ok === false) {
    const message = body.error || body.message || "Failed to load draft tiles";
    throw new Error(message);
  }

  return {
    tiles: body.data?.tiles ?? [],
    total: body.data?.total ?? body.data?.tiles?.length ?? 0,
    page: body.data?.page ?? options?.page ?? 1,
    limit:
      (body.data?.limit ?? options?.limit ?? body.data?.tiles?.length ?? 0) || 25,
  };
}

export interface GenerateDraftTilesParams {
  placeId: string;
  city?: string;
  state?: string;
  tileCount: number;
  generationMode?: "cluster" | "perZip";
}

export interface JobStatusResponse {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  tilesGenerated?: number;
  error?: string;
  result?: any;
  createdAt: number;
  completedAt?: number;
}

const TILE_PUBLISH_POLL_INTERVAL_MS = 2000;
const TILE_PUBLISH_MAX_ATTEMPTS = 60;

export interface PublishedTileSummary {
  tileId: string;
  slug: string;
  name: string;
  status: string;
  zipCount: number;
  areaSqMeters: number | null;
  population: number | null;
  coveragePercent: number | null;
  zips: string[];
  geometry: Feature | null;
}

interface TilePublishStatusPayload {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: {
    jobId: string;
    status: "pending" | "processing" | "completed" | "failed";
    error?: string | null;
    result?: {
      summary?: any;
      [key: string]: any;
    } | null;
  };
}

interface OfferPublishStatusPayload {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: {
    jobId: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number | null;
    result?: any;
    error?: string | null;
    createdAt: number;
    processedAt?: number | null;
    completedAt?: number | null;
  };
}

function mapServiceAreaSummaryToTile(
  summary: any,
): PublishedTileSummary | null {
  if (!summary || typeof summary !== "object" || !summary.tile) {
    return null;
  }

  const tile = summary.tile as Record<string, any>;
  const zipEntries = Array.isArray(summary.zips) ? summary.zips : [];

  const geometry = (summary.tileGeometry ?? null) as Feature | null;

  return {
    tileId: String(tile.id ?? ""),
    slug: String(tile.slug ?? ""),
    name: String(tile.name ?? ""),
    status: String(tile.status ?? ""),
    zipCount: Number(summary.zipCount ?? zipEntries.length ?? 0) || 0,
    areaSqMeters:
      typeof summary.tileAreaSqMeters === "number"
        ? summary.tileAreaSqMeters
        : Number(summary.tileAreaSqMeters ?? NaN) || null,
    population:
      typeof summary.totalPopulation === "number"
        ? summary.totalPopulation
        : Number(summary.totalPopulation ?? NaN) || null,
    coveragePercent:
      typeof summary.coveragePercent === "number"
        ? summary.coveragePercent
        : Number(summary.coveragePercent ?? NaN) || null,
    zips: zipEntries
      .map((entry: any): string | null => {
        const zipValue = entry?.zip;
        return typeof zipValue === "string" ? zipValue : null;
      })
      .filter(
        (zipValue: string | null): zipValue is string =>
          typeof zipValue === "string" && zipValue.length > 0,
      ),
    geometry,
  };
}

function mapTileSummaryRow(tile: any): PublishedTileSummary | null {
  if (!tile || typeof tile !== "object") {
    return null;
  }

  return {
    tileId: String(tile.tileId ?? tile.tile_id ?? ""),
    slug: String(tile.slug ?? ""),
    name: String(tile.name ?? ""),
    status: String(tile.status ?? ""),
    zipCount: Number(tile.zipCount ?? tile.zip_count ?? 0) || 0,
    areaSqMeters:
      typeof tile.areaSqMeters === "number"
        ? tile.areaSqMeters
        : Number(tile.areaSqMeters ?? tile.area_sq_m ?? NaN) || null,
    population:
      typeof tile.population === "number"
        ? tile.population
        : Number(tile.population ?? NaN) || null,
    coveragePercent:
      typeof tile.coveragePercent === "number"
        ? tile.coveragePercent
        : Number(tile.coveragePercent ?? NaN) || null,
    zips: Array.isArray(tile.zips) ? tile.zips.map((zip: any) => String(zip)) : [],
    geometry: (tile.geometry ?? null) as Feature | null,
  };
}

async function pollTilePublishJob(jobId: string): Promise<PublishedTileSummary | null> {
  for (let attempt = 0; attempt < TILE_PUBLISH_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, TILE_PUBLISH_POLL_INTERVAL_MS));

    const response = await fetch(
      `/api/admin/service-tiles/publish/status?jobId=${encodeURIComponent(jobId)}`,
      {
        credentials: "include",
      },
    );

    const payload = (await response.json().catch(() => ({}))) as TilePublishStatusPayload;

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || payload.message || "Failed to check publish status");
    }

    const status = payload.data;
    if (!status) {
      throw new Error("Invalid publish job status response");
    }

    if (status.status === "completed") {
      const summary = status.result?.summary ?? null;
      return mapServiceAreaSummaryToTile(summary);
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Tile publish job failed");
    }
  }

  throw new Error("Tile publish job timed out. Please try again.");
}

/**
 * Poll for job status until completion
 */
async function pollJobStatus(
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
): Promise<GenerateResponse> {
  const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
  const pollInterval = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const response = await fetch(`/api/admin/tiles/generate/status?jobId=${jobId}`, {
      credentials: "include",
    });

    const body = await readJson<{ ok: boolean; data?: JobStatusResponse } & ApiError>(response);

    if (!response.ok || body.ok === false) {
      throw new Error(body.error || body.message || "Failed to check job status");
    }

    const jobStatus = body.data!;
    
    // Call progress callback if provided
    if (onProgress) {
      onProgress(jobStatus);
    }

    if (jobStatus.status === "completed") {
      // Job completed successfully, return the result
      return {
        ok: true,
        data: jobStatus.result,
      };
    }

    if (jobStatus.status === "failed") {
      throw new Error(jobStatus.error || "Tile generation failed");
    }

    // Continue polling if status is "pending" or "processing"
  }

  throw new Error("Tile generation timed out after 2 minutes");
}

export async function generateDraftTiles(
  params: GenerateDraftTilesParams,
  options?: {
    onProgress?: (status: JobStatusResponse) => void;
  },
): Promise<GenerateResponse> {
  const { placeId, city, state, tileCount, generationMode = "cluster" } = params;
  
  const response = await fetch("/api/admin/tiles/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ placeId, city, state, tileCount, generationMode }),
  });

  const body = await readJson<GenerateResponse | ApiError>(response);

  if (!response.ok || ("ok" in body && !body.ok)) {
    const message = (body as ApiError).error || (body as ApiError).message || "Tile generation failed";
    throw new Error(message);
  }

  const responseData = body as GenerateResponse;

  // Check if this was queued (async) or completed synchronously
  if (responseData.ok && responseData.data && "jobId" in responseData.data && "status" in responseData.data) {
    // Job was queued, poll for completion
    const jobId = (responseData.data as any).jobId;
    console.log(`[TileGen] Job ${jobId} queued, polling for completion...`);
    return await pollJobStatus(jobId, options?.onProgress);
  }

  // Synchronous completion (fallback when queue is not available)
  return responseData;
}

export async function deleteDraftTile(tileId: string): Promise<void> {
  const response = await fetch(`/api/admin/tiles/${tileId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const body = await readJson<{ ok?: boolean } & ApiError>(response);

  if (!response.ok || body.ok === false) {
    const message = body.error || body.message || "Failed to delete tile";
    throw new Error(message);
  }
}

export async function renameServiceTile(
  tileId: string,
  name: string,
): Promise<{ tile?: any } | null> {
  const response = await fetch(`/api/admin/tiles/${tileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });

  const body = await readJson<{ ok?: boolean; data?: { tile?: any } } & ApiError>(response);

  if (!response.ok || body.ok === false) {
    const message = body.error || body.message || "Failed to rename tile";
    throw new Error(message);
  }

  return body.data ?? null;
}

export async function publishDraftTile(
  tileId: string,
  status: string,
): Promise<PublishedTileSummary | null> {
  const response = await fetch(`/api/admin/tiles/${tileId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });

  const body = await readJson<
    { ok?: boolean; data?: { jobId?: string; tile?: any } } & ApiError
  >(response);

  if (!response.ok || body.ok === false) {
    const message = body.error || body.message || "Failed to publish tile";
    throw new Error(message);
  }

  const data = body.data ?? {};

  if (typeof data.jobId === "string" && data.jobId.trim().length > 0) {
    return await pollTilePublishJob(data.jobId);
  }

  if (data.tile) {
    return mapTileSummaryRow(data.tile);
  }

  return null;
}

const OFFER_PUBLISH_POLL_INTERVAL_MS = 2000;
const OFFER_PUBLISH_MAX_ATTEMPTS = 60;

export interface OfferPublishJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number | null;
  result?: any;
  error?: string | null;
  createdAt: number;
  processedAt?: number | null;
  completedAt?: number | null;
}

export interface OfferPublishResult {
  queued: boolean;
  jobId?: string;
  jobStatus?: OfferPublishJobStatus | null;
  created?: number;
  offers?: any[];
}

async function pollOfferPublishJob(jobId: string): Promise<OfferPublishJobStatus | null> {
  for (let attempt = 0; attempt < OFFER_PUBLISH_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, OFFER_PUBLISH_POLL_INTERVAL_MS));

    const response = await fetch(
      `/api/admin/service-tiles/publish/offers/status?jobId=${encodeURIComponent(jobId)}`,
      {
        credentials: "include",
      },
    );

    const payload = (await response.json().catch(() => ({}))) as OfferPublishStatusPayload;

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || payload.message || "Failed to check offer publish status");
    }

    const status = payload.data;
    if (!status) {
      throw new Error("Invalid offer publish job status response");
    }

    if (status.status === "completed") {
      return {
        jobId: status.jobId,
        status: status.status,
        progress: status.progress ?? null,
        result: status.result ?? null,
        error: status.error ?? null,
        createdAt: status.createdAt,
        processedAt: status.processedAt ?? null,
        completedAt: status.completedAt ?? null,
      } satisfies OfferPublishJobStatus;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Offer publish job failed");
    }
  }

  throw new Error("Offer publish job timed out. Please try again.");
}

export async function publishServiceTileOffers(
  slug: string,
  options?: { lookaheadDays?: number; limit?: number },
): Promise<OfferPublishResult> {
  const body: Record<string, unknown> = {};
  if (typeof options?.lookaheadDays === "number") {
    body.lookaheadDays = options.lookaheadDays;
  }
  if (typeof options?.limit === "number") {
    body.limit = options.limit;
  }

  const response = await fetch(`/api/admin/service-tiles/${slug}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | { ok?: boolean; data?: { jobId?: string; status?: string } }
    | { ok?: boolean; created?: number; offers?: any[]; queued?: boolean }
    | OfferPublishStatusPayload;

  if (!response.ok || ("ok" in payload && payload.ok === false)) {
    const err = (payload as any)?.error || (payload as any)?.message || "Failed to publish offers";
    throw new Error(err);
  }

  const queuedData = (payload as any)?.data;
  if (queuedData && typeof queuedData.jobId === "string") {
    const status = await pollOfferPublishJob(queuedData.jobId);
    return {
      queued: true,
      jobId: queuedData.jobId,
      jobStatus: status,
    } satisfies OfferPublishResult;
  }

  return {
    queued: false,
    created: (payload as any)?.created ?? null,
    offers: (payload as any)?.offers ?? [],
  } satisfies OfferPublishResult;
}
