"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Activity,
  TimerReset,
  Filter,
  Plus,
  Loader2,
  Map as MapIcon,
  List,
  UserPlus,
  MapPinPlus,
  Crosshair,
  LocateFixed,
  Users as UsersIcon,
  PlayCircle,
  UserCheck,
  UserX,
  X,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Wand2,
  BellRing,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AiVisitRecorder, type AiVisitResult } from "@/components/outbound/AiVisitRecorder";
import { cn } from "@/lib/utils";
import {
  SALES_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { StyleSpecification } from "maplibre-gl";
import type { ServiceTileStatus } from "@prisma/client";
import type { ServiceAreaSummary } from "@/lib/tiles/service-areas";
import type * as GeoJSON from "geojson";

interface LeadCadenceEnrollment {
  id: string;
  cadenceId: string;
  status: string;
  nextRunAt?: string | null;
  cadence?: { id: string; name: string } | null;
}

type OwnerOption = {
  id: string;
  label: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

interface LeadActivity {
  id: string;
  type: string;
  notes?: string | null;
  result?: string | null;
  occurredAt: string;
  createdAt?: string | null;
  user?: { id: string; name?: string | null; email?: string | null } | null;
}

interface OutboundLead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadType: string;
  pipelineStage?: string | null;
  stageColor?: string;
  dogs?: number | null;
  owner?: { id: string; name?: string | null; email?: string | null } | null;
  territory?: { id: string; name: string; color?: string | null } | null;
  address?: string | null;
  lastActivity?: {
    id: string;
    type: string;
    result?: string | null;
    occurredAt: string;
    notes?: string | null;
    location?: {
      lat: number;
      lng: number;
      accuracy?: number | null;
    } | null;
  } | null;
  submittedAt: string;
  lastActivityAt?: string | null;
  nextActionAt?: string | null;
  nextActionSlaMinutes?: number | null;
  preferredStartDate?: string | null;
  preferredContactMethods?: string[] | null;
  howDidYouHear?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cadenceEnrollments?: LeadCadenceEnrollment[] | null;
  serviceArea?: {
    slug: string;
    status: ServiceTileStatus;
  } | null;
}

interface TerritoryOption {
  id: string;
  name: string;
  color?: string | null;
}

interface NewLeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  pipelineStage: string;
  territoryId: string;
  dogs: string;
  yardSize: string;
  frequency: string;
  specialInstructions: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface FocusTarget extends Coordinates {
  key: number;
}

interface FetchLeadsOptions {
  cursor?: string | null;
  showSpinner?: boolean;
  append?: boolean;
  pageSize?: number;
  includeCadence?: boolean;
  signal?: AbortSignal;
  suppressError?: boolean;
}

interface FetchLeadsResult {
  nextCursor: string | null;
  count: number;
}

function mergeLeadPages(existing: OutboundLead[], incoming: OutboundLead[]) {
  if (!incoming.length) {
    return existing;
  }

  if (!existing.length) {
    return incoming;
  }

  const indexById = new Map<string, number>();
  existing.forEach((lead, idx) => {
    indexById.set(lead.id, idx);
  });

  const merged = existing.slice();
  incoming.forEach((lead) => {
    const index = indexById.get(lead.id);
    if (index != null) {
      merged[index] = lead;
    } else {
      merged.push(lead);
      indexById.set(lead.id, merged.length - 1);
    }
  });

  return merged;
}

interface TeamLocation {
  userId: string;
  name?: string | null;
  email?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  occurredAt: string;
}

type CadenceStepSummary = {
  id: string;
  order: number;
  channel: string;
  waitMinutes: number;
} & Partial<{
  slaMinutes: number | null;
  autoComplete: boolean;
}>;

interface CadenceSummary {
  id: string;
  name: string;
  description?: string | null;
  targetStage?: string | null;
  steps: CadenceStepSummary[];
}

const USER_LOCATION_STORAGE_KEY = "yardura.outbound.userLocation";
const SYSTEM_GENERATED_EMAIL_SUFFIX = "@leads.yardura";
const SYSTEM_EMAIL_PREFIXES = ["outbound-", "inbound-", "lead-"];

function sanitizeLeadEmail(email?: string | null) {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (lower.endsWith(SYSTEM_GENERATED_EMAIL_SUFFIX)) {
    const prefix = lower.slice(
      0,
      lower.length - SYSTEM_GENERATED_EMAIL_SUFFIX.length,
    );
    if (SYSTEM_EMAIL_PREFIXES.some((candidate) => prefix.startsWith(candidate))) {
      return null;
    }
  }

  return trimmed;
}

const activityTypes = [
  { value: "DOOR_KNOCK", label: "Door Knock" },
  { value: "CALL", label: "Call" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
];

const activityTypeLookup = activityTypes.reduce<Record<string, string>>(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {},
);

const nextActionFilters = [
  { value: "all", label: "All next actions" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Scheduled later" },
  { value: "none", label: "No next action" },
];

const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

const normalizeState = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const lookup = STATE_ABBREVIATIONS[trimmed];
  if (lookup) return lookup;
  return trimmed.slice(0, 2).toUpperCase();
};

type DogPresenceValue = "HAS_DOG" | "NO_DOG" | "UNKNOWN";

const dogPresenceOptions: {
  value: DogPresenceValue;
  label: string;
  description?: string;
}[] = [
  {
    value: "HAS_DOG",
    label: "Dog on site",
    description: "Saw or heard a dog",
  },
  { value: "NO_DOG", label: "No dog" },
  { value: "UNKNOWN", label: "Not sure" },
];

const encounterOptions = [
  { value: "NOT_HOME", label: "Not home / no answer", color: "#f59e0b" },
  { value: "NO_THANK_YOU", label: "No thank you", color: "#f97316" },
  { value: "RUDE", label: "Rude / hostile", color: "#ef4444" },
  { value: "NO_SOLICITING", label: "No soliciting", color: "#6b7280" },
  { value: "LEFT_FLYER", label: "Left door hanger", color: "#14b8a6" },
  { value: "INTERESTED", label: "Interested / follow up", color: "#10b981" },
  { value: "QUOTED", label: "Quoted", color: "#6366f1" },
  { value: "SUBSCRIBED", label: "Subscribed", color: "#0ea5e9" },
];

const objectionOptions = [
  { value: "WALKS", label: "Dog goes on walks" },
  { value: "SCOOP_IMMEDIATELY", label: "We scoop right away" },
  { value: "DOESNT_BOTHER", label: "Doesn't bother us" },
  { value: "BUSY", label: "Busy / no time" },
  { value: "COST", label: "Cost concerns" },
];

const ENCOUNTER_VALUES = encounterOptions.map((option) => option.value);
const DOG_VALUES = dogPresenceOptions.map((option) => option.value);
const OBJECTION_VALUES = objectionOptions.map((option) => option.value);

const objectionValueByLabel = new Map(
  objectionOptions.map((option) => [option.label.toLowerCase(), option.value]),
);

const formatValueList = (labels: string[]) => {
  if (labels.length === 0) {
    return "";
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} & ${labels[1]}`;
  }
  if (labels.length === 3) {
    return `${labels[0]}, ${labels[1]} & ${labels[2]}`;
  }
  return `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
};

const buildFilterSummary = <T extends string>(
  includes: readonly T[],
  exclusions: readonly T[],
  allValues: readonly T[],
  labelLookup: (value: T) => string,
) => {
  if (includes.length > 0) {
    if (includes.length === allValues.length) {
      return "All included";
    }
    const labels = includes.map(labelLookup);
    return `Only ${formatValueList(labels)}`;
  }

  if (!exclusions.length) {
    return "All included";
  }

  if (exclusions.length === allValues.length) {
    return "None";
  }

  if (exclusions.length === 1) {
    return `Excluded ${labelLookup(exclusions[0])}`;
  }

  if (exclusions.length <= 3) {
    const labels = exclusions.map(labelLookup);
    return `Excluded ${formatValueList(labels)}`;
  }

  return `${exclusions.length} excluded`;
};

const computeOptionState = <T extends string>(
  value: T,
  includes: readonly T[],
  exclusions: readonly T[],
  allValues: readonly T[],
): FilterOptionState => {
  if (includes.length > 0) {
    return includes.includes(value) ? "only" : "exclude";
  }

  if (exclusions.includes(value)) {
    return "exclude";
  }

  return exclusions.length > 0 && exclusions.length < allValues.length
    ? "only"
    : "include";
};

type FilterOptionState = "include" | "exclude" | "only";

interface FilterOptionCardProps {
  title: string;
  description?: string;
  state: FilterOptionState;
  onToggleExclude: () => void;
  onOnly: () => void;
}

const FilterOptionCard: React.FC<FilterOptionCardProps> = ({
  title,
  description,
  state,
  onToggleExclude,
  onOnly,
}) => {
  const isOnly = state === "only";
  const isExcluded = state === "exclude";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleExclude();
    }
  };

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint/30 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900",
        isOnly
          ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200"
          : isExcluded
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/60 dark:bg-rose-500/10 dark:text-rose-200"
            : "border-slate-200 bg-white/90 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/60",
      )}
      onClick={onToggleExclude}
      onKeyDown={handleKeyDown}
      aria-pressed={state !== "include"}
      role="button"
      tabIndex={0}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium leading-none">{title}</span>
        <div className="flex flex-wrap items-center gap-2">
          {description ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
          ) : null}
          {isOnly ? (
            <Badge className="border border-sky-200 bg-sky-100/70 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200">
              Only
            </Badge>
          ) : null}
          {isExcluded ? (
            <Badge
              variant="destructive"
              className="text-[10px] font-semibold uppercase tracking-wide dark:bg-rose-500/40 dark:text-rose-100"
            >
              Excluded
            </Badge>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Show only ${title}`}
        aria-pressed={isOnly}
        onClick={(event) => {
          event.stopPropagation();
          onOnly();
        }}
        className={cn(
          "h-8 w-8 rounded-full border border-transparent text-slate-500 transition hover:text-brand-mint dark:text-slate-300 dark:hover:text-brand-mint",
          isOnly &&
            "border-sky-400 bg-sky-100 text-sky-700 hover:text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200",
        )}
      >
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Show only {title}</span>
      </Button>
    </div>
  );
};

type MapStyleMode = "auto" | "light" | "dark" | "satellite";

const MAP_STYLE_STORAGE_KEY = "yardura-outbound-map-style";

const OSM_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as const;

const CUSTOM_MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL &&
  process.env.NEXT_PUBLIC_MAP_STYLE_URL.trim().length > 0
    ? process.env.NEXT_PUBLIC_MAP_STYLE_URL.trim()
    : null;

const DEFAULT_LIGHT_MAP_STYLE: string | StyleSpecification =
  CUSTOM_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const DEFAULT_DARK_MAP_STYLE: string | StyleSpecification =
  CUSTOM_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "esri-world-imagery",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
    },
  ],
};

interface ApiResponse {
  ok: boolean;
  data: {
    leads: OutboundLead[];
    pageInfo: { nextCursor?: string | null };
  };
  error?: string;
}

const stageOptions = [
  { value: "all", label: "All stages" },
  { value: "cold", label: "Cold" },
  { value: "contacted", label: "Contacted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "follow_up", label: "Follow Up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const leadTypeDisplay = {
  inbound: {
    label: "Inbound",
    badgeClass: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  outbound: {
    label: "Canvassing",
    badgeClass: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  referral: {
    label: "Referral",
    badgeClass: "bg-brand-mint/10 text-brand-mint border border-brand-mint/30",
  },
} as const;

const MAP_STYLE_OPTIONS: Array<{ value: MapStyleMode; label: string }> = [
  { value: "auto", label: "Match theme" },
  { value: "light", label: "Light streets" },
  { value: "dark", label: "Dark streets" },
  { value: "satellite", label: "Satellite" },
];

const NEXT_ACTION_STATUS_LABELS: Record<
  "overdue" | "today" | "upcoming" | "none",
  string
> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Scheduled",
  none: "No next action",
};

const getLeadNextActionStatus = (
  lead: OutboundLead,
): { code: "overdue" | "today" | "upcoming" | "none"; label: string } => {
  if (!lead.nextActionAt) {
    return { code: "none", label: NEXT_ACTION_STATUS_LABELS.none };
  }

  const ts = new Date(lead.nextActionAt).getTime();
  if (!Number.isFinite(ts)) {
    return { code: "none", label: NEXT_ACTION_STATUS_LABELS.none };
  }

  const now = Date.now();
  if (ts < now) {
    return { code: "overdue", label: NEXT_ACTION_STATUS_LABELS.overdue };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  if (ts >= startOfDay.getTime() && ts <= endOfDay.getTime()) {
    return { code: "today", label: NEXT_ACTION_STATUS_LABELS.today };
  }

  return { code: "upcoming", label: NEXT_ACTION_STATUS_LABELS.upcoming };
};

function makeNewLeadForm(): NewLeadForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    pipelineStage: "cold",
    territoryId: "UNASSIGNED",
    dogs: "",
    yardSize: "__unset",
    frequency: "__unset",
    specialInstructions: "",
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatRelativeMinutes(diffMinutes: number | null | undefined) {
  if (diffMinutes === null || diffMinutes === undefined) return "—";
  if (!Number.isFinite(diffMinutes)) return "—";
  if (diffMinutes === 0) return "Due now";
  if (diffMinutes > 0) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = Math.abs(Math.round(diffMinutes % 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }
  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = Math.abs(Math.round(abs % 60));
  if (hours > 0) return `${hours}h ${minutes}m overdue`;
  return `${minutes}m overdue`;
}

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function stageBadgeColor(stageColor?: string) {
  switch (stageColor) {
    case "cyan":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "blue":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "green":
    case "emerald":
      return "bg-brand-mint/10 text-brand-mint border-brand-mint/30";
    case "amber":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "rose":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function normalizeResultValue(result?: string | null): string | null {
  if (!result) return null;
  const lower = result.toLowerCase();
  if (lower.includes("not home")) return "NOT_HOME";
  if (lower.includes("no thank")) return "NO_THANK_YOU";
  if (lower.includes("rude")) return "RUDE";
  if (lower.includes("solicit")) return "NO_SOLICITING";
  if (lower.includes("flyer") || lower.includes("door hanger")) return "LEFT_FLYER";
  if (lower.includes("interested") || lower.includes("follow"))
    return "INTERESTED";
  return result.toUpperCase().replace(/[^A-Z_]/g, "");
}

function parseTagLine(notes?: string | null) {
  if (!notes) return {} as Record<string, string>;
  const tagLine = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("tags:"));
  if (!tagLine) return {} as Record<string, string>;
  const payload = tagLine.slice(5).trim();
  const entries = payload
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, value] = pair.split("=");
      return [key?.trim(), value?.trim()] as [string | undefined, string | undefined];
    })
    .filter((tuple): tuple is [string, string] =>
      Boolean(tuple[0]) && Boolean(tuple[1]),
    );
  return Object.fromEntries(entries) as Record<string, string>;
}

interface QuickVisitMeta {
  tags: Record<string, string>;
  encounterToken: string | null;
  dogToken: DogPresenceValue | null;
  objectionTokens: string[];
}

function getLeadQuickVisitMeta(lead: OutboundLead): QuickVisitMeta {
  const lastActivityNotes =
    lead.lastActivity && "notes" in lead.lastActivity
      ? (lead.lastActivity as { notes?: string | null }).notes ?? null
      : null;
  const lastActivityResult =
    lead.lastActivity && "result" in lead.lastActivity
      ? (lead.lastActivity as { result?: string | null }).result ?? null
      : null;

  const tags = parseTagLine(lastActivityNotes);
  const encounterToken = normalizeResultValue(tags.encounter || lastActivityResult);
  const resolvedDogToken = (() => {
    const tagValue = tags.dog ? tags.dog.toUpperCase() : null;
    if (tagValue === "HAS_DOG") return "HAS_DOG" as DogPresenceValue;
    if (tagValue === "NO_DOG") return "NO_DOG" as DogPresenceValue;
    if (tagValue === "UNKNOWN") return "UNKNOWN" as DogPresenceValue;
    if (typeof lead.dogs === "number") {
      return lead.dogs > 0 ? ("HAS_DOG" as DogPresenceValue) : ("NO_DOG" as DogPresenceValue);
    }
    const normalizedNotes = lastActivityNotes?.toLowerCase() ?? "";
    if (/(dog on site|has dog|friendly dog|dog present|dog out)/i.test(normalizedNotes)) {
      return "HAS_DOG" as DogPresenceValue;
    }
    if (/(no dog|without dog|dog not|dog gone)/i.test(normalizedNotes)) {
      return "NO_DOG" as DogPresenceValue;
    }
    return null;
  })();

  const objectionTokensSet = new Set<string>();
  if (tags.objections) {
    tags.objections
      .split("|")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
      .forEach((token) => objectionTokensSet.add(token));
  }

  const humanObjectionLine = lastActivityNotes
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("objections:"));

  if (humanObjectionLine) {
    const payload = humanObjectionLine.slice("Objections:".length).trim();
    if (payload) {
      payload
        .split(/[,|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((label) => {
          const normalized = label.toLowerCase();
          const matchedValue =
            objectionValueByLabel.get(normalized) ||
            objectionOptions.find((option) =>
              option.label.toLowerCase().includes(normalized),
            )?.value ||
            label.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
          if (matchedValue) {
            objectionTokensSet.add(matchedValue);
          }
        });
    }
  }

  const objectionTokens = Array.from(objectionTokensSet);

  return {
    tags,
    encounterToken,
    dogToken: resolvedDogToken,
    objectionTokens,
  };
}

function getLeadMarkerVisual(lead: OutboundLead) {
  const { tags, encounterToken, dogToken, objectionTokens } = getLeadQuickVisitMeta(lead);

  const encounterColor =
    encounterOptions.find((option) => option.value === encounterToken)?.color || "#64748b";

  const hasDog = dogToken === "HAS_DOG";
  const dogUnknown = dogToken === "UNKNOWN";
  const ringColor = hasDog
    ? "rgba(22, 163, 74, 0.9)"
    : dogUnknown
      ? "rgba(59, 130, 246, 0.45)"
      : "rgba(255,255,255,0.9)";

  const objectionColor = objectionTokens.length
    ? "rgba(147, 51, 234, 0.9)"
    : null;

  return {
    fill: encounterColor,
    ring: ringColor,
    objection: objectionColor,
    dogToken,
  };
}

function getLeadCoordinates(lead: {
  latitude?: number | null;
  longitude?: number | null;
  lastActivity?: OutboundLead["lastActivity"];
}): { latitude: number; longitude: number } | null {
  if (
    typeof lead.latitude === "number" &&
    Number.isFinite(lead.latitude) &&
    typeof lead.longitude === "number" &&
    Number.isFinite(lead.longitude)
  ) {
    return { latitude: lead.latitude, longitude: lead.longitude };
  }

  const fallback = lead.lastActivity?.location;
  if (
    fallback &&
    typeof fallback.lat === "number" &&
    Number.isFinite(fallback.lat) &&
    typeof fallback.lng === "number" &&
    Number.isFinite(fallback.lng)
  ) {
    return { latitude: fallback.lat, longitude: fallback.lng };
  }

  return null;
}

function splitHouseAndStreet(line1?: string | null) {
  if (!line1) return { house: "", street: "" };
  const match = line1.match(/^\s*(\d+[A-Za-z0-9\-]*)\s+(.*)$/);
  if (match) {
    return { house: match[1] ?? "", street: match[2]?.trim() ?? "" };
  }
  return { house: "", street: line1.trim() };
}

function OutboundLeadsPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();

  const resolvedTheme = useMemo(() => theme ?? "light", [theme]);

  const [leads, setLeads] = useState<OutboundLead[]>([]);
  const leadsRef = useRef<OutboundLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [territoryFilter, setTerritoryFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [encounterExclusions, setEncounterExclusions] = useState<string[]>([]);
  const [dogExclusions, setDogExclusions] = useState<DogPresenceValue[]>([]);
  const [objectionExclusions, setObjectionExclusions] = useState<string[]>([]);
  const [encounterIncludes, setEncounterIncludes] = useState<string[]>([]);
  const [dogIncludes, setDogIncludes] = useState<DogPresenceValue[]>([]);
  const [objectionIncludes, setObjectionIncludes] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [openFilterSections, setOpenFilterSections] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<OutboundLead | null>(null);
  const [selectedLead, setSelectedLead] = useState<OutboundLead | null>(null);
  const [activityType, setActivityType] = useState<string>("DOOR_KNOCK");
  const [activityNotes, setActivityNotes] = useState("");
  const [activityResult, setActivityResult] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NewLeadForm>(() =>
    makeNewLeadForm(),
  );
  const [houseNumber, setHouseNumber] = useState("");
  const [houseNumberSuggestion, setHouseNumberSuggestion] =
    useState<string | null>(null);
  const [isHouseNumberConfirmed, setIsHouseNumberConfirmed] = useState(false);
  const [streetOptions, setStreetOptions] = useState<string[]>([]);
  const [selectedStreet, setSelectedStreet] = useState("");
  const [customStreet, setCustomStreet] = useState("");
  const [showAdvancedAddress, setShowAdvancedAddress] = useState(false);
  const [dogPresence, setDogPresence] = useState<DogPresenceValue | null>(null);
  const [dogCount, setDogCount] = useState<number | null>(null);
  const [encounterTags, setEncounterTags] = useState<string[]>([]);
  const [objectionTags, setObjectionTags] = useState<string[]>([]);
  const [quickNotes, setQuickNotes] = useState("");
  const [visitCaptureMode, setVisitCaptureMode] =
    useState<"prompt" | "quick" | "ai">("prompt");
  const [aiVisitResult, setAiVisitResult] = useState<AiVisitResult | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingCoordinates, setPendingCoordinates] =
    useState<Coordinates | null>(null);
  const [hydrationTrigger, setHydrationTrigger] = useState(0);
  const [mapHydrationStatus, setMapHydrationStatus] = useState({
    active: false,
    loaded: 0,
  });
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>("auto");
  const [isMobileMapSheetOpen, setIsMobileMapSheetOpen] = useState(false);
  const pendingCoordinatesRef = useRef<Coordinates | null>(null);
  const autoDropAtUserRef = useRef(false);
  const houseNumberInputRef = useRef<HTMLInputElement | null>(null);
  const [isDroppingPin, setIsDroppingPin] = useState(false);
  const mapHydrationControllerRef = useRef<AbortController | null>(null);
  const mapHydrationRunningRef = useRef(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "pending" | "ready" | "denied"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<FocusTarget | null>(null);
  const [mapLeadSelection, setMapLeadSelection] = useState<string>("");
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [showTeamRadar, setShowTeamRadar] = useState(false);
  const [locationErrorDismissed, setLocationErrorDismissed] = useState(false);
  const [cadences, setCadences] = useState<CadenceSummary[]>([]);
  const [cadencesLoaded, setCadencesLoaded] = useState(false);
  const [cadenceLoading, setCadenceLoading] = useState(false);
  const [isCadenceSheetOpen, setIsCadenceSheetOpen] = useState(false);
  const [cadenceError, setCadenceError] = useState<string | null>(null);
  const [cadenceSubmitting, setCadenceSubmitting] = useState(false);
  const [cadenceSelection, setCadenceSelection] = useState<string>("");
  const [leadForCadence, setLeadForCadence] = useState<OutboundLead | null>(null);
  const [ownerDirectory, setOwnerDirectory] = useState<OwnerOption[]>([]);
  const [mutatingLeadId, setMutatingLeadId] = useState<string | null>(null);
  const currentUserId = (session?.user as any)?.id ?? null;
  const userOrgId = (session?.user as any)?.orgId ?? null;
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaSummary[]>([]);
  const [serviceAreasLoading, setServiceAreasLoading] = useState(false);
  const serviceAreaFeatures = useMemo<GeoJSON.Feature[]>(
    () =>
      serviceAreas
        .map((area) => area.tileGeometry)
        .filter((feature): feature is GeoJSON.Feature => !!feature),
    [serviceAreas],
  );
  const [cadenceSuccess, setCadenceSuccess] = useState<string | null>(null);
  const NO_OWNER_VALUE = "__unset__";
  const [activityHistory, setActivityHistory] = useState<LeadActivity[]>([]);
  const [activityHistoryLoading, setActivityHistoryLoading] = useState(false);
  const [activityHistoryError, setActivityHistoryError] = useState<string | null>(
    null,
  );
  const [activityHistoryCursor, setActivityHistoryCursor] = useState<string | null>(
    null,
  );
  const [activityHistoryHasMore, setActivityHistoryHasMore] = useState(false);

  const encounterOptionMap = useMemo(() => {
    return encounterOptions.reduce<Record<string, (typeof encounterOptions)[number]>>(
      (acc, option) => {
        acc[option.value] = option;
        return acc;
      },
      {},
    );
  }, []);

  const loadServiceAreas = useCallback(async () => {
    setServiceAreasLoading(true);
    try {
      const response = await fetch("/api/admin/service-areas");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      const areas: ServiceAreaSummary[] = payload?.serviceAreas ?? [];
      setServiceAreas(areas);
    } catch (error) {
      console.warn("Failed to load service areas", error);
    } finally {
      setServiceAreasLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServiceAreas();
  }, [loadServiceAreas]);

  const dogOptionMap = useMemo(() => {
    return dogPresenceOptions.reduce<Record<string, (typeof dogPresenceOptions)[number]>>(
      (acc, option) => {
        acc[option.value] = option;
        return acc;
      },
      {},
    );
  }, []);

  const objectionOptionMap = useMemo(() => {
    return objectionOptions.reduce<Record<string, (typeof objectionOptions)[number]>>(
      (acc, option) => {
        acc[option.value] = option;
        return acc;
      },
      {},
    );
  }, []);

  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState<string>(
    currentUserId ?? NO_OWNER_VALUE,
  );
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const hasCenteredOnUserRef = useRef(false);
  const forceCenterOnUserRef = useRef(false);
  const userLocationRef = useRef<Coordinates | null>(null);
  const [freezeViewport, setFreezeViewport] = useState(false);
  const [reverseLookupLoading, setReverseLookupLoading] = useState(false);
  const [reverseLookupError, setReverseLookupError] = useState<string | null>(
    null,
  );
  const [reverseLookupCompleted, setReverseLookupCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY) as
      | MapStyleMode
      | null;
    if (saved && MAP_STYLE_OPTIONS.some((option) => option.value === saved)) {
      setMapStyleMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleMode);
  }, [mapStyleMode]);

  const mapStylePreference = useMemo(() => {
    const ensureStyle = (
      style: string | StyleSpecification | null,
    ): string | StyleSpecification => {
      if (style) return style;
      return OSM_FALLBACK_STYLE;
    };

    const lightStyle = ensureStyle(DEFAULT_LIGHT_MAP_STYLE);
    const darkStyle = ensureStyle(
      DEFAULT_DARK_MAP_STYLE === DEFAULT_LIGHT_MAP_STYLE
        ? DEFAULT_LIGHT_MAP_STYLE
        : DEFAULT_DARK_MAP_STYLE,
    );

    if (mapStyleMode === "satellite") {
      return {
        style: SATELLITE_STYLE,
        key: "satellite",
      };
    }

    if (mapStyleMode === "light") {
      return { style: lightStyle, key: "light" };
    }

    if (mapStyleMode === "dark") {
      return { style: darkStyle, key: "dark" };
    }

    const isDark = resolvedTheme === "dark";
    return {
      style: isDark ? darkStyle : lightStyle,
      key: isDark ? "auto-dark" : "auto-light",
    };
  }, [mapStyleMode, resolvedTheme]);

  useEffect(() => {
    if (viewMode !== "map" && isMobileMapSheetOpen) {
      setIsMobileMapSheetOpen(false);
    }
  }, [viewMode, isMobileMapSheetOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || userLocationRef.current) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | { latitude?: number; longitude?: number }
        | null;
      if (
        parsed &&
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number"
      ) {
        const coords: Coordinates = {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        };
        userLocationRef.current = coords;
        setUserLocation((current) => current ?? coords);
        setLocationStatus((status) => (status === "ready" ? status : "ready"));
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to restore cached user location", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!leads.length) {
      setSelectedLeadIds([]);
    }
  }, [leads.length]);

  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    const coords: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    userLocationRef.current = coords;
    setUserLocation((prev) =>
      prev && prev.latitude === coords.latitude && prev.longitude === coords.longitude
        ? prev
        : coords,
    );
    setLocationStatus("ready");
    setLocationError(null);
    setLocationErrorDismissed(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          USER_LOCATION_STORAGE_KEY,
          JSON.stringify({ ...coords, timestamp: Date.now() }),
        );
      } catch (storageError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to cache user location", storageError);
        }
      }
    }
  }, []);

  const handleLocationError = useCallback(
    (geoError: GeolocationPositionError) => {
      console.warn("Geolocation error", geoError);

      if (userLocationRef.current && geoError.code !== geoError.PERMISSION_DENIED) {
        autoDropAtUserRef.current = false;
        setLocationStatus("ready");
        setLocationError(null);
        return;
      }

      const message = (() => {
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            return "Location permission denied. Enable location access to use “Locate me”.";
          case geoError.POSITION_UNAVAILABLE:
            return "We couldn't grab your GPS right now. Try again in a moment.";
          case geoError.TIMEOUT:
            return "Taking a bit longer to locate you. Try again or move to an open area.";
          default:
            return "Unable to determine your current location.";
        }
      })();

      setLocationStatus(
        geoError.code === geoError.PERMISSION_DENIED ? "denied" : "idle",
      );
      setLocationError(message);
      setLocationErrorDismissed(false);
      autoDropAtUserRef.current = false;
    },
    [],
  );

  const fetchLeads = useCallback(
    async (options?: FetchLeadsOptions): Promise<FetchLeadsResult | null> => {
      const cursor = options?.cursor ?? null;
      const showSpinner = options?.showSpinner ?? true;
      const append = options?.append ?? false;
      const limit = Math.max(1, Math.min(options?.pageSize ?? 200, 2000));
      const includeCadence = options?.includeCadence ?? true;

      if (!append) {
        if (mapHydrationControllerRef.current) {
          mapHydrationControllerRef.current.abort();
          mapHydrationControllerRef.current = null;
        }
        mapHydrationRunningRef.current = false;
        setMapHydrationStatus((prev) =>
          prev.active ? { active: false, loaded: prev.loaded } : prev,
        );
      }

      if (showSpinner) {
        setIsLoading(true);
      }
      if (!options?.suppressError) {
        setError(null);
      }

      const params = new URLSearchParams();
      params.set("leadType", "outbound");
      params.set("limit", String(limit));
      params.set("includeCadence", includeCadence ? "true" : "false");
      if (searchTerm) params.set("search", searchTerm);
      if (stageFilter !== "all") params.set("pipelineStage", stageFilter);
      if (territoryFilter !== "all") params.set("territoryId", territoryFilter);
      if (ownerFilter === "unassigned") {
        params.set("ownerId", "NULL");
      } else if (ownerFilter !== "all") {
        params.set("ownerId", ownerFilter);
      }
      if (cursor) params.set("cursor", cursor);

      try {
        const res = await fetch(`/api/leads/outbound?${params.toString()}`, {
          signal: options?.signal,
        });
        const json: ApiResponse = await res.json();
        if (!json.ok) {
          throw new Error(json.error || "Failed to load outbound leads");
        }

        let merged: OutboundLead[] = [];
        setLeads((prev) => {
          merged = append ? mergeLeadPages(prev, json.data.leads) : json.data.leads;
          return merged;
        });

        const mergedIdSet = new Set(merged.map((lead) => lead.id));
        setSelectedLeadIds((prev) => prev.filter((id) => mergedIdSet.has(id)));
        setMapHydrationStatus((prev) =>
          prev.loaded === merged.length ? prev : { ...prev, loaded: merged.length },
        );

        const next = json.data.pageInfo.nextCursor ?? null;
        setNextCursor(next);

        if (!append) {
          setHydrationTrigger((value) => value + 1);
        }

        return { nextCursor: next, count: json.data.leads.length };
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          return null;
        }
        console.error(err);
        if (!options?.suppressError) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
        return null;
      } finally {
        if (showSpinner) {
          setIsLoading(false);
        }
      }
    },
    [searchTerm, stageFilter, territoryFilter, ownerFilter],
  );

  const fetchLeadsRef = useRef(fetchLeads);
  useEffect(() => {
    fetchLeadsRef.current = fetchLeads;
  }, [fetchLeads]);

  const updateLeadOwner = useCallback(
    async (
      leadId: string,
      ownerIdValue: string | null,
      options?: { silent?: boolean; skipRefresh?: boolean },
    ) => {
      const silent = options?.silent ?? false;
      const skipRefresh = options?.skipRefresh ?? false;
      if (!silent) {
        setMutatingLeadId(leadId);
      }
      try {
        const response = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: ownerIdValue ?? null }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Failed to update assignment");
        }
        if (!silent) {
          toast.success(ownerIdValue ? "Lead assigned" : "Lead unassigned");
        }
        if (!skipRefresh) {
          await fetchLeads({ showSpinner: false });
        }
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to update lead assignment",
          );
        }
        if (silent) {
          throw error;
        }
      } finally {
        if (!silent) {
          setMutatingLeadId(null);
        }
      }
    },
    [fetchLeads],
  );

  const fetchTerritories = useCallback(async () => {
    try {
      const response = await fetch("/api/territories");
      if (!response.ok) {
        if (response.status === 403) {
          // Sales reps don't have territory management access yet; skip silently.
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load territories");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to load territories");
      }

      setTerritories(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCadences = useCallback(async () => {
    try {
      setCadenceLoading(true);
      setCadenceError(null);
      setCadenceSuccess(null);
      const res = await fetch("/api/cadences");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load cadences");
      setCadences(Array.isArray(json.data) ? json.data : []);
      setCadencesLoaded(true);
    } catch (err) {
      console.error(err);
      setCadenceError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setCadenceLoading(false);
    }
  }, []);

  const fetchOwnerDirectory = useCallback(async () => {
    try {
      const response = await fetch("/api/leads/owners");
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: Array<Record<string, unknown>>;
        owners?: Array<Record<string, unknown>>;
        error?: string;
      };

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to load sales reps");
      }

      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.owners)
        ? payload.owners
        : [];

      const map = new Map<string, OwnerOption>();
      rawList.forEach((entry) => {
        const id = typeof entry?.id === "string" ? entry.id : null;
        if (!id) return;
        const name =
          typeof entry?.name === "string" ? (entry.name as string) : null;
        const email =
          typeof entry?.email === "string" ? (entry.email as string) : null;
        const role =
          typeof entry?.role === "string" ? (entry.role as string) : null;
        const label =
          typeof entry?.label === "string"
            ? (entry.label as string)
            : name || email || "Sales rep";
        map.set(id, { id, name, email, role, label });
      });

      setOwnerDirectory(Array.from(map.values()));
    } catch (error) {
      console.error("Error fetching sales rep directory:", error);
    }
  }, []);

  const sessionUserLabel =
    (session?.user as any)?.name || (session?.user as any)?.email || "You";

  const formatOwnerLabel = useCallback(
    (
      id?: string | null,
      name?: string | null,
      email?: string | null,
      fallback?: string | null,
      options?: { includeSelfTag?: boolean },
    ) => {
      const includeSelfTag = options?.includeSelfTag ?? true;

      let base = name?.trim() ?? "";

      if (!base && fallback) {
        const stripped = fallback.replace(/\s*\(.+?\)\s*$/, "").trim();
        base = stripped;
      }

      if (!base && email) {
        const local = email.split("@")[0]?.trim();
        if (local) base = local;
      }

      if (!base) {
        base = "Sales rep";
      }

      if (includeSelfTag && id && id === currentUserId && !base.includes("(You)")) {
        base = `${base} (You)`;
      }

      return base;
    },
    [currentUserId],
  );

  const availableOwners = useMemo<OwnerOption[]>(() => {
    const map = new Map<string, string>();

    ownerDirectory.forEach((owner) => {
      if (!owner.id) return;
      const label = formatOwnerLabel(
        owner.id,
        owner.name ?? null,
        owner.email ?? null,
        owner.label ?? null,
      );
      map.set(owner.id, label);
    });

    if (currentUserId && !map.has(currentUserId)) {
      const label = formatOwnerLabel(
        currentUserId,
        sessionUserLabel,
        (session?.user as any)?.email ?? null,
        sessionUserLabel,
      );
      map.set(currentUserId, label);
    }

    leads.forEach((lead) => {
      if (lead.owner?.id && !map.has(lead.owner.id)) {
        const label = formatOwnerLabel(
          lead.owner.id,
          lead.owner.name ?? null,
          lead.owner.email ?? null,
          null,
        );
        map.set(lead.owner.id, label);
      }
    });

    teamLocations.forEach((member) => {
      if (member.userId && !map.has(member.userId)) {
        const label = formatOwnerLabel(
          member.userId,
          member.name ?? null,
          member.email ?? null,
          null,
        );
        map.set(member.userId, label);
      }
    });

    return Array.from(map.entries())
      .map(([id, label]): OwnerOption => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ownerDirectory, currentUserId, sessionUserLabel, leads, teamLocations, formatOwnerLabel]);

  useEffect(() => {
    if (!availableOwners.length) return;

    if (
      (bulkAssignOwnerId === NO_OWNER_VALUE ||
        !availableOwners.some((owner) => owner.id === bulkAssignOwnerId)) &&
      (currentUserId || availableOwners[0]?.id)
    ) {
      setBulkAssignOwnerId(currentUserId ?? availableOwners[0]?.id ?? NO_OWNER_VALUE);
    }
  }, [bulkAssignOwnerId, currentUserId, availableOwners]);

  useEffect(() => {
    if (!leads.length && selectedLeadIds.length) {
      setSelectedLeadIds([]);
    }
  }, [leads.length, selectedLeadIds.length]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    setIsHouseNumberConfirmed(houseNumber.trim().length > 0);
  }, [houseNumber]);

  useEffect(() => {
    if (!filtersExpanded) {
      setOpenFilterSections([]);
    }
  }, [filtersExpanded]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const meta = getLeadQuickVisitMeta(lead);

      const encounterToken = meta.encounterToken ?? "__NONE";
      if (encounterIncludes.length) {
        if (!encounterIncludes.includes(encounterToken)) {
          return false;
        }
      } else if (encounterExclusions.length && encounterExclusions.includes(encounterToken)) {
        return false;
      }

      const dogToken: DogPresenceValue = meta.dogToken ?? "UNKNOWN";
      if (dogIncludes.length) {
        if (!dogIncludes.includes(dogToken)) {
          return false;
        }
      } else if (dogExclusions.length && dogExclusions.includes(dogToken)) {
        return false;
      }

      if (objectionIncludes.length) {
        if (!meta.objectionTokens.some((token) => objectionIncludes.includes(token))) {
          return false;
        }
      } else if (
        objectionExclusions.length &&
        meta.objectionTokens.some((token) => objectionExclusions.includes(token))
      ) {
        return false;
      }

      return true;
    });
  }, [
    leads,
    encounterExclusions,
    encounterIncludes,
    dogExclusions,
    dogIncludes,
    objectionExclusions,
    objectionIncludes,
  ]);

  const leadsWithCoordinates = useMemo(
    () => filteredLeads.filter((lead) => getLeadCoordinates(lead) != null),
    [filteredLeads],
  );

  const hasStreetSelection = useMemo(() => {
    const trimmedSelected = selectedStreet.trim();
    const trimmedCustom = customStreet.trim();
    return trimmedSelected.length > 0 || trimmedCustom.length > 0;
  }, [selectedStreet, customStreet]);

  const showQuickVisitSection = isHouseNumberConfirmed && hasStreetSelection;

  useEffect(() => {
    if (!showQuickVisitSection) {
      setVisitCaptureMode("prompt");
      setAiVisitResult(null);
    }
  }, [showQuickVisitSection]);

  const toggleEncounterExclusion = useCallback((value: string) => {
    setEncounterIncludes((prev) => prev.filter((item) => item !== value));
    setEncounterExclusions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }, []);

  const setEncounterOnly = useCallback((value: string) => {
    setEncounterExclusions([]);
    setEncounterIncludes((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) {
          return [];
        }
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const resetEncounterIncludes = useCallback(() => {
    setEncounterIncludes([]);
    setEncounterExclusions([]);
  }, []);

  const toggleDogExclusion = useCallback((value: DogPresenceValue) => {
    setDogIncludes((prev) => prev.filter((item) => item !== value));
    setDogExclusions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }, []);

  const setDogOnly = useCallback((value: DogPresenceValue) => {
    setDogExclusions([]);
    setDogIncludes((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) {
          return [];
        }
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const resetDogIncludes = useCallback(() => {
    setDogIncludes([]);
    setDogExclusions([]);
  }, []);

  const toggleObjectionExclusion = useCallback((value: string) => {
    setObjectionIncludes((prev) => prev.filter((item) => item !== value));
    setObjectionExclusions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }, []);

  const setObjectionOnly = useCallback((value: string) => {
    setObjectionExclusions([]);
    setObjectionIncludes((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) {
          return [];
        }
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const resetObjectionIncludes = useCallback(() => {
    setObjectionIncludes([]);
    setObjectionExclusions([]);
  }, []);

  const clearAllFilters = useCallback(() => {
    setEncounterExclusions([]);
    setDogExclusions([]);
    setObjectionExclusions([]);
    setEncounterIncludes([]);
    setDogIncludes([]);
    setObjectionIncludes([]);
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (encounterIncludes.length > 0) {
      const labels = encounterIncludes.map(
        (value) => encounterOptionMap[value]?.label ?? value.replace(/_/g, " "),
      );
      chips.push({
        key: "encounter-includes",
        label: `Only: ${formatValueList(labels)}`,
        onRemove: resetEncounterIncludes,
      });
    } else {
      encounterExclusions.forEach((value) => {
        const option = encounterOptionMap[value];
        chips.push({
          key: `encounter-${value}`,
          label: `Exclude: ${option?.label ?? value.replace(/_/g, " ")}`,
          onRemove: () => toggleEncounterExclusion(value),
        });
      });
    }

    if (dogIncludes.length > 0) {
      const labels = dogIncludes.map(
        (value) => dogOptionMap[value]?.label ?? value.toLowerCase(),
      );
      chips.push({
        key: "dog-includes",
        label: `Only: ${formatValueList(labels)}`,
        onRemove: resetDogIncludes,
      });
    } else {
      dogExclusions.forEach((value) => {
        const option = dogOptionMap[value];
        chips.push({
          key: `dog-${value}`,
          label: `Exclude: ${option?.label ?? value.toLowerCase()}`,
          onRemove: () => toggleDogExclusion(value),
        });
      });
    }

    if (objectionIncludes.length > 0) {
      const labels = objectionIncludes.map(
        (value) => objectionOptionMap[value]?.label ?? value.replace(/_/g, " "),
      );
      chips.push({
        key: "objection-includes",
        label: `Only: ${formatValueList(labels)}`,
        onRemove: resetObjectionIncludes,
      });
    } else {
      objectionExclusions.forEach((value) => {
        const option = objectionOptionMap[value];
        chips.push({
          key: `objection-${value}`,
          label: `Exclude: ${option?.label ?? value.replace(/_/g, " ")}`,
          onRemove: () => toggleObjectionExclusion(value),
        });
      });
    }

    return chips;
  }, [
    encounterIncludes,
    encounterExclusions,
    dogIncludes,
    dogExclusions,
    objectionIncludes,
    objectionExclusions,
    encounterOptionMap,
    dogOptionMap,
    objectionOptionMap,
    toggleEncounterExclusion,
    toggleDogExclusion,
    toggleObjectionExclusion,
    resetEncounterIncludes,
    resetDogIncludes,
    resetObjectionIncludes,
  ]);

  const activeFilterCount = activeFilterChips.length;

  const encounterSummary = useMemo(
    () =>
      buildFilterSummary(
        encounterIncludes,
        encounterExclusions,
        ENCOUNTER_VALUES,
        (value) => encounterOptionMap[value]?.label ?? value.replace(/_/g, " "),
      ),
    [encounterIncludes, encounterExclusions, encounterOptionMap],
  );

  const dogSummary = useMemo(
    () =>
      buildFilterSummary(
        dogIncludes,
        dogExclusions,
        DOG_VALUES,
        (value) => dogOptionMap[value]?.label ?? value.toLowerCase(),
      ),
    [dogIncludes, dogExclusions, dogOptionMap],
  );

  const objectionSummary = useMemo(
    () =>
      buildFilterSummary(
        objectionIncludes,
        objectionExclusions,
        OBJECTION_VALUES,
        (value) => objectionOptionMap[value]?.label ?? value.replace(/_/g, " "),
      ),
    [objectionIncludes, objectionExclusions, objectionOptionMap],
  );

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    if (viewMode !== "map") {
      if (mapHydrationControllerRef.current) {
        mapHydrationControllerRef.current.abort();
        mapHydrationControllerRef.current = null;
      }
      mapHydrationRunningRef.current = false;
      setMapHydrationStatus((prev) =>
        prev.active ? { active: false, loaded: leadsRef.current.length } : prev,
      );
      return;
    }

    if (mapHydrationRunningRef.current) {
      return;
    }

    const initialCursor = nextCursorRef.current;
    if (!initialCursor) {
      setMapHydrationStatus((prev) =>
        prev.active ? { active: false, loaded: leadsRef.current.length } : prev,
      );
      return;
    }

    const controller = new AbortController();
    mapHydrationControllerRef.current = controller;
    mapHydrationRunningRef.current = true;

    let loadedCount = leadsRef.current.length;
    setMapHydrationStatus({ active: true, loaded: loadedCount });

    const hydrate = async () => {
      let cursor: string | null = initialCursor;
      while (cursor && !controller.signal.aborted) {
        const result = await fetchLeadsRef.current({
          cursor,
          append: true,
          showSpinner: false,
          pageSize: 750,
          signal: controller.signal,
          suppressError: true,
        });
        if (!result) {
          break;
        }
        if (result.count === 0) {
          cursor = result.nextCursor;
          if (!cursor) {
            break;
          }
          continue;
        }
        loadedCount += result.count;
        setMapHydrationStatus({ active: true, loaded: loadedCount });
        cursor = result.nextCursor;
      }
    };

    hydrate()
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to hydrate outbound map", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMapHydrationStatus({
            active: false,
            loaded: leadsRef.current.length,
          });
        }
        mapHydrationRunningRef.current = false;
        if (mapHydrationControllerRef.current === controller) {
          mapHydrationControllerRef.current = null;
        }
      });

    return () => {
      controller.abort();
      mapHydrationRunningRef.current = false;
      if (mapHydrationControllerRef.current === controller) {
        mapHydrationControllerRef.current = null;
      }
    };
  }, [viewMode, hydrationTrigger]);

  const handleCadenceSheetChange = useCallback((open: boolean) => {
    setIsCadenceSheetOpen(open);
    if (!open) {
      setLeadForCadence(null);
      setCadenceSelection("");
      setCadenceError(null);
      setCadenceSuccess(null);
      setCadenceSubmitting(false);
    }
  }, []);

  const openCadenceSheet = useCallback(
    (lead: OutboundLead) => {
      setLeadForCadence(lead);
      setCadenceSelection("");
      setCadenceError(null);
      setCadenceSuccess(null);
      setIsCadenceSheetOpen(true);

      if (!cadencesLoaded && !cadenceLoading) {
        void fetchCadences();
        return;
      }

      if (cadencesLoaded && cadences.length === 0 && !cadenceLoading) {
        void fetchCadences();
      }
    },
    [cadenceLoading, cadences, cadencesLoaded, fetchCadences],
  );

  const submitCadenceEnrollment = useCallback(async () => {
    if (!leadForCadence) {
      setCadenceError("Select a lead to enroll.");
      return;
    }

    if (!cadenceSelection) {
      setCadenceError("Select a cadence to assign.");
      return;
    }

    setCadenceSubmitting(true);
    setCadenceError(null);
    setCadenceSuccess(null);

    try {
      const response = await fetch(`/api/leads/${leadForCadence.id}/cadences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadenceId: cadenceSelection }),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to enroll cadence");
      }

      await fetchLeads({ showSpinner: false });

      const cadenceName =
        cadences.find((cadence) => cadence.id === cadenceSelection)?.name ??
        "Cadence";

      setCadenceSuccess(`${cadenceName} assigned to lead.`);
    } catch (err) {
      console.error(err);
      setCadenceError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setCadenceSubmitting(false);
    }
  }, [cadenceSelection, cadences, fetchLeads, leadForCadence]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/leads/outbound");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !SALES_PORTAL_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }

    void fetchLeads();
    void fetchTerritories();
    void fetchOwnerDirectory();
  }, [
    session,
    status,
    router,
    fetchLeads,
    fetchTerritories,
    fetchOwnerDirectory,
  ]);

  useEffect(() => {
    if (!searchParams) return;
    const focusId = searchParams.get("focus");
    if (focusId) {
      setPendingFocusId(focusId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchTeamLocations = async () => {
      try {
        const res = await fetch("/api/leads/outbound/team");
        if (res.status === 403) {
          setTeamLocations([]);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }
        const json = await res.json();
        if (!json.ok)
          throw new Error(json.error || "Failed to load team locations");
        if (!cancelled) {
          setTeamLocations(Array.isArray(json.data) ? json.data : []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setTeamLocations([]);
        }
      }
    };

    void fetchTeamLocations();
    intervalId = setInterval(fetchTeamLocations, 30000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [status]);

  useEffect(() => {
    if (!locationError) {
      setLocationErrorDismissed(false);
    }
  }, [locationError]);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("denied");
      setLocationError("Location services are unavailable in this browser.");
      return;
    }

    const geo = navigator.geolocation;
    const fastOptions: PositionOptions = {
      enableHighAccuracy: false,
      maximumAge: 600_000,
      timeout: 5_000,
    };
    const preciseOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 20_000,
      timeout: 10_000,
    };

    setLocationStatus("pending");
    setLocationError(null);
    setLocationErrorDismissed(false);

    let watchId: number | null = null;
    let cancelled = false;

    const centerOnPosition = (position: GeolocationPosition) => {
      handleLocationSuccess(position);

      const shouldCenter =
        !hasCenteredOnUserRef.current || forceCenterOnUserRef.current;
      if (shouldCenter) {
        hasCenteredOnUserRef.current = true;
        forceCenterOnUserRef.current = false;
        setViewMode("map");
        setMapFocus({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          key: Date.now(),
        });
      }
    };

    const requestPreciseFix = () => {
      geo.getCurrentPosition(
        (position) => {
          if (!cancelled) {
            centerOnPosition(position);
          }
        },
        (error) => {
          if (!cancelled) {
            handleLocationError(error);
          }
        },
        preciseOptions,
      );
    };

    geo.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        centerOnPosition(position);
        requestPreciseFix();
      },
      (error) => {
        if (cancelled) return;
        if (error.code === error.PERMISSION_DENIED) {
          handleLocationError(error);
          return;
        }
        requestPreciseFix();
      },
      fastOptions,
    );

    watchId = geo.watchPosition(
      (position) => {
        if (!cancelled) {
          centerOnPosition(position);
        }
      },
      (error) => {
        if (!cancelled) {
          handleLocationError(error);
        }
      },
      preciseOptions,
    );

    return () => {
      cancelled = true;
      if (watchId != null) {
        geo.clearWatch(watchId);
      }
    };
  }, [handleLocationError, handleLocationSuccess]);

  useEffect(() => {
    if (!leadForCadence) return;
    const refreshed = leads.find((lead) => lead.id === leadForCadence.id);
    if (refreshed && refreshed !== leadForCadence) {
      setLeadForCadence(refreshed);
    }
  }, [leadForCadence, leads]);

  useEffect(() => {
    if (!selectedLead) return;
    const refreshed = leads.find((lead) => lead.id === selectedLead.id);
    if (refreshed && refreshed !== selectedLead) {
      setSelectedLead(refreshed);
    }
  }, [leads, selectedLead]);

  useEffect(() => {
    if (!activeLead) return;
    const refreshed = leads.find((lead) => lead.id === activeLead.id);
    if (refreshed && refreshed !== activeLead) {
      setActiveLead(refreshed);
    }
  }, [activeLead, leads]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void fetchLeads();
  };

  const toggleDropMode = useCallback(() => {
    setIsDroppingPin((prev) => {
      const next = !prev;
      if (next) {
        setViewMode("map");
        setFreezeViewport(true);
        setReverseLookupError(null);
        setReverseLookupCompleted(false);
        setReverseLookupLoading(false);
        autoDropAtUserRef.current = false;
      } else {
        setFreezeViewport(false);
        setPendingCoordinates(null);
        setReverseLookupLoading(false);
        setReverseLookupError(null);
        setReverseLookupCompleted(false);
        autoDropAtUserRef.current = false;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (viewMode !== "map") {
      setSelectedLead(null);
      if (isDroppingPin) {
      setIsDroppingPin(false);
      }
      setFreezeViewport(false);
      setReverseLookupLoading(false);
      setReverseLookupError(null);
      setReverseLookupCompleted(false);
    }
  }, [viewMode, isDroppingPin]);

  useEffect(() => {
    if (!pendingCoordinates || !isHouseNumberConfirmed || !hasStreetSelection) return;
    const trimmedHouse = houseNumber.trim();
    if (!trimmedHouse) return;
    const streetSource = (selectedStreet || customStreet).trim();
    if (!streetSource) return;
    setCreateForm((prev) => ({
      ...prev,
      address:
        `${trimmedHouse} ${streetSource}`.trim(),
    }));
  }, [
    houseNumber,
    selectedStreet,
    customStreet,
    pendingCoordinates,
    isHouseNumberConfirmed,
    hasStreetSelection,
  ]);

  useEffect(() => {
    if (!pendingCoordinates || !showQuickVisitSection) return;
    setCreateForm((prev) => ({
      ...prev,
      dogs:
        dogPresence === "HAS_DOG"
          ? String(dogCount ?? 1)
          : dogPresence === "NO_DOG"
            ? "0"
            : "",
    }));
  }, [dogPresence, dogCount, pendingCoordinates, showQuickVisitSection]);

  useEffect(() => {
    if (!isDroppingPin) {
      autoDropAtUserRef.current = false;
    }
  }, [isDroppingPin]);

  const resetActivityForm = () => {
    setActivityType("DOOR_KNOCK");
    setActivityNotes("");
    setActivityResult("");
  };

  const prefillAddressFromCoordinates = useCallback(
    async (coords: Coordinates) => {
      setReverseLookupLoading(true);
      setReverseLookupError(null);
      setReverseLookupCompleted(false);

      try {
        const params = new URLSearchParams({
          lat: coords.latitude.toString(),
          lng: coords.longitude.toString(),
        });
        const response = await fetch(`/api/geo/reverse?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Unable to look up address");
        }

        const address = payload?.data?.address ?? {};
        const line1 = address.line1 || null;
        const cityValue = address.city || null;
        const stateValue =
          address.stateCode || normalizeState(address.state) || null;
        const postalCode = address.postalCode || null;
        const rawStreetCandidates = Array.isArray(address.streetCandidates)
          ? address.streetCandidates.filter((street: unknown): street is string =>
              Boolean(street && typeof street === "string"),
            )
          : [];
        const { house, street } = splitHouseAndStreet(line1);

        const disallowed = new Set(
          [address.neighbourhood, address.suburb, address.city, address.county]
            .filter((value) => typeof value === "string")
            .map((value) => value.trim().toLowerCase()),
        );

        const STREET_HINT_REGEX = /\b(ave|avenue|st|street|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|pl|place|way|pkwy|parkway|trail|trl|loop|cir|circle|terrace|ter|hwy|highway|pike|pass|row|walk|alley)\b/i;

        const normalizedCandidates = Array.from(
          new Set<string>(
            rawStreetCandidates
              .map((value: string) => value.trim())
              .filter((value: string) => value.length > 0),
          ),
        );

        const filteredCandidates: string[] = normalizedCandidates.filter((candidate: string) => {
          const lower = candidate.toLowerCase();
          if (disallowed.has(lower)) return false;
          if (STREET_HINT_REGEX.test(candidate)) return true;
          return candidate.includes(" ");
        });

        const finalCandidates: string[] = filteredCandidates.length
          ? filteredCandidates
          : normalizedCandidates.filter((candidate: string) => {
              const lower = candidate.toLowerCase();
              return !disallowed.has(lower);
            });

        setStreetOptions((prev) => {
          if (finalCandidates.length) return finalCandidates;
          if (street) {
            const set = new Set<string>(prev);
            set.add(street);
            return Array.from(set);
          }
          return prev;
        });
        setSelectedStreet((prev) => {
          if (prev && finalCandidates.includes(prev)) return prev;
          if (finalCandidates.length) return finalCandidates[0];
          if (street) return street;
          return prev;
        });
        setCustomStreet("");
        const suggestion = typeof house === "string" && house.length > 0 ? house : null;
        setHouseNumberSuggestion(suggestion);
        setHouseNumber("");
        setIsHouseNumberConfirmed(false);

        requestAnimationFrame(() => {
          const input = houseNumberInputRef.current;
          if (!input) return;
          if (suggestion && suggestion.trim().length >= 1) {
            const prefixLength = Math.min(2, suggestion.length);
            const prefix = suggestion.slice(0, prefixLength);
            setHouseNumber(prefix);
            input.focus();
            const caret = prefix.length;
            input.setSelectionRange(caret, caret);
            return;
          }
          input.focus();
        });

        setCreateForm((prev) => {
          const latest = pendingCoordinatesRef.current;
          if (
            latest &&
            (latest.latitude !== coords.latitude ||
              latest.longitude !== coords.longitude)
          ) {
            return prev;
          }

          return {
            ...prev,
            city: prev.city || cityValue || prev.city,
            state: prev.state || stateValue || prev.state,
            zipCode: prev.zipCode || postalCode || prev.zipCode,
          };
        });

        if (
          (!pendingCoordinatesRef.current ||
            (pendingCoordinatesRef.current.latitude === coords.latitude &&
              pendingCoordinatesRef.current.longitude === coords.longitude)) &&
          (line1 || cityValue || stateValue || postalCode)
        ) {
          setReverseLookupCompleted(true);
        }
      } catch (error) {
        console.error("Reverse geocoding failed", error);
        setReverseLookupError(
          error instanceof Error ? error.message : "Reverse geocoding failed",
        );
      } finally {
        setReverseLookupLoading(false);
      }
    },
    [],
  );

  const handleCreateFieldChange = useCallback(
    (field: keyof NewLeadForm, value: string) => {
      setCreateForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleApplyAiVisit = useCallback(
    (result: AiVisitResult) => {
      setAiVisitResult(result);
      setVisitCaptureMode("quick");

      const encounterSet = Array.from(
        new Set(
          Array.isArray(result.encounterTags)
            ? result.encounterTags.filter(Boolean)
            : [],
        ),
      );
      setEncounterTags(encounterSet);

      if (
        result.dogPresence === "HAS_DOG" ||
        result.dogPresence === "NO_DOG" ||
        result.dogPresence === "UNKNOWN"
      ) {
        setDogPresence(result.dogPresence);
      } else {
        setDogPresence(null);
      }

      if (
        typeof result.dogCount === "number" &&
        Number.isFinite(result.dogCount) &&
        result.dogCount >= 0
      ) {
        setDogCount(result.dogCount);
      } else {
        setDogCount(null);
      }

      const objectionSet = Array.from(
        new Set(
          Array.isArray(result.objectionTags)
            ? result.objectionTags.filter(Boolean)
            : [],
        ),
      );
      setObjectionTags(objectionSet);

      const noteParts: string[] = [];
      if (typeof result.summary === "string" && result.summary.trim()) {
        noteParts.push(result.summary.trim());
      }
      if (typeof result.followUp === "string" && result.followUp.trim()) {
        noteParts.push(`Follow-up: ${result.followUp.trim()}`);
      }
      if (typeof result.transcript === "string" && result.transcript.trim()) {
        noteParts.push(`Transcript: ${result.transcript.trim()}`);
      }
      setQuickNotes(noteParts.join("\n\n"));

      toast.success("AI notes applied. Review and save the visit log.");
    },
    [],
  );

  const beginCreateLead = useCallback(
    (coords?: Coordinates | null) => {
      setCreateForm(makeNewLeadForm());
      setCreateError(null);
      setReverseLookupError(null);
      setReverseLookupCompleted(false);
      setHouseNumber("");
      setHouseNumberSuggestion(null);
      setIsHouseNumberConfirmed(false);
      setStreetOptions([]);
      setSelectedStreet("");
      setShowAdvancedAddress(Boolean(!coords));
      setDogPresence(null);
      setDogCount(null);
      setEncounterTags([]);
      setObjectionTags([]);
      setQuickNotes("");
      setVisitCaptureMode("prompt");
      setAiVisitResult(null);
      setCustomStreet("");
      setPendingCoordinates(coords ?? null);
      if (coords) {
        pendingCoordinatesRef.current = coords;
      } else {
        pendingCoordinatesRef.current = null;
      }

      if (coords) {
        setFreezeViewport(true);
        setViewMode("map");
        setMapFocus({
          latitude: coords.latitude,
          longitude: coords.longitude,
          key: Date.now(),
        });
        void prefillAddressFromCoordinates(coords);
      } else {
        setReverseLookupLoading(false);
      }

      setIsDroppingPin(false);
      setIsCreateSheetOpen(true);
    },
    [prefillAddressFromCoordinates],
  );

  const handlePinCaptured = useCallback(
    (coords: Coordinates) => {
      beginCreateLead(coords);
    },
    [beginCreateLead],
  );

  useEffect(() => {
    if (!isDroppingPin) return;
    if (!autoDropAtUserRef.current) return;
    if (userLocation) {
      autoDropAtUserRef.current = false;
      handlePinCaptured(userLocation);
    }
  }, [isDroppingPin, userLocation, handlePinCaptured]);

  const clearCapturedCoordinates = useCallback(() => {
    setPendingCoordinates(null);
    setReverseLookupLoading(false);
    setReverseLookupError(null);
    setReverseLookupCompleted(false);
    setFreezeViewport(false);
    pendingCoordinatesRef.current = null;
    setHouseNumber("");
    setHouseNumberSuggestion(null);
    setIsHouseNumberConfirmed(false);
    setStreetOptions([]);
    setSelectedStreet("");
    setCustomStreet("");
    setVisitCaptureMode("prompt");
    setAiVisitResult(null);
  }, []);

  const retryReverseLookup = useCallback(() => {
    if (pendingCoordinates) {
      setReverseLookupError(null);
      setReverseLookupCompleted(false);
      void prefillAddressFromCoordinates(pendingCoordinates);
    }
  }, [pendingCoordinates, prefillAddressFromCoordinates]);

  useEffect(() => {
    pendingCoordinatesRef.current = pendingCoordinates;
  }, [pendingCoordinates]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const focusOnUserLocation = useCallback((): boolean => {
    const coords = userLocationRef.current;
    if (!coords) {
      return false;
    }

    setViewMode("map");
    setMapFocus({
      latitude: coords.latitude,
      longitude: coords.longitude,
      key: Date.now(),
    });
    hasCenteredOnUserRef.current = true;
    return true;
  }, [setMapFocus, setViewMode]);

  const requestLocationRefresh = useCallback(
    (options?: { skipImmediate?: boolean }) => {
      const skipImmediate = options?.skipImmediate ?? false;
      if (!skipImmediate) {
        focusOnUserLocation();
      }

      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        setLocationStatus("denied");
        setLocationError("Location services are unavailable in this browser.");
        return;
      }

      setLocationStatus("pending");
      setLocationError(null);
      setLocationErrorDismissed(false);

      forceCenterOnUserRef.current = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationSuccess(position);
          hasCenteredOnUserRef.current = true;
          forceCenterOnUserRef.current = false;
          setViewMode("map");
          setMapFocus({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            key: Date.now(),
          });
        },
        (error) => {
          forceCenterOnUserRef.current = false;
          handleLocationError(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15_000,
        },
      );
    },
    [
      focusOnUserLocation,
      handleLocationError,
      handleLocationSuccess,
      setMapFocus,
      setViewMode,
    ],
  );

  const dropPinAtUserLocation = useCallback(() => {
    const coords = userLocationRef.current;
    if (coords) {
      handlePinCaptured(coords);
      return;
    }
    autoDropAtUserRef.current = true;
    requestLocationRefresh({ skipImmediate: true });
  }, [handlePinCaptured, requestLocationRefresh]);

  const centerMapOnUser = useCallback(() => {
    const centered = focusOnUserLocation();
    if (!centered) {
      requestLocationRefresh();
      return;
    }
    forceCenterOnUserRef.current = true;
  }, [focusOnUserLocation, requestLocationRefresh]);

  const jumpToLeadOnMap = useCallback((lead: OutboundLead) => {
    setPendingFocusId(lead.id);
    setViewMode("map");
    const coords = getLeadCoordinates(lead);
    if (coords) {
      setMapFocus({ latitude: coords.latitude, longitude: coords.longitude, key: Date.now() });
    }
  }, []);

  useEffect(() => {
    if (!pendingFocusId || !leads.length) return;
    const target = leads.find((lead) => lead.id === pendingFocusId);
    if (!target) return;

    setSelectedLead(target);
    setIsDroppingPin(false);
    setViewMode("map");
    const coords = getLeadCoordinates(target);
    if (coords) {
      setMapFocus({
        latitude: coords.latitude,
        longitude: coords.longitude,
        key: Date.now(),
      });
    }
    setMapLeadSelection(target.id);
    setPendingFocusId(null);
  }, [pendingFocusId, leads]);

  const mapFilterKey = useMemo(
    () => `${territoryFilter}|${ownerFilter}`,
    [territoryFilter, ownerFilter],
  );

  useEffect(() => {
    setMapLeadSelection("");
    setSelectedLead(null);
  }, [mapFilterKey]);

  const logQuickActivityForLead = useCallback(
    async (
      leadId: string,
      details: {
        encounter: string[];
        objections: string[];
        dogPresence: DogPresenceValue | null;
        dogCount: number | null;
        notes: string;
      },
    ) => {
      try {
        const tagParts: string[] = [];
        if (details.dogPresence) {
          tagParts.push(`dog=${details.dogPresence}`);
        }
        if (
          details.dogCount != null &&
          Number.isFinite(details.dogCount) &&
          (details.dogCount ?? 0) >= 0
        ) {
          tagParts.push(`dog_count=${details.dogCount}`);
        }
        if (details.encounter.length) {
          tagParts.push(`encounter=${details.encounter[0]}`);
        }
        if (details.objections.length) {
          tagParts.push(`objections=${details.objections.join("|")}`);
        }

        const tagLine = tagParts.length ? `Tags: ${tagParts.join(",")}` : "";

        const encounterLabels = details.encounter
          .map(
            (value) =>
              encounterOptions.find((option) => option.value === value)?.label ??
              value.replace(/_/g, " "),
          )
          .filter(Boolean);

        const objectionLabels = details.objections
          .map(
            (value) =>
              objectionOptions.find((option) => option.value === value)?.label ??
              value.replace(/_/g, " "),
          )
          .filter(Boolean);

        const additionalNote = details.notes?.trim() ?? "";

        const notesPayload = [tagLine, additionalNote]
          .map((segment) => segment?.trim())
          .filter((segment) => segment && segment.length > 0)
          .join("\n")
          .trim();
        const resultLabel = encounterLabels[0] ?? undefined;

        if (!notesPayload && !resultLabel) {
          return;
        }

        const response = await fetch(`/api/leads/${leadId}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "DOOR_KNOCK",
            result: resultLabel,
            notes: notesPayload || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error("Failed to log quick activity", data?.error || response.status);
        }
      } catch (error) {
        console.error("Quick activity logging failed", error);
      }
    },
    [],
  );

  const submitNewLead = useCallback(async () => {
    setCreateSubmitting(true);
    setCreateError(null);
    setReverseLookupLoading(false);

    const trimmedFirst = createForm.firstName.trim();
    const trimmedLast = createForm.lastName.trim();
    const trimmedEmail = createForm.email.trim();
    const trimmedPhone = createForm.phone.trim();
    const trimmedAddress = createForm.address.trim();
    const trimmedCity = createForm.city.trim();
    const trimmedState = createForm.state.trim();
    const trimmedZip = createForm.zipCode.trim();

    const hasName = Boolean(trimmedFirst || trimmedLast);
    const hasContact = Boolean(trimmedEmail || trimmedPhone);
    const hasLocation = Boolean(
      trimmedAddress ||
        trimmedCity ||
        trimmedState ||
        trimmedZip ||
        pendingCoordinates,
    );

    if (!hasName && !hasContact && !hasLocation) {
      setCreateError(
        "Please add at least a name, contact method, or address before saving.",
      );
      setCreateSubmitting(false);
      return;
    }

    const streetSource = selectedStreet || customStreet;
    const trimmedHouse = houseNumber.trim();
    const composedLine1 =
      trimmedHouse && streetSource
        ? `${trimmedHouse} ${streetSource}`.trim()
        : trimmedAddress;

    const payload: Record<string, unknown> = {
      pipelineStage: createForm.pipelineStage || "cold",
    };

    if (trimmedFirst) payload.firstName = trimmedFirst;
    if (trimmedLast) payload.lastName = trimmedLast;
    if (trimmedEmail) payload.email = trimmedEmail;
    if (trimmedPhone) payload.phone = trimmedPhone;
    const territoryId =
      createForm.territoryId === "UNASSIGNED" ? "" : createForm.territoryId;
    if (territoryId) payload.territoryId = territoryId;

    if (hasLocation) {
      payload.address = {
        line1: composedLine1 || undefined,
        city: trimmedCity || undefined,
        state: trimmedState ? trimmedState.toUpperCase() : undefined,
        zip: trimmedZip || undefined,
        latitude: pendingCoordinates?.latitude,
        longitude: pendingCoordinates?.longitude,
      };
    }

    if (pendingCoordinates) {
      if (!trimmedHouse) {
        setCreateError("Enter the house number before saving this prospect.");
        setCreateSubmitting(false);
        return;
      }
      if (!streetSource || !streetSource.trim()) {
        setCreateError("Select or enter the street name before saving.");
        setCreateSubmitting(false);
        return;
      }
    }

    const dogsCount = Number.parseInt(createForm.dogs, 10);
    if (!Number.isNaN(dogsCount) && dogsCount >= 0) {
      payload.dogs = dogsCount;
    }

    if (createForm.yardSize && createForm.yardSize !== "__unset") {
      payload.yardSize = createForm.yardSize;
    }

    if (createForm.frequency && createForm.frequency !== "__unset") {
      payload.frequency = createForm.frequency;
    }

    const combinedInstructions = [
      createForm.specialInstructions.trim(),
      quickNotes.trim() && !pendingCoordinates ? quickNotes.trim() : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (combinedInstructions) {
      payload.specialInstructions = combinedInstructions;
    }

    const primaryEncounter = encounterTags[0] ?? null;
    if (
      primaryEncounter === "NO_THANK_YOU" ||
      primaryEncounter === "RUDE" ||
      primaryEncounter === "NO_SOLICITING"
    ) {
      payload.pipelineStage = "lost";
    } else if (primaryEncounter === "INTERESTED") {
      payload.pipelineStage = "contacted";
    }

    if (pendingCoordinates) {
      setViewMode("map");
      setMapFocus({
        latitude: pendingCoordinates.latitude,
        longitude: pendingCoordinates.longitude,
        key: Date.now(),
      });
    }

    try {
      const response = await fetch("/api/leads/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { lead?: { id?: string } };
      };

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to create lead");
      }

      const createdLeadId = data?.data?.lead?.id;

      setIsCreateSheetOpen(false);
      setCreateForm(makeNewLeadForm());
      setPendingCoordinates(null);
      setIsDroppingPin(false);
      setReverseLookupError(null);
      setReverseLookupCompleted(false);
      setVisitCaptureMode("prompt");
      setAiVisitResult(null);

      if (createdLeadId) {
        setPendingFocusId(createdLeadId);
        setViewMode("map");
        setMapLeadSelection(createdLeadId);

        if (
          encounterTags.length ||
          objectionTags.length ||
          dogPresence ||
          quickNotes.trim()
        ) {
          await logQuickActivityForLead(createdLeadId, {
            encounter: encounterTags,
            objections: objectionTags,
            dogPresence,
            dogCount,
            notes: quickNotes.trim(),
          });
        }
      }

      await fetchLeads({ showSpinner: false });
      toast.success("Prospect saved");
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setCreateSubmitting(false);
      setFreezeViewport(false);
    }
  }, [
    createForm,
    pendingCoordinates,
    fetchLeads,
    selectedStreet,
    customStreet,
    houseNumber,
    encounterTags,
    objectionTags,
    dogPresence,
    dogCount,
    quickNotes,
    logQuickActivityForLead,
  ]);

  const loadActivityHistory = useCallback(
    async (options?: { reset?: boolean; cursor?: string | null }) => {
      if (!activeLead) return;
      const reset = options?.reset ?? false;
      const cursor = options?.cursor ?? null;

      if (reset) {
        setActivityHistory([]);
        setActivityHistoryCursor(null);
        setActivityHistoryHasMore(false);
      }

      setActivityHistoryLoading(true);
      setActivityHistoryError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "25");
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(
          `/api/leads/${activeLead.id}/activities?${params.toString()}`,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Failed to load activity history");
        }

        const fetched: LeadActivity[] = Array.isArray(data?.data?.activities)
          ? data.data.activities
          : [];
        const nextCursor = data?.data?.pageInfo?.nextCursor ?? null;

        setActivityHistory((prev) => {
          const base = reset ? [] : prev;
          if (!fetched.length) return base;
          const existingIds = new Set(base.map((activity) => activity.id));
          const merged = [...base];
          fetched.forEach((activity) => {
            if (!existingIds.has(activity.id)) {
              merged.push(activity);
              existingIds.add(activity.id);
            }
          });
          return merged;
        });
        setActivityHistoryCursor(nextCursor);
        setActivityHistoryHasMore(Boolean(nextCursor));
      } catch (error) {
        console.error(error);
        setActivityHistoryError(
          error instanceof Error
            ? error.message
            : "Failed to load activity history",
        );
      } finally {
        setActivityHistoryLoading(false);
      }
    },
    [activeLead],
  );

  useEffect(() => {
    if (!isSheetOpen || !activeLead) return;
    void loadActivityHistory({ reset: true });
  }, [isSheetOpen, activeLead, loadActivityHistory]);

  useEffect(() => {
    if (isSheetOpen) return;
    setActivityHistory([]);
    setActivityHistoryCursor(null);
    setActivityHistoryHasMore(false);
    setActivityHistoryError(null);
    setActivityHistoryLoading(false);
  }, [isSheetOpen]);

  const openActivitySheet = (lead: OutboundLead) => {
    setActiveLead(lead);
    resetActivityForm();
    setActivityHistory([]);
    setActivityHistoryCursor(null);
    setActivityHistoryHasMore(false);
    setActivityHistoryError(null);
    setIsSheetOpen(true);
  };

  const submitActivity = async () => {
    if (!activeLead) return;
    setActivitySubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${activeLead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityType,
          notes: activityNotes,
          result: activityResult,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log activity");
      }

      toast.success("Activity logged");
      resetActivityForm();
      await loadActivityHistory({ reset: true });
      await fetchLeads({ showSpinner: false });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setActivitySubmitting(false);
    }
  };

  const leadCountByStage = useMemo(() => {
    return leads.reduce<Record<string, number>>((acc, lead) => {
      const stage = (lead.pipelineStage || "unknown").toLowerCase();
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});
  }, [leads]);

  const toggleLeadSelection = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(leadId)) return prev;
        return [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  }, []);

  const toggleAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedLeadIds((prev) => {
        if (checked) {
          const combined = new Set(prev);
          filteredLeads.forEach((lead) => combined.add(lead.id));
          return Array.from(combined);
        }
        const idsToRemove = new Set(filteredLeads.map((lead) => lead.id));
        return prev.filter((id) => !idsToRemove.has(id));
      });
    },
    [filteredLeads],
  );

  const selectedCount = selectedLeadIds.length;
  const allVisibleSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selectedLeadIds.includes(lead.id));
  const someVisibleSelected =
    filteredLeads.length > 0 &&
    filteredLeads.some((lead) => selectedLeadIds.includes(lead.id));
  const headerCheckboxState = allVisibleSelected
    ? true
    : someVisibleSelected
    ? "indeterminate"
    : false;

  const bulkAssignOwnerIdResolved =
    bulkAssignOwnerId && bulkAssignOwnerId !== NO_OWNER_VALUE
      ? bulkAssignOwnerId
      : null;

  const handleBulkAssignSelected = useCallback(async () => {
    if (!selectedLeadIds.length) {
      toast.error("Select at least one lead to assign.");
      return;
    }
    const resolved = bulkAssignOwnerIdResolved;
    if (!resolved) {
      toast.error("Choose a sales rep before assigning.");
      return;
    }
    setBulkAssignLoading(true);
    try {
      await Promise.all(
        selectedLeadIds.map((leadId) =>
          updateLeadOwner(leadId, resolved, { silent: true, skipRefresh: true }),
        ),
      );
      await fetchLeads({ showSpinner: false });
      toast.success(
        `Assigned ${selectedLeadIds.length} lead${selectedLeadIds.length === 1 ? "" : "s"}.`,
      );
      setSelectedLeadIds([]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to assign selected leads",
      );
    } finally {
      setBulkAssignLoading(false);
    }
  }, [bulkAssignOwnerIdResolved, selectedLeadIds, updateLeadOwner, fetchLeads]);

  const deleteLead = useCallback(
    async (
      leadId: string,
      options?: { skipRefresh?: boolean; silent?: boolean },
    ) => {
      const skipRefresh = options?.skipRefresh ?? false;
      const silent = options?.silent ?? false;

      if (!silent) {
        setMutatingLeadId(leadId);
      }

      try {
        const response = await fetch(`/api/leads/${leadId}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Failed to delete lead");
        }

        setSelectedLead((current) =>
          current?.id === leadId ? null : current,
        );
        setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));

        if (!skipRefresh) {
          await fetchLeads({ showSpinner: false });
        }

        if (!silent) {
          toast.success("Lead deleted");
        }

        return true;
      } catch (error) {
        console.error("Failed to delete lead", error);
        if (!silent) {
          toast.error(
            error instanceof Error ? error.message : "Failed to delete lead",
          );
        }
        return false;
      } finally {
        if (!silent) {
          setMutatingLeadId(null);
        }
      }
    },
    [fetchLeads],
  );

  const handleBulkDeleteSelected = useCallback(async () => {
    if (!selectedLeadIds.length) {
      toast.error("Select at least one lead to delete.");
      return;
    }

    const confirmMessage = `Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? "" : "s"}? This cannot be undone.`;
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setBulkAssignLoading(true);
    try {
      let successCount = 0;
      for (const leadId of selectedLeadIds) {
        const success = await deleteLead(leadId, {
          silent: true,
          skipRefresh: true,
        });
        if (success) successCount += 1;
      }

      await fetchLeads({ showSpinner: false });
      setSelectedLeadIds([]);

      if (successCount === selectedLeadIds.length) {
        toast.success(
          `Deleted ${successCount} lead${successCount === 1 ? "" : "s"}.`,
        );
      } else if (successCount > 0) {
        toast.warning(
          `Deleted ${successCount} lead${successCount === 1 ? "" : "s"}. Some deletions failed.`,
        );
      } else {
        toast.error("Failed to delete the selected leads.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete selected leads",
      );
    } finally {
      setBulkAssignLoading(false);
    }
  }, [deleteLead, fetchLeads, selectedLeadIds]);

  const handleBulkUnassignSelected = useCallback(async () => {
    if (!selectedLeadIds.length) {
      toast.error("Select at least one lead to unassign.");
      return;
    }
    setBulkAssignLoading(true);
    try {
      await Promise.all(
        selectedLeadIds.map((leadId) =>
          updateLeadOwner(leadId, null, { silent: true, skipRefresh: true }),
        ),
      );
      await fetchLeads({ showSpinner: false });
      toast.success(
        `Unassigned ${selectedLeadIds.length} lead${selectedLeadIds.length === 1 ? "" : "s"}.`,
      );
      setSelectedLeadIds([]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to unassign selected leads",
      );
    } finally {
      setBulkAssignLoading(false);
    }
  }, [selectedLeadIds, updateLeadOwner, fetchLeads]);

  const handleClearSelection = useCallback(() => {
    setSelectedLeadIds([]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__yarduraOutbound = {
      leads,
      filteredLeads,
      encounterExclusions,
      dogExclusions,
      objectionExclusions,
      leadsWithCoordinates,
      mapHydrationStatus,
    };
  }, [
    leads,
    filteredLeads,
    encounterExclusions,
    dogExclusions,
    objectionExclusions,
    leadsWithCoordinates,
    mapHydrationStatus,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };
    setIsCompactViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const hideMapToolbar = viewMode === "map" && isCompactViewport;

  const selectedCadenceSummary = useMemo(
    () => cadences.find((cadence) => cadence.id === cadenceSelection) ?? null,
    [cadences, cadenceSelection],
  );

  const heroMetrics = useMemo(() => {
    let assigned = 0;
    let contacted = 0;

    for (const lead of leads) {
      if (lead.owner?.id) {
        assigned += 1;
      }
      if (lead.lastActivity) {
        contacted += 1;
      }
    }

    const total = leads.length;

    return {
      total,
      assigned,
      unassigned: Math.max(total - assigned, 0),
      mapped: leadsWithCoordinates.length,
      contacted,
    };
  }, [leads, leadsWithCoordinates.length]);

  const followUpSummary = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;

    for (const lead of leads) {
      if (!lead.nextActionAt) continue;
      const ts = new Date(lead.nextActionAt).getTime();
      if (!Number.isFinite(ts)) continue;

      if (ts < now.getTime()) {
        overdue += 1;
      } else if (ts >= startOfDay.getTime() && ts <= endOfDay.getTime()) {
        dueToday += 1;
      } else {
        upcoming += 1;
      }
    }

    return { overdue, dueToday, upcoming };
  }, [leads]);

  if (status === "loading" || isLoading) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-mint/70 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <span className="admin-pill inline-flex items-center gap-2">
              <Target className="h-3.5 w-3.5" />
              Outbound Ops
            </span>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
                Canvassing & Door Knocking
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                Guide field sales reps through daily turf assignments, log door activity, and keep follow-ups on pace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
              onClick={() => router.push("/admin/leads/cadences")}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Cadences
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchLeads({ showSpinner: true })}
              disabled={isLoading}
              className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Filter className="mr-2 h-4 w-4" />
              )}
              Refresh list
            </Button>
            <Button
              className="rounded-xl bg-brand-coral text-white shadow-sm transition hover:bg-brand-coral/90"
              onClick={() => beginCreateLead()}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              New prospect
            </Button>
          </div>
        </div>

        <div className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          <div className="admin-card min-w-[220px] snap-start rounded-2xl p-4 sm:min-w-0 sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Active prospects
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
              {heroMetrics.total.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {heroMetrics.assigned.toLocaleString()} assigned • {heroMetrics.unassigned.toLocaleString()} unassigned
            </p>
          </div>
          <div className="admin-card min-w-[220px] snap-start rounded-2xl p-4 sm:min-w-0 sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Mapped homes
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
              {heroMetrics.mapped.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {heroMetrics.mapped === 0 ? "Pin new homes from the map" : "Ready for routing"}
            </p>
          </div>
          <div className="admin-card min-w-[220px] snap-start rounded-2xl p-4 sm:min-w-0 sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Follow-up load
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
              {followUpSummary.dueToday.toLocaleString()} today
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {followUpSummary.overdue.toLocaleString()} overdue • {followUpSummary.upcoming.toLocaleString()} upcoming
            </p>
          </div>
          <div className="admin-card min-w-[220px] snap-start rounded-2xl p-4 sm:min-w-0 sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Logged interactions
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
              {heroMetrics.contacted.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedLeadIds.length.toLocaleString()} selected for bulk actions
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          <div className="admin-card rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setViewMode("table")}
                >
                  <List className="h-4 w-4" /> Table
                </Button>
                <Button
                  variant={viewMode === "map" ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setViewMode("map")}
                >
                  <MapIcon className="h-4 w-4" /> Map
                </Button>
                {!hideMapToolbar && viewMode === "map" && leadsWithCoordinates.length > 0 ? (
                  <Select
                    value={mapLeadSelection}
                    onValueChange={(value) => {
                      setMapLeadSelection(value);
                      if (value) {
                        const params = new URLSearchParams({ focus: value });
                        router.push(`/admin/leads/outbound?${params.toString()}`);
                      }
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "rounded-xl border-slate-200 dark:border-slate-700",
                        "w-full min-w-[160px] sm:w-[220px]",
                      )}
                    >
                      <SelectValue placeholder="Jump to lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadsWithCoordinates.map((lead) => {
                        const name =
                          [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                          "Unnamed lead";
                        const subtitle = [lead.city, lead.state]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <SelectItem key={lead.id} value={lead.id}>
                            <div className="flex flex-col text-left">
                              <span>{name}</span>
                              {subtitle ? (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {subtitle}
                                </span>
                              ) : null}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : null}
                {!hideMapToolbar && viewMode === "map" ? (
                  <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
                    <SelectTrigger
                      className={cn(
                        "rounded-xl border-slate-200 dark:border-slate-700",
                        "w-full min-w-[160px] sm:w-[200px]",
                      )}
                    >
                      <SelectValue placeholder="Territory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All territories</SelectItem>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {territories.map((territory) => (
                        <SelectItem key={territory.id} value={territory.id}>
                          {territory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {!hideMapToolbar && viewMode === "map" ? (
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger
                      className={cn(
                        "rounded-xl border-slate-200 dark:border-slate-700",
                        "w-full min-w-[160px] sm:w-[220px]",
                      )}
                    >
                      <SelectValue placeholder="Owner" />
                    </SelectTrigger>
                    <SelectContent className="w-[220px] max-w-[80vw]">
                      <SelectItem value="all">All owners</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {availableOwners
                        .filter((option) => option.id && option.id.trim().length > 0)
                        .map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {!hideMapToolbar && viewMode === "map" ? (
                  <Select
                    value={mapStyleMode}
                    onValueChange={(value) =>
                      setMapStyleMode(value as MapStyleMode)
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "rounded-xl border-slate-200 dark:border-slate-700",
                        "w-full min-w-[160px] sm:w-[200px]",
                      )}
                    >
                      <SelectValue placeholder="Map style" />
                    </SelectTrigger>
                    <SelectContent className="w-[220px] max-w-[80vw]">
                      {MAP_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!hideMapToolbar && viewMode === "map" ? (
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                    onClick={() => {
                      setViewMode("map");
                      requestLocationRefresh();
                    }}
                    disabled={locationStatus === "pending"}
                  >
                    <LocateFixed className="h-4 w-4" />
                    {locationStatus === "pending" ? "Locating…" : "Locate me"}
                  </Button>
                ) : null}
                {!hideMapToolbar && viewMode === "map" ? (
                  <Button
                    variant={showTeamRadar ? "default" : "outline"}
                    className={cn(
                      "gap-2 rounded-xl",
                      showTeamRadar
                        ? "bg-brand-mint text-white hover:bg-brand-mint/90"
                        : "border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40",
                    )}
                    onClick={() => setShowTeamRadar((prev) => !prev)}
                  >
                    <UsersIcon className="h-4 w-4" />
                    {showTeamRadar ? "Hide team" : "Team radar"}
                  </Button>
                ) : null}
                {!hideMapToolbar && viewMode === "map" ? (
                  <Button
                    variant={isDroppingPin ? "default" : "outline"}
                    className={cn(
                      "gap-2 rounded-xl",
                      isDroppingPin
                        ? "bg-brand-mint text-white hover:bg-brand-mint/90"
                        : "border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40",
                    )}
                    onClick={toggleDropMode}
                  >
                    <MapPinPlus className="h-4 w-4" />
                    {isDroppingPin ? "Cancel drop" : "Drop pin"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="admin-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint/30 focus-visible:ring-offset-1 dark:text-slate-100 dark:hover:bg-slate-800/60"
                onClick={() => setFiltersExpanded((prev) => !prev)}
                aria-expanded={filtersExpanded}
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-brand-mint dark:text-slate-900">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </span>
                {filtersExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
        {filtersExpanded ? (
          <div className="border-t border-slate-100 dark:border-slate-800/80">
            <Accordion
              type="multiple"
              value={openFilterSections}
              onValueChange={(value) =>
                setOpenFilterSections(Array.isArray(value) ? value : [])
              }
              className="divide-y divide-slate-100 dark:divide-slate-800/80"
            >
              <AccordionItem value="encounters">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100/70 dark:text-slate-100 dark:hover:bg-slate-800/60">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>Visit outcomes</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      {encounterSummary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {encounterOptions.map((option) => {
                      const value = option.value;
                      const state = computeOptionState(
                        value,
                        encounterIncludes,
                        encounterExclusions,
                        ENCOUNTER_VALUES,
                      );

                      const handleToggle = () => {
                        if (
                          encounterIncludes.length > 0 &&
                          encounterIncludes.includes(value)
                        ) {
                          setEncounterOnly(value);
                          return;
                        }

                        toggleEncounterExclusion(value);
                      };

                      return (
                        <FilterOptionCard
                          key={value}
                          title={option.label}
                          state={state}
                          onToggleExclude={handleToggle}
                          onOnly={() => setEncounterOnly(value)}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dogs">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100/70 dark:text-slate-100 dark:hover:bg-slate-800/60">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>Dog signals</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      {dogSummary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {dogPresenceOptions.map((option) => {
                      const value = option.value as DogPresenceValue;
                      const state = computeOptionState(
                        value,
                        dogIncludes,
                        dogExclusions,
                        DOG_VALUES,
                      );

                      const handleToggle = () => {
                        if (dogIncludes.length > 0 && dogIncludes.includes(value)) {
                          setDogOnly(value);
                          return;
                        }

                        toggleDogExclusion(value);
                      };

                      return (
                        <FilterOptionCard
                          key={value}
                          title={option.label}
                          description={option.description}
                          state={state}
                          onToggleExclude={handleToggle}
                          onOnly={() => setDogOnly(value)}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="objections">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100/70 dark:text-slate-100 dark:hover:bg-slate-800/60">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>Objections</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      {objectionSummary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {objectionOptions.map((option) => {
                      const value = option.value;
                      const state = computeOptionState(
                        value,
                        objectionIncludes,
                        objectionExclusions,
                        OBJECTION_VALUES,
                      );

                      const handleToggle = () => {
                        if (
                          objectionIncludes.length > 0 &&
                          objectionIncludes.includes(value)
                        ) {
                          setObjectionOnly(value);
                          return;
                        }

                        toggleObjectionExclusion(value);
                      };

                      return (
                        <FilterOptionCard
                          key={value}
                          title={option.label}
                          state={state}
                          onToggleExclude={handleToggle}
                          onOnly={() => setObjectionOnly(value)}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : null}
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <div
              key={chip.key}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-rose-500 dark:text-slate-400 dark:hover:bg-slate-700/70"
                aria-label={`Remove filter ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-slate-600 hover:text-brand-mint dark:text-slate-300 dark:hover:text-brand-mint"
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>

    {!hideMapToolbar && (
      <div className="flex flex-wrap gap-2">
        {stageOptions
          .filter((option) => option.value !== "all")
          .map((option) => (
            <div
              key={option.value}
              className="admin-card w-full rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm sm:w-[calc(50%-0.5rem)] lg:w-[180px] dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {option.label}
              </div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white">
                {leadCountByStage[option.value] ?? 0}
              </div>
            </div>
          ))}
      </div>
    )}

      {viewMode === "table" ? (
        <>
          <div className="md:hidden">
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Leads
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredLeads.length.toLocaleString()} of {leads.length.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {filteredLeads.map((lead) => {
                const coords = getLeadCoordinates(lead);
                const name =
                  [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                  lead.email ||
                  lead.phone ||
                  "Unnamed lead";
                const subtitle = [lead.city, lead.state]
                  .filter(Boolean)
                  .join(", ");
                const leadTypeMeta =
                  leadTypeDisplay[
                    (lead.leadType ?? "outbound").toLowerCase() as keyof typeof leadTypeDisplay
                  ] ?? leadTypeDisplay.outbound;
                const nextActionStatus = getLeadNextActionStatus(lead);
                return (
                  <div
                    key={lead.id}
                    className="admin-card rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {name}
                        </div>
                        {subtitle ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {subtitle}
                          </div>
                        ) : null}
                        {lead.address ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3" /> {lead.address}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge className={cn("border text-xs", leadTypeMeta.badgeClass)}>
                            {leadTypeMeta.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-xs capitalize border", stageBadgeColor(lead.stageColor))}
                          >
                            {lead.pipelineStage || "Unknown"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              nextActionStatus.code === "overdue"
                                ? "border-rose-200 text-rose-600 dark:border-rose-400/70 dark:text-rose-200"
                                : nextActionStatus.code === "today"
                                  ? "border-brand-mint/30 text-brand-mint dark:border-brand-mint/40 dark:text-brand-mint"
                                  : "border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300",
                            )}
                          >
                            {nextActionStatus.label}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 dark:text-slate-300"
                        onClick={() => {
                          setSelectedLead(lead);
                          setViewMode("map");
                          if (coords) {
                            setMapFocus({
                              latitude: coords.latitude,
                              longitude: coords.longitude,
                              key: Date.now(),
                            });
                          } else {
                            setPendingFocusId(lead.id);
                          }
                        }}
                        aria-label="Open on map"
                      >
                        <MapIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        <span>{lead.owner?.name ?? lead.owner?.email ?? "Unassigned rep"}</span>
                        <span className="text-slate-400">•</span>
                        <span>{lead.zipCode ?? "No ZIP"}</span>
                        {lead.dogs != null ? (
                          <>
                            <span className="text-slate-400">•</span>
                            <span>{lead.dogs} dog{lead.dogs === 1 ? "" : "s"}</span>
                          </>
                        ) : null}
                      </div>
                      {lead.serviceArea ? (
                        <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          <Target className="h-3 w-3" />
                          <span>{lead.serviceArea.slug}</span>
                          <span className="text-slate-400">•</span>
                          <span>{lead.serviceArea.status.toLowerCase()}</span>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <TimerReset className="h-3 w-3" />
                          {formatRelativeMinutes(lead.nextActionSlaMinutes)}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span>{formatDate(lead.nextActionAt)}</span>
                      </div>
                      {lead.lastActivity ? (
                        <div className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                            <Activity className="h-3 w-3" />
                            {lead.lastActivity.type.replace(/_/g, " ")}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{formatDate(lead.lastActivity.occurredAt)}</span>
                            {lead.lastActivity.result ? (
                              <>
                                <span className="text-slate-400">•</span>
                                <span>{lead.lastActivity.result}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[120px] gap-2 rounded-xl bg-brand-mint text-white hover:bg-brand-mint/90"
                        onClick={() => {
                          openActivitySheet(lead);
                          setIsMobileMapSheetOpen(false);
                        }}
                      >
                        <Plus className="h-3 w-3" /> Log activity
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[120px] gap-2 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                        onClick={() => openCadenceSheet(lead)}
                      >
                        <PlayCircle className="h-3 w-3" /> Cadence
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[120px] gap-2 rounded-xl border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-rose-400"
                        onClick={() => {
                          setSelectedLead(lead);
                          if (coords) {
                            setMapFocus({
                              latitude: coords.latitude,
                              longitude: coords.longitude,
                              key: Date.now(),
                            });
                          } else {
                            setPendingFocusId(lead.id);
                          }
                          setViewMode("map");
                        }}
                      >
                        <MapPin className="h-3 w-3" /> View on map
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredLeads.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                  No outbound leads match your filters.
                </div>
              ) : null}
            </div>
          </div>

          <Card className="hidden md:block admin-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <CardHeader className="py-3">
              <CardTitle>Lead List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[220px]">
                <Input
                  placeholder="Search by name, email, phone, or city"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-[200px]">
                <Select
                  value={stageFilter}
                  onValueChange={(value) => setStageFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 space-y-1">
                </div>
              <div className="w-[220px]">
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
              <SelectContent className="w-[220px] max-w-[80vw]">
                <SelectItem value="all">All owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {availableOwners
                  .filter((option) => option.id && option.id.trim().length > 0)
                  .map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
              </div>
              <div className="w-[220px]">
                <Select
                  value={territoryFilter}
                  onValueChange={setTerritoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Territory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All territories</SelectItem>
                    <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                    {territories.map((territory) => (
                      <SelectItem key={territory.id} value={territory.id}>
                        {territory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="gap-2">
                <Filter className="w-4 h-4" /> Apply
              </Button>
            </form>

            {error && (
              <div className="p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                {error}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {selectedCount} lead{selectedCount === 1 ? "" : "s"} selected
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={bulkAssignOwnerId}
                    onValueChange={setBulkAssignOwnerId}
                    disabled={bulkAssignLoading}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Choose sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OWNER_VALUE}>Select a rep</SelectItem>
                      {availableOwners
                        .filter((option) => option.id && option.id.trim().length > 0)
                        .map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="gap-2"
                    onClick={handleBulkAssignSelected}
                    disabled={
                      bulkAssignLoading || !bulkAssignOwnerIdResolved || selectedCount === 0
                    }
                  >
                    {bulkAssignLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                    Assign
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleBulkUnassignSelected}
                    disabled={bulkAssignLoading || selectedCount === 0}
                  >
                    {bulkAssignLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserX className="w-3 h-3" />
                    )}
                    Unassign
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={handleBulkDeleteSelected}
                    disabled={bulkAssignLoading || selectedCount === 0}
                  >
                    {bulkAssignLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleClearSelection}
                    disabled={bulkAssignLoading}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={headerCheckboxState}
                        onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Stage & Owner</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Last Touch</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[130px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const fullName =
                      [lead.firstName, lead.lastName]
                        .filter(Boolean)
                        .join(" ") || "Unnamed lead";
                    const displayEmail = sanitizeLeadEmail(lead.email);
                    const territoryLabel = lead.territory?.name || "Unassigned";
                  const nextSlaClass =
                    lead.nextActionSlaMinutes && lead.nextActionSlaMinutes < 0
                      ? "text-rose-600"
                      : "text-slate-600";
                  const leadTypeMeta =
                    leadTypeDisplay[
                      (lead.leadType ?? "outbound").toLowerCase() as keyof typeof leadTypeDisplay
                    ] ?? leadTypeDisplay.outbound;
                  const isMutating = mutatingLeadId === lead.id;

                  const handleUnassign = async () => {
                    const confirmed = window.confirm(
                      "Remove rep assignment from this lead?",
                    );
                    if (!confirmed) return;
                    await updateLeadOwner(lead.id, null);
                  };

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={(checked) =>
                            toggleLeadSelection(lead.id, checked === true)
                          }
                          aria-label={`Select lead ${fullName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {fullName}
                          </div>
                            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                              <Mail className="w-3 h-3" />{" "}
                              {displayEmail ?? "No email"}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                              <Phone className="w-3 h-3" />{" "}
                              {lead.phone || "No phone"}
                            </div>
                            {(lead.city || lead.zipCode) && (
                              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <MapPin className="w-3 h-3" />
                                {[lead.city, lead.state, lead.zipCode]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                            {lead.serviceArea ? (
                              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <Target className="w-3 h-3" />
                                <span>{lead.serviceArea.slug}</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border text-[10px] uppercase tracking-wide",
                                    lead.serviceArea.status === "LIVE"
                                      ? "border-brand-mint/40 text-brand-mint dark:border-brand-mint/40 dark:text-brand-mint"
                                      : lead.serviceArea.status === "WAITLIST"
                                        ? "border-amber-400 text-amber-600 dark:border-amber-400/70 dark:text-amber-200"
                                        : "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-300",
                                  )}
                                >
                                  {lead.serviceArea.status.toLowerCase()}
                                </Badge>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge
                              className={leadTypeMeta.badgeClass}
                            >
                              {leadTypeMeta.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border text-xs capitalize",
                                stageBadgeColor(lead.stageColor),
                              )}
                            >
                              {lead.pipelineStage || "Unknown"}
                            </Badge>
                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                Assigned to
                              </div>
                            </div>
                            <Select
                              value={lead.owner?.id ?? "unassigned"}
                              onValueChange={async (value) => {
                                if (value === "unassigned") {
                                  await handleUnassign();
                                } else {
                                  await updateLeadOwner(lead.id, value);
                                }
                              }}
                              disabled={isMutating}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                                <SelectValue placeholder="Assign sales rep" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72 w-[260px] max-w-[90vw]">
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {availableOwners
                                  .filter((option) => option.id && option.id.trim().length > 0)
                                  .map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {lead.cadenceEnrollments?.length ? (
                              <div className="space-y-1 text-xs text-purple-600">
                                {lead.cadenceEnrollments.map((enrollment) => (
                                  <div
                                    key={enrollment.id}
                                    className="flex items-center gap-1"
                                  >
                                    <PlayCircle className="w-3 h-3" />
                                    <span>
                                      {enrollment.cadence?.name ?? "Active cadence"}
                                    </span>
                                    {enrollment.nextRunAt ? (
                                      <span className="text-[10px] text-purple-500">
                                        · next {formatDate(enrollment.nextRunAt)}
                                      </span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {territoryLabel}
                            </div>
                            {lead.territory?.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: lead.territory.color,
                                }}
                              />
                            )}
                            {lead.howDidYouHear && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Source: {lead.howDidYouHear}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className={cn("font-medium", nextSlaClass)}>
                              {formatRelativeMinutes(lead.nextActionSlaMinutes)}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1">
                              <TimerReset className="w-3 h-3" />
                              {formatDate(lead.nextActionAt)}
                            </div>
                            {lead.preferredStartDate && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Prefers start:{" "}
                                {formatDate(lead.preferredStartDate)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            {lead.lastActivity ? (
                              <>
                          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-medium">
                            <Activity className="w-3 h-3" />
                            {lead.lastActivity.type
                              .toLowerCase()
                              .replace("_", " ")}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(lead.lastActivity.occurredAt)}
                          </div>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                No activity yet
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                            <Calendar className="w-3 h-3" />
                            {formatDate(lead.submittedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2 text-slate-600"
                              onClick={() => jumpToLeadOnMap(lead)}
                              disabled={!getLeadCoordinates(lead)}
                            >
                              <MapIcon className="w-3 h-3" /> Map
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => openCadenceSheet(lead)}
                            >
                              <PlayCircle className="w-3 h-3" /> Cadence
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => openActivitySheet(lead)}
                            >
                              <Plus className="w-3 h-3" /> Log activity
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-2"
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  "Delete this lead? This cannot be undone.",
                                );
                                if (!confirmed) return;
                                await deleteLead(lead.id);
                              }}
                              disabled={mutatingLeadId === lead.id}
                            >
                              {mutatingLeadId === lead.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-10 text-slate-500 dark:text-slate-400"
                      >
                        No outbound leads found. Try adjusting filters or adding
                        new prospects.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {nextCursor && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() =>
                    fetchLeads({
                      cursor: nextCursor,
                      showSpinner: false,
                      append: true,
                    })
                  }
                >
                  Load more
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      ) : (
        <div className="relative">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              {error}
            </div>
          )}
          <OutboundMap
            leads={filteredLeads}
            onMarkerSelect={(lead) => {
              setSelectedLead(lead);
              const coords = getLeadCoordinates(lead);
              if (coords) {
                setMapFocus({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  key: Date.now(),
                });
              }
            }}
            stageColorFor={stageBadgeColor}
            dropMode={isDroppingPin}
            onNewPin={handlePinCaptured}
            pendingPin={pendingCoordinates}
            userLocation={userLocation}
            focusTarget={mapFocus}
            onFocusConsumed={() => setMapFocus(null)}
            teamLocations={teamLocations}
            showTeamRadar={showTeamRadar}
            freezeViewport={freezeViewport}
            mapStyle={mapStylePreference.style}
            mapStyleId={mapStylePreference.key}
            serviceAreaFeatures={serviceAreaFeatures}
            serviceAreasLoading={serviceAreasLoading}
          />
          {hideMapToolbar && viewMode === "map" ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 px-4 sm:hidden">
              <div className="flex justify-end">
                <Button
                  size="lg"
                  className="pointer-events-auto gap-2 rounded-2xl bg-slate-900/90 text-white shadow-lg backdrop-blur-md dark:bg-white/90 dark:text-slate-900"
                  onClick={() => setIsMobileMapSheetOpen(true)}
                >
                  <Filter className="h-4 w-4" /> Map actions
                </Button>
              </div>
            </div>
          ) : null}
          {mapHydrationStatus.active && (
            <div className="pointer-events-none absolute top-4 left-4 z-[5] flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              <span>
                Loading pins… {mapHydrationStatus.loaded.toLocaleString()}
              </span>
            </div>
          )}
          {isDroppingPin && (
            <div className="absolute top-4 right-4 max-w-xs rounded-xl border border-dashed border-slate-300 bg-white/95 p-4 text-xs text-slate-600 shadow-sm space-y-2 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200">
              <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                <Crosshair className="w-4 h-4" /> Drop mode active
              </div>
              <p>
                Tap the map to place a pin, or use “Drop at my location” to
                capture where you’re standing. Press “Cancel drop” to exit.
              </p>
            </div>
          )}
          {showTeamRadar && teamLocations.length > 0 && (
            <div
              className={cn(
                "absolute right-4 z-[5] max-w-xs rounded-xl border border-brand-mint/30 bg-white/95 px-4 py-3 shadow-sm text-xs text-slate-600 space-y-2 dark:border-brand-mint/40 dark:bg-slate-900/80 dark:text-slate-200",
                isDroppingPin ? "top-32" : "top-4",
              )}
            >
              <div className="flex items-center gap-2 text-brand-mint font-semibold text-sm">
                <UsersIcon className="w-4 h-4" /> Team radar
              </div>
              <div className="space-y-2">
                {teamLocations.slice(0, 4).map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {member.name || member.email || "Unassigned rep"}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(member.occurredAt)}
                      </div>
                    </div>
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                      <span className="block h-2.5 w-2.5 rounded-full bg-purple-600 border-2 border-white shadow-[0_0_0_3px_rgba(147,51,234,0.35)]"></span>
                    </span>
                  </div>
                ))}
                {teamLocations.length > 4 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    +{teamLocations.length - 4} more active reps
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-24 right-4 flex flex-col gap-2">
            {isDroppingPin ? (
              <>
                <Button
                  variant="default"
                  className="pointer-events-auto gap-2"
                  onClick={toggleDropMode}
                >
                  <X className="w-4 h-4" /> Cancel drop
                </Button>
                <Button
                  variant="outline"
                  className="pointer-events-auto gap-2 border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                  onClick={dropPinAtUserLocation}
                  disabled={locationStatus === "pending"}
                >
                  <Crosshair className="w-4 h-4" />
                  Drop at my location
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="pointer-events-auto gap-2 border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                onClick={toggleDropMode}
              >
                <MapPinPlus className="w-4 h-4" /> Drop pin
              </Button>
            )}
            <Button
              variant="outline"
              className="pointer-events-auto gap-2 border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
              onClick={() => {
                setViewMode("map");
                requestLocationRefresh();
              }}
              disabled={locationStatus === "pending"}
            >
              <LocateFixed className="w-4 h-4" />
              {locationStatus === "pending" ? "Locating…" : "Locate me"}
            </Button>
          </div>
          {userLocation && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Center map on your location"
              onClick={centerMapOnUser}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " " ||
                  event.key === "Spacebar"
                ) {
                  event.preventDefault();
                  centerMapOnUser();
                }
              }}
              className="absolute bottom-4 left-4 flex cursor-pointer select-none items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <span className="block h-2.5 w-2.5 rounded-full bg-blue-600 border-2 border-white shadow-[0_0_0_3px_rgba(37,99,235,0.35)]"></span>
              </span>
              You are here
            </div>
          )}
          {locationError && !locationErrorDismissed && (
            <div className="absolute bottom-4 right-4 max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 shadow-sm space-y-2 dark:border-amber-400/60 dark:bg-amber-950/60 dark:text-amber-100">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-amber-800">
                  {locationError}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss location message"
                  className="text-amber-600 hover:text-amber-700"
                  onClick={() => setLocationErrorDismissed(true)}
                >
                  ×
                </button>
              </div>
              {locationStatus === "denied" && (
                <div className="text-[11px] text-amber-700">
                  Use “Locate me” after enabling location permissions in your
                  browser settings.
                </div>
              )}
            </div>
          )}
          {selectedLead && (
            <div className="absolute top-4 left-4 w-72 rounded-xl border bg-white/95 shadow-lg p-4 space-y-2">
              {(() => {
                const leadTypeMeta =
                  leadTypeDisplay[
                    (selectedLead.leadType ?? "outbound").toLowerCase() as keyof typeof leadTypeDisplay
                  ] ?? leadTypeDisplay.outbound;
                const isMutating = mutatingLeadId === selectedLead.id;
                const displayEmail = sanitizeLeadEmail(selectedLead.email);

                const handleUnassignSelected = async () => {
                  const confirmed = window.confirm("Remove rep assignment from this lead?");
                  if (!confirmed) return;
                  await updateLeadOwner(selectedLead.id, null);
                };

                return (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {[selectedLead.firstName, selectedLead.lastName]
                            .filter(Boolean)
                            .join(" ") || "Unnamed lead"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedLead.city}, {selectedLead.state}{" "}
                          {selectedLead.zipCode}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs capitalize border",
                          stageBadgeColor(selectedLead.stageColor),
                        )}
                      >
                        {selectedLead.pipelineStage || "unknown"}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Assigned to
                      </p>
                      <Select
                        value={selectedLead.owner?.id ?? "unassigned"}
                        onValueChange={async (value) => {
                          if (value === "unassigned") {
                            await handleUnassignSelected();
                          } else {
                            await updateLeadOwner(selectedLead.id, value);
                          }
                        }}
                        disabled={isMutating}
                      >
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue placeholder="Assign sales rep" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 w-[260px] max-w-[90vw]">
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {availableOwners.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedLead.address && (
                      <div className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3 mt-0.5" />
                        <span>{selectedLead.address}</span>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {displayEmail ?? "No email"}
                      </div>
                      {selectedLead.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {selectedLead.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-slate-500">
                        <span className="font-medium text-slate-600">Territory:</span>
                        <span>{selectedLead.territory?.name ?? "Unassigned"}</span>
                      </div>
                      {selectedLead.preferredContactMethods?.length ? (
                        <div>
                          <span className="font-medium text-slate-600">
                            Preferred contact:
                          </span>{" "}
                          <span>
                            {selectedLead.preferredContactMethods.join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {selectedLead.preferredStartDate ? (
                        <div>
                          <span className="font-medium text-slate-600">
                            Preferred start:
                          </span>{" "}
                          <span>{formatDate(selectedLead.preferredStartDate)}</span>
                        </div>
                      ) : null}
                      {selectedLead.howDidYouHear ? (
                        <div>
                          <span className="font-medium text-slate-600">Source:</span>{" "}
                          <span>{selectedLead.howDidYouHear}</span>
                        </div>
                      ) : null}
                      {selectedLead.cadenceEnrollments?.length ? (
                        <div className="space-y-1 text-xs text-purple-600">
                          <div className="font-medium text-purple-700">Cadence</div>
                          {selectedLead.cadenceEnrollments.map((enrollment) => (
                            <div key={enrollment.id} className="flex flex-wrap gap-1">
                              <span>{enrollment.cadence?.name ?? "Active cadence"}</span>
                              {enrollment.nextRunAt ? (
                                <span className="text-[10px] text-purple-500">
                                  next {formatDate(enrollment.nextRunAt)}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {selectedLead.nextActionAt && (
                        <div className="space-y-0.5">
                          <div>
                            <span className="font-medium text-slate-600">
                              Next action:
                            </span>{" "}
                            <span
                              className={cn(
                                selectedLead.nextActionSlaMinutes &&
                                  selectedLead.nextActionSlaMinutes < 0
                                  ? "text-rose-600"
                                  : "text-slate-700",
                              )}
                            >
                              {formatDate(selectedLead.nextActionAt)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatRelativeMinutes(
                              selectedLead.nextActionSlaMinutes ?? null,
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[120px] gap-2"
                        onClick={() => openActivitySheet(selectedLead)}
                      >
                        <Plus className="w-3 h-3" /> Log activity
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[120px] gap-2"
                        onClick={() => openCadenceSheet(selectedLead)}
                      >
                        <PlayCircle className="w-3 h-3" /> Cadence
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 min-w-[120px] gap-2"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "Delete this lead? This cannot be undone.",
                          );
                          if (!confirmed) return;
                          await deleteLead(selectedLead.id);
                        }}
                        disabled={mutatingLeadId === selectedLead.id}
                      >
                        {mutatingLeadId === selectedLead.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-8 w-8"
                        onClick={() => setSelectedLead(null)}
                        aria-label="Close details"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <Sheet
        open={isCreateSheetOpen}
        onOpenChange={(open) => {
          setIsCreateSheetOpen(open);
          if (!open) {
            setCreateError(null);
            setPendingCoordinates(null);
            setCreateForm(makeNewLeadForm());
            setFreezeViewport(false);
            setReverseLookupLoading(false);
            setReverseLookupError(null);
            setReverseLookupCompleted(false);
            pendingCoordinatesRef.current = null;
            setHouseNumber("");
            setStreetOptions([]);
            setSelectedStreet("");
            setShowAdvancedAddress(false);
            setDogPresence(null);
            setDogCount(null);
            setEncounterTags([]);
            setObjectionTags([]);
            setQuickNotes("");
            setCustomStreet("");
          }
        }}
      >
        <SheetContent
          side="right"
          className="overflow-y-auto bg-white/95 px-0 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100"
        >
          <div className="space-y-6 px-6 pb-8">
            <SheetHeader className="space-y-2 pt-4">
              <SheetTitle className="font-serif text-2xl text-slate-900 dark:text-white">
                New outbound prospect
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
                Capture a door knock, referral, or canvassing lead. Leave email blank if unknown and we’ll track them by address.
              </SheetDescription>
            </SheetHeader>

            {createError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-400/60 dark:bg-rose-500/10 dark:text-rose-200">
                {createError}
              </div>
            )}

            {pendingCoordinates && (
              <div className="admin-card space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Confirm address
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter the house number and confirm the street. We’ll fill in the rest.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCapturedCoordinates}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      House number
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={houseNumberInputRef}
                        value={houseNumber}
                        onChange={(e) =>
                          setHouseNumber(e.target.value.replace(/[^A-Za-z0-9\-]/g, ""))
                        }
                    placeholder={
                      houseNumberSuggestion
                        ? `${houseNumberSuggestion.slice(0, Math.min(2, houseNumberSuggestion.length))}${
                            houseNumberSuggestion.length > 2 ? "…" : ""
                          }`
                        : "123"
                    }
                    inputMode="numeric"
                    className="flex-1"
                  />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter the exact house number before confirming the street.
                      {houseNumberSuggestion ? ` Suggested number: ${houseNumberSuggestion}` : ""}
                    </p>
                  </div>

                  {isHouseNumberConfirmed && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Street
                        </label>
                        {streetOptions.length ? (
                          <Select
                            value={selectedStreet || "__custom"}
                            onValueChange={(value) => {
                              if (value === "__custom") {
                                setSelectedStreet("");
                              } else {
                                setSelectedStreet(value);
                                setCustomStreet("");
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select street" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[240px]">
                              {streetOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom">Other street…</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : null}
                        {(!streetOptions.length || !selectedStreet) && (
                          <Input
                            className="mt-2"
                            value={customStreet}
                            onChange={(e) => setCustomStreet(e.target.value)}
                            placeholder={
                              selectedStreet || streetOptions[0] || "Street name"
                            }
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono">
                          Lat: {pendingCoordinates.latitude.toFixed(6)}
                        </span>
                        <span className="font-mono">
                          Lng: {pendingCoordinates.longitude.toFixed(6)}
                        </span>
                        {reverseLookupLoading && (
                          <span className="inline-flex items-center gap-1 text-brand-mint">
                            <Loader2 className="h-3 w-3 animate-spin" /> Looking up street…
                          </span>
                        )}
                        {reverseLookupError && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            {reverseLookupError}
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="px-0"
                              onClick={retryReverseLookup}
                            >
                              Retry
                            </Button>
                          </span>
                        )}
                        {!reverseLookupLoading &&
                        !reverseLookupError &&
                        reverseLookupCompleted ? (
                          <span className="text-brand-mint">
                            Street name confirmed from map pin
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {showQuickVisitSection && (
              <div className="space-y-4">
                <div className="admin-card space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Capture this visit
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Choose AI-assisted notes or log manually. You can switch anytime.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={visitCaptureMode === "ai" ? "default" : "outline"}
                        className="gap-2 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                        onClick={() => setVisitCaptureMode("ai")}
                      >
                        Record & auto-tag with AI
                      </Button>
                      <Button
                        type="button"
                        variant={visitCaptureMode === "quick" ? "default" : "outline"}
                        className="gap-2 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                        onClick={() => setVisitCaptureMode("quick")}
                      >
                        Quick visit log
                      </Button>
                    </div>
                  </div>

                  {visitCaptureMode === "prompt" && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      Start by selecting an option above to capture what happened at this stop.
                    </div>
                  )}

                  {visitCaptureMode === "quick" && (
                    <div className="space-y-4">
                      {aiVisitResult ? (
                        <div className="flex items-start gap-2 rounded-md border border-brand-mint/30 bg-brand-mint/10 px-3 py-2 text-xs text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint">
                          <Wand2 className="h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-semibold text-brand-mint dark:text-brand-mint">
                              AI summary applied
                            </p>
                            <p>Review the fields below and make any edits before saving.</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Dogs on site
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {dogPresenceOptions.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={dogPresence === option.value ? "default" : "outline"}
                              className="h-8 rounded-full px-4 text-xs"
                              onClick={() =>
                                setDogPresence((prev) =>
                                  prev === option.value ? null : option.value,
                                )
                              }
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        {dogPresence === "HAS_DOG" ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>How many?</span>
                            <Input
                              value={dogCount ?? ""}
                              onChange={(event) => {
                                const next = event.target.value
                                  ? Number.parseInt(event.target.value, 10)
                                  : null;
                                setDogCount(
                                  Number.isFinite(next as number) ? next : null,
                                );
                              }}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="h-8 w-16"
                              placeholder="1"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Encounter result
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {encounterOptions.map((option) => {
                            const isActive = encounterTags.includes(option.value);
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                variant={isActive ? "default" : "outline"}
                                className="h-8 rounded-full px-4 text-xs"
                                style={
                                  isActive
                                    ? {
                                        backgroundColor: option.color,
                                        borderColor: option.color,
                                      }
                                    : undefined
                                }
                                onClick={() =>
                                  setEncounterTags((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((value) => value !== option.value)
                                      : [...prev, option.value],
                                  )
                                }
                              >
                                {option.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Common objections
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {objectionOptions.map((option) => {
                            const isActive = objectionTags.includes(option.value);
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                variant={isActive ? "default" : "outline"}
                                className="h-8 rounded-full px-4 text-xs"
                                onClick={() =>
                                  setObjectionTags((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((value) => value !== option.value)
                                      : [...prev, option.value],
                                  )
                                }
                              >
                                {option.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Extra note (optional)
                        </label>
                        <Textarea
                          value={quickNotes}
                          onChange={(e) => setQuickNotes(e.target.value)}
                          rows={2}
                          placeholder="Gate code, follow-up reminder, etc."
                        />
                        <div className="pt-3 space-y-1">
                          <Button
                            type="button"
                            className="w-full gap-2 sm:w-auto"
                            onClick={submitNewLead}
                            disabled={createSubmitting}
                          >
                            {createSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Log visit & save prospect
                          </Button>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            We’ll create the prospect and log this activity in one step.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {visitCaptureMode === "ai" && (
                  <AiVisitRecorder
                    businessId={userOrgId ?? undefined}
                    encounterOptionMap={encounterOptionMap}
                    dogOptionMap={dogOptionMap}
                    objectionOptionMap={objectionOptionMap}
                    onApply={handleApplyAiVisit}
                    onCancel={() => setVisitCaptureMode("prompt")}
                  />
                )}

                {pendingCoordinates && (
                  <div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm"
                      onClick={() => setShowAdvancedAddress((prev) => !prev)}
                    >
                      {showAdvancedAddress ? "Hide advanced details" : "Add more details"}
                    </Button>
                  </div>
                )}

                {(!pendingCoordinates || showAdvancedAddress) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          First name
                        </label>
                        <Input
                          value={createForm.firstName}
                          onChange={(event) =>
                            handleCreateFieldChange("firstName", event.target.value)
                          }
                          placeholder="Jordan"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Last name
                        </label>
                        <Input
                          value={createForm.lastName}
                          onChange={(event) =>
                            handleCreateFieldChange("lastName", event.target.value)
                          }
                          placeholder="Smith"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Email
                        </label>
                        <Input
                          type="email"
                          value={createForm.email}
                          onChange={(event) =>
                            handleCreateFieldChange("email", event.target.value)
                          }
                          placeholder="prospect@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Phone
                        </label>
                        <Input
                          value={createForm.phone}
                          onChange={(event) =>
                            handleCreateFieldChange("phone", event.target.value)
                          }
                          placeholder="555-0100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Notes
                      </label>
                      <Textarea
                        value={createForm.specialInstructions}
                        onChange={(event) =>
                          handleCreateFieldChange(
                            "specialInstructions",
                            event.target.value,
                          )
                        }
                        rows={3}
                        placeholder="Gate code, follow-up details, or context for the team."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
      </SheetContent>
    </Sheet>

      <Sheet open={isMobileMapSheetOpen} onOpenChange={setIsMobileMapSheetOpen}>
        <SheetContent
          side="bottom"
          className="admin-card sm:hidden text-slate-900 dark:text-slate-100"
        >
          <SheetHeader className="space-y-1">
            <SheetTitle className="font-serif text-xl text-slate-900 dark:text-white">
              Map actions
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
              Quick tools for canvassing in the field.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                className="h-10 rounded-xl"
                onClick={() => {
                  setViewMode("table");
                  setIsMobileMapSheetOpen(false);
                }}
              >
                <List className="mr-2 h-4 w-4" /> Table
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                className="h-10 rounded-xl"
                onClick={() => setViewMode("map")}
              >
                <MapIcon className="mr-2 h-4 w-4" /> Map
              </Button>
            </div>

            {leadsWithCoordinates.length > 0 ? (
              <Select
                value={mapLeadSelection}
                onValueChange={(value) => {
                  setMapLeadSelection(value);
                  setIsMobileMapSheetOpen(false);
                  if (value) {
                    const params = new URLSearchParams({ focus: value });
                    router.push(`/admin/leads/outbound?${params.toString()}`);
                    if (viewMode !== "map") {
                      setViewMode("map");
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Jump to lead" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {leadsWithCoordinates.map((lead) => {
                    const name =
                      [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                      "Unnamed lead";
                    const subtitle = [lead.city, lead.state]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <SelectItem key={lead.id} value={lead.id}>
                        <div className="flex flex-col text-left">
                          <span>{name}</span>
                          {subtitle ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {subtitle}
                            </span>
                          ) : null}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}

            <div className="grid gap-3">
              <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Territory" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="all">All territories</SelectItem>
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  {territories.map((territory) => (
                    <SelectItem key={territory.id} value={territory.id}>
                      {territory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {availableOwners
                    .filter((option) => option.id && option.id.trim().length > 0)
                    .map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={mapStyleMode}
                onValueChange={(value) => setMapStyleMode(value as MapStyleMode)}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Map style" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {MAP_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-12 gap-2 rounded-2xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                onClick={() => {
                  setViewMode("map");
                  requestLocationRefresh();
                  setIsMobileMapSheetOpen(false);
                }}
                disabled={locationStatus === "pending"}
              >
                <LocateFixed className="h-4 w-4" />
                {locationStatus === "pending" ? "Locating…" : "Locate me"}
              </Button>

              <Button
                variant={showTeamRadar ? "default" : "outline"}
                className={cn(
                  "h-12 gap-2 rounded-2xl",
                  showTeamRadar
                    ? "bg-brand-mint text-white hover:bg-brand-mint/90"
                    : "border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40",
                )}
                onClick={() => setShowTeamRadar((prev) => !prev)}
              >
                <UsersIcon className="h-4 w-4" />
                {showTeamRadar ? "Hide team" : "Show team"}
              </Button>

              <Button
                variant={isDroppingPin ? "default" : "outline"}
                className={cn(
                  "h-12 gap-2 rounded-2xl",
                  isDroppingPin
                    ? "bg-brand-mint text-white hover:bg-brand-mint/90"
                    : "border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40",
                )}
                onClick={() => {
                  toggleDropMode();
                  setIsMobileMapSheetOpen(false);
                }}
              >
                <MapPinPlus className="h-4 w-4" />
                {isDroppingPin ? "Cancel drop" : "Drop a pin"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="admin-card text-slate-900 dark:text-slate-100">
          <SheetHeader className="space-y-2">
            <SheetTitle className="font-serif text-2xl text-slate-900 dark:text-white">
              Log activity
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
              {activeLead
                ? `For ${activeLead.firstName ?? ""} ${activeLead.lastName ?? ""}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Recent activity
                </p>
                {activityHistoryLoading && !activityHistory.length ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : null}
              </div>
              {activityHistoryError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {activityHistoryError}
                </div>
              ) : null}
              {activityHistory.length ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {activityHistory.map((activity) => {
                    const label =
                      activityTypeLookup[activity.type] ??
                      activity.type
                        .split("_")
                        .map((part) =>
                          part.charAt(0) + part.slice(1).toLowerCase(),
                        )
                        .join(" ");
                    const actor =
                      activity.user?.name || activity.user?.email || "Unknown rep";
                    const rawNotes = activity.notes ?? "";
                    const noteLines = rawNotes
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean);
                    const tagPrefix = noteLines.find((line) =>
                      line.toLowerCase().startsWith("tags:")
                    );
                    const tagBadges = tagPrefix
                      ? tagPrefix
                          .slice(5)
                          .split(",")
                          .map((piece) => piece.trim())
                          .filter(Boolean)
                          .map((piece) => {
                            const [rawKey, rawValue] = piece.split("=");
                            const key = rawKey?.trim()?.toLowerCase() ?? "";
                            const value = rawValue?.trim() ?? "";
                            const friendly = () => {
                              if (key === "dog") {
                                if (value === "HAS_DOG") return "Dog on site";
                                if (value === "NO_DOG") return "No dog";
                                if (value === "UNKNOWN") return "Dog status unknown";
                              }
                              if (key === "dog_count") return `Dogs: ${value}`;
                              if (key === "encounter") {
                                return (
                                  encounterOptions.find((option) => option.value === value)
                                    ?.label ?? value.replace(/_/g, " ")
                                );
                              }
                              if (key === "objections") {
                                return value
                                  .split("|")
                                  .map((part) =>
                                    objectionOptions.find((option) => option.value === part)?.label ??
                                    part.replace(/_/g, " ")
                                  )
                                  .join(", ");
                              }
                              return `${key}: ${value}`;
                            };
                            return { key, value: friendly() };
                          })
                      : [];
                    const noteBody = rawNotes
                      .split(/\r?\n/)
                      .filter((line) => !line.toLowerCase().startsWith("tags:"))
                      .join("\n");
                    const noteSegments = noteBody
                      .split(/\n\s*\n/)
                      .map((segment) => segment.trim())
                      .filter(Boolean);

                    let summaryText: string | null = null;
                    let followUpText: string | null = null;
                    let transcriptText: string | null = null;
                    const additionalNotes: string[] = [];

                    for (const segment of noteSegments) {
                      const lower = segment.toLowerCase();
                      if (lower.startsWith("transcript:")) {
                        transcriptText = segment.slice("transcript:".length).trim();
                        continue;
                      }
                      if (lower.startsWith("follow-up:")) {
                        followUpText = segment.slice("follow-up:".length).trim();
                        continue;
                      }

                      if (!summaryText) {
                        summaryText = segment;
                      } else {
                        additionalNotes.push(segment);
                      }
                    }

                    if (summaryText && summaryText.toLowerCase().startsWith("summary:")) {
                      summaryText = summaryText.slice("summary:".length).trim();
                    }
                    if (
                      followUpText &&
                      followUpText.toLowerCase().startsWith("follow-up:")
                    ) {
                      followUpText = followUpText.slice("follow-up:".length).trim();
                    }

                    return (
                      <div
                        key={activity.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            <Activity className="w-3.5 h-3.5 text-slate-400" />
                            <span>{label}</span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatRelativeTime(activity.occurredAt)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(activity.occurredAt)} · Logged by {actor}
                        </div>
                        {tagBadges.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tagBadges.map((badge, index) => (
                              <span
                                key={`${badge.key}-${badge.value}-${index}`}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                              >
                                {badge.value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {summaryText ? (
                          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                            {summaryText}
                          </p>
                        ) : null}
                        {additionalNotes.length
                          ? additionalNotes.map((note, noteIndex) => (
                              <p
                                key={`${activity.id}-note-${noteIndex}`}
                                className="mt-1 text-xs text-slate-600 whitespace-pre-wrap"
                              >
                                {note}
                              </p>
                            ))
                          : null}
                        {followUpText ? (
                          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <BellRing className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <div>
                              <p className="font-medium text-amber-700">Follow-up</p>
                              <p className="mt-0.5 whitespace-pre-wrap text-amber-800">
                                {followUpText}
                              </p>
                            </div>
                          </div>
                        ) : null}
                        {transcriptText ? (
                          <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <summary className="flex cursor-pointer items-center gap-2 text-slate-500">
                              <FileText className="h-3.5 w-3.5" />
                              View transcript
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-slate-600">
                              {transcriptText}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : !activityHistoryLoading && !activityHistoryError ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No activity logged yet. Capture a visit or touchpoint below.
                </p>
              ) : null}
              {activityHistoryHasMore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void loadActivityHistory({ cursor: activityHistoryCursor });
                  }}
                  disabled={activityHistoryLoading}
                  className="gap-2"
                >
                  {activityHistoryLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Load more
                </Button>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Activity type
                </label>
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Outcome
                </label>
                <Input
                  placeholder="e.g. Interested, requested brochure"
                  value={activityResult}
                  onChange={(e) => setActivityResult(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Notes
                </label>
                <Textarea
                  rows={5}
                  placeholder="Add context from the visit or next steps"
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button
              onClick={submitActivity}
              disabled={activitySubmitting}
              className="gap-2 rounded-full bg-brand-coral text-white hover:bg-brand-coral/90"
            >
              {activitySubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Save activity
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isCadenceSheetOpen} onOpenChange={handleCadenceSheetChange}>
        <SheetContent className="admin-card text-slate-900 dark:text-slate-100">
          <SheetHeader className="space-y-2">
            <SheetTitle className="font-serif text-2xl text-slate-900 dark:text-white">
              Assign cadence
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
              {leadForCadence
                ? `For ${[leadForCadence.firstName, leadForCadence.lastName]
                    .filter(Boolean)
                    .join(" ") || "Unnamed lead"}`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {leadForCadence?.cadenceEnrollments?.length ? (
              <div className="space-y-1 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
                <div className="font-medium text-purple-800">
                  Active cadence{leadForCadence.cadenceEnrollments.length > 1 ? "s" : ""}
                </div>
                {leadForCadence.cadenceEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex flex-wrap items-center gap-1">
                    <span>{enrollment.cadence?.name ?? "Cadence"}</span>
                    {enrollment.nextRunAt ? (
                      <span className="text-[10px] text-purple-500">
                        next {formatDate(enrollment.nextRunAt)}
                      </span>
                    ) : null}
                    <Badge variant="outline" className="border-purple-200 text-[10px]">
                      {enrollment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No cadence assigned yet.
              </div>
            )}

            {cadenceError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {cadenceError}
              </div>
            ) : null}

            {cadenceSuccess ? (
              <div className="rounded-md border border-brand-mint/30 bg-brand-mint/10 px-3 py-2 text-sm text-brand-mint">
                {cadenceSuccess}
              </div>
            ) : null}

            {cadenceLoading && !cadencesLoaded ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading cadences…
              </div>
            ) : cadences.length ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Choose cadence
                </label>
                <Select
                  value={cadenceSelection}
                  onValueChange={setCadenceSelection}
                  disabled={cadenceSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    {cadences.map((cadence) => (
                      <SelectItem key={cadence.id} value={cadence.id}>
                        {cadence.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                <div>No cadences available yet.</div>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={() => {
                    handleCadenceSheetChange(false);
                    router.push("/admin/leads/cadences");
                  }}
                >
                  Create a cadence
                </Button>
              </div>
            )}

            {selectedCadenceSummary ? (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="font-medium text-slate-700">
                  {selectedCadenceSummary.name}
                </div>
                {selectedCadenceSummary.description ? (
                  <div>{selectedCadenceSummary.description}</div>
                ) : null}
                <ol className="list-decimal space-y-1 pl-4">
                  {selectedCadenceSummary.steps.map((step) => (
                    <li key={step.id} className="space-x-1">
                      <span className="font-medium capitalize">
                        {step.channel.toLowerCase()}
                      </span>
                      <span className="text-slate-500">
                        · wait {step.waitMinutes}m
                      </span>
                      {typeof step.slaMinutes === "number" ? (
                        <span className="text-slate-500">
                          · SLA {step.slaMinutes}m
                        </span>
                      ) : null}
                      {step.autoComplete ? (
                        <span className="text-slate-500"> · auto-complete</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={submitCadenceEnrollment}
              disabled={
                cadenceSubmitting ||
                cadenceLoading ||
                !cadenceSelection ||
                !cadences.length
              }
              className="gap-2 rounded-full bg-brand-coral text-white hover:bg-brand-coral/90"
            >
              {cadenceSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Assign cadence
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCadenceSheetChange(false)}
              className="rounded-full border-slate-200 text-slate-600 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:text-brand-mint"
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
        </div>
      </div>
    </div>
  );
}

export default function OutboundLeadsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}> 
      <OutboundLeadsPageInner />
    </Suspense>
  );
}

interface OutboundMapProps {
  leads: OutboundLead[];
  onMarkerSelect: (lead: OutboundLead) => void;
  stageColorFor: (color?: string) => string;
  dropMode?: boolean;
  onNewPin?: (coords: Coordinates) => void;
  pendingPin?: Coordinates | null;
  userLocation?: Coordinates | null;
  focusTarget?: FocusTarget | null;
  onFocusConsumed?: () => void;
  teamLocations?: TeamLocation[];
  showTeamRadar?: boolean;
  freezeViewport?: boolean;
  mapStyle: string | StyleSpecification;
  mapStyleId: string;
  serviceAreaFeatures?: GeoJSON.Feature[];
  serviceAreasLoading?: boolean;
}

function OutboundMap({
  leads,
  onMarkerSelect,
  stageColorFor,
  dropMode = false,
  onNewPin,
  pendingPin = null,
  userLocation = null,
  focusTarget = null,
  onFocusConsumed,
  teamLocations = [],
  showTeamRadar = false,
  freezeViewport = false,
  mapStyle,
  mapStyleId,
  serviceAreaFeatures = [],
  serviceAreasLoading = false,
}: OutboundMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pendingMarkerRef = useRef<any | null>(null);
  const userMarkerRef = useRef<any | null>(null);
  const teamMarkersRef = useRef<any[]>([]);
  const defaultCenterRef = useRef<[number, number]>([-93.265, 44.9778]);
  const defaultZoomRef = useRef<number>(12);
  const dropModeRef = useRef(dropMode);
  const skipFitRef = useRef(false);
  const lastManualFocusRef = useRef<number | null>(null);
  const freezeViewportRef = useRef(freezeViewport);
  const pendingPinRef = useRef<Coordinates | null>(pendingPin);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapStyleIdRef = useRef(mapStyleId);
  const serviceAreaCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({ type: "FeatureCollection", features: serviceAreaFeatures }),
    [serviceAreaFeatures],
  );

  const SERVICE_AREA_SOURCE_ID = "outbound-service-areas";
  const SERVICE_AREA_FILL_LAYER_ID = `${SERVICE_AREA_SOURCE_ID}-fill`;
  const SERVICE_AREA_OUTLINE_LAYER_ID = `${SERVICE_AREA_SOURCE_ID}-outline`;

  const prepareMapStyle = useCallback(
    (style: string | StyleSpecification): string | StyleSpecification => {
      if (typeof style === "string") {
        return style;
      }
      try {
        return JSON.parse(JSON.stringify(style)) as StyleSpecification;
      } catch {
        return style;
      }
    },
    [],
  );

  useEffect(() => {
    freezeViewportRef.current = freezeViewport;
  }, [freezeViewport]);

  useEffect(() => {
    pendingPinRef.current = pendingPin;
  }, [pendingPin]);

  const mapEffectState = useMemo(
    () => ({
      leads,
      onMarkerSelect,
      dropMode,
      userLocation,
      showTeamRadar,
      teamLocations,
      focusTarget,
    }),
    [leads, onMarkerSelect, dropMode, userLocation, showTeamRadar, teamLocations, focusTarget],
  );

  useEffect(() => {
    if (focusTarget) {
      skipFitRef.current = true;
      lastManualFocusRef.current = Date.now();
    }
  }, [focusTarget]);

  useEffect(() => {
    if (userLocation) {
      defaultCenterRef.current = [
        userLocation.longitude,
        userLocation.latitude,
      ];
      defaultZoomRef.current = 13;
      return;
    }

    let fallbackCoords: { longitude: number; latitude: number } | null = null;
    for (const lead of leads) {
      const coords = getLeadCoordinates(lead);
      if (coords) {
        fallbackCoords = { longitude: coords.longitude, latitude: coords.latitude };
        break;
      }
    }

    if (fallbackCoords) {
      defaultCenterRef.current = [fallbackCoords.longitude, fallbackCoords.latitude];
      defaultZoomRef.current = 12;
    }
  }, [userLocation, leads]);

  useEffect(() => {
    let cancelled = false;
    let pendingLoadListener: (() => void) | null = null;

    async function initMap() {
      if (
        typeof window === "undefined" ||
        mapRef.current ||
        !mapContainerRef.current
      ) {
        return;
      }

      const maplibreModule = await import("maplibre-gl");
      const maplibre = maplibreModule.default ?? maplibreModule;

      const map = new maplibre.Map({
        container: mapContainerRef.current,
        style: prepareMapStyle(mapStyle) as any,
        center: defaultCenterRef.current,
        zoom: defaultZoomRef.current,
        maxZoom: 18,
        minZoom: 3,
      });

      mapRef.current = map;

      const markReady = () => {
        if (cancelled) return;
        setIsMapReady(true);

        if (!map.getSource(SERVICE_AREA_SOURCE_ID)) {
          map.addSource(SERVICE_AREA_SOURCE_ID, {
            type: "geojson",
            data: serviceAreaCollection,
          });
          map.addLayer(
            {
              id: SERVICE_AREA_FILL_LAYER_ID,
              type: "fill",
              source: SERVICE_AREA_SOURCE_ID,
              paint: {
                "fill-color": "#10b981",
                "fill-opacity": 0.08,
              },
            },
            "waterway-label",
          );
          map.addLayer({
            id: SERVICE_AREA_OUTLINE_LAYER_ID,
            type: "line",
            source: SERVICE_AREA_SOURCE_ID,
            paint: {
              "line-color": "#10b981",
              "line-width": 1.5,
              "line-opacity": 0.6,
            },
          });
        }
      };

      if (map.loaded()) {
        markReady();
      } else {
        pendingLoadListener = markReady;
        map.once("load", markReady);
      }

      map.on("error", (event) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Maplibre error", event?.error ?? event);
        }
        if (!map.loaded()) {
          markReady();
        }
      });

      map.addControl(new maplibre.NavigationControl(), "top-right");
      map.addControl(
        new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: false,
          showAccuracyCircle: false,
        }),
        "top-right",
      );
    }

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current && pendingLoadListener) {
        mapRef.current.off("load", pendingLoadListener);
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      teamMarkersRef.current.forEach((marker) => marker.remove());
      teamMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const {
      leads: currentLeads,
      onMarkerSelect: currentOnMarkerSelect,
      dropMode: currentDropMode,
      userLocation: currentUserLocation,
      showTeamRadar: currentShowTeamRadar,
      teamLocations: currentTeamLocations,
      focusTarget: currentFocusTarget,
    } = mapEffectState;

    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[Outbound map] rendering markers",
        currentLeads.length,
        currentLeads.filter((lead) => getLeadCoordinates(lead)).length,
      );
    }

    const dropModeChanged = dropModeRef.current !== currentDropMode;
    dropModeRef.current = currentDropMode;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    import("maplibre-gl").then((maplibreModule) => {
      const maplibre = maplibreModule.default ?? maplibreModule;

      const bounds = new maplibre.LngLatBounds();
      let hasBounds = false;
      let firstLeadCoords: [number, number] | null = null;
      let leadCoordCount = 0;
      let teamCoordCount = 0;

      currentLeads.forEach((lead: OutboundLead) => {
        const coords = getLeadCoordinates(lead);
        if (!coords) return;

        const markerVisual = getLeadMarkerVisual(lead);

        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";

        const bubble = document.createElement("div");
        bubble.className = "rounded-full border";
        bubble.style.width = "16px";
        bubble.style.height = "16px";
        bubble.style.position = "relative";
        bubble.style.backgroundColor = markerVisual.fill;
        bubble.style.border = "2px solid #ffffff";
        bubble.style.boxShadow = `0 1px 3px rgba(15, 23, 42, 0.35), 0 0 0 4px ${markerVisual.ring}`;
        bubble.style.borderRadius = "9999px";

        if (markerVisual.objection) {
          const corner = document.createElement("div");
          corner.style.position = "absolute";
          corner.style.bottom = "-3px";
          corner.style.right = "-3px";
          corner.style.width = "6px";
          corner.style.height = "6px";
          corner.style.borderRadius = "9999px";
          corner.style.backgroundColor = markerVisual.objection;
          corner.style.border = "1px solid #ffffff";
          bubble.appendChild(corner);
        }

        el.addEventListener("click", (event) => {
          if (currentDropMode) {
            event.stopPropagation();
            event.preventDefault();
            return;
          }
          currentOnMarkerSelect(lead);
        });

        el.appendChild(bubble);

        const marker = new maplibre.Marker({ element: el, anchor: "center" })
          .setLngLat([coords.longitude, coords.latitude])
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([coords.longitude, coords.latitude]);
        hasBounds = true;
        leadCoordCount += 1;
        if (!firstLeadCoords) {
          firstLeadCoords = [coords.longitude, coords.latitude];
        }
      });

      if (currentUserLocation) {
        bounds.extend([
          currentUserLocation.longitude,
          currentUserLocation.latitude,
        ]);
        hasBounds = true;
      }

      if (currentShowTeamRadar) {
        currentTeamLocations.forEach((member) => {
          if (
            typeof member.longitude !== "number" ||
            typeof member.latitude !== "number"
          )
            return;
          bounds.extend([member.longitude, member.latitude]);
          hasBounds = true;
          teamCoordCount += 1;
        });
      }

      const recentlyFocused =
        lastManualFocusRef.current != null &&
        Date.now() - lastManualFocusRef.current < 5000;
      const shouldAdjustView =
        !(currentDropMode && dropModeChanged) &&
        !currentFocusTarget &&
        !skipFitRef.current &&
        !recentlyFocused &&
        !freezeViewportRef.current &&
        !pendingPinRef.current;

      if (hasBounds && shouldAdjustView) {
        if (
          leadCoordCount > 1 ||
          teamCoordCount > 1 ||
          (leadCoordCount && teamCoordCount)
        ) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        } else if (leadCoordCount === 1 && firstLeadCoords) {
          map.easeTo({
            center: firstLeadCoords,
            zoom: Math.max(map.getZoom(), 13),
          });
        } else if (!leadCoordCount && currentUserLocation) {
          map.easeTo({
            center: [currentUserLocation.longitude, currentUserLocation.latitude],
            zoom: Math.max(map.getZoom(), 13),
          });
        } else if (
          !leadCoordCount &&
          currentShowTeamRadar &&
          currentTeamLocations.length === 1
        ) {
          const member = currentTeamLocations[0];
          map.easeTo({
            center: [member.longitude, member.latitude],
            zoom: Math.max(map.getZoom(), 13),
          });
        }
      }

      if (skipFitRef.current && !freezeViewportRef.current) {
        skipFitRef.current = false;
      }
    });
  }, [mapEffectState, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mapStyleIdRef.current === mapStyleId) return;

    mapStyleIdRef.current = mapStyleId;
    const nextStyle = prepareMapStyle(mapStyle) as any;
    setIsMapReady(false);

    const handleStyleData = () => {
      if (!map.getSource(SERVICE_AREA_SOURCE_ID)) {
        map.addSource(SERVICE_AREA_SOURCE_ID, {
          type: "geojson",
          data: serviceAreaCollection,
        });
        map.addLayer(
          {
            id: SERVICE_AREA_FILL_LAYER_ID,
            type: "fill",
            source: SERVICE_AREA_SOURCE_ID,
            paint: {
              "fill-color": "#10b981",
              "fill-opacity": 0.08,
            },
          },
          "waterway-label",
        );
        map.addLayer({
          id: SERVICE_AREA_OUTLINE_LAYER_ID,
          type: "line",
          source: SERVICE_AREA_SOURCE_ID,
          paint: {
            "line-color": "#10b981",
            "line-width": 1.5,
            "line-opacity": 0.6,
          },
        });
      }
      setIsMapReady(true);
    };

    map.once("styledata", handleStyleData);
    map.setStyle(nextStyle);

    return () => {
      map.off("styledata", handleStyleData);
    };
  }, [mapStyle, mapStyleId, prepareMapStyle, serviceAreaCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    const source = map.getSource(SERVICE_AREA_SOURCE_ID) as
      | { setData: (data: GeoJSON.FeatureCollection) => void }
      | undefined;
    if (source) {
      source.setData(serviceAreaCollection);
    }
  }, [serviceAreaCollection, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const handleManualInteraction = () => {
      lastManualFocusRef.current = Date.now();
      skipFitRef.current = true;
    };

    map.on("movestart", handleManualInteraction);
    map.on("zoomstart", handleManualInteraction);

    return () => {
      map.off("movestart", handleManualInteraction);
      map.off("zoomstart", handleManualInteraction);
    };
  }, [isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const canvas = typeof map.getCanvas === "function" ? map.getCanvas() : null;

    const handleClick = (event: any) => {
      if (!dropMode) {
        return;
      }
      if (typeof event.originalEvent?.preventDefault === "function") {
        event.originalEvent.preventDefault();
      }
      if (typeof event.originalEvent?.stopPropagation === "function") {
        event.originalEvent.stopPropagation();
      }
      if (canvas) {
        canvas.style.cursor = "";
      }
      map.off("click", handleClick);
      onNewPin?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };

    if (dropMode) {
      if (canvas) {
        canvas.style.cursor = "crosshair";
      }
      map.on("click", handleClick);
    } else if (canvas) {
      canvas.style.cursor = "";
    }

    return () => {
      map.off("click", handleClick);
      if (canvas) {
        canvas.style.cursor = "";
      }
    };
  }, [dropMode, onNewPin, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const canvas = typeof map.getCanvas === "function" ? map.getCanvas() : null;
    if (!canvas) return;

    const handleTouch = (event: TouchEvent) => {
      if (!dropMode) return;
      if (!event.changedTouches.length) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const touch = event.changedTouches[0];
      const point = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
      const lngLat = map.unproject(point);
      onNewPin?.({ latitude: lngLat.lat, longitude: lngLat.lng });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!dropMode) return;
      if (event.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const lngLat = map.unproject(point);
      onNewPin?.({ latitude: lngLat.lat, longitude: lngLat.lng });
    };

    canvas.addEventListener("touchend", handleTouch, { passive: false });
    canvas.addEventListener("mouseup", handleMouseUp, { passive: false });

    return () => {
      canvas.removeEventListener("touchend", handleTouch);
      canvas.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dropMode, onNewPin, isMapReady]);

  useEffect(() => {
    const container = mapContainerRef.current;
    const map = mapRef.current;
    if (!container || !map || !isMapReady) return;

    const handleContainerClick = (event: MouseEvent) => {
      if (!dropModeRef.current) return;
      if (event.defaultPrevented) return;
      if (typeof event.button === "number" && event.button !== 0) return;

      const rect = container.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const lngLat = map.unproject(point);
      onNewPin?.({ latitude: lngLat.lat, longitude: lngLat.lng });
    };

    container.addEventListener("click", handleContainerClick);

    return () => {
      container.removeEventListener("click", handleContainerClick);
    };
  }, [onNewPin, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (!pendingPin) {
      return;
    }

    const setup = async () => {
      const maplibreModule = await import("maplibre-gl");
      const maplibre = maplibreModule.default ?? maplibreModule;

      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = "#f59e0b";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 2px rgba(245, 158, 11, 0.35)";
      el.style.cursor = "pointer";

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([pendingPin.longitude, pendingPin.latitude])
        .addTo(map);

      pendingMarkerRef.current = marker;
    };

    void setup();

    return () => {
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
    };
  }, [pendingPin, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    let cancelled = false;

    (async () => {
      const maplibreModule = await import("maplibre-gl");
      if (cancelled) return;
      const maplibre = maplibreModule.default ?? maplibreModule;

      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = "#2563eb";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.3)";

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userLocation, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    teamMarkersRef.current.forEach((marker) => marker.remove());
    teamMarkersRef.current = [];

    if (!showTeamRadar || !teamLocations.length) {
      return;
    }

    (async () => {
      const maplibreModule = await import("maplibre-gl");
      const maplibre = maplibreModule.default ?? maplibreModule;

      teamLocations.forEach((member) => {
        if (
          typeof member.longitude !== "number" ||
          typeof member.latitude !== "number"
        )
          return;

        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "9999px";
        el.style.backgroundColor = "#9333ea";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 0 4px rgba(147, 51, 234, 0.25)";

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([member.longitude, member.latitude])
          .addTo(map);

        teamMarkersRef.current.push(marker);
      });
    })();

    return () => {
      teamMarkersRef.current.forEach((marker) => marker.remove());
      teamMarkersRef.current = [];
    };
  }, [teamLocations, showTeamRadar, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget || !isMapReady) return;

    lastManualFocusRef.current = Date.now();
    map.easeTo({
      center: [focusTarget.longitude, focusTarget.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 750,
    });

    onFocusConsumed?.();
  }, [focusTarget, onFocusConsumed, isMapReady]);

  return (
    <div
      ref={mapContainerRef}
      className="h-[520px] w-full rounded-xl border border-slate-200 bg-slate-200/20 overflow-hidden dark:border-slate-700 dark:bg-slate-900/40"
    />
  );
}
