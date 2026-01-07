"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";

import MapLibreMap, { type MapLibreMapRef } from "@/components/maps/MapLibreMap";
import { Button } from "@/components/ui/button";

type PoopMapPoint = {
  id: string;
  lat: number;
  lng: number;
  capturedAt: string;
  source: "OWNER" | "PRO";
};

type HomeLocation = { lat: number; lng: number } | null;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timeBucketForHour = (hour: number) => {
  if (hour >= 5 && hour < 11) return "Morning";
  if (hour >= 11 && hour < 16) return "Midday";
  if (hour >= 16 && hour < 21) return "Evening";
  return "Overnight";
};

export default function MobileWellnessPoopMap({
  points,
  homeLocation,
}: {
  points: PoopMapPoint[];
  homeLocation: HomeLocation;
}) {
  const mapId = useMemo(
    () => `poop-map-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const mapApiRef = useRef<MapLibreMapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const ownerPoints = points.filter((point) => point.source === "OWNER");
  const proPoints = points.filter((point) => point.source === "PRO");

  const ownerGeo = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: ownerPoints.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: { capturedAt: point.capturedAt },
      })),
    } as GeoJSON.FeatureCollection;
  }, [ownerPoints]);

  const proGeo = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: proPoints.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: { capturedAt: point.capturedAt },
      })),
    } as GeoJSON.FeatureCollection;
  }, [proPoints]);

  const combinedGeo = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: [...ownerGeo.features, ...proGeo.features],
    } as GeoJSON.FeatureCollection;
  }, [ownerGeo, proGeo]);

  useEffect(() => {
    if (!mapReady) return;
    if (typeof window === "undefined") return;
    const api = (window as any)[`maplibre_${mapId}`] as MapLibreMapRef | undefined;
    if (!api) return;
    mapApiRef.current = api;
  }, [mapReady, mapId]);

  useEffect(() => {
    const api = mapApiRef.current;
    if (!api) return;

    const addOrUpdate = (
      id: string,
      data: GeoJSON.FeatureCollection,
      color: string,
    ) => {
      const existing = api.getLayerInfo(id);
      if (existing) {
        api.updateLayerData(id, data);
        return;
      }
      api.addGeoJsonLayer({
        id,
        data,
        layerType: "circle",
        circleColor: color,
        circleOpacity: 0.8,
        circleRadius: 6,
        circleStrokeColor: "#0f172a",
        circleStrokeWidth: 1,
      });
    };

    addOrUpdate("owner-captures", ownerGeo, "#34d399");
    addOrUpdate("pro-captures", proGeo, "#f97316");

    if (combinedGeo.features.length > 0) {
      api.fitToData(combinedGeo, { padding: 60, maxZoom: 16 });
    }
  }, [ownerGeo, proGeo, combinedGeo]);

  const coaching = useMemo(() => {
    if (points.length === 0) return null;
    const dayCounts = new Map<number, number>();
    const bucketCounts = new Map<string, number>();

    points.forEach((point) => {
      const date = new Date(point.capturedAt);
      const day = date.getDay();
      const hour = date.getHours();
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      const bucket = timeBucketForHour(hour);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    });

    const topDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topBucket = Array.from(bucketCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      dayLabel: topDay ? DAY_LABELS[topDay[0]] : "—",
      bucketLabel: topBucket ? topBucket[0] : "—",
      total: points.length,
    };
  }, [points]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Poop map
            </p>
            <h2 className="text-lg font-semibold text-white">
              See patterns across your yard
            </h2>
            <p className="text-sm text-slate-400">
              Compare owner captures with scooper visits to stay consistent.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
        <div className="relative h-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
          <MapLibreMap
            id={mapId}
            className="h-full w-full"
            center={
              homeLocation ? [homeLocation.lng, homeLocation.lat] : undefined
            }
            zoom={homeLocation ? 15 : undefined}
            onLoad={() => setMapReady(true)}
          />
          {points.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
              No map points yet. Capture a stool or complete a scoop to populate.
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Owner capture
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-orange-300" />
            Pro capture
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Sparkles className="h-4 w-4" aria-hidden />
          Schedule coaching
        </div>
        {coaching ? (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              {coaching.total} captures logged. Most activity happens on{" "}
              <span className="font-semibold text-white">
                {coaching.dayLabel} {coaching.bucketLabel}
              </span>
              .
            </p>
            <p className="text-xs text-slate-400">
              Set reminders around that window for a consistent routine.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Log a few captures to unlock timing suggestions.
          </p>
        )}

        <Link href="/mobile/dashboard/wellness/reminders" className="block">
          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-700 text-slate-200"
          >
            Set a reminder
          </Button>
        </Link>
      </section>
    </div>
  );
}
