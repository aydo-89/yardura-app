"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { toast } from "sonner";
import type { StyleSpecification } from "maplibre-gl";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Gauge,
  Layers,
  MapPin,
  ArrowRight,
  Wand2,
  Users,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type {
  Feature,
  FeatureCollection,
  Geometry,
} from "geojson";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { publishServiceTileOffers } from "@/lib/tiles/studio-client";
import type {
  MapLibreMapProps,
  MapLibreMapRef,
} from "@/components/maps/MapLibreMap";

const MapLibreMap = dynamic<MapLibreMapProps>(
  () => import("@/components/maps/MapLibreMap"),
  { ssr: false },
);

const MAP_ID = "tile-readiness-map";
const MAP_LAYER_ID = "tile-readiness-selected";

const LIGHT_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f8f9fa",
      },
    },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 0.85,
      },
    },
  ],
};

const DARK_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#0b1220",
      },
    },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 0.85,
      },
    },
  ],
};

const TILE_PUBLISH_POLL_INTERVAL_MS = 2000;
const TILE_PUBLISH_MAX_ATTEMPTS = 60;

async function pollTilePublishJob(jobId: string) {
  const pollUrl = `/api/admin/service-tiles/publish/status?jobId=${encodeURIComponent(jobId)}`;

  for (let attempt = 0; attempt < TILE_PUBLISH_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(pollUrl, {
      credentials: "include",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      data?: {
        status?: string;
        error?: string | null;
        result?: any;
      };
    };

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || payload?.message || "Failed to check publish status");
    }

    const status = payload.data;
    if (!status) {
      throw new Error("Invalid publish job status response");
    }

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Tile publish job failed");
    }

    await new Promise((resolve) => setTimeout(resolve, TILE_PUBLISH_POLL_INTERVAL_MS));
  }

  throw new Error("Tile publish job timed out. Please try again.");
}

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    let message = "Failed to load data";
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
      if (body?.message) message = body.message;
    } catch (error) {
      // ignore json parse errors
    }
    throw new Error(message);
  }
  return response.json();
};

type ServiceAreaStatus = "DRAFT" | "WAITLIST" | "LIVE" | "SUSPENDED";

type RawServiceAreaSummary = {
  tileId: string;
  tileSlug: string;
  tileName: string;
  status: ServiceAreaStatus;
  goLiveDate: string | null;
  activationEligible: boolean;
  waitlistMvdEligible?: boolean;
  launchReady?: boolean;
  unmetScooperCount: number;
  unmetCustomerCount: number;
  unmetWaitlistCount?: number;
  minCertifiedScoopers: number;
  minCustomerUnits: number;
  minWaitlistSignups?: number;
  coverageRadiusMeters: number | null;
  territoryId: string | null;
  latestSnapshot: {
    id: string;
    weekOf: string;
    activeScoopers: number;
    scheduledStops: number;
    completedStops: number;
  } | null;
  thresholds: {
    minCertifiedScoopers: number;
    minCustomerUnits: number;
    minWaitlistSignups?: number;
  };
  advisoryReasons: string[];
  // Waitlist/demand data
  waitlistSignups?: number;
  estimatedPopulation?: number;
  populationSource?: string;
};

type ServiceAreaSummary = {
  id: string;
  slug: string;
  name: string;
  status: ServiceAreaStatus;
  goLiveDate: string | null;
  activationEligible: boolean;
  waitlistMvdEligible?: boolean;
  launchReady?: boolean;
  unmetScooperCount: number;
  unmetCustomerCount: number;
  unmetWaitlistCount?: number;
  minCertifiedScoopers: number;
  minCustomerUnits: number;
  minWaitlistSignups?: number;
  coverageRadiusMeters: number | null;
  territoryId: string | null;
  latestSnapshot: {
    id: string;
    weekOf: string;
    activeScoopers: number;
    scheduledStops: number;
    completedStops: number;
  } | null;
  thresholds: {
    minCertifiedScoopers: number;
    minCustomerUnits: number;
    minWaitlistSignups?: number;
  };
  advisoryReasons: string[];
  // Waitlist/demand data
  waitlistSignups?: number;
  estimatedPopulation?: number;
  populationSource?: string;
};

type ServiceAreaListResponse = {
  orgId: string;
  tiles: RawServiceAreaSummary[];
};

type ServiceAreaDetailResponse = {
  orgId: string;
  readiness: {
    tile: {
      id: string;
      slug: string;
      name: string;
      status: ServiceAreaStatus;
      minCertifiedScoopers: number;
      minCustomerUnits: number;
      coverageRadiusMeters: number | null;
      notes: string | null;
      goLiveDate: string | null;
      territoryId: string | null;
      geometryGeoJSON?: string | null;
      territory?: {
        id: string;
        name: string;
        geometry: unknown;
      } | null;
    };
    latestSnapshot: {
      id: string;
      weekOf: string;
      activeScoopers: number;
      scheduledStops: number;
      completedStops: number;
    } | null;
    thresholds: {
      minCertifiedScoopers: number;
      minCustomerUnits: number;
    };
    activationEligible: boolean;
    unmetScooperCount: number;
    unmetCustomerCount: number;
    advisoryReasons: string[];
  };
};

type ServiceAreaMetricsResponse = {
  tile: {
    id: string;
    name: string;
  };
  snapshots: Array<{
    id: string;
    weekOf: string;
    activeScoopers: number;
    scheduledStops: number;
    completedStops: number;
  }>;
};

const STATUS_LABELS: Record<ServiceAreaStatus, string> = {
  DRAFT: "Waitlist", // DRAFT treated as Waitlist in UI
  WAITLIST: "Waitlist",
  LIVE: "Live",
  SUSPENDED: "Suspended",
};

const STATUS_BADGE_CLASSES: Record<ServiceAreaStatus, string> = {
  LIVE: "bg-brand-mint/10 text-brand-mint dark:bg-brand-mint/20 dark:text-brand-mint",
  WAITLIST: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200", // DRAFT uses same style as Waitlist
  SUSPENDED: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
};

type ChartDatum = {
  week: string;
  activeScoopers: number;
  scheduledStops: number;
  completedStops: number;
};

function normalizeGeometry(
  geometry: unknown,
  slug: string,
  name: string,
): FeatureCollection | null {
  if (!geometry) return null;

  const parsed =
    typeof geometry === "string" ? (JSON.parse(geometry) as unknown) : geometry;

  if (!parsed || typeof parsed !== "object") return null;

  if ((parsed as FeatureCollection).type === "FeatureCollection") {
    return parsed as FeatureCollection;
  }

  if ((parsed as Feature).type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [parsed as Feature],
    } satisfies FeatureCollection;
  }

  if (
    (parsed as Geometry).type === "Polygon" ||
    (parsed as Geometry).type === "MultiPolygon"
  ) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { slug, name },
          geometry: parsed as Geometry,
        },
      ],
    } satisfies FeatureCollection;
  }

  return null;
}

export default function TileReadinessPage() {
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateList,
  } = useSWR<ServiceAreaListResponse>("/api/admin/service-tiles", fetcher);

  const rawServiceAreas = listData?.tiles ?? [];
  const serviceAreas = useMemo<ServiceAreaSummary[]>(
    () =>
      rawServiceAreas.map((area) => ({
        id: area.tileId,
        slug: area.tileSlug,
        name: area.tileName,
        status: area.status,
        goLiveDate: area.goLiveDate,
        activationEligible: area.activationEligible,
        waitlistMvdEligible: area.waitlistMvdEligible,
        launchReady: area.launchReady,
        unmetScooperCount: area.unmetScooperCount,
        unmetCustomerCount: area.unmetCustomerCount,
        unmetWaitlistCount: area.unmetWaitlistCount,
        minCertifiedScoopers: area.minCertifiedScoopers,
        minCustomerUnits: area.minCustomerUnits,
        minWaitlistSignups: area.minWaitlistSignups ?? area.thresholds?.minWaitlistSignups ?? 15,
        coverageRadiusMeters: area.coverageRadiusMeters,
        territoryId: area.territoryId,
        latestSnapshot: area.latestSnapshot,
        thresholds: area.thresholds,
        advisoryReasons: area.advisoryReasons,
        waitlistSignups: area.waitlistSignups ?? 0,
        estimatedPopulation: area.estimatedPopulation,
        populationSource: area.populationSource,
      })),
    [rawServiceAreas],
  );

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mapRef, setMapRef] = useState<MapLibreMapRef | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const detailKey = selectedSlug
    ? `/api/admin/service-tiles/${selectedSlug}`
    : null;
  const metricsKey = selectedSlug
    ? `/api/admin/service-tiles/${selectedSlug}/metrics`
    : null;

  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR<ServiceAreaDetailResponse>(detailKey, fetcher);

  const { data: metricsData } = useSWR<ServiceAreaMetricsResponse>(metricsKey, fetcher);

  const readiness = detailData?.readiness;
  const areaDetail = readiness?.tile;
  const latestSnapshot = readiness?.latestSnapshot;
  const areaThresholds = readiness?.thresholds;

  const [minScoopers, setMinScoopers] = useState("");
  const [minCustomers, setMinCustomers] = useState("");
  const [coverageRadius, setCoverageRadius] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!selectedSlug && serviceAreas.length) {
      setSelectedSlug(serviceAreas[0].slug);
    }
  }, [serviceAreas, selectedSlug]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDarkMode(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!areaDetail || !areaThresholds) return;
    setMinScoopers(String(areaThresholds.minCertifiedScoopers ?? 0));
    setMinCustomers(String(areaThresholds.minCustomerUnits ?? 0));
    setCoverageRadius(
      areaDetail.coverageRadiusMeters !== null
        ? String(areaDetail.coverageRadiusMeters)
        : "",
    );
    setGoLiveDate(
      areaDetail.goLiveDate
        ? format(new Date(areaDetail.goLiveDate), "yyyy-MM-dd")
        : "",
    );
    setNotes(areaDetail.notes ?? "");
  }, [areaDetail, areaThresholds]);

  const chartData: ChartDatum[] = useMemo(() => {
    if (!metricsData?.snapshots?.length) return [];
    return [...metricsData.snapshots]
      .reverse()
      .map((snapshot) => ({
        week: weekFormatter.format(new Date(snapshot.weekOf)),
        activeScoopers: snapshot.activeScoopers,
        scheduledStops: snapshot.scheduledStops,
        completedStops: snapshot.completedStops,
      }));
  }, [metricsData]);

  const geometry = useMemo(() => {
    if (areaDetail?.geometryGeoJSON) {
      const parsed = normalizeGeometry(
        areaDetail.geometryGeoJSON,
        areaDetail.slug,
        areaDetail.name,
      );
      if (parsed) return parsed;
    }
    if (areaDetail?.territory?.geometry) {
      return normalizeGeometry(
        areaDetail.territory.geometry,
        areaDetail.slug,
        areaDetail.name,
      );
    }
    return null;
  }, [areaDetail]);

  const filteredServiceAreas = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return serviceAreas;
    return serviceAreas.filter((area) =>
      `${area.name} ${area.slug}`.toLowerCase().includes(query),
    );
  }, [serviceAreas, search]);

  const readinessStats = useMemo(() => {
    const total = serviceAreas.length;
    const ready = serviceAreas.filter((area) => area.activationEligible).length;
    const waitlisted = serviceAreas.filter((area) => area.status === "WAITLIST").length;
    const live = serviceAreas.filter((area) => area.status === "LIVE").length;
    return { total, ready, waitlisted, live };
  }, [serviceAreas]);

  useEffect(() => {
    if (!mapRef) return;
    if (geometry) {
      mapRef.addGeoJsonLayer({
        id: MAP_LAYER_ID,
        data: geometry,
        fillColor: "#34d399",
        fillOpacity: 0.25,
        strokeColor: "#0f766e",
        strokeWidth: 3,
      });
      mapRef.fitToData(geometry);
    } else {
      mapRef.removeLayer(MAP_LAYER_ID);
    }
  }, [geometry, mapRef]);

  const updateServiceArea = (
    payload: Record<string, unknown>,
    message?: string,
    onSuccess?: () => Promise<void> | void,
  ) => {
    if (!selectedSlug) return;
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/admin/service-tiles/${selectedSlug}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );

          const body = await response.json().catch(() => ({}));

          if (!response.ok || body?.ok === false) {
            const errorMessage =
              (body as any)?.error || (body as any)?.message || "Unable to update service area";
            throw new Error(errorMessage);
          }

          const jobId =
            typeof (body as any)?.data?.jobId === "string"
              ? ((body as any).data.jobId as string)
              : null;

          let loadingToastId: string | number | undefined;

          if (jobId) {
            loadingToastId = toast.loading("Syncing ZIP coverage…");
            try {
              await pollTilePublishJob(jobId);
            } finally {
              if (loadingToastId !== undefined) {
                toast.dismiss(loadingToastId);
              }
            }
          }

          await Promise.all([mutateDetail(), mutateList()]);

          if (onSuccess) {
            try {
              await onSuccess();
            } catch (hookError) {
              console.error("post-update hook failed", hookError);
            }
          }

          toast.success(message ?? "Service area settings saved");
        } catch (error) {
          console.error(error);
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to update service area",
          );
        }
      })();
    });
  };

  const handleThresholdSave = () => {
    if (!areaDetail) return;

    const payload: Record<string, unknown> = {};

    if (minScoopers.trim() !== "") {
      const value = Number(minScoopers);
      if (!Number.isNaN(value)) {
        payload.minCertifiedScoopers = value;
      }
    }

    if (minCustomers.trim() !== "") {
      const value = Number(minCustomers);
      if (!Number.isNaN(value)) {
        payload.minCustomerUnits = value;
      }
    }

    if (coverageRadius.trim() !== "") {
      const value = Number(coverageRadius);
      if (!Number.isNaN(value)) {
        payload.coverageRadiusMeters = value;
      }
    } else {
      payload.coverageRadiusMeters = null;
    }

    if (goLiveDate.trim()) {
      payload.goLiveDate = `${goLiveDate}T00:00:00Z`;
    } else {
      payload.goLiveDate = null;
    }

    payload.notes = notes.trim() ? notes.trim() : null;

    updateServiceArea(payload, "Service area readiness updated");
  };

  const handleStatusChange = (status: ServiceAreaStatus) => {
    const payload: Record<string, unknown> = { status };
    if (status === "LIVE" && !areaDetail?.goLiveDate) {
      payload.goLiveDate = new Date().toISOString();
    }
    const successMessage =
      status === "LIVE"
        ? "Service area moved to live coverage"
        : status === "WAITLIST"
          ? "Service area moved to waitlist"
          : status === "SUSPENDED"
            ? "Service area suspended"
            : "Service area reverted to draft";

    const publishOffersCallback =
      status === "LIVE" && selectedSlug
        ? async () => {
            const loadingToastId = toast.loading("Generating visit offers…");
            try {
              const result = await publishServiceTileOffers(selectedSlug);

              const offersCreated = result.queued
                ? ((result.jobStatus?.result?.offersEvaluated as number | undefined) ?? 0)
                : (result.created ?? result.offers?.length ?? 0);

              const tilesProcessed = result.jobStatus?.result?.tilesProcessed as
                | number
                | undefined;

              const messageParts: string[] = [];
              if (offersCreated > 0) {
                messageParts.push(
                  `${offersCreated} visit offer${offersCreated === 1 ? "" : "s"}`,
                );
              }
              if (tilesProcessed && tilesProcessed > 0) {
                messageParts.push(
                  `${tilesProcessed} tile${tilesProcessed === 1 ? "" : "s"}`,
                );
              }

              const successText =
                messageParts.length > 0
                  ? `Offer sweep complete: ${messageParts.join(", ")}.`
                  : "Offer sweep complete — no new offers required.";

              toast.success(successText, { id: loadingToastId });
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to generate visit offers";
              toast.error(message, { id: loadingToastId });
            }
          }
        : undefined;

    updateServiceArea(payload, successMessage, publishOffersCallback);
  };

  const headerError = listError ?? detailError;
  const mapStyle = isDarkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
  const mapStyleKey = isDarkMode ? "tile-readiness-dark" : "tile-readiness-light";
  const chartAxisStroke = isDarkMode ? "#94a3b8" : "#475569";
  const chartGridStroke = isDarkMode ? "rgba(148, 163, 184, 0.25)" : "#cbd5f53d";
  const chartTooltip = isDarkMode
    ? {
        background: "#0f172a",
        borderRadius: "0.75rem",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        color: "#e2e8f0",
      }
    : {
        background: "#ffffff",
        borderRadius: "0.75rem",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        color: "#0f172a",
      };

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto space-y-8 px-6 pb-24 pt-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="admin-title text-3xl sm:text-4xl">
              Service area readiness
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Monitor density signals, inspect territories, and fast-track coverage zones from waitlist to live service.
            </p>
            {headerError ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">
                {headerError instanceof Error
                  ? headerError.message
                  : "Unable to load service area data."}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="rounded-xl border-brand-coral/30 dark:border-white/20 text-brand-coral hover:bg-brand-coral/10">
              <Link href="/admin/marketplace/waitlist" className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Waitlist Monitor
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-300 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5">
              <Link
                href="/admin/marketplace/tiles/studio"
                className="inline-flex items-center gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Tile Studio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-brand-coral/15 dark:border-white/10 bg-cream-porcelain/50 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <Layers className="h-4 w-4" />
              Service areas
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-white/70">Total configured coverage zones</CardDescription>
            <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {numberFormatter.format(readinessStats.total)}
            </div>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-brand-mint/30 dark:border-brand-mint/20 bg-brand-mint/10 dark:bg-brand-mint/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-mint dark:text-brand-mint">
              <CheckCircle2 className="h-4 w-4" />
              Live coverage
            </CardTitle>
            <CardDescription className="text-brand-mint dark:text-brand-mint">Currently accepting bookings</CardDescription>
            <div className="mt-4 text-3xl font-bold text-brand-mint dark:text-brand-mint">
              {numberFormatter.format(readinessStats.live)}
            </div>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-brand-gold/30 dark:border-brand-gold/20 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-brand-gold">
              <Sparkles className="h-4 w-4" />
              Launch-ready
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-500">Meets MVD thresholds</CardDescription>
            <div className="mt-4 text-3xl font-bold text-amber-700 dark:text-brand-gold">
              {numberFormatter.format(readinessStats.ready)}
            </div>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-brand-coral/15 dark:border-white/10 bg-cream-porcelain/50 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <Users className="h-4 w-4" />
              Waitlist
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-white/70">Building demand signals</CardDescription>
            <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {numberFormatter.format(readinessStats.waitlisted)}
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="rounded-2xl border-brand-coral/15 dark:border-white/10 bg-cream-porcelain/50 dark:bg-white/5 h-full">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="font-serif text-lg text-slate-900 dark:text-white">Service areas</CardTitle>
              <CardDescription className="text-slate-600 dark:text-white/70">
                Showing {filteredServiceAreas.length} of {serviceAreas.length} coverage zones.
              </CardDescription>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or slug"
              className="h-10 rounded-xl border border-brand-coral/15 dark:border-white/15 bg-cream-vanilla/80 dark:bg-white/5 px-4 text-sm focus-visible:ring-brand-coral/30"
            />
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-y-auto pr-2">
              {listLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : filteredServiceAreas.length ? (
                <div className="space-y-3">
                  {filteredServiceAreas.map((area) => {
                    const isActive = area.slug === selectedSlug;
                    const isPreLaunch = area.status === "DRAFT" || area.status === "WAITLIST";
                    const waitlistCount = area.waitlistSignups ?? 0;
                    const minWaitlist = area.minWaitlistSignups ?? 15;
                    
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setSelectedSlug(area.slug)}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition",
                          isActive
                            ? "border-brand-coral/50 bg-brand-coral/10 shadow-sm dark:border-brand-coral/60"
                            : "border-slate-200 bg-cream-vanilla/50 hover:border-brand-coral/40 hover:bg-brand-coral/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-coral/40 dark:hover:bg-brand-coral/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-serif text-sm font-semibold text-slate-900 dark:text-white">
                              {area.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {area.slug}
                            </p>
                          </div>
                          <Badge className={cn("rounded-full text-xs", STATUS_BADGE_CLASSES[area.status])}>
                            {STATUS_LABELS[area.status]}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-100 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                            🧑‍🔧 {area.latestSnapshot?.activeScoopers ?? 0}/{area.minCertifiedScoopers}
                          </span>
                          {isPreLaunch ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium",
                              waitlistCount >= minWaitlist 
                                ? "border-brand-mint/20 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/30 dark:bg-brand-mint/20 dark:text-brand-mint"
                                : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                            )}>
                              <Sparkles className="h-3 w-3" />
                              {waitlistCount}/{minWaitlist} waitlist
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-100 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                              📍 {area.latestSnapshot?.scheduledStops ?? 0}/{area.minCustomerUnits}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs">
                          {isPreLaunch ? (
                            waitlistCount >= minWaitlist && (area.latestSnapshot?.activeScoopers ?? 0) >= area.minCertifiedScoopers ? (
                              <span className="inline-flex items-center gap-1 text-brand-mint dark:text-brand-mint">
                                <CheckCircle2 className="h-3.5 w-3.5" /> MVD reached — ready to launch
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {area.advisoryReasons[0] ?? "Building demand"}
                              </span>
                            )
                          ) : area.activationEligible ? (
                            <span className="inline-flex items-center gap-1 text-brand-mint dark:text-brand-mint">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Live service active
                            </span>
                          ) : area.advisoryReasons.length ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {area.advisoryReasons[0]}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              Monitoring density
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  {search.trim()
                    ? `No service areas match "${search.trim()}". Try a different name or slug.`
                    : "No service areas found."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="admin-card">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-mint" />
                Coverage map
              </CardTitle>
              <CardDescription>
                Visualize the service area footprint and confirm where scooper density is tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {detailLoading ? (
                <Skeleton className="h-[320px] w-full rounded-2xl" />
              ) : areaDetail ? (
                <>
                  <div className="h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/60">
                    <MapLibreMap
                      id={MAP_ID}
                      className="h-full"
                      style={mapStyle}
                      styleKey={mapStyleKey}
                      onLoad={() => {
                        const assignRef = () => {
                          const api = (window as any)[`maplibre_${MAP_ID}`] as
                            | MapLibreMapRef
                            | undefined;
                          if (api) {
                            setMapRef(api);
                            return true;
                          }
                          return false;
                        };

                        if (!assignRef()) {
                          setTimeout(() => {
                            assignRef();
                          }, 120);
                        }
                      }}
                    />
                  </div>
                  {!geometry ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      No territory geometry linked to this service area yet. Assign a territory to visualize coverage.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  Select a service area to view its territory map.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader className="gap-2">
              <CardTitle>Density snapshot</CardTitle>
              <CardDescription>
                Compare active scoopers and weekly stops against launch thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {detailLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : readiness ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Certified scooper coverage
                    </p>
                    <p className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {numberFormatter.format(latestSnapshot?.activeScoopers ?? 0)}
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        / {numberFormatter.format(areaThresholds?.minCertifiedScoopers ?? 0)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {readiness.unmetScooperCount > 0
                        ? `${readiness.unmetScooperCount} more certified scoopers needed.`
                        : "Certified coverage goal met."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Weekly stop density
                    </p>
                    <p className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {numberFormatter.format(latestSnapshot?.scheduledStops ?? 0)}
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        / {numberFormatter.format(areaThresholds?.minCustomerUnits ?? 0)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {readiness.unmetCustomerCount > 0
                        ? `${readiness.unmetCustomerCount} more weekly stops needed.`
                        : "Stop density threshold reached."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Activation state
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {readiness.activationEligible ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-brand-mint" />
                          Ready
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          Needs lift
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {areaDetail?.goLiveDate
                        ? `Go-live: ${dateFormatter.format(new Date(areaDetail.goLiveDate))}`
                        : "Go-live date not scheduled."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select a service area to see density thresholds and metrics.
                </p>
              )}

              <div className="h-[260px] w-full">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                      <XAxis dataKey="week" stroke={chartAxisStroke} tick={{ fontSize: 12 }} />
                      <YAxis stroke={chartAxisStroke} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={chartTooltip}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="activeScoopers"
                        name="Active scoopers"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="scheduledStops"
                        name="Scheduled stops"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="completedStops"
                        name="Completed stops"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300/70 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No metric snapshots yet. Once weekly rollups are recorded, they'll appear here.
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="admin-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-brand-mint" />
                  Minimum viable density
                </CardTitle>
                <CardDescription>
                  Tune the certified scooper and weekly customer thresholds gating when a service area moves from waitlist to live coverage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Certified scoopers minimum
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={minScoopers}
                      onChange={(event) => setMinScoopers(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Weekly stops minimum
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={minCustomers}
                      onChange={(event) => setMinCustomers(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Coverage radius (meters)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={coverageRadius}
                      onChange={(event) => setCoverageRadius(event.target.value)}
                      placeholder="Optional"
                      className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Go-live target
                    </Label>
                    <Input
                      type="date"
                      value={goLiveDate}
                      onChange={(event) => setGoLiveDate(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Operator notes
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add internal launch notes, blockers, or MVD rationale."
                    className="min-h-[96px] rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-700 shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </div>
                <Button
                  onClick={handleThresholdSave}
                  disabled={isPending || !areaDetail}
                  className="w-full rounded-full bg-brand-coral text-sm font-semibold text-slate-950 hover:bg-brand-coral/90"
                >
                  Save readiness settings
                </Button>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-brand-mint" />
                  Activation controls
                </CardTitle>
                <CardDescription>
                  Override waitlist status, launch live coverage, or pause a service area while retaining density telemetry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Current status: {areaDetail ? STATUS_LABELS[areaDetail.status] : "—"}
                  </p>
                  {areaDetail?.goLiveDate ? (
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      Go-live: {dateFormatter.format(new Date(areaDetail.goLiveDate))}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      No go-live date recorded. Launching will stamp today’s date unless you pick one above.
                    </p>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    variant="outline"
                    disabled={isPending || !areaDetail || areaDetail.status === "DRAFT"}
                    onClick={() => handleStatusChange("DRAFT")}
                  >
                    Return to draft
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending || !areaDetail || areaDetail.status === "WAITLIST"}
                    onClick={() => handleStatusChange("WAITLIST")}
                  >
                    Move to waitlist
                  </Button>
                  <Button
                    className="bg-brand-coral text-white hover:bg-brand-coral/90"
                    disabled={isPending || !areaDetail || areaDetail.status === "LIVE"}
                    onClick={() => handleStatusChange("LIVE")}
                  >
                    Force live coverage
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isPending || !areaDetail || areaDetail.status === "SUSPENDED"}
                    onClick={() => handleStatusChange("SUSPENDED")}
                  >
                    Pause service area
                  </Button>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">Need-to-know</p>
                  <p className="mt-1">
                    Moving a service area to live overrides minimum viable density checks. Keep an eye on availability to avoid over-promising coverage.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Advisory feed</CardTitle>
              <CardDescription>
                Automatic notes explain what's blocking activation or why a service area is healthy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readiness?.advisoryReasons?.length ? (
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {readiness.advisoryReasons.map((reason, index) => (
                    <li
                      key={`${reason}-${index}`}
                      className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No outstanding blockers. Density signals look healthy for activation.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
  );
}
