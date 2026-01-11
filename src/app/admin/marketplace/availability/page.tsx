"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { AvailabilityWindow } from "@prisma/client";
import type * as GeoJSON from "geojson";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ServiceAreaSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  zipCount: number;
  coveragePercent: number;
  coverageRatio: number;
  tileGeometry?: GeoJSON.Feature | null;
}

interface AvailabilityRow {
  id: string;
  tileId: string;
  tileSlug: string;
  tileName: string;
  weekday: number;
  window: AvailabilityWindow;
  maxStops: number | null;
}

interface ScooperSummary {
  profileId: string;
  userId: string;
  name: string;
  status: string;
  availability: AvailabilityRow[];
}

interface AvailabilityResponse {
  ok: true;
  data: {
    tiles: ServiceAreaSummary[];
    scoopers: ScooperSummary[];
  };
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WINDOW_LABELS: Record<AvailabilityWindow, string> = {
  FULL: "Full day",
  AM: "Morning",
  PM: "Afternoon",
  CUSTOM: "Custom",
};

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}

function ScooperSelect({
  scoopers,
  selectedId,
  onSelect,
}: {
  scoopers: ScooperSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Scooper
      </Label>
      <Select
        value={selectedId ?? undefined}
        onValueChange={(value) => onSelect(value)}
      >
        <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
          <SelectValue placeholder="Select a scooper" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {scoopers.map((scooper) => (
            <SelectItem key={scooper.profileId} value={scooper.profileId}>
              {scooper.name || "Unnamed scooper"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AvailabilityTable({
  rows,
  onRemove,
  busy,
}: {
  rows: AvailabilityRow[];
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        This scooper has no active availability blocks.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <TableHead className="text-xs font-semibold uppercase tracking-[0.18em]">Service area</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-[0.18em]">Weekday</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-[0.18em]">Window</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-[0.18em]">Max stops</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.18em]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="text-sm text-slate-700 dark:text-slate-200">
              <TableCell className="font-semibold">
                {row.tileName}
                <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                  {row.tileSlug}
                </span>
              </TableCell>
              <TableCell>{WEEKDAY_LABELS[row.weekday]}</TableCell>
              <TableCell>{WINDOW_LABELS[row.window]}</TableCell>
              <TableCell>{row.maxStops ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRemove(row.id)}
                  className="text-rose-500 hover:bg-rose-100 hover:text-rose-600 dark:text-rose-300 dark:hover:bg-rose-500/15"
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AddAvailabilityForm({
  serviceAreas,
  onSubmit,
  busy,
  prefillSlug,
}: {
  serviceAreas: ServiceAreaSummary[];
  onSubmit: (payload: {
    tileSlug: string;
    weekday: number;
    window: AvailabilityWindow;
    maxStops: number | null;
  }) => void;
  busy: boolean;
  prefillSlug?: string | null;
}) {
  const [tileSlug, setTileSlug] = useState<string>("");
  const [weekday, setWeekday] = useState<number>(1);
  const [window, setWindow] = useState<AvailabilityWindow>(AvailabilityWindow.FULL);
  const [maxStops, setMaxStops] = useState<number | "">("");

  useEffect(() => {
    if (prefillSlug) {
      setTileSlug(prefillSlug);
    }
  }, [prefillSlug]);

  const selectedArea = useMemo(
    () => serviceAreas.find((area) => area.slug === tileSlug) ?? null,
    [serviceAreas, tileSlug],
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!tileSlug) return;
        onSubmit({
          tileSlug,
          weekday,
          window,
          maxStops: maxStops === "" ? null : Number(maxStops),
        });
      }}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Service area
        </Label>
        <Select
          value={tileSlug || undefined}
          onValueChange={setTileSlug}
        >
          <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
            <SelectValue placeholder="Choose a service area" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {serviceAreas.map((area) => (
              <SelectItem key={area.id} value={area.slug}>
                {area.name} ({area.slug})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedArea ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedArea.zipCount.toLocaleString()} ZIPs • {Math.round(selectedArea.coveragePercent)}% coverage • {selectedArea.status.toLowerCase()}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Weekday
        </Label>
        <Select
          value={String(weekday)}
          onValueChange={(value) => setWeekday(Number(value))}
        >
          <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {WEEKDAY_LABELS.map((label, index) => (
              <SelectItem key={index} value={String(index)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Time window
        </Label>
        <Select value={window} onValueChange={(value) => setWindow(value as AvailabilityWindow)}>
          <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Object.entries(WINDOW_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Max stops (optional)
        </Label>
        <Input
          type="number"
          min={1}
          max={60}
          value={maxStops}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              setMaxStops("");
              return;
            }
            setMaxStops(Number(value));
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-700 shadow-sm transition focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
        />
      </div>

      <div className="lg:col-span-4 flex justify-end">
        <Button
          type="submit"
          disabled={busy || !tileSlug}
          className="rounded-full bg-brand-coral text-sm font-semibold text-slate-950 hover:bg-brand-coral/90"
        >
          Add block
        </Button>
      </div>
    </form>
  );
}

function ServiceAreaExplorer({
  serviceAreas,
  searchTerm,
  onSearch,
  onSelect,
  selectedSlug,
}: {
  serviceAreas: ServiceAreaSummary[];
  searchTerm: string;
  onSearch: (value: string) => void;
  onSelect?: (slug: string) => void;
  selectedSlug?: string | null;
}) {
  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return serviceAreas;
    return serviceAreas.filter((area) =>
      [area.name, area.slug].some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchTerm, serviceAreas]);

  const total = serviceAreas.length;

  const getStatusBadgeVariant = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "LIVE") return "outline";
    if (normalized === "WAITLIST") return "secondary";
    return "secondary";
  };

  const formatStatusLabel = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "LIVE") return "Live";
    if (normalized === "WAITLIST") return "Waitlist";
    if (normalized === "DRAFT") return "Waitlist"; // DRAFT treated as Waitlist in UI
    return status;
  };

  const formatCoverage = (value: number) => `${Math.round(value)}%`;

  return (
    <Card className="admin-card h-full">
      <CardHeader className="space-y-3">
        <CardTitle>Service areas</CardTitle>
        <CardDescription>
          Browse every zone configured for dispatch. Showing {filtered.length} of {total} service areas.
        </CardDescription>
        <Input
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name or slug"
          className="h-10 rounded-full border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              No service areas match that search.
            </div>
          ) : (
            filtered.map((area) => {
              const isSelected = selectedSlug === area.slug;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => onSelect?.(area.slug)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-brand-mint/40 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                      : "border-slate-200 bg-white hover:border-brand-mint/40 hover:bg-brand-mint/10 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{area.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{area.slug}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {area.zipCount.toLocaleString()} ZIPs • {formatCoverage(area.coveragePercent)} coverage
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(area.status)} className="rounded-full">
                      {formatStatusLabel(area.status)}
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceAvailabilityPage() {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityResponse>(
    "/api/admin/marketplace/availability",
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const scoopers = data?.data.scoopers ?? [];
  const serviceAreas = data?.data.tiles ?? [];
  const [selectedScooperId, setSelectedScooperId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [serviceAreaSearch, setServiceAreaSearch] = useState("");
  const [prefillServiceArea, setPrefillServiceArea] = useState<string | null>(null);

  useEffect(() => {
    if (!scoopers.length) {
      setSelectedScooperId(null);
      return;
    }
    setSelectedScooperId((current) => {
      if (current && scoopers.some((s) => s.profileId === current)) {
        return current;
      }
      return scoopers[0]?.profileId ?? null;
    });
  }, [scoopers]);

  const selectedScooper = useMemo(
    () => scoopers.find((scooper) => scooper.profileId === selectedScooperId) ?? null,
    [selectedScooperId, scoopers],
  );

  const serviceAreaStats = useMemo(() => {
    const total = serviceAreas.length;
    const live = serviceAreas.filter((area) => area.status.toUpperCase() === "LIVE").length;
    const waitlist = serviceAreas.filter((area) => area.status.toUpperCase() === "WAITLIST").length;
    const averageCoverage = total
      ? serviceAreas.reduce((sum, area) => sum + (area.coveragePercent ?? 0), 0) / total
      : 0;
    const totalZips = serviceAreas.reduce((sum, area) => sum + (area.zipCount ?? 0), 0);
    return {
      total,
      live,
      waitlist,
      averageCoverage,
      totalZips,
    };
  }, [serviceAreas]);

  const handleRemove = (availabilityId: string) => {
    if (!selectedScooperId) return;
    startTransition(() => {
      fetch("/api/admin/marketplace/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scooperId: selectedScooperId,
          remove: [availabilityId],
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.ok) {
            mutate();
          } else {
            console.error("Failed to remove availability", res.error);
          }
        })
        .catch((err) => console.error(err));
    });
  };

  const handleAdd = (payload: {
    tileSlug: string;
    weekday: number;
    window: AvailabilityWindow;
    maxStops: number | null;
  }) => {
    if (!selectedScooperId) return;
    startTransition(() => {
      fetch("/api/admin/marketplace/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scooperId: selectedScooperId,
          add: [payload],
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.ok) {
            mutate();
          } else {
            console.error("Failed to add availability", res.error);
          }
        })
        .catch((err) => console.error(err));
    });
  };

  const activeScoopers = useMemo(
    () => scoopers.filter((scooper) => scooper.availability.length).length,
    [scoopers],
  );

  const totalBlocks = useMemo(
    () => scoopers.reduce((total, scooper) => total + scooper.availability.length, 0),
    [scoopers],
  );

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-rose-500 dark:text-rose-300">
        Failed to load marketplace availability.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="admin-surface min-h-screen">
        <div className="container mx-auto space-y-6 px-6 pb-24 pt-24">
          <OverviewSkeleton />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (serviceAreas.length === 0) {
    return (
      <div className="admin-surface min-h-screen">
        <div className="container mx-auto max-w-3xl space-y-6 px-6 pb-24 pt-24">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              No service tiles found
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Import your service tiles via the PostGIS ETL (`npm run etl:tiles` followed by `npm run etl:tile-zips`) before managing scooper availability. Once tiles exist they will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/80 text-slate-900 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-20">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <Badge variant="secondary" className="rounded-full border border-brand-coral/20 bg-brand-coral/10 text-brand-coral dark:border-brand-mint/30 dark:bg-brand-mint/10 dark:text-brand-mint">
                  Marketplace
                </Badge>
                <span>Scooper coverage</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">Availability planner</h1>
                <p className="admin-subtitle">
                  Shape daily capacity across your service areas without wiping existing schedules. Adjust weekdays, windows, and stop caps in seconds.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Service areas
                </CardTitle>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  Configured coverage zones
                </CardDescription>
                <div className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">
                  {serviceAreaStats.total}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {serviceAreaStats.live} live • {serviceAreaStats.waitlist} waitlist
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {serviceAreaStats.totalZips.toLocaleString()} ZIPs mapped
                </p>
              </CardHeader>
            </Card>
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Average coverage
                </CardTitle>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  Across all service areas
                </CardDescription>
                <div className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">
                  {serviceAreaStats.averageCoverage.toFixed(1)}%
                </div>
              </CardHeader>
            </Card>
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Active scoopers
                </CardTitle>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  With at least one block this week
                </CardDescription>
                <div className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">{activeScoopers}</div>
              </CardHeader>
            </Card>
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Availability blocks
                </CardTitle>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  Across the current roster
                </CardDescription>
                <div className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">{totalBlocks}</div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-10 px-6 pb-24 pt-12">
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <ServiceAreaExplorer
            serviceAreas={serviceAreas}
            searchTerm={serviceAreaSearch}
            onSearch={setServiceAreaSearch}
            selectedSlug={prefillServiceArea}
            onSelect={(slug) => setPrefillServiceArea(slug)}
          />

          <Card className="admin-card">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Scooper availability</CardTitle>
                <CardDescription>
                  Pick a scooper to edit their weekday capacity across service areas.
                </CardDescription>
              </div>
              <ScooperSelect
                scoopers={scoopers}
                selectedId={selectedScooperId}
                onSelect={(value) => {
                  setSelectedScooperId(value);
                  setPrefillServiceArea(null);
                }}
              />
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedScooper ? (
                <>
                  <AddAvailabilityForm
                    serviceAreas={serviceAreas}
                    onSubmit={(payload) => {
                      setPrefillServiceArea(payload.tileSlug);
                      handleAdd(payload);
                    }}
                    busy={isPending}
                    prefillSlug={prefillServiceArea}
                  />
                  <AvailabilityTable
                    rows={selectedScooper.availability}
                    onRemove={handleRemove}
                    busy={isPending}
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  Select a scooper to view and adjust availability.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
