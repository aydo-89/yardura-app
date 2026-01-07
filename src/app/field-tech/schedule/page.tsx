"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import type maplibregl from "maplibre-gl";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { addDays, format, formatDistanceToNow, isSameDay, startOfDay } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  SkipForward,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FIELD_OPS_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import {
  extractPreferredTimeWindow,
  type PreferredTimeWindowSlug,
} from "@/lib/time-window";
import { formatPhoneNumber } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import SinglePhotoCamera from "@/app/field-tech/components/SinglePhotoCamera";
import { useTheme } from "@/components/theme/ThemeProvider";
import type {
  MapLibreMapProps,
  MapLibreMapRef,
} from "@/components/maps/MapLibreMap";

type VisitStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "SKIPPED";

type VisitMediaType =
  | "ARRIVAL"
  | "INSIGHTSCOOP"
  | "PROOF"
  | "GATE"
  | "ISSUE"
  | "OTHER";

type VisitGeo = {
  latitude: number;
  longitude: number;
  source: string;
};

type TravelSegment = {
  distanceMeters: number;
  durationSeconds: number;
  origin?: string;
  destination?: string;
  geometry?: [number, number][] | null;
};

type RouteSummary = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

type VisitCommunication = {
  id: string;
  templateId: string | null;
  status: string;
  statusDetail: string | null;
  createdAt: string;
  sentAt: string | null;
};

type VisitAccessState = {
  allowed: boolean;
  reason?: string;
};

const CHECKLIST_DEFAULTS = {
  uniform: false,
  scooperKit: false,
  mount: false,
  remote: false,
  glovesReady: false,
  sanitizer: false,
  deodorizer: false,
  deodorizerSprayer: false,
  bags: false,
} as const;

type ChecklistKey = keyof typeof CHECKLIST_DEFAULTS;

const CHECKLIST_KEYS = Object.keys(CHECKLIST_DEFAULTS) as ChecklistKey[];

function buildChecklistFlagState<T extends boolean>(value: T) {
  return CHECKLIST_KEYS.reduce(
    (acc, key) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<ChecklistKey, T>,
  );
}

type SkipReason = {
  id: string;
  code: string;
  label: string;
  description: string | null;
};

type VisitListItem = {
  id: string;
  scheduledDate: string;
  status: VisitStatus;
  job?: {
    id: string;
    frequency: string;
    primaryScooperId?: string | null;
  } | null;
  customer: {
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
    phone: string | null;
    email: string | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
  media: Array<{ id: string; assetType: VisitMediaType }>;
  metadata?: Record<string, unknown> | null;
  preferredTimeWindowLabel?: string | null;
  preferredTimeWindowSlug?: PreferredTimeWindowSlug | null;
  geo?: VisitGeo | null;
  travelFromPrevious?: TravelSegment | null;
  navigationUrl?: string | null;
  communications?: VisitCommunication[];
  routeSequence?: number | null;
  revenueCents?: number | null;
  payoutCents?: number | null;
};

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPLIBRE_FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
const MAP_STYLE_LIGHT = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : MAPLIBRE_FALLBACK_STYLE;
const MAP_STYLE_DARK = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/toner-v2/style.json?key=${MAPTILER_KEY}`
  : MAP_STYLE_LIGHT;
const MAP_STYLE_SATELLITE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
  : null;
const MAP_STYLE_OPTIONS = {
  light: { label: "Light", url: MAP_STYLE_LIGHT },
  dark: { label: "Dark", url: MAP_STYLE_DARK },
  satellite: { label: "Satellite", url: MAP_STYLE_SATELLITE },
} as const;
type MapStyleKey = keyof typeof MAP_STYLE_OPTIONS;

const MapLibreMap = dynamic<MapLibreMapProps>(
  () => import("@/components/maps/MapLibreMap"),
  { ssr: false },
);

type ScopeKey = "today" | "tomorrow" | "upcoming";
type ScopeView = "list" | "map";

const SCOPE_ORDER: ScopeKey[] = ["today", "tomorrow", "upcoming"];

function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

function formatDistance(meters?: number | null): string {
  if (!meters || meters <= 0) return "—";
  const miles = metersToMiles(meters);
  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  const precision = miles < 10 ? 2 : 1;
  return `${miles.toFixed(precision)} mi`;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatFrequencyLabel(frequency?: string | null): string {
  if (!frequency) return "recurring";
  return frequency.toLowerCase().replaceAll("_", " ");
}

function formatDogSummary(
  dogs?: Array<{ name: string; breed?: string | null }>,
): string | null {
  if (!dogs?.length) return null;
  const label = dogs.length === 1 ? "Dog" : "Dogs";
  const names = dogs
    .map((dog) => {
      if (!dog.name) return null;
      return dog.breed ? `${dog.name} (${dog.breed})` : dog.name;
    })
    .filter((value): value is string => Boolean(value));
  if (!names.length) return `${label}: ${dogs.length}`;
  const preview = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  const suffix = remaining > 0 ? ` +${remaining} more` : "";
  return `${label}: ${dogs.length} • ${preview}${suffix}`;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatCurrencyFromCents(cents?: number | null): string {
  if (typeof cents !== "number") return "—";
  return currencyFormatter.format(cents / 100);
}

const ON_WAY_TEMPLATE_IDS = ["on_way_sms_v1", "on_way_email_v1"];

const CHECKLIST_ITEMS: Array<{
  key: keyof typeof CHECKLIST_DEFAULTS;
  label: string;
  description: string;
  fallback?: string;
}> = [
  {
    key: "uniform",
    label: "Uniform + badge",
    description: "Hat, hoodie/shirt, and badge visible in the selfie.",
    fallback: "Missing pieces? Ping ops before rolling so we can restock you.",
  },
  {
    key: "scooperKit",
    label: "Scooper + bucket/bin",
    description: "Standard scooper head with bucket or approved backup container.",
    fallback: "If you forgot the scooper, grab a clean bucket or container before starting routes.",
  },
  {
    key: "mount",
    label: "Phone mount secured",
    description: "Clamp tightened and aimed at the bucket.",
    fallback: "If the mount failed, keep the device steady and capture every sample manually.",
  },
  {
    key: "remote",
    label: "Bluetooth remote paired",
    description: "Remote paired or volume buttons ready for captures.",
    fallback: "If the remote is missing, tap the shutter on screen or use the volume-up button each time.",
  },
  {
    key: "glovesReady",
    label: "Fresh gloves + PPE stocked",
    description: "Disposable gloves (plus backups) ready so you can swap between every yard.",
    fallback: "No gloves? Restock immediately—visits cannot finish without PPE.",
  },
  {
    key: "sanitizer",
    label: "Kennel-grade sanitizer + sprayer",
    description: "Approved disinfectant and sprayer ready for between-stop cleaning.",
    fallback: "You must restock before routes—sanitation proof is required to finish a visit.",
  },
  {
    key: "deodorizer",
    label: "Pet-safe deodorizing enzymes",
    description: "Approved enzyme deodorizer loaded per route notes.",
    fallback: "Restock before visits if you’re out so we can keep yards smelling fresh.",
  },
  {
    key: "deodorizerSprayer",
    label: "Dedicated deodorizer sprayer",
    description: "Carry a second sprayer that’s only for enzymes so sanitizer stays uncontaminated.",
    fallback: "Grab a spare sprayer before routes—odor control needs its own bottle.",
  },
  {
    key: "bags",
    label: "Liners & disposal bags",
    description: "Fresh liners and spare bags staged with you.",
    fallback: "Grab liners/bags before leaving HQ—never leave waste behind without them.",
  },
];

const DAILY_CHECK_KEY = "insightscoop-daily-checkin-date" as const;
const gearCheckEndpoint = "/api/field-tech/gear-check" as const;

function getBrowserTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.length > 0 ? timeZone : null;
  } catch {
    return null;
  }
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCheckDate(value: string) {
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(value);
}

function isTodayValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(new Date());
}

function computeVisitRouteSummary(visits: VisitListItem[]): RouteSummary | null {
  if (!visits.length) {
    return null;
  }

  const ordered = [...visits].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
  );

  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  // Sum up all travelFromPrevious segments
  ordered.forEach((visit) => {
    const segment = visit.travelFromPrevious;
    if (segment && typeof segment === "object") {
      if (typeof segment.distanceMeters === "number" && segment.distanceMeters > 0) {
        totalDistanceMeters += segment.distanceMeters;
      }
      if (typeof segment.durationSeconds === "number" && segment.durationSeconds > 0) {
        totalDurationSeconds += segment.durationSeconds;
      }
    }
  });

  if (totalDistanceMeters === 0 && totalDurationSeconds === 0) {
    return null;
  }

  return {
    totalDistanceMeters,
    totalDurationSeconds,
  } satisfies RouteSummary;
}

export default function FieldTechVisitsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [globalRouteSummary, setGlobalRouteSummary] = useState<RouteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [activeScope, setActiveScope] = useState<ScopeKey>("today");
  const [scopeViews, setScopeViews] = useState<Record<ScopeKey, ScopeView>>({
    today: "list",
    tomorrow: "list",
    upcoming: "list",
  });
  const [scopeVisitIndices, setScopeVisitIndices] = useState<Record<ScopeKey, number>>({
    today: 0,
    tomorrow: 0,
    upcoming: 0,
  });
  const [skipReasons, setSkipReasons] = useState<SkipReason[]>([]);
  const [skipDialog, setSkipDialog] = useState<{ open: boolean; visitId: string | null; scope: ScopeKey | null }>({
    open: false,
    visitId: null,
    scope: null,
  });
  const [selectedSkipReason, setSelectedSkipReason] = useState<string>("");
  const [skipNote, setSkipNote] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [handoffDialog, setHandoffDialog] = useState<{
    open: boolean;
    visitId: string | null;
    jobId: string | null;
  }>({ open: false, visitId: null, jobId: null });
  const [handoffScope, setHandoffScope] = useState<"visit" | "job">("visit");
  const [handoffReason, setHandoffReason] = useState("");
  const [handoffChecks, setHandoffChecks] = useState({
    availability: false,
    scope: false,
    policy: false,
  });
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [checkInInitialized, setCheckInInitialized] = useState(false);
  const [checkInLoggedToday, setCheckInLoggedToday] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  const [checkInCameraOpen, setCheckInCameraOpen] = useState(false);
  const [checkInPreviewUrl, setCheckInPreviewUrl] = useState<string | null>(null);
  const [checkInPhotoFile, setCheckInPhotoFile] = useState<File | null>(null);
  const [checkInChecklist, setCheckInChecklist] = useState({ ...CHECKLIST_DEFAULTS });
  const [checkInMissing, setCheckInMissing] = useState<Record<ChecklistKey, boolean>>(() =>
    buildChecklistFlagState(false),
  );
  const hasCompletedDailyCheckIn = checkInInitialized && checkInLoggedToday;
  const requiresDailyCheckInGate = !checkInInitialized || !checkInLoggedToday;
const [stopViewMode, setStopViewMode] = useState<"carousel" | "compact">("carousel");

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/field-tech");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !FIELD_OPS_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }

    setAuthorized(true);
  }, [session, status, router]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/field-tech/visits`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        let message = payload?.message || payload?.error || "Unable to load visits";
        if (payload?.error === "home_anchor_missing") {
          message = "Add your home address on the Profile tab so we can optimize your routes.";
        } else if (payload?.error === "insufficient_route_credits") {
          message = "You need more route credits before requesting that custom route. Contact dispatch to top up.";
        }
        throw new Error(message);
      }

      const data = await response.json();

      const visitsPayload = (data.visits ?? []).map((visit: any) => {
        const { slug, label } = extractPreferredTimeWindow(
          visit.metadata,
          visit.preferredTimeWindowLabel ?? null,
        );

        const communications: VisitCommunication[] = (visit.communications ?? []).map(
          (communication: any) => ({
            id: communication.id,
            templateId: communication.templateId ?? null,
            status: communication.status,
            statusDetail: communication.statusDetail ?? null,
            createdAt: communication.createdAt,
            sentAt: communication.sentAt ?? null,
          }),
        );

        return {
          ...visit,
          customer: visit.customer
            ? {
                ...visit.customer,
                phone: visit.customer.phone ?? null,
                email: visit.customer.email ?? null,
              }
            : null,
          communications,
          job: visit.job
            ? {
                id: visit.job.id,
                frequency: visit.job.frequency,
                primaryScooperId: visit.job.primaryScooperId ?? null,
              }
            : null,
          preferredTimeWindowSlug: slug ?? visit.preferredTimeWindowSlug ?? null,
          preferredTimeWindowLabel: label ?? visit.preferredTimeWindowLabel ?? null,
          routeSequence: typeof visit.routeSequence === "number" ? visit.routeSequence : null,
          revenueCents: typeof visit.revenueCents === "number" ? visit.revenueCents : null,
          payoutCents:
            typeof visit.projectedPayoutCents === "number"
              ? visit.projectedPayoutCents
              : null,
          travelFromPrevious: visit.travelFromPrevious ?? null,
          geo: visit.geo ?? null,
        } satisfies VisitListItem;
      });
      setVisits(visitsPayload);

      if (data.summary && typeof data.summary.totalDistanceMeters === "number") {
        setGlobalRouteSummary({
          totalDistanceMeters: data.summary.totalDistanceMeters,
          totalDurationSeconds: data.summary.totalDurationSeconds ?? 0,
        });
      } else {
        setGlobalRouteSummary(null);
      }
    } catch (err: any) {
      console.error("Failed to load technician visits", err);
      const message = err?.message ?? "Unknown error";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    void loadVisits();
  }, [authorized, loadVisits]);

  useEffect(() => {
    if (!authorized) return;
    void loadVisits();
  }, [authorized, loadVisits]);

  useEffect(() => {
    if (!authorized) return;
    const loadReasons = async () => {
      try {
        const response = await fetch("/api/field-tech/skip-reasons");
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? "Unable to load skip reasons");
        }
        setSkipReasons(json.skipReasons ?? []);
      } catch (err) {
        console.error("field-tech.skip-reasons", err);
      }
    };
    void loadReasons();
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const initializeCheckIn = async () => {
      let remoteDate: string | null = null;

      try {
        const timeZone = getBrowserTimeZone();
        const response = await fetch(gearCheckEndpoint, {
          cache: "no-store",
          headers: timeZone ? { "X-Time-Zone": timeZone } : undefined,
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.lastGearCheckAt) {
          remoteDate = payload.lastGearCheckAt as string;
        }
      } catch (error) {
        console.error("daily-check.fetch", error);
      }

      let storedDate: string | null = null;
      if (typeof window !== "undefined") {
        storedDate = window.localStorage.getItem(DAILY_CHECK_KEY);
      }

      const trackedDate = remoteDate ?? storedDate;
      const loggedToday = isTodayValue(trackedDate);

      if (!cancelled) {
        setCheckInLoggedToday(loggedToday);
        setLastCheckInAt(trackedDate ?? null);
        setCheckInInitialized(true);
        if (remoteDate && typeof window !== "undefined") {
          window.localStorage.setItem(DAILY_CHECK_KEY, remoteDate);
        }
      }
    };

    void initializeCheckIn();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const submitDailyCheckIn = async (
    file: File,
    checklistData: Record<string, boolean>,
  ) => {
    setCheckInSubmitting(true);
    setCheckInError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("checklist", JSON.stringify(checklistData));
      const timeZone = getBrowserTimeZone();
      const response = await fetch(gearCheckEndpoint, {
        method: "POST",
        body: formData,
        headers: timeZone ? { "X-Time-Zone": timeZone } : undefined,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to record check-in");
      }

      const iso = payload?.lastGearCheckAt ?? new Date().toISOString();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DAILY_CHECK_KEY, iso);
      }

      setCheckInLoggedToday(true);
      setLastCheckInAt(iso);
      setCheckInInitialized(true);
      toast.success("Checked in for today. You're ready to scoop!");
    } catch (error: any) {
      console.error("daily-check.submit", error);
      const message = error?.message ?? "Unable to record check-in";
      setCheckInError(message);
      toast.error(message);
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const handleDailyCheckIn = () => {
    resetCheckInDialogState();
    setCheckInCameraOpen(true);
  };

  const handleCameraCapture = async (file: File) => {
    setCheckInPhotoFile(file);
    setCheckInError(null);
    const objectUrl = URL.createObjectURL(file);
    setCheckInPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  };

  const handleRetakePhoto = () => {
    if (checkInPreviewUrl) {
      URL.revokeObjectURL(checkInPreviewUrl);
    }
    setCheckInPreviewUrl(null);
    setCheckInPhotoFile(null);
    setCheckInChecklist({ ...CHECKLIST_DEFAULTS });
    setCheckInMissing(buildChecklistFlagState(false));
    setCheckInError(null);
  };

  const handleChecklistToggle = (key: ChecklistKey, value: boolean) => {
    setCheckInChecklist((prev) => ({ ...prev, [key]: value }));
    if (value) {
      setCheckInMissing((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleChecklistMissingToggle = (key: ChecklistKey) => {
    setCheckInMissing((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checklistComplete = useMemo(
    () => Object.values(checkInChecklist).every(Boolean),
    [checkInChecklist],
  );

  const handleCheckInSubmit = async () => {
    if (!checkInPhotoFile) {
      toast.error("Capture your check-in selfie first.");
      return;
    }
    if (!checklistComplete) {
      toast.error("Confirm every checklist item before continuing.");
      return;
    }
    try {
      await submitDailyCheckIn(checkInPhotoFile, checkInChecklist);
      setCheckInCameraOpen(false);
      resetCheckInDialogState();
    } catch (error) {
      console.error("daily-check.submit", error);
    }
  };

  const handleCheckInDialogChange = (open: boolean) => {
    if (!open) {
      setCheckInCameraOpen(false);
      resetCheckInDialogState();
    } else {
      setCheckInCameraOpen(true);
    }
  };

  const lastCheckInRelative = useMemo(() => {
    if (!lastCheckInAt) return null;
    const date = new Date(lastCheckInAt);
    if (Number.isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  }, [lastCheckInAt]);

  useEffect(() => {
    return () => {
      if (checkInPreviewUrl) {
        URL.revokeObjectURL(checkInPreviewUrl);
      }
    };
  }, [checkInPreviewUrl]);

  const resetCheckInDialogState = () => {
    if (checkInPreviewUrl) {
      URL.revokeObjectURL(checkInPreviewUrl);
    }
    setCheckInPreviewUrl(null);
    setCheckInPhotoFile(null);
    setCheckInChecklist({ ...CHECKLIST_DEFAULTS });
    setCheckInMissing(buildChecklistFlagState(false));
    setCheckInError(null);
  };

  const upcoming = useMemo(
    () =>
      visits.filter(
        (visit) => visit.status === "SCHEDULED" || visit.status === "IN_PROGRESS",
      ),
    [visits],
  );

  const orderedUpcoming = useMemo(() => {
    const comparator = (a: VisitListItem, b: VisitListItem) => {
      const seqA = typeof a.routeSequence === "number" ? a.routeSequence : null;
      const seqB = typeof b.routeSequence === "number" ? b.routeSequence : null;
      if (seqA !== null && seqB !== null && seqA !== seqB) {
        return seqA - seqB;
      }
      if (seqA !== null && seqB === null) {
        return -1;
      }
      if (seqA === null && seqB !== null) {
        return 1;
      }
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    };
    return [...upcoming].sort(comparator);
  }, [upcoming]);

  const groupedVisits = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);

    const todayKey = todayStart.getTime();
    const tomorrowKey = tomorrowStart.getTime();

    const groups: Record<ScopeKey, VisitListItem[]> = {
      today: [],
      tomorrow: [],
      upcoming: [],
    };

    orderedUpcoming.forEach((visit) => {
      const visitTime = startOfDay(new Date(visit.scheduledDate)).getTime();
      if (visitTime === todayKey) {
        groups.today.push(visit);
      } else if (visitTime === tomorrowKey) {
        groups.tomorrow.push(visit);
      } else if (visitTime > tomorrowKey) {
        groups.upcoming.push(visit);
      }
    });

    return groups;
  }, [orderedUpcoming]);

  useEffect(() => {
    setScopeVisitIndices((prev) => {
      let changed = false;
      const next: Record<ScopeKey, number> = { ...prev };
      SCOPE_ORDER.forEach((scope) => {
        const maxIndex = groupedVisits[scope].length > 0 ? groupedVisits[scope].length - 1 : 0;
        if ((next[scope] ?? 0) > maxIndex) {
          next[scope] = maxIndex;
          changed = true;
        }
        if ((next[scope] ?? 0) < 0) {
          next[scope] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [groupedVisits]);

  const scopeMeta: Record<ScopeKey, { label: string; helper: string }> = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);
    const upcomingStart = addDays(todayStart, 2);

    return {
      today: {
        label: "Today",
        helper: format(todayStart, "EEE, MMM d"),
      },
      tomorrow: {
        label: "Tomorrow",
        helper: format(tomorrowStart, "EEE, MMM d"),
      },
      upcoming: {
        label: "Upcoming",
        helper: `${format(upcomingStart, "MMM d")}+`,
      },
    } satisfies Record<ScopeKey, { label: string; helper: string }>;
  }, []);

  const emptyStateCopy: Record<ScopeKey, { title: string; description: string }> = {
    today: {
      title: "No active visits",
      description: "You're all caught up. Completed visits live in Dispatch if you need them.",
    },
    tomorrow: {
      title: "No visits scheduled for tomorrow",
      description: "Once dispatch publishes tomorrow's route it will appear here.",
    },
    upcoming: {
      title: "Nothing booked beyond tomorrow",
      description: "Future assignments will land here after dispatch builds new routes.",
    },
  };

  const scopedVisits = groupedVisits[activeScope];
  const scopeSummary = useMemo(() => {
    // Try to compute from scoped visits first
    const computed = computeVisitRouteSummary(scopedVisits);

    // Debug logging
    if (activeScope === "today" && scopedVisits.length > 0) {
      const sampleTravel = scopedVisits
        .filter(v => v.travelFromPrevious)
        .slice(0, 3)
        .map(v => ({
          visitId: v.id,
          travel: v.travelFromPrevious,
          distanceType: typeof (v.travelFromPrevious as any)?.distanceMeters,
          durationType: typeof (v.travelFromPrevious as any)?.durationSeconds,
        }));
      console.log(`[field-tech.schedule] Today scope summary:`, {
        visitCount: scopedVisits.length,
        visitsWithTravelData: scopedVisits.filter(v => v.travelFromPrevious).length,
        computedSummary: computed,
        globalSummary: globalRouteSummary,
        firstVisit: scopedVisits[0]?.id,
        firstVisitTravel: scopedVisits[0]?.travelFromPrevious,
        sampleTravelData: sampleTravel,
      });
    }

    if (computed) {
      return computed;
    }

    // Fall back to the global summary (typically today) so drive load isn't blank
    if (globalRouteSummary) {
      return globalRouteSummary;
    }

    return null;
  }, [scopedVisits, activeScope, globalRouteSummary]);

  const scopeHasGeo = useMemo(() => scopedVisits.some((visit) => !!visit.geo), [scopedVisits]);

  const activeScopeMeta = scopeMeta[activeScope];
  const activeScopeView = scopeViews[activeScope];
  const handleScopeViewChange = (view: ScopeView) => {
    setScopeViews((prev) => ({ ...prev, [activeScope]: view }));
  };
  const activeScopeIndex = scopeVisitIndices[activeScope] ?? 0;
  const safeActiveIndex = scopedVisits.length
    ? Math.min(Math.max(activeScopeIndex, 0), scopedVisits.length - 1)
    : 0;
  const isVisitComplete = (visit?: VisitListItem | null) =>
    !visit || visit.status === "COMPLETED" || visit.status === "SKIPPED" || visit.status === "CANCELLED";
  const firstIncompleteIndex = scopedVisits.findIndex((visit) => !isVisitComplete(visit));
  const maxUnlockedIndex = firstIncompleteIndex === -1 ? scopedVisits.length - 1 : firstIncompleteIndex;
  const activeVisit = scopedVisits[safeActiveIndex] ?? null;
  const isTodayScope = activeScope === "today";
  const isVisitToday = activeVisit ? isSameDay(new Date(activeVisit.scheduledDate), new Date()) : false;
  const visitDate = activeVisit ? new Date(activeVisit.scheduledDate) : null;
  const getLatestOnWayCommunication = (visit: VisitListItem) =>
    visit.communications?.find((communication) => 
      ON_WAY_TEMPLATE_IDS.includes(communication.templateId ?? "")
    ) ?? null;
  const visitUnlocked = !activeVisit || safeActiveIndex <= maxUnlockedIndex || isVisitComplete(activeVisit);
  const activeVisitLatestOnWay = activeVisit ? getLatestOnWayCommunication(activeVisit) : null;
  const onWaySent = Boolean(activeVisitLatestOnWay);
  const activeVisitArrivalStatus = activeVisitLatestOnWay?.status ?? null;
  const activeVisitPhone = activeVisit?.customer?.phone ?? null;
  const activeVisitNormalizedPhone = activeVisitPhone ? normalizePhone(activeVisitPhone) : null;
  const activeVisitFormattedPhone = activeVisitPhone ? formatPhoneNumber(activeVisitPhone) : null;
  const activeVisitEmail = activeVisit?.customer?.email ?? null;
  const activeVisitHasContact = Boolean(activeVisitNormalizedPhone || activeVisitEmail);
  const activeVisitContactMethod = activeVisitNormalizedPhone ? "text" : (activeVisitEmail ? "email" : null);
  const activeVisitPayoutCents = activeVisit?.payoutCents ?? null;
  const activeVisitJob = activeVisit?.job ?? null;
  const activeVisitFrequencyLabel = activeVisitJob?.frequency
    ? formatFrequencyLabel(activeVisitJob.frequency)
    : null;
  const activeVisitJobOwnerId = activeVisitJob?.primaryScooperId ?? null;
  const isJobOwner = Boolean(
    activeVisitJobOwnerId && session?.user?.id && activeVisitJobOwnerId === session.user.id,
  );
  const isJobOwnedByAnother = Boolean(
    activeVisitJobOwnerId && session?.user?.id && activeVisitJobOwnerId !== session.user.id,
  );
  const canReleaseVisit = Boolean(activeVisit && activeVisit.status === "SCHEDULED");
  const canReleaseJob = Boolean(
    canReleaseVisit && isJobOwner && activeVisitJob?.id && activeVisitJob.frequency !== "ONE_TIME",
  );
  const visitReleaseCommitment = isJobOwnedByAnother
    ? "This route stays with its current owner."
    : activeVisitJob?.id
      ? "Your recurring route remains assigned unless you release the job."
      : "No recurring schedule is affected.";
  const visitReleaseGuidance = isJobOwnedByAnother
    ? "Late releases within 48 hours are limited to five per quarter. The recurring route stays with its owner—message dispatch if you need to exit the route entirely."
    : "Late releases within 48 hours are limited to five per quarter. Early releases (48+ hours) have a higher allowance. If you can’t maintain the recurring schedule, release the entire job instead.";
  const canConfirmHandoff =
    handoffChecks.availability && handoffChecks.scope && handoffChecks.policy;
  const handoffSummary =
    handoffScope === "job"
      ? {
          title: "Release recurring job",
          description: `Removes all upcoming ${activeVisitFrequencyLabel ?? "recurring"} visits from your route.`,
          commitment: "Future visits return to the offer board for reassignment.",
        }
      : {
          title: "Release this visit",
          description: "Returns this single visit to the offer board.",
          commitment: visitReleaseCommitment,
        };
  const handoffScopeLabel = handoffScope === "job" ? "recurring job" : "visit";
  const computeVisitAccessState = useCallback(
    (visit: VisitListItem, index: number): VisitAccessState => {
      if (!visit) {
        return { allowed: false };
      }
      if (!hasCompletedDailyCheckIn) {
        return { allowed: false, reason: "Complete your daily check-in first." };
      }
      const visitDateValue = new Date(visit.scheduledDate);
      const dateIsValid = !Number.isNaN(visitDateValue.getTime());
      const visitIsToday = dateIsValid && isSameDay(visitDateValue, new Date());
      const visitIsComplete = isVisitComplete(visit);
      if (!visitIsToday && !visitIsComplete) {
        return {
          allowed: false,
          reason: dateIsValid
            ? `Visit opens ${format(visitDateValue, "EEE, MMM d")}`
            : "Visit window unavailable yet.",
        };
      }
      const sequenceUnlocked = index <= maxUnlockedIndex || visitIsComplete;
      if (!sequenceUnlocked) {
        return { allowed: false, reason: "Complete earlier stops first." };
      }
      const hasOnWay = Boolean(getLatestOnWayCommunication(visit));
      if (!hasOnWay) {
        return { allowed: false, reason: "Send the on-the-way text first." };
      }
      return { allowed: true };
    },
    [hasCompletedDailyCheckIn, maxUnlockedIndex],
  );
  const handleOpenVisit = useCallback(
    (visit: VisitListItem, index: number) => {
      const gate = computeVisitAccessState(visit, index);
      if (!gate.allowed) {
        if (gate.reason) {
          toast.error(gate.reason);
        }
        return;
      }
      router.push(`/field-tech/visits/${visit.id}`);
    },
    [computeVisitAccessState, router],
  );
  const handleVisitSelect = useCallback((index: number) => {
    setScopeVisitIndices((prev) => {
      if (scopedVisits.length === 0) return prev;
      const clamped = Math.min(Math.max(index, 0), scopedVisits.length - 1);
      if (clamped === (prev[activeScope] ?? 0)) {
        return prev;
      }
      return { ...prev, [activeScope]: clamped };
    });
  }, [activeScope, scopedVisits.length]);
  const handleVisitNav = (direction: "prev" | "next") => {
    setScopeVisitIndices((prev) => {
      const current = prev[activeScope] ?? 0;
      if (scopedVisits.length === 0) return prev;
      const delta = direction === "next" ? 1 : -1;
      const target = Math.min(
        Math.max(current + delta, 0),
        scopedVisits.length - 1,
      );
      if (target === current) return prev;
      return { ...prev, [activeScope]: target };
    });
  };

  const openSkipDialog = () => {
    if (!activeVisit) return;
    setSelectedSkipReason("");
    setSkipNote("");
    setSkipDialog({ open: true, visitId: activeVisit.id, scope: activeScope });
  };

  const closeSkipDialog = () => {
    setSkipDialog({ open: false, visitId: null, scope: null });
    setSelectedSkipReason("");
    setSkipNote("");
  };

  const openHandoffDialog = () => {
    if (!activeVisit || !canReleaseVisit) return;
    setHandoffDialog({
      open: true,
      visitId: activeVisit.id,
      jobId: activeVisit.job?.id ?? null,
    });
    setHandoffScope("visit");
    setHandoffReason("");
    setHandoffChecks({
      availability: false,
      scope: false,
      policy: false,
    });
    setHandoffError(null);
  };

  const closeHandoffDialog = () => {
    setHandoffDialog({ open: false, visitId: null, jobId: null });
    setHandoffReason("");
    setHandoffChecks({
      availability: false,
      scope: false,
      policy: false,
    });
    setHandoffError(null);
  };

  const handleHandoffScopeChange = (value: "visit" | "job") => {
    if (value === "job" && !canReleaseJob) {
      return;
    }
    setHandoffScope(value);
    setHandoffChecks((prev) => ({ ...prev, scope: false }));
  };

  const handleSkipVisit = async () => {
    if (!skipDialog.visitId) {
      toast.error("Select a visit to skip");
      return;
    }
    if (!selectedSkipReason) {
      toast.error("Choose a skip reason");
      return;
    }
    setSkipping(true);
    try {
      const response = await fetch(`/api/field-tech/visits/${skipDialog.visitId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonId: selectedSkipReason, note: skipNote.trim() || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to skip visit");
      }
      setVisits((prev) =>
        prev.map((item) =>
          item.id === skipDialog.visitId ? { ...item, status: "SKIPPED" } : item,
        ),
      );
      toast.success("Visit skipped");
      const scope = skipDialog.scope;
      if (scope) {
        setScopeVisitIndices((prev) => {
          const current = prev[scope] ?? 0;
          const scopeVisits = groupedVisits[scope] ?? [];
          if (scopeVisits.length === 0) {
            return { ...prev, [scope]: 0 };
          }
          const nextIndex = Math.min(current + 1, scopeVisits.length - 1);
          return { ...prev, [scope]: nextIndex };
        });
      }
      closeSkipDialog();
    } catch (error: any) {
      console.error("skip.visit", error);
      toast.error(error?.message ?? "Unable to skip visit");
    } finally {
      setSkipping(false);
    }
  };

  const handleHandoffSubmit = async () => {
    if (!handoffDialog.visitId) {
      setHandoffError("Select a visit to release");
      return;
    }
    if (handoffScope === "job" && !handoffDialog.jobId) {
      setHandoffError("This visit is not tied to a recurring job.");
      return;
    }

    setHandoffSubmitting(true);
    setHandoffError(null);

    const endpoint =
      handoffScope === "job"
        ? `/api/field-tech/jobs/${handoffDialog.jobId}/handoff`
        : `/api/field-tech/visits/${handoffDialog.visitId}/handoff`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: handoffReason.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const message = payload?.message ?? payload?.error ?? "Unable to release this work.";
        setHandoffError(message);
        toast.error(message);
        return;
      }

      toast.success(
        handoffScope === "job"
          ? "Recurring job released back to the offer board."
          : "Visit released back to the offer board.",
      );
      closeHandoffDialog();
      void loadVisits();
    } catch (error: any) {
      const message = error?.message ?? "Unable to release this work.";
      setHandoffError(message);
      toast.error(message);
    } finally {
      setHandoffSubmitting(false);
    }
  };

  const handleSkipDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeSkipDialog();
      return;
    }
    setSkipDialog((prev) => ({ ...prev, open: true }));
  };

  const handleSendOnWay = async (visit: VisitListItem) => {
    if (!hasCompletedDailyCheckIn) {
      toast.error("Complete your daily check-in before messaging customers.");
      return;
    }
    if (!isSameDay(new Date(visit.scheduledDate), new Date())) {
      toast.error("You can send on-the-way notifications on the day of the visit");
      return;
    }

    const hasPhone = Boolean(normalizePhone(visit.customer?.phone));
    const hasEmail = Boolean(visit.customer?.email);
    if (!hasPhone && !hasEmail) {
      toast.error("No contact info on file for this customer");
      return;
    }

    setSendingSmsId(visit.id);
    try {
      const response = await fetch(`/api/field-tech/visits/${visit.id}/arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includePetReminder: true }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to send on-the-way message");
      }

      if (json.communication) {
        const communication = json.communication as VisitCommunication;
        setVisits((prev) =>
          prev.map((item) =>
            item.id === visit.id
              ? {
                  ...item,
                  communications: [
                    communication,
                    ...(item.communications ?? []),
                  ],
                }
              : item,
          ),
        );
      }

      const channel = json.channel === "EMAIL" ? "email" : "text";
      toast.success(`On-the-way ${channel} sent to the customer`);
    } catch (error: any) {
      console.error("field-tech.on-way", error);
      toast.error(error?.message ?? "Unable to send on-the-way message");
    } finally {
      setSendingSmsId(null);
    }
  };

  if (!authorized) {
    if (session === undefined) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 bg-slate-50 dark:bg-slate-950 px-4 text-slate-900 dark:text-white">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">Field routes</h1>
            <p className="text-sm text-slate-600 dark:text-white/70">Loading today&apos;s assignments…</p>
          </header>
          <Skeleton className="h-32 w-full bg-white/80 dark:bg-white/10" />
        </main>
      );
    }

    return null;
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <Dialog open={checkInCameraOpen} onOpenChange={handleCheckInDialogChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily check-in</DialogTitle>
            <DialogDescription>
              Capture a fresh selfie in full gear, then confirm your equipment before starting routes.
            </DialogDescription>
          </DialogHeader>

          {!checkInPhotoFile ? (
            <div className="space-y-4">
              <SinglePhotoCamera
                onCapture={handleCameraCapture}
                label="Center yourself in the guide"
                capturedImageUrl={undefined}
                uploading={checkInSubmitting}
                defaultFacing="user"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lighting tip: Face a window or bright area to keep the badge and hat clearly visible.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/70 bg-slate-100 p-3 dark:border-white/15 dark:bg-white/5">
                {checkInPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkInPreviewUrl}
                    alt="Check-in preview"
                    className="h-64 w-full rounded-2xl object-cover"
                  />
                ) : null}
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={handleRetakePhoto}
                  disabled={checkInSubmitting}
                >
                  Retake selfie
                </Button>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Gear checklist
                </p>
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {CHECKLIST_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                    >
                      <Checkbox
                        checked={checkInChecklist[item.key]}
                        onCheckedChange={(checked) =>
                          handleChecklistToggle(item.key, checked === true)
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold">{item.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {item.description}
                        </span>
                        {!checkInChecklist[item.key] ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              handleChecklistMissingToggle(item.key);
                            }}
                            className="mt-2 inline-flex text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-300"
                          >
                            {checkInMissing[item.key] ? "I’ve restocked this" : "I don’t have this right now"}
                          </button>
                        ) : null}
                        {checkInMissing[item.key] && item.fallback ? (
                          <span className="mt-2 block rounded-2xl border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100">
                            {item.fallback}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                {!checklistComplete ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    Complete every checklist item to continue.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {checkInError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
              {checkInError}
            </p>
          ) : null}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleCheckInDialogChange(false)}
              disabled={checkInSubmitting}
            >
              Cancel
            </Button>
            {checkInPhotoFile ? (
              <Button
                className="flex-1"
                onClick={handleCheckInSubmit}
                disabled={checkInSubmitting || !checklistComplete}
              >
                {checkInSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Posting check-in…
                  </span>
                ) : (
                  "Submit check-in"
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),_transparent_55%)]" />

      <header className="shrink-0 border-b border-slate-200/70 dark:border-white/10 px-4 pb-4 pt-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Field routes</h1>
        <p className="text-sm text-slate-600 dark:text-white/70">
          Capture required proof, finish QA checkpoints, and keep customers updated from a single view.
        </p>
      </header>

      <div className="shrink-0 px-4 pb-4 pt-3 space-y-3">
        {!checkInInitialized ? (
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking your daily check-in status…</span>
          </div>
        ) : checkInLoggedToday && lastCheckInRelative ? (
          <div className="flex items-center gap-3 rounded-3xl border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-semibold">Checked in for today</p>
              <p className="text-xs">Logged {lastCheckInRelative}.</p>
            </div>
          </div>
        ) : null}

        <div>
          <Tabs
            value={activeScope}
            onValueChange={(value) => setActiveScope(value as ScopeKey)}
            className="w-full"
          >
            <TabsList className="grid h-11 w-full grid-cols-3 gap-1 rounded-full bg-white dark:bg-white/5 p-1 text-slate-600 dark:text-white/70">
              {SCOPE_ORDER.map((scope) => {
                const meta = scopeMeta[scope];
                const isActive = scope === activeScope;
                const count = groupedVisits[scope].length;
                return (
                  <TabsTrigger
                    key={scope}
                    value={scope}
                    disabled={loading}
                    className="flex h-9 items-center justify-between gap-2 rounded-full px-3 text-sm font-medium transition-colors data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 data-[state=active]:shadow"
                  >
                    <span>{meta.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive ? "bg-white/60 dark:bg-white/30 text-slate-950" : "bg-white/80 dark:bg-white/10 text-slate-600 dark:text-white/70"
                      }`}
                    >
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <p className="mt-2 text-xs text-slate-500 dark:text-white/60">{activeScopeMeta.helper}</p>
        </div>
      </div>

      <section className="flex-1 overflow-hidden px-4 pb-6">
        {loading ? (
          <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-3xl border border-dashed border-slate-200/60 dark:border-white/15 p-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-32 w-full bg-white/80 dark:bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">Something went wrong</CardTitle>
                <CardDescription className="text-slate-600 dark:text-white/70">{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => window.location.reload()}>Reload</Button>
              </CardContent>
            </Card>
          </div>
        ) : requiresDailyCheckInGate ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md rounded-3xl border border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              <CardHeader>
                <CardTitle>
                  {checkInInitialized
                    ? "Complete your daily check-in"
                    : "Verifying your daily check-in"}
                </CardTitle>
                <CardDescription className="text-amber-800/80 dark:text-amber-100/70">
                  {checkInInitialized
                    ? "Upload today’s selfie and confirm your gear to unlock the route controls."
                    : "Hang tight while we confirm today’s check-in status."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {checkInError ? (
                  <p className="rounded-2xl border border-amber-400/60 bg-white/70 p-3 text-sm font-semibold text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50">
                    {checkInError}
                  </p>
                ) : null}
                {checkInInitialized ? (
                  <Button onClick={handleDailyCheckIn} className="rounded-full">
                    Start check-in
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-200/60 bg-white/70 px-3 py-2 text-sm text-amber-900 dark:border-white/10 dark:bg-white/5 dark:text-amber-50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for your latest check-in…
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : scopedVisits.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">{emptyStateCopy[activeScope].title}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-white/70">{emptyStateCopy[activeScope].description}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4">
            <FieldTechRouteSummary
              visits={scopedVisits}
              summary={scopeSummary}
              scopeLabel={activeScopeMeta.label}
            />
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white">
              <Tabs
                value={activeScopeView}
                onValueChange={(value) => handleScopeViewChange(value as ScopeView)}
                className="flex h-full flex-col"
              >
                <TabsList className="m-3 grid h-10 grid-cols-2 gap-1 rounded-full bg-white/80 dark:bg-white/10 p-1 text-slate-600 dark:text-white/70">
                  <TabsTrigger
                    value="list"
                    className="h-8 rounded-full px-3 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
                  >
                    Stops
                  </TabsTrigger>
                  <TabsTrigger
                    value="map"
                    className="h-8 rounded-full px-3 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
                  >
                    Map
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="list"
                  className="mt-0 flex flex-1 flex-col overflow-hidden px-3 pb-4"
                >
                  {activeVisit ? (
                    <div className="flex h-full flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">
                        {stopViewMode === "carousel" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <span>Stop {safeActiveIndex + 1} of {scopedVisits.length || 1}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Previous stop"
                                disabled={safeActiveIndex === 0}
                                onClick={() => handleVisitNav("prev")}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Next stop"
                                disabled={safeActiveIndex >= scopedVisits.length - 1}
                                onClick={() => handleVisitNav("next")}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs normal-case text-slate-500 dark:text-white/60">
                            List view shows stops at a glance. Switch to carousel to interact with a stop.
                          </p>
                        )}
                        <div className="inline-flex rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 p-0.5">
                          {["carousel", "compact"].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                stopViewMode === mode
                                  ? "bg-emerald-500 text-slate-950 shadow"
                                  : "text-slate-500 hover:text-emerald-700 dark:text-white/70"
                              }`}
                              onClick={() => setStopViewMode(mode as "carousel" | "compact")}
                            >
                              {mode === "carousel" ? "Carousel" : "List"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {stopViewMode === "compact" ? (
                        <>
                          <FieldTechVisitCompactList
                            visits={scopedVisits}
                            activeIndex={safeActiveIndex}
                            onSelect={handleVisitSelect}
                            showOpenButton
                            onOpenVisit={handleOpenVisit}
                            getVisitAccessState={computeVisitAccessState}
                          />
                          <p className="text-[11px] text-slate-500 dark:text-white/60">
                            Need to send texts or log samples? Switch back to carousel view.
                          </p>
                        </>
                      ) : (
                        <div className="flex-1 overflow-y-auto">
                          <Card className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                              <div className="space-y-1">
                              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                                {activeVisit.customer?.name ?? "Client"}
                              </CardTitle>
                              <CardDescription className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                                  {activeVisit.preferredTimeWindowLabel || "Window TBD"}
                                </span>
                                <span className="normal-case">
                                  {format(new Date(activeVisit.scheduledDate), "eee MMM d h:mmaaa")}
                                </span>
                              </CardDescription>
                              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                                {activeVisitPayoutCents != null
                                  ? `Pays ${formatCurrencyFromCents(activeVisitPayoutCents)}`
                                  : "Payout to be assigned"}
                              </p>
                              {activeVisit.customer?.addressLine1 ? (
                                <p className="text-xs text-slate-500 dark:text-white/60">
                                  {activeVisit.customer.addressLine1}
                                  {activeVisit.customer?.city ? `, ${activeVisit.customer.city}` : ""}
                                </p>
                              ) : null}
                              {formatDogSummary(activeVisit.customer?.dogs) ? (
                                <p className="text-xs text-slate-500 dark:text-white/60">
                                  {formatDogSummary(activeVisit.customer?.dogs)}
                                </p>
                              ) : null}
                            {activeVisitFormattedPhone ? (
                              <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/70">
                                <Phone className="h-4 w-4 text-slate-500 dark:text-white/60" aria-hidden="true" />
                                <a
                                  href={activeVisitNormalizedPhone ? `tel:${activeVisitNormalizedPhone}` : undefined}
                                  className="font-medium text-slate-900 dark:text-white underline-offset-2 hover:underline"
                                >
                                  {activeVisitFormattedPhone}
                                </a>
                              </p>
                            ) : null}
                            </div>
                            <Badge variant={activeVisit.status === "IN_PROGRESS" ? "default" : "secondary"}>
                              {activeVisit.status.replace("_", " ")}
                            </Badge>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-3 pt-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/60">
                              <span>Photos captured: {activeVisit.media.length}</span>
                              {activeVisit.travelFromPrevious ? (
                                <span>
                                  Drive from last stop: {formatDistance(activeVisit.travelFromPrevious.distanceMeters)} • {formatDuration(activeVisit.travelFromPrevious.durationSeconds)}
                                </span>
                              ) : (
                                <span>Route kickoff stop</span>
                              )}
                            </div>
                            {activeVisit.navigationUrl ? (
                              <Button
                                variant="outline"
                                asChild
                                className="group w-full rounded-2xl border-slate-200/60 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white transition hover:border-emerald-400/60 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100"
                              >
                                <a
                                  href={activeVisit.navigationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2"
                                >
                                  <MapPin className="h-4 w-4 text-emerald-500 transition group-hover:text-emerald-700 dark:text-emerald-200 dark:group-hover:text-emerald-100" />
                                  Open in Google Maps
                                </a>
                              </Button>
                            ) : null}
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="secondary"
                                className="w-full rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border disabled:border-slate-200/70 dark:border-white/10 disabled:bg-white/80 dark:bg-white/10 disabled:text-slate-500 dark:text-white/50"
                                disabled={
                                  sendingSmsId === activeVisit.id ||
                                  !activeVisitHasContact ||
                                  !isVisitToday ||
                                  !visitUnlocked ||
                                  onWaySent ||
                                  !hasCompletedDailyCheckIn
                                }
                                onClick={() => handleSendOnWay(activeVisit)}
                              >
                                {sendingSmsId === activeVisit.id
                                  ? `Sending on-the-way ${activeVisitContactMethod ?? "message"}...`
                                  : onWaySent
                                    ? `On-the-way ${activeVisitContactMethod ?? "message"} sent`
                                    : `Send on-the-way ${activeVisitContactMethod ?? "message"}`}
                              </Button>
                              {activeVisitHasContact ? (
                                !isVisitToday ? (
                                  <p className="text-[11px] text-slate-500 dark:text-white/60">Arrival notifications unlock on the day of the visit.</p>
                                ) : onWaySent ? (
                                  <p className="text-[11px] text-slate-500 dark:text-white/60">
                                    Sent {formatDistanceToNow(new Date(activeVisitLatestOnWay?.sentAt ?? activeVisitLatestOnWay?.createdAt ?? new Date().toISOString()), { addSuffix: true })}
                                    {activeVisitArrivalStatus ? ` • ${activeVisitArrivalStatus.toLowerCase()}` : ""}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-slate-500 dark:text-white/60">
                                    Let the customer know you&apos;re on the way{activeVisitContactMethod === "email" ? " via email" : ""}.
                                  </p>
                                )
                              ) : (
                                <p className="text-[11px] text-amber-600">No contact info on file for this customer.</p>
                              )}
                           </div>
                           <div className="flex flex-col gap-2 pt-1">
                              {visitUnlocked ? (
                                isVisitToday ? (
                                  onWaySent ? (
                                    <Button
                                      className="w-full"
                                      onClick={() => activeVisit && handleOpenVisit(activeVisit, safeActiveIndex)}
                                      disabled={!hasCompletedDailyCheckIn}
                                    >
                                      Open visit
                                    </Button>
                                  ) : (
                                    <Button className="w-full" disabled>
                                      Send on-the-way {activeVisitContactMethod ?? "message"} to unlock
                                    </Button>
                                  )
                                ) : (
                                  <Button className="w-full rounded-2xl border border-slate-200/60 dark:border-white/15 bg-white/80 dark:bg-white/10 text-slate-500 dark:text-white/60" disabled>
                                    Opens {visitDate ? format(visitDate, "EEE, MMM d") : "soon"}
                                  </Button>
                                )
                              ) : (
                                <Button className="w-full" disabled>
                                  Complete earlier stops to unlock
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                className="w-full rounded-2xl border-white/20 bg-white text-slate-900 dark:bg-white/10 dark:text-white transition hover:border-emerald-400/60 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/20 dark:hover:text-rose-100 disabled:cursor-not-allowed disabled:border-slate-200/60 dark:border-white/15 disabled:bg-white dark:bg-white/5 disabled:text-slate-400 dark:text-white/40"
                                onClick={openSkipDialog}
                                disabled={!visitUnlocked || skipReasons.length === 0 || !isVisitToday || !hasCompletedDailyCheckIn}
                              >
                                <SkipForward className="mr-2 h-4 w-4" />
                                Skip this visit
                              </Button>
                              {!visitUnlocked ? (
                                <p className="flex items-center gap-2 text-[11px] text-amber-600">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Complete earlier stops to unlock this visit.
                                </p>
                              ) : !isVisitToday ? (
                                <p className="text-[11px] text-slate-500 dark:text-white/60">You can manage skips on the day of the visit.</p>
                              ) : !onWaySent ? (
                                <p className="text-[11px] text-amber-600">
                                  Send the on-the-way {activeVisitContactMethod ?? "message"} to unlock visit controls.
                                </p>
                              ) : skipReasons.length === 0 ? (
                                <p className="text-[11px] text-slate-500 dark:text-white/60">Dispatch hasn&apos;t configured skip reasons yet.</p>
                              ) : null}
                              <Button
                                variant="outline"
                                className="w-full rounded-2xl border-rose-200/80 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-200/60 dark:disabled:border-white/15 disabled:bg-white dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-white/40"
                                onClick={openHandoffDialog}
                                disabled={!canReleaseVisit || handoffSubmitting}
                              >
                                Release to offer board
                              </Button>
                              {canReleaseVisit ? (
                                <p className="text-[11px] text-slate-500 dark:text-white/60">
                                  Need to drop this stop? Release it back to the offer board.
                                  {canReleaseJob
                                    ? " You can also choose to release the entire recurring job in the dialog."
                                    : ""}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-500 dark:text-white/60">
                                  Release is available for scheduled visits.
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-white/60">
                      No visits in this scope.
                    </div>
                  )}
                </TabsContent>
                <TabsContent
                  value="map"
                  className="mt-0 flex flex-1 min-h-0 flex-col overflow-hidden px-3 pb-4"
                >
                  {isTodayScope ? (
                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5">
                      {scopeHasGeo ? (
                        <div className="flex-1 min-h-[260px]">
                          <FieldTechRouteMap
                            visits={scopedVisits}
                            activeIndex={safeActiveIndex}
                            isActive={activeScopeView === "map"}
                          />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-white/60">
                          We&apos;ll render the route map once we have location data for these stops.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-6 text-center text-sm text-slate-500 dark:text-white/60">
                      Map view is available on the day of service once routing locks in.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </section>
      <Dialog open={skipDialog.open} onOpenChange={handleSkipDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip this visit</DialogTitle>
            <DialogDescription>
              Select a reason so dispatch and billing know why this stop was skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="font-semibold">Accountability reminder</p>
            <p className="mt-1 leading-relaxed">
              Skipping a visit is treated as a missed visit. Missed visits pause new offers after three per
              quarter. Late releases within 48 hours are capped separately.
            </p>
          </div>
          {skipReasons.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-white/60">
              No skip reasons available yet. Ask dispatch to configure them before skipping stops.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="skip-reason">Reason</Label>
                <Select
                  value={selectedSkipReason}
                  onValueChange={(value) => setSelectedSkipReason(value)}
                >
                  <SelectTrigger id="skip-reason">
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {skipReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="skip-note">Notes (optional)</Label>
                <Textarea
                  id="skip-note"
                  value={skipNote}
                  onChange={(event) => setSkipNote(event.target.value)}
                  rows={3}
                  placeholder="Add context the dispatcher or client should know."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSkipDialog} disabled={skipping}>
              Cancel
            </Button>
            <Button onClick={handleSkipVisit} disabled={skipping || skipReasons.length === 0}>
              {skipping ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Skipping…
                </span>
              ) : (
                "Confirm skip"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={handoffDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeHandoffDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handoffSummary.title}</DialogTitle>
            <DialogDescription>
              Return work to the offer board so another scooper can cover it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex flex-col gap-2">
              <Label htmlFor="handoff-scope">Release scope</Label>
              <Select
                value={handoffScope}
                onValueChange={(value) => handleHandoffScopeChange(value as "visit" | "job")}
              >
                <SelectTrigger id="handoff-scope">
                  <SelectValue placeholder="Choose scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visit">This visit only</SelectItem>
                  {canReleaseJob ? (
                    <SelectItem value="job">Entire recurring job</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                What happens next
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {handoffSummary.description}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {handoffSummary.commitment}
              </p>
              {handoffScope === "job" && activeVisitFrequencyLabel ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Schedule: {activeVisitFrequencyLabel}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">Accountability reminder</p>
            <p className="mt-1 leading-relaxed">
                Late releases within 48 hours are capped at five per quarter. Early releases have a wider
                allowance, and recurring job releases are capped separately.
            </p>
            </div>

            {handoffScope === "visit" ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Release limits</p>
                <p className="mt-1 leading-relaxed">
                  {visitReleaseGuidance}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="handoff-reason">Reason (optional)</Label>
              <Textarea
                id="handoff-reason"
                value={handoffReason}
                onChange={(event) => setHandoffReason(event.target.value)}
                rows={3}
                placeholder="Share context for dispatch (optional)."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="handoff-availability"
                  checked={handoffChecks.availability}
                  onCheckedChange={(value) =>
                    setHandoffChecks((prev) => ({
                      ...prev,
                      availability: value === true,
                    }))
                  }
                />
                <Label
                  htmlFor="handoff-availability"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  I can’t complete this {handoffScopeLabel} and need to release it.
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="handoff-scope-confirm"
                  checked={handoffChecks.scope}
                  onCheckedChange={(value) =>
                    setHandoffChecks((prev) => ({
                      ...prev,
                      scope: value === true,
                    }))
                  }
                />
                <Label
                  htmlFor="handoff-scope-confirm"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  I understand this releases the {handoffScopeLabel} back to the offer board.
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="handoff-policy"
                  checked={handoffChecks.policy}
                  onCheckedChange={(value) =>
                    setHandoffChecks((prev) => ({
                      ...prev,
                      policy: value === true,
                    }))
                  }
                />
                <Label
                  htmlFor="handoff-policy"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  I understand late releases are capped and repeated misses can pause offers or routes.
                </Label>
              </div>
            </div>

            {handoffError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>{handoffError}</p>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeHandoffDialog} disabled={handoffSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleHandoffSubmit}
              disabled={!canConfirmHandoff || handoffSubmitting || !canReleaseVisit}
            >
              {handoffSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Releasing…
                </span>
              ) : (
                "Release work"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FieldTechRouteSummary({
  visits,
  summary,
  scopeLabel,
}: {
  visits: VisitListItem[];
  summary: RouteSummary | null;
  scopeLabel: string;
}) {
  const nextVisit = visits[0];
  const totalStops = visits.length;
  
  // Use provided summary if available, otherwise compute from visits
  // If still null, try to use global summary proportionally
  const derivedSummary = summary ?? computeVisitRouteSummary(visits);
  
  // If no summary from visits, log warning
  if (!derivedSummary && visits.length > 0) {
    console.warn(`[field-tech.schedule] No summary for ${scopeLabel}:`, {
      visitCount: visits.length,
      visitsWithTravel: visits.filter(v => v.travelFromPrevious).length,
      firstVisitTravel: visits[0]?.travelFromPrevious,
    });
  }
  
  const totalDistance = derivedSummary ? formatDistance(derivedSummary.totalDistanceMeters) : "—";
  const totalDriveTime = derivedSummary ? formatDuration(derivedSummary.totalDurationSeconds) : "—";
  const totalPayoutCents = visits.reduce(
    (sum, visit) => sum + (visit.payoutCents ?? 0),
    0,
  );
  const avgPayoutCents = totalStops > 0 ? Math.round(totalPayoutCents / totalStops) : 0;

  return (
    <Card className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Route snapshot — {scopeLabel}</CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-white/60">
          {scopeLabel === "Today"
            ? "Follow the ordered queue. Jump to the map view if you need drive context."
            : `Preview how ${scopeLabel.toLowerCase()} is sequenced so you can plan ahead.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-white/60">Next stop</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {nextVisit.customer?.name ?? "Client"}
          </p>
          <p className="text-xs text-slate-500 dark:text-white/50">
            {format(new Date(nextVisit.scheduledDate), "eee MMM d, h:mmaaa")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-white/60">Drive load</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{totalDistance}</p>
          <p className="text-xs text-slate-500 dark:text-white/50">~{totalDriveTime} behind the wheel</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-white/60">Stops</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{totalStops}</p>
          <p className="text-xs text-slate-500 dark:text-white/50">Includes in-progress work</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-white/60">Projected payout</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {totalPayoutCents > 0 ? formatCurrencyFromCents(totalPayoutCents) : "—"}
          </p>
          <p className="text-xs text-slate-500 dark:text-white/50">
            {totalPayoutCents > 0
              ? `~${formatCurrencyFromCents(avgPayoutCents)} per stop`
              : "Add payouts to see estimates"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldTechVisitCompactList({
  visits,
  activeIndex,
  onSelect,
  showOpenButton = false,
  onOpenVisit,
  getVisitAccessState,
}: {
  visits: VisitListItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  showOpenButton?: boolean;
  onOpenVisit?: (visit: VisitListItem, index: number) => void;
  getVisitAccessState?: (visit: VisitListItem, index: number) => VisitAccessState;
}) {
  if (!visits.length) return null;

  const gridTemplate = showOpenButton
    ? "grid-cols-[52px,1fr,120px,90px,80px]"
    : "grid-cols-[52px,1fr,120px,90px]";

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(index);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5">
      <div className={`grid ${gridTemplate} gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60`}>
        <span>Stop</span>
        <span>Customer</span>
        <span>Window</span>
        <span className="text-right">Status</span>
        {showOpenButton ? <span className="text-right">Visit</span> : null}
      </div>
      <div className="divide-y divide-slate-200/70 dark:divide-white/10">
        {visits.map((visit, index) => {
          const stopNumber = typeof visit.routeSequence === "number" ? visit.routeSequence + 1 : index + 1;
          const visitDate = new Date(visit.scheduledDate);
          const scheduledLabel = format(visitDate, "h:mmaaa");
          const statusLabel = visit.status.replace(/_/g, " ");
          const isActive = index === activeIndex;
          const gateState = getVisitAccessState?.(visit, index);
          const actionDisabled = gateState ? !gateState.allowed : false;

          return (
            <div
              key={visit.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              className={`grid w-full ${gridTemplate} items-center gap-2 px-4 py-3 text-left text-sm transition hover:bg-emerald-50/70 dark:hover:bg-white/10 ${
                isActive ? "bg-emerald-50 dark:bg-emerald-500/10" : ""
              }`}
            >
              <span className="font-semibold text-slate-700 dark:text-white">
                #{stopNumber}
              </span>
              <span className="flex flex-col truncate text-slate-600 dark:text-white/80">
                <span className="truncate">{visit.customer?.name ?? "Client"}</span>
                {formatDogSummary(visit.customer?.dogs) ? (
                  <span className="truncate text-[11px] text-slate-500 dark:text-white/60">
                    {formatDogSummary(visit.customer?.dogs)}
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] text-slate-500 dark:text-white/70">
                {scheduledLabel}
              </span>
              <span className="flex justify-end">
                <Badge variant={visit.status === "SCHEDULED" ? "outline" : "secondary"} className="text-[11px] uppercase">
                  {statusLabel}
                </Badge>
              </span>
              {showOpenButton ? (
                <span className="flex justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (actionDisabled) return;
                      onOpenVisit?.(visit, index);
                    }}
                    disabled={actionDisabled}
                    title={gateState?.reason}
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                      actionDisabled
                        ? "cursor-not-allowed border-slate-200/70 text-slate-400 opacity-60 dark:border-white/10 dark:text-white/40"
                        : "border-slate-200/70 text-emerald-600 hover:bg-emerald-50 dark:border-white/20 dark:text-emerald-200"
                    }`}
                  >
                    {actionDisabled ? "Locked" : "Open"}
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldTechRouteMap({
  visits,
  activeIndex,
  isActive = true,
}: {
  visits: VisitListItem[];
  activeIndex: number;
  isActive?: boolean;
}) {
  const { theme } = useTheme();
  const mapIdRef = useRef<string>(
    `field-tech-route-map-${Math.random().toString(36).slice(2, 8)}`,
  );
  const mapId = mapIdRef.current;
  const mapApiRef = useRef<MapLibreMapRef | null>(null);
  const mapEventCleanupRef = useRef<(() => void) | null>(null);
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [styleOverrideUrl, setStyleOverrideUrl] = useState<string | null>(null);
  const styleOverrideRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<"upcoming" | "all">("upcoming");
  const manualStyleChangeRef = useRef(false);
  const [baseStyle, setBaseStyle] = useState<MapStyleKey>(
    theme === "dark" ? "dark" : "light",
  );
  const baseStyleRef = useRef<MapStyleKey>(baseStyle);
  const [mapError, setMapError] = useState<string | null>(null);
  const resolvedStyleUrl = styleOverrideUrl ?? MAP_STYLE_OPTIONS[baseStyle]?.url ?? MAPLIBRE_FALLBACK_STYLE;
  const styleKey = `${styleOverrideUrl ? "fallback" : baseStyle}-${resolvedStyleUrl}`;
  const stopsLayerId = `${mapId}-stops`;
  const stopLabelLayerId = `${mapId}-stops-labels`;
  const routeLayerId = `${mapId}-route`;

  const markMapReady = useCallback(() => {
    setMapReadyVersion((version) => version + 1);
  }, []);

  const orderedStops = useMemo(() => {
    const comparator = (a: { visit: VisitListItem }, b: { visit: VisitListItem }) => {
      const seqA = typeof a.visit.routeSequence === "number" ? a.visit.routeSequence : null;
      const seqB = typeof b.visit.routeSequence === "number" ? b.visit.routeSequence : null;
      if (seqA !== null && seqB !== null && seqA !== seqB) {
        return seqA - seqB;
      }
      if (seqA !== null && seqB === null) return -1;
      if (seqA === null && seqB !== null) return 1;
      return new Date(a.visit.scheduledDate).getTime() - new Date(b.visit.scheduledDate).getTime();
    };

    return visits
      .map((visit, idx) => ({ visit, originalIndex: idx }))
      .filter((entry) => entry.visit.geo)
      .sort(comparator)
      .map((entry, orderIndex) => ({ ...entry, orderIndex }));
  }, [visits]);

  const normalizedActiveIndex = useMemo(() => {
    if (!orderedStops.length) return 0;
    const activeVisit = visits[activeIndex];
    if (activeVisit) {
      const idx = orderedStops.findIndex((entry) => entry.visit.id === activeVisit.id);
      if (idx >= 0) {
        return idx;
      }
    }
    return 0;
  }, [orderedStops, activeIndex, visits]);

  const visibleStops = useMemo(() => {
    if (!orderedStops.length) return [];
    if (viewMode === "all") {
      return orderedStops;
    }
    if (!orderedStops.length) return [];
    const startIndex = Math.max(
      0,
      Math.min(normalizedActiveIndex, orderedStops.length - 1),
    );
    return orderedStops.slice(startIndex, startIndex + 3);
  }, [orderedStops, normalizedActiveIndex, viewMode]);

  const stopsGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    return {
      type: "FeatureCollection",
      features: visibleStops.map(({ visit, orderIndex }) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [visit.geo!.longitude, visit.geo!.latitude],
        },
        properties: {
          label: (visit.routeSequence ?? orderIndex) + 1,
          stopIndex: orderIndex,
          status:
            orderIndex === normalizedActiveIndex
              ? "active"
              : orderIndex < normalizedActiveIndex
                ? "complete"
                : "upcoming",
        },
      })),
    };
  }, [visibleStops, normalizedActiveIndex]);

  const routeGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    if (visibleStops.length <= 1) {
      return { type: "FeatureCollection", features: [] };
    }

    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 1; i < visibleStops.length; i += 1) {
      const current = visibleStops[i];
      const previous = visibleStops[i - 1];
      const geometry = current.visit.travelFromPrevious?.geometry;
      let coordinates: [number, number][] | null = null;
      if (geometry && geometry.length > 1) {
        coordinates = geometry;
      } else if (current.visit.geo && previous.visit.geo) {
        coordinates = [
          [previous.visit.geo.longitude, previous.visit.geo.latitude],
          [current.visit.geo.longitude, current.visit.geo.latitude],
        ];
      }
      if (!coordinates) continue;
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          legIndex: i - 1,
        },
      });
    }

    return { type: "FeatureCollection", features };
  }, [visibleStops]);

  const attachMapApi = useCallback(() => {
    if (typeof window === "undefined") return false;
    const api = (window as any)[`maplibre_${mapId}`] as MapLibreMapRef | undefined;
    if (!api || !api.map) {
      return false;
    }

    mapApiRef.current = api;
    const mapInstance = api.map;

    const handleStyleReady = () => {
      markMapReady();
    };

    const handleMapError = (event: any) => {
      const status = event?.error?.status ?? event?.error?.statusCode ?? null;
      const message =
        event?.error?.message ||
        event?.error?.statusText ||
        (status ? `Map tiles unavailable (${status})` : "Map tiles unavailable");
      setMapError(message);
      if (status === 404) {
        if (!styleOverrideRef.current) {
          setStyleOverrideUrl(MAPLIBRE_FALLBACK_STYLE);
        }
        if (baseStyleRef.current !== "light") {
          manualStyleChangeRef.current = true;
          setBaseStyle("light");
        }
      }
    };

    mapEventCleanupRef.current?.();
    mapInstance.on("style.load", handleStyleReady);
    mapInstance.on("load", handleStyleReady);
    mapInstance.on("error", handleMapError);
    mapEventCleanupRef.current = () => {
      mapInstance.off("style.load", handleStyleReady);
      mapInstance.off("load", handleStyleReady);
      mapInstance.off("error", handleMapError);
    };

    if (typeof mapInstance.isStyleLoaded === "function" && mapInstance.isStyleLoaded()) {
      markMapReady();
    }

    return true;
  }, [mapId, markMapReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (attachMapApi()) return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attachMapApi() || attempts > 40) {
        window.clearInterval(interval);
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [attachMapApi]);

  useEffect(() => {
    return () => {
      const api = mapApiRef.current;
      if (api) {
        [routeLayerId, stopsLayerId, stopLabelLayerId].forEach((layerId) =>
          api.removeLayer(layerId),
        );
      }
      mapEventCleanupRef.current?.();
      mapEventCleanupRef.current = null;
      mapApiRef.current = null;
    };
  }, [routeLayerId, stopLabelLayerId, stopsLayerId]);

  useEffect(() => {
    baseStyleRef.current = baseStyle;
  }, [baseStyle]);

  useEffect(() => {
    setStyleOverrideUrl(null);
  }, [baseStyle]);

  useEffect(() => {
    styleOverrideRef.current = styleOverrideUrl;
  }, [styleOverrideUrl]);

  useEffect(() => {
    if (manualStyleChangeRef.current) {
      return;
    }
    if (theme === "dark" && baseStyle !== "dark") {
      setBaseStyle("dark");
    }
    if (theme !== "dark" && baseStyle !== "light") {
      setBaseStyle("light");
    }
  }, [theme, baseStyle]);

  useEffect(() => {
    if (!mapReadyVersion) return;
    setMapError(null);
  }, [mapReadyVersion, baseStyle]);

  useEffect(() => {
    if (!mapReadyVersion) return;
    const api = mapApiRef.current;
    if (!api) return;

    if (!routeGeoJson.features.length) {
      api.removeLayer(routeLayerId);
      return;
    }

    api.addGeoJsonLayer({
      id: routeLayerId,
      data: routeGeoJson,
      layerType: "line",
      strokeColor: "#0ea5e9",
      strokeWidth: 4,
      strokeOpacity: 0.85,
      visible: true,
    });
  }, [mapReadyVersion, routeGeoJson, routeLayerId]);

  useEffect(() => {
    if (!mapReadyVersion) return;
    const api = mapApiRef.current;
    if (!api) return;

    if (!stopsGeoJson.features.length) {
      api.removeLayer(stopsLayerId);
      api.removeLayer(stopLabelLayerId);
      return;
    }

    const circleColor: any = [
      "match",
      ["get", "status"],
      "active",
      "#fbbf24",
      "complete",
      "#94a3b8",
      "#60a5fa",
    ];

    const circleRadius: any = [
      "case",
      ["==", ["get", "status"], "active"],
      8,
      ["==", ["get", "status"], "complete"],
      6,
      6,
    ];

    api.addGeoJsonLayer({
      id: stopsLayerId,
      data: stopsGeoJson,
      layerType: "circle",
      circleColor,
      circleRadius,
      circleStrokeColor: "#ffffff",
      circleStrokeWidth: 2,
      visible: true,
    });

    const stopLabelTextField = ["to-string", ["get", "label"]] as unknown as maplibregl.Expression;

    api.addGeoJsonLayer({
      id: stopLabelLayerId,
      data: stopsGeoJson,
      layerType: "symbol",
      textField: stopLabelTextField,
      textSize: 11,
      textColor: "#0f172a",
      textHaloColor: "rgba(255,255,255,0.85)",
      textHaloWidth: 1.4,
      textOffset: [0, 0.2],
      textFont: ["Open Sans Bold", "Arial Unicode MS Bold"],
      visible: true,
    });

    if (isActive) {
      api.fitToData(stopsGeoJson, {
        padding: viewMode === "all" ? 80 : 60,
        maxZoom: 15,
      });
    }
  }, [mapReadyVersion, stopsGeoJson, stopsLayerId, stopLabelLayerId, isActive, viewMode]);

  const visibleCountLabel = viewMode === "all" ? "Whole route" : "Next stops";

  return (
    <div className="relative h-full min-h-[320px] w-full rounded-2xl bg-slate-200 dark:bg-slate-900">
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 text-xs font-semibold text-slate-600 shadow dark:border-white/20 dark:bg-slate-900/80 dark:text-white/80">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${viewMode === "upcoming" ? "bg-emerald-500 text-slate-950 shadow" : "hover:text-emerald-700"}`}
            onClick={() => setViewMode("upcoming")}
          >
            Next stops
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${viewMode === "all" ? "bg-emerald-500 text-slate-950 shadow" : "hover:text-emerald-700"}`}
            onClick={() => setViewMode("all")}
          >
            Whole route
          </button>
        </div>
        <div className="pointer-events-auto inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 text-[11px] font-semibold text-slate-600 shadow dark:border-white/20 dark:bg-slate-900/80 dark:text-white/80">
          {(
            [
              { key: "light", label: "Light" },
              { key: "dark", label: "Dark" },
              { key: "satellite", label: "Satellite", disabled: !MAP_STYLE_OPTIONS.satellite.url },
            ] as Array<{ key: MapStyleKey; label: string; disabled?: boolean }>
          ).map((style) => (
            <button
              key={style.key}
              type="button"
              disabled={style.disabled}
              className={`rounded-full px-3 py-1 ${
                baseStyle === style.key
                  ? "bg-slate-900 text-white shadow dark:bg-white/90 dark:text-slate-900"
                  : style.disabled
                    ? "opacity-40"
                    : "hover:text-emerald-700"
              }`}
              onClick={() => {
                if (style.disabled) return;
                manualStyleChangeRef.current = true;
                setBaseStyle(style.key);
              }}
            >
              {style.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto rounded-full bg-white/90 px-3 py-1 text-[11px] text-slate-600 shadow dark:bg-slate-900/80 dark:text-white/70">
          {visibleCountLabel}: {visibleStops.length} of {orderedStops.length || 0}
        </div>
      </div>
      <MapLibreMap id={mapId} className="h-full w-full rounded-2xl" style={resolvedStyleUrl} styleKey={styleKey} />
      {mapError ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/85 text-center text-xs text-slate-600 dark:bg-slate-900/85 dark:text-white/70">
          <p className="font-semibold">{mapError}</p>
          {styleOverrideUrl ? (
            <p className="mt-2 max-w-xs">
              The MapTiler style returned 404 so we switched to the open MapLibre fallback. Update <code>NEXT_PUBLIC_MAPTILER_KEY</code> if you want branded tiles.
            </p>
          ) : !MAPTILER_KEY ? (
            <p className="mt-2 max-w-xs">
              Add <code>NEXT_PUBLIC_MAPTILER_KEY</code> to enable MapTiler basemaps. We&apos;ll use the demo style until then.
            </p>
          ) : (
            <p className="mt-2 max-w-xs">
              We couldn&apos;t load that basemap. Try switching back to Light, or confirm your key supports the selected style.
            </p>
          )}
        </div>
      ) : null}
      {!orderedStops.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-white/60">
          No geocoded stops to plot yet.
        </div>
      ) : null}
    </div>
  );
}
