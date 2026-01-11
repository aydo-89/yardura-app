"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SVGProps,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import type { Feature, FeatureCollection } from "geojson";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  CalendarDays,
  CheckCircle2,
  Compass,
  Loader2,
  Mail,
  MapPin,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import type {
  MapLibreMapProps,
  MapLibreMapRef,
} from "@/components/maps/MapLibreMap";

const MapLibreMap = dynamic<MapLibreMapProps>(
  () => import("@/components/maps/MapLibreMap"),
  { ssr: false },
);

const MAP_ID = "scooper-apply-map";
const TILE_LAYER_ID = "scooper-apply-selected-tile";
const LOCATION_LAYER_ID = "scooper-apply-location";

const WEEKDAYS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
] as const;

const AVAILABILITY_WINDOWS = [
  { label: "Full day", value: "FULL" },
  { label: "Morning", value: "AM" },
  { label: "Afternoon", value: "PM" },
] as const;

type ServiceTileStatus = "DRAFT" | "WAITLIST" | "LIVE" | "SUSPENDED";
type AvailabilityWindow = "AM" | "PM" | "FULL";

const WEEKDAY_LABEL_BY_VALUE = new Map<number, string>(
  WEEKDAYS.map((day) => [day.value, day.label]),
);

const AVAILABILITY_WINDOW_LABEL_BY_VALUE = new Map<AvailabilityWindow, string>(
  AVAILABILITY_WINDOWS.map((entry) => [entry.value, entry.label]),
);

const SCOOPER_STATUS_META: Record<string, { label: string; description: string; badgeClass: string }> = {
  APPLICANT: {
    label: "Application received",
    description: "We’ve logged your details and the operations team will review coverage needs shortly.",
    badgeClass: "bg-sky-500/15 text-sky-700 border border-sky-500/30",
  },
  PENDING_REVIEW: {
    label: "Pending review",
    description: "Your application is waiting on operations triage. Watch your email for updates.",
    badgeClass: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
  },
  CERTIFIED: {
    label: "Certified",
    description: "You’re cleared for routes. Offers will start flowing once availability matches open shifts.",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
  },
  PAUSED: {
    label: "Paused",
    description: "Coverage is paused. Reach out to ops if this needs attention.",
    badgeClass: "bg-slate-500/15 text-slate-700 border border-slate-400/30",
  },
  DEACTIVATED: {
    label: "Deactivated",
    description: "This account is currently inactive.",
    badgeClass: "bg-rose-500/15 text-rose-700 border border-rose-500/30",
  },
};

const BACKGROUND_STATUS_META: Record<string, { label: string; description: string; badgeClass: string }> = {
  NOT_SUBMITTED: {
    label: "Background check pending",
    description: "We’ll send the screening form once you’re queued for certification.",
    badgeClass: "bg-slate-200 text-slate-700 border border-slate-300",
  },
  PENDING: {
    label: "Background check in progress",
    description: "Screening is underway. You’ll receive a confirmation when it clears.",
    badgeClass: "bg-amber-200 text-amber-800 border border-amber-300",
  },
  PASSED: {
    label: "Background check cleared",
    description: "You’re fully cleared for coverage.",
    badgeClass: "bg-emerald-200 text-emerald-800 border border-emerald-300",
  },
  FAILED: {
    label: "Background check issue",
    description: "Contact ops for next steps.",
    badgeClass: "bg-rose-200 text-rose-800 border border-rose-300",
  },
};

type TileApiEntry = {
  tile: {
    slug: string;
    name: string;
    status: ServiceTileStatus;
    goLiveDate: string | null;
    minCertifiedScoopers: number;
    minCustomerUnits: number;
    coverageRadiusMeters: number | null;
    territoryId: string | null;
    geometry: FeatureCollection | null;
    cities: string[];
    zips: string[];
    coverage: {
      zipCount: number;
      coveragePercent: number | null;
      tileAreaSqMeters: number | null;
      coveredAreaSqMeters: number | null;
      conflictZipCount: number;
    };
  };
  readiness: {
    activationEligible: boolean;
    unmetScooperCount: number;
    unmetCustomerCount: number;
    advisoryReasons: string[];
  };
  latestSnapshot: {
    activeScoopers: number;
    scheduledStops: number;
    completedStops: number;
    weekOf: string;
  } | null;
};

type TileApiResponse = {
  data: TileApiEntry[];
};

interface TileSelection {
  tile: TileApiEntry;
  weekdays: number[];
  window: AvailabilityWindow;
  maxStops: number | null;
}

interface SubmittedApplication {
  name: string;
  email: string;
  profile: {
    id?: string;
    status?: string | null;
    backgroundCheckStatus?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  selections: TileSelection[];
}

const STATUS_META: Record<
  ServiceTileStatus,
  { label: string; badgeClass: string; description: string }
> = {
  LIVE: {
    label: "Live",
    badgeClass: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/40",
    description: "Actively servicing customers—routes are open now.",
  },
  WAITLIST: {
    label: "Waitlist",
    badgeClass: "bg-amber-500/15 text-amber-600 border border-amber-500/40",
    description: "Accepting interest while coverage builds—be first in when it flips live.",
  },
  DRAFT: {
    label: "Waitlist",
    badgeClass: "bg-amber-500/15 text-amber-600 border border-amber-500/40",
    description: "Accepting interest while coverage builds—be first in when it flips live.",
  },
  SUSPENDED: {
    label: "Paused",
    badgeClass: "bg-rose-500/15 text-rose-600 border border-rose-500/40",
    description: "Temporarily paused coverage—watch for updates soon.",
  },
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load data");
  }
  return response.json() as Promise<TileApiResponse>;
};

function buildCircleFeatureCollection(
  lng: number,
  lat: number,
  radiusMeters = 500,
  steps = 48,
): FeatureCollection {
  const coordinates: [number, number][] = [];
  const earthRadius = 6_378_137; // meters
  const angularDistance = radiusMeters / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * 2 * Math.PI;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance)
        + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLng =
      lngRad
      + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat),
      );
    coordinates.push([
      (pointLng * 180) / Math.PI,
      (pointLat * 180) / Math.PI,
    ]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "applicant-location" },
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  } satisfies FeatureCollection;
}

function sortTilesForDisplay(entries: TileApiEntry[]): TileApiEntry[] {
  const priority: Record<ServiceTileStatus, number> = {
    LIVE: 0,
    WAITLIST: 1,
    DRAFT: 2,
    SUSPENDED: 3,
  };

  return [...entries].sort((a, b) => {
    const statusDiff = priority[a.tile.status] - priority[b.tile.status];
    if (statusDiff !== 0) return statusDiff;
    return a.tile.name.localeCompare(b.tile.name);
  });
}

export default function FieldTechApplyPage() {
  const { data, error, isLoading } = useSWR<TileApiResponse>(
    "/api/marketplace/tiles",
    fetcher,
  );

  const tiles = useMemo(() => sortTilesForDisplay(data?.data ?? []), [data?.data]);
  const tileBySlug = useMemo(() => {
    const map = new Map<string, TileApiEntry>();
    tiles.forEach((entry) => {
      map.set(entry.tile.slug, entry);
    });
    return map;
  }, [tiles]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleDetail, setVehicleDetail] = useState("");
  const [insuranceProofUrl, setInsuranceProofUrl] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [homeZip, setHomeZip] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | ServiceTileStatus
  >("ALL");
  const [selectedTileSlug, setSelectedTileSlug] = useState<string | null>(null);
  const [tileSelections, setTileSelections] = useState<Record<string, TileSelection>>({});
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(null);

  const resetForm = useCallback(() => {
    setSubmittedApplication(null);
    setName("");
    setEmail("");
    setPhone("");
    setVehicleDetail("");
    setInsuranceProofUrl("");
    setHomeAddress("");
    setCityInput("");
    setSelectedCity(null);
    setHomeZip("");
    setTileSelections({});
    setSelectedTileSlug(null);
    setStatusFilter("ALL");
    setUserLocation(null);
    setLocationLoading(false);
    setSubmitting(false);
    setBackgroundConsent(false);
    setTermsConsent(false);
  }, []);

  const mapApiRef = useRef<MapLibreMapRef | null>(null);

  useEffect(() => {
    if (selectedTileSlug || !tiles.length) return;
    const defaultTile = tiles.find((entry) => entry.tile.status === "LIVE") ?? tiles[0];
    if (defaultTile) {
      setSelectedTileSlug(defaultTile.tile.slug);
    }
  }, [selectedTileSlug, tiles]);

  useEffect(() => {
    if (submittedApplication && typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [submittedApplication]);

  const statusFilteredTiles = useMemo(() => {
    const query = (selectedCity ?? cityInput).trim().toLowerCase();
    return tiles.filter((entry) => {
      const matchesStatus =
        statusFilter === "ALL" || entry.tile.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const inCities = entry.tile.cities.some((city) => city.toLowerCase().includes(query));
      const inName = entry.tile.name.toLowerCase().includes(query);
      return inCities || inName;
    });
  }, [tiles, statusFilter, cityInput, selectedCity]);

  const selectedTile = selectedTileSlug ? tileBySlug.get(selectedTileSlug) ?? null : null;

  const uniqueCities = useMemo(() => {
    const citySet = new Set<string>();
    tiles.forEach((entry) => {
      entry.tile.cities.forEach((city) => {
        if (city) citySet.add(city);
      });
    });
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [tiles]);

  const matchingCities = useMemo(() => {
    if (!cityInput.trim()) {
      return uniqueCities.slice(0, 6);
    }
    const query = cityInput.trim().toLowerCase();
    return uniqueCities
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 6);
  }, [cityInput, uniqueCities]);

  const selectedTiles = useMemo(
    () => Object.values(tileSelections),
    [tileSelections],
  );

  const handleAssignMapRef = useCallback(() => {
    const api = (window as any)[`maplibre_${MAP_ID}`] as MapLibreMapRef | undefined;
    if (api) {
      mapApiRef.current = api;
      return true;
    }
    return false;
  }, []);

  const recalcMapLayers = useCallback(
    (tile: TileApiEntry | null, location: { lat: number; lng: number } | null) => {
      const api = mapApiRef.current;
      if (!api) return;

      const features: Feature[] = [];

      if (tile?.tile.geometry) {
        api.addGeoJsonLayer({
          id: TILE_LAYER_ID,
          data: tile.tile.geometry,
          fillColor: "#34d399",
          fillOpacity: 0.35,
          strokeColor: "#047857",
          strokeWidth: 2.5,
        });
        features.push(...tile.tile.geometry.features);
      } else {
        api.removeLayer(TILE_LAYER_ID);
      }

      if (location) {
        const locationGeometry = buildCircleFeatureCollection(location.lng, location.lat);
        api.addGeoJsonLayer({
          id: LOCATION_LAYER_ID,
          data: locationGeometry,
          fillColor: "rgba(59,130,246,0.28)",
          fillOpacity: 0.2,
          strokeColor: "#1d4ed8",
          strokeWidth: 2,
        });
        features.push(...locationGeometry.features);
      } else {
        api.removeLayer(LOCATION_LAYER_ID);
      }

      if (features.length > 0) {
        api.fitToData(
          { type: "FeatureCollection", features },
          { padding: 60 },
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!mapApiRef.current) return;
    recalcMapLayers(selectedTile ?? null, userLocation);
  }, [selectedTile, userLocation, recalcMapLayers]);

  const handleUseLocation = useCallback(() => {
    if (locationLoading) return;
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Location services are not available in this browser.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
        toast.success("Pinned your current location on the map.");
      },
      (geoError) => {
        console.error("geolocation error", geoError);
        setLocationLoading(false);
        toast.error("We couldn't access your location—allow permission and try again.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [locationLoading]);

  const addTileSelection = useCallback((entry: TileApiEntry) => {
    setTileSelections((prev) => {
      if (prev[entry.tile.slug]) return prev;
      const defaults: TileSelection = {
        tile: entry,
        weekdays: [1, 3, 5],
        window: "FULL",
        maxStops: entry.tile.status === "LIVE" ? 20 : 10,
      };
      return {
        ...prev,
        [entry.tile.slug]: defaults,
      };
    });
  }, []);

  const removeTileSelection = useCallback((slug: string) => {
    setTileSelections((prev) => {
      if (!prev[slug]) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }, []);

  const toggleWeekday = useCallback((slug: string, weekday: number, enabled: boolean) => {
    setTileSelections((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      const nextDays = new Set(current.weekdays);
      if (enabled) {
        nextDays.add(weekday);
      } else {
        nextDays.delete(weekday);
      }
      return {
        ...prev,
        [slug]: {
          ...current,
          weekdays: Array.from(nextDays).sort((a, b) => a - b),
        },
      };
    });
  }, []);

  const updateWindow = useCallback((slug: string, window: AvailabilityWindow) => {
    setTileSelections((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return {
        ...prev,
        [slug]: {
          ...current,
          window,
        },
      };
    });
  }, []);

  const updateMaxStops = useCallback((slug: string, value: number | null) => {
    setTileSelections((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return {
        ...prev,
        [slug]: {
          ...current,
          maxStops: value,
        },
      };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedVehicle = vehicleDetail.trim();

    if (!trimmedName) {
      toast.error("Please share your full name so we know who to follow up with.");
      return;
    }

    if (!trimmedEmail) {
      toast.error("Email is required so we can send onboarding steps.");
      return;
    }

    if (!trimmedVehicle) {
      toast.error("Let us know what vehicle you'll be using for route coverage.");
      return;
    }

    if (selectedTiles.length === 0) {
      toast.error("Pick at least one tile you can support.");
      return;
    }

    if (!backgroundConsent || !termsConsent) {
      toast.error("Please confirm the background check authorization and terms.");
      return;
    }

    const selectionSnapshot: TileSelection[] = selectedTiles.map((selection) => ({
      tile: selection.tile,
      weekdays: [...selection.weekdays],
      window: selection.window,
      maxStops: selection.maxStops,
    }));

    const availability = selectionSnapshot.flatMap((selection) =>
      selection.weekdays.map((weekday) => ({
        tileSlug: selection.tile.tile.slug,
        weekday,
        window: selection.window,
        maxStops:
          typeof selection.maxStops === "number" && Number.isFinite(selection.maxStops)
            ? Math.max(1, Math.min(60, Math.round(selection.maxStops)))
            : undefined,
      })),
    );

    if (!availability.length) {
      toast.error("Select at least one weekday you can cover.");
      return;
    }

    const homeBaseCity = (selectedCity ?? cityInput).trim();
    const homeBaseZip = homeZip.trim();
    const homeBaseAddress = homeAddress.trim();

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() || undefined,
      vehicleDetail: trimmedVehicle,
      insuranceProofUrl: insuranceProofUrl.trim() || undefined,
      availability,
      homeBaseAddress: homeBaseAddress || undefined,
      homeBaseCity: homeBaseCity || undefined,
      homeBaseZip: /^\d{5}$/.test(homeBaseZip) ? homeBaseZip : undefined,
      location: userLocation ?? undefined,
      backgroundConsent,
      termsConsent,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/scoopers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || (result && (result as any).ok === false)) {
        const message =
          (result as any)?.error
          || (result as any)?.message
          || "Unable to submit application";
        throw new Error(message);
      }

      toast.success("Application received! We'll reach out with next steps.");
      setSubmittedApplication({
        name: trimmedName,
        email: trimmedEmail,
        profile: (result as any)?.profile ?? null,
        selections: selectionSnapshot,
      });
    } catch (submissionError) {
      console.error(submissionError);
      toast.error(
        submissionError instanceof Error
          ? submissionError.message
          : "Unexpected error submitting your application",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    cityInput,
    email,
    homeAddress,
    homeZip,
    insuranceProofUrl,
    name,
    phone,
    selectedCity,
    selectedTiles,
    submitting,
    backgroundConsent,
    termsConsent,
    userLocation,
    vehicleDetail,
  ]);

  if (submittedApplication) {
    const statusKey = (submittedApplication.profile?.status ?? "APPLICANT").toUpperCase();
    const statusMeta = SCOOPER_STATUS_META[statusKey] ?? {
      label: statusKey.replaceAll("_", " "),
      description: "We’ll keep you posted as the operations team reviews your application.",
      badgeClass: "bg-slate-500/15 text-slate-700 border border-slate-400/30",
    };

    const backgroundKey = (submittedApplication.profile?.backgroundCheckStatus ?? "NOT_SUBMITTED").toUpperCase();
    const backgroundMeta = BACKGROUND_STATUS_META[backgroundKey] ?? {
      label: backgroundKey.replaceAll("_", " "),
      description: "We’ll follow up if additional screening steps are required.",
      badgeClass: "bg-slate-200 text-slate-700 border border-slate-300",
    };

    const formatWeekdays = (values: number[]) =>
      [...values]
        .sort((a, b) => a - b)
        .map((value) => WEEKDAY_LABEL_BY_VALUE.get(value)?.slice(0, 3) ?? `Day ${value}`)
        .join(", ") || "—";

    const formatWindow = (value: AvailabilityWindow) =>
      AVAILABILITY_WINDOW_LABEL_BY_VALUE.get(value) ?? value;

    const signInHref = `/signin?callbackUrl=${encodeURIComponent("/field-tech/profile")}&method=magic&email=${encodeURIComponent(submittedApplication.email)}`;

    return (
      <div className="space-y-6 px-4 py-6">
        <Card className="border border-emerald-500/30 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-900/20">
          <CardHeader>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                  Application submitted
                </CardTitle>
                <CardDescription className="text-sm text-emerald-800/80 dark:text-emerald-100/70">
                  Thanks {submittedApplication.name.split(" ")[0] || "there"}! We’ve logged everything and will keep you posted as coverage opens up.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusMeta.badgeClass)}>
                <Sparkles className="h-3.5 w-3.5" />
                {statusMeta.label}
              </span>
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", backgroundMeta.badgeClass)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {backgroundMeta.label}
              </span>
            </div>
            <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">{statusMeta.description}</p>
            <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm text-emerald-900 shadow-sm ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-500/40">
              <Mail className="h-4 w-4" />
              We’ll email updates to <span className="font-semibold">{submittedApplication.email}</span>. Use that address when requesting a magic sign-in link.
            </div>
            <div className="space-y-2 rounded-2xl border border-emerald-200/60 bg-white/75 p-4 text-sm text-slate-700 shadow-sm dark:border-emerald-500/40 dark:bg-slate-900/50 dark:text-slate-200">
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">1</span>
                <p>Request or open a magic link from the sign-in page to access your Field Tech profile.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">2</span>
                <p>Track your certification checklist and update availability directly from the profile once activated.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">3</span>
                <p>Ops will reach out if we need insurance evidence or to fast-track a tile that’s close to going live.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage preferences</CardTitle>
            <CardDescription>What you told us you can support once routes open.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submittedApplication.selections.map((selection) => {
              const tileStatusMeta = STATUS_META[selection.tile.tile.status];
              const advisory = selection.tile.readiness?.advisoryReasons?.[0] ?? null;
              return (
                <div
                  key={selection.tile.tile.slug}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {selection.tile.tile.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selection.tile.tile.cities.slice(0, 3).join(", ") || "Tile coverage"}
                      </p>
                    </div>
                    <Badge className={cn("text-xs font-medium", tileStatusMeta.badgeClass)}>
                      {tileStatusMeta.label}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/90 p-3 shadow-inner dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-widest text-slate-400">Weekdays</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                        {formatWeekdays(selection.weekdays)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/90 p-3 shadow-inner dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-widest text-slate-400">Preferred window</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                        {formatWindow(selection.window)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/90 p-3 shadow-inner dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-widest text-slate-400">Max stops</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                        {selection.maxStops ?? "Use dispatch default"}
                      </p>
                    </div>
                  </div>
                  {advisory ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{advisory}</p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>Your profile is created and will unlock once operations review the tile coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              You can sign in with your email now—if you don’t have a password yet, use the “Email me a magic link” option. Once certified, we’ll surface training modules, gear checklists, and route offers straight from the Field Tech profile.
            </p>
            <p>
              Need to tweak anything? Reply to the confirmation email or submit another application below.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="min-w-[220px]">
            <Link href={signInHref}>Sign in to track status</Link>
          </Button>
          <Button variant="outline" onClick={resetForm} className="min-w-[180px]">
            Submit another application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="space-y-2">
        <Badge variant="outline" className="border-brand-mint/50 text-brand-mint">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Become a scooper
        </Badge>
        <h1 className="font-serif text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Join the InsightScoop team
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tell us where you can scoop and earn $20-30/hour. We'll confirm certification requirements and dispatch tiles as they move from waitlist to live coverage.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>We’ll use this to spin up your field-tech profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="applicant-name">Full name</Label>
            <Input
              id="applicant-name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jordan Ramirez"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicant-email">Email</Label>
            <Input
              id="applicant-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicant-phone">Phone (optional)</Label>
            <Input
              id="applicant-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="555-555-5555"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-detail">Vehicle + hauling setup</Label>
            <Textarea
              id="vehicle-detail"
              value={vehicleDetail}
              onChange={(event) => setVehicleDetail(event.target.value)}
              placeholder="E.g. 2020 Ford Transit with locking bins, onboard deodorizer, liners stocked"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insurance-proof">Insurance proof URL (optional)</Label>
            <Input
              id="insurance-proof"
              type="url"
              value={insuranceProofUrl}
              onChange={(event) => setInsuranceProofUrl(event.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Home base & coverage map</CardTitle>
          <CardDescription>Enter your home base to pin your location and compare against each tile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="home-address">Home base address</Label>
            <AddressAutocomplete
              value={homeAddress}
              onChange={(value) => setHomeAddress(value)}
              onSelect={({ formattedAddress, city, postalCode, latitude, longitude }) => {
                setHomeAddress(formattedAddress);
                if (city) {
                  setSelectedCity(city);
                  setCityInput(city);
                }
                if (postalCode) {
                  setHomeZip(postalCode);
                }
                if (typeof latitude === "number" && typeof longitude === "number") {
                  setUserLocation({ lat: latitude, lng: longitude });
                }
              }}
              placeholder="123 Main St"
              className="rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use your full address to help us map the best tiles near you.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="home-city">City you’ll launch from</Label>
            <Input
              id="home-city"
              value={cityInput}
              onChange={(event) => {
                setCityInput(event.target.value);
                setSelectedCity(null);
              }}
              placeholder="Minneapolis"
            />
            {matchingCities.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {matchingCities.map((city) => (
                  <Button
                    type="button"
                    key={city}
                    size="sm"
                    variant={selectedCity === city ? "default" : "outline"}
                    className={cn(
                      "rounded-full text-xs",
                      selectedCity === city
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600",
                    )}
                    onClick={() => {
                      setSelectedCity(city);
                      setCityInput(city);
                    }}
                  >
                    {city}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="home-zip">Home ZIP (optional)</Label>
            <Input
              id="home-zip"
              inputMode="numeric"
              maxLength={5}
              value={homeZip}
              onChange={(event) => setHomeZip(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="55403"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Compass className="mr-2 h-4 w-4" />
              )}
              Use my location
            </Button>
            {userLocation ? (
              <p className="text-xs text-slate-500">
                Locked at {userLocation.lat.toFixed(3)}, {userLocation.lng.toFixed(3)}
              </p>
            ) : null}
          </div>

          <div className="h-80 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40">
            <MapLibreMap
              id={MAP_ID}
              className="h-full w-full"
              onLoad={() => {
                if (!handleAssignMapRef()) {
                  setTimeout(() => {
                    handleAssignMapRef();
                    recalcMapLayers(selectedTile ?? null, userLocation);
                  }, 150);
                } else {
                  recalcMapLayers(selectedTile ?? null, userLocation);
                }
              }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Green shows the tile footprint. Share your location to see how far the tile sits from your base.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select tiles you can cover</CardTitle>
          <CardDescription>Add live tiles to scoop now or waitlist tiles to be first in when coverage unlocks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1 space-y-1">
              <Label>Status filter</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="LIVE">Live now</SelectItem>
                  <SelectItem value="WAITLIST">Waitlist</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUSPENDED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("ALL");
                  setCityInput("");
                  setSelectedCity(null);
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset filters
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              We couldn’t load tile data. Refresh the page or try again shortly.
            </div>
          ) : statusFilteredTiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              No tiles match those filters yet. Clear filters or pick another city.
            </div>
          ) : (
            <div className="space-y-4">
              {statusFilteredTiles.map((entry) => {
                const statusInfo = STATUS_META[entry.tile.status];
                const selected = Boolean(tileSelections[entry.tile.slug]);
                const activeScoopers = entry.latestSnapshot?.activeScoopers ?? 0;
                const coverageCopy = entry.readiness.unmetScooperCount > 0
                  ? `${Math.max(entry.tile.minCertifiedScoopers - activeScoopers, 0)} more certified needed`
                  : "Scooper coverage ready";
                const stopsCopy = entry.latestSnapshot
                  ? `${entry.latestSnapshot.scheduledStops} weekly stops`
                  : "Stops data pending";

                return (
                  <div
                    key={entry.tile.slug}
                    className={cn(
                      "rounded-2xl border p-5 transition",
                      selected
                        ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/60 dark:bg-emerald-500/10"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {entry.tile.name}
                          </h3>
                          <Badge className={cn("text-xs font-medium", statusInfo.badgeClass)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {statusInfo.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/70">
                            <Sparkles className="h-3.5 w-3.5" />
                            {coverageCopy}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/70">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {stopsCopy}
                          </span>
                          {entry.tile.cities.length ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/70">
                              <MapPin className="h-3.5 w-3.5" />
                              {entry.tile.cities.slice(0, 2).join(", ")}
                              {entry.tile.cities.length > 2 ? " +" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTileSlug(entry.tile.slug);
                            recalcMapLayers(entry, userLocation);
                          }}
                        >
                          <Target className="mr-2 h-4 w-4" />
                          View coverage
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "secondary"}
                          onClick={() => {
                            if (selected) {
                              removeTileSelection(entry.tile.slug);
                            } else {
                              addTileSelection(entry);
                            }
                          }}
                        >
                          {selected ? (
                            <Trash2 className="mr-2 h-4 w-4" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          {selected ? "Remove" : "Add to my coverage"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your availability</CardTitle>
          <CardDescription>Tune the weekdays and window for each tile so dispatch knows when to route you in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              Add a tile above to configure availability.
            </div>
          ) : (
            selectedTiles.map((selection) => (
              <div
                key={selection.tile.tile.slug}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {selection.tile.tile.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selection.tile.tile.status === "WAITLIST"
                        ? "We’ll fast-track your onboarding once this tile flips live."
                        : "Expect offers as soon as schedules open."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTileSelection(selection.tile.tile.slug)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Weekdays you can scoop</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {WEEKDAYS.map((day) => {
                        const checked = selection.weekdays.includes(day.value);
                        return (
                          <label
                            key={day.value}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                              checked
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleWeekday(
                                  selection.tile.tile.slug,
                                  day.value,
                                  value === true,
                                )
                              }
                            />
                            {day.label.slice(0, 3)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred window</Label>
                    <Select
                      value={selection.window}
                      onValueChange={(value) =>
                        updateWindow(selection.tile.tile.slug, value as AvailabilityWindow)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABILITY_WINDOWS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1 pt-2">
                      <Label htmlFor={`max-stops-${selection.tile.tile.slug}`}>
                        Max stops per shift (optional)
                      </Label>
                      <Input
                        id={`max-stops-${selection.tile.tile.slug}`}
                        type="number"
                        min={5}
                        max={60}
                        value={selection.maxStops ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateMaxStops(
                            selection.tile.tile.slug,
                            value ? Math.max(5, Math.min(60, Number.parseInt(value, 10))) : null,
                          );
                        }}
                        placeholder="20"
                      />
                      <p className="text-xs text-slate-500">
                        Helps dispatch balance density across tiles. Leave blank to accept system defaults.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consents</CardTitle>
          <CardDescription>
            We need authorization to run screening and confirm you agree to the Scooper Marketplace Terms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <Checkbox
              checked={backgroundConsent}
              onCheckedChange={(value) => setBackgroundConsent(value === true)}
              className="mt-0.5"
            />
            <span>
              I authorize InsightScoop to run background checks and verify my eligibility for the marketplace.
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <Checkbox
              checked={termsConsent}
              onCheckedChange={(value) => setTermsConsent(value === true)}
              className="mt-0.5"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/scooper-terms"
                className="font-semibold text-brand-coral underline-offset-2 hover:underline dark:text-brand-mint"
              >
                Scooper Marketplace Terms
              </Link>
              , safety expectations, and quality policies.
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 left-0 right-0 flex justify-end bg-gradient-to-t from-white via-white/90 to-transparent pb-4 pt-6 dark:from-slate-950 dark:via-slate-950/90">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || isLoading}
          className="min-w-[220px]"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <HandShakeIcon className="mr-2 h-5 w-5" />
          )}
          Submit application
        </Button>
      </div>
    </div>
  );
}

function HandShakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M12 12 8 8a2 2 0 0 1 2.83-2.83l1.65 1.66 1.65-1.66A2 2 0 0 1 17.96 8l-4 4" />
      <path d="M20 16.5 16.5 20l-3.17-3.17" />
      <path d="M4 19.5l5.5-5.5" />
      <path d="M8 22 2 16l4-4" />
      <path d="m22 16-4-4" />
    </svg>
  );
}
