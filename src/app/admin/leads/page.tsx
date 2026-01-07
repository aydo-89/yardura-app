"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  Search,
  User,
  Building,
  Map as MapIcon,
  Loader2,
  Trash2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { type CheckedState } from "@radix-ui/react-checkbox";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SALES_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";

interface LeadOwner {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface LeadTerritory {
  id: string;
  name: string;
  color?: string | null;
}

interface Lead {
  id: string;
  orgId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  serviceType?: string | null;
  dogs?: number | null;
  yardSize?: string | null;
  frequency?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  submittedAt?: string | null;
  referralSource?: string | null;
  preferredStartDate?: string | null;
  leadType?: string | null;
  nextActionAt?: string | null;
  lastCleanedBucket?: string | null;
  lastCleanedDate?: string | null;
  divertMode?: string | null;
  deodorize?: boolean | null;
  sprayDeck?: boolean | null;
  wellnessOptIn?: boolean | null;
  owner?: LeadOwner | null;
  territory?: LeadTerritory | null;
}

interface OwnerOption {
  id: string;
  label: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface MetaState {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface StatsState {
  inboundCount: number;
  outboundCount: number;
  assignedCount: number;
  unassignedCount: number;
  overdueCount: number;
  todayCount: number;
  thisWeekCount: number;
}

const LEAD_TYPE_META: Record<
  string,
  {
    label: string;
    description: string;
    badgeClass: string;
  }
> = {
  outbound: {
    label: "Outbound lead",
    description: "Created by field sales or manual entry",
    badgeClass:
      "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100",
  },
  referral: {
    label: "Referral lead",
    description: "Captured via referral or partner",
    badgeClass:
      "border border-brand-mint/30 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint",
  },
  inbound: {
    label: "Inbound quote",
    description: "Submitted through online quote flow",
    badgeClass:
      "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-100",
  },
};

const yardSizeOptions = [
  { value: "all", label: "All property sizes" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "XL" },
];

const frequencyOptions = [
  { value: "all", label: "Any cadence" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one_time", label: "One-time" },
];

const lastCleanedOptions = [
  { value: "all", label: "Any history" },
  { value: "14", label: "Within 2 weeks" },
  { value: "42", label: "2–6 weeks" },
  { value: "90_plus", label: "6+ weeks" },
];

const addOnsOptions = [
  { value: "any", label: "Add-ons (any)" },
  { value: "with", label: "Has add-ons" },
  { value: "without", label: "No add-ons" },
];

const divertModeOptions = [
  { value: "all", label: "Any waste plan" },
  { value: "none", label: "Leave in bin" },
  { value: "takeaway", label: "Haul away" },
  { value: "compost", label: "Compost routing" },
];

const waitlistOptions = [
  { value: "any", label: "Waitlist (any)" },
  { value: "joined", label: "Joined waitlist" },
  { value: "not_joined", label: "Not on waitlist" },
];

const wellnessOptions = [
  { value: "any", label: "Wellness opt-in (any)" },
  { value: "true", label: "Opted in" },
  { value: "false", label: "Opted out" },
];

const sortOptions: Array<{ value: string; label: string }> = [
  { value: "submittedAt", label: "Created" },
  { value: "dogs", label: "Dogs" },
  { value: "zipCode", label: "ZIP code" },
  { value: "nextActionAt", label: "Next action" },
  { value: "lastCleanedDate", label: "Last cleaned" },
  { value: "frequency", label: "Cadence" },
  { value: "priority", label: "Priority" },
];

const nextActionOptions = [
  { value: "all", label: "All follow-ups" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Scheduled" },
  { value: "none", label: "No next action" },
];

const addOnsLabelMap: Record<string, string> = {
  with: "Has add-ons",
  without: "No add-ons",
};

const waitlistLabelMap: Record<string, string> = {
  joined: "Joined waitlist",
  not_joined: "Not on waitlist",
};

const wellnessLabelMap: Record<string, string> = {
  true: "Wellness opted-in",
  false: "Wellness opted-out",
};

const divertLabelMap: Record<string, string> = {
  none: "Leave in bin",
  takeaway: "Haul away",
  compost: "Compost routing",
};

const nextActionLabelMap: Record<string, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Scheduled",
  none: "No next action",
};

const ADVANCED_FILTER_KEYS = new Set([
  "dogs",
  "yard",
  "zip",
  "frequency",
  "last-cleaned",
  "last-cleaned-range",
  "addons",
  "divert",
  "waitlist",
  "wellness",
  "sort",
]);

const getLeadTypeMeta = (leadType?: string | null) => {
  const normalized = (leadType ?? "").toLowerCase();
  return LEAD_TYPE_META[normalized] ?? LEAD_TYPE_META.inbound;
};

const computeNextActionStatus = (lead: Lead) => {
  if (!lead.nextActionAt) return { code: "none", label: "No next action" };
  const ts = new Date(lead.nextActionAt).getTime();
  if (Number.isNaN(ts)) return { code: "none", label: "No next action" };
  const now = Date.now();
  if (ts < now) return { code: "overdue", label: "Overdue" };
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  if (ts >= startOfDay.getTime() && ts <= endOfDay.getTime()) {
    return { code: "today", label: "Due today" };
  }
  return { code: "upcoming", label: "Scheduled" };
};

const getServiceTypeIcon = (serviceType?: string | null) => {
  return (serviceType ?? "").toLowerCase() === "commercial" ? Building : User;
};

const getServiceTypeColor = (serviceType?: string | null) => {
  return (serviceType ?? "").toLowerCase() === "commercial"
    ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-100"
    : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-100";
};

const defaultMeta: MetaState = {
  total: 0,
  page: 1,
  pageSize: 50,
  pageCount: 1,
  sortBy: "submittedAt",
  sortOrder: "desc",
};

const defaultStats: StatsState = {
  inboundCount: 0,
  outboundCount: 0,
  assignedCount: 0,
  unassignedCount: 0,
  overdueCount: 0,
  todayCount: 0,
  thisWeekCount: 0,
};

export default function AdminLeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<MetaState>(defaultMeta);
  const [stats, setStats] = useState<StatsState>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [nextActionFilter, setNextActionFilter] = useState<string>("all");
  const [dogsMin, setDogsMin] = useState("");
  const [dogsMax, setDogsMax] = useState("");
  const [yardSizeFilter, setYardSizeFilter] = useState<string>("all");
  const [zipFilter, setZipFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [lastCleanedBucketFilter, setLastCleanedBucketFilter] = useState<string>("all");
  const [lastCleanedAfter, setLastCleanedAfter] = useState("");
  const [lastCleanedBefore, setLastCleanedBefore] = useState("");
  const [addOnsFilter, setAddOnsFilter] = useState<string>("any");
  const [divertModeFilter, setDivertModeFilter] = useState<string>("all");
  const [waitlistFilter, setWaitlistFilter] = useState<string>("any");
  const [wellnessFilter, setWellnessFilter] = useState<string>("any");
  const [sortBy, setSortBy] = useState<string>("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [assignableOwners, setAssignableOwners] = useState<OwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [mutatingLeadId, setMutatingLeadId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const hasAuthRef = useRef(false);

  const currentUserId = (session?.user as any)?.id ?? null;
  const userOrgId = (session?.user as any)?.orgId ?? null;
  const sessionUserLabel =
    (session?.user as any)?.name ||
    (session?.user as any)?.email ||
    "You";

  const handleResetFilters = useCallback(() => {
    setSearchTerm("");
    setLeadTypeFilter("all");
    setOwnerFilter("all");
    setNextActionFilter("all");
    setDogsMin("");
    setDogsMax("");
    setYardSizeFilter("all");
    setZipFilter("");
    setFrequencyFilter("all");
    setLastCleanedBucketFilter("all");
    setLastCleanedAfter("");
    setLastCleanedBefore("");
    setAddOnsFilter("any");
    setDivertModeFilter("all");
    setWaitlistFilter("any");
    setWellnessFilter("any");
    setSortBy("submittedAt");
    setSortOrder("desc");
    setPage(1);
    setPageSize(50);
  }, []);

  const fetchOwnerOptions = useCallback(async () => {
    try {
      setOwnersLoading(true);
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

      const deduped = new Map<string, OwnerOption>();
      rawList.forEach((entry) => {
        const id = typeof entry?.id === "string" ? entry.id : null;
        if (!id) return;
        const name = typeof entry?.name === "string" ? entry.name : null;
        const email = typeof entry?.email === "string" ? entry.email : null;
        const role = typeof entry?.role === "string" ? entry.role : null;
        const labelValue =
          typeof entry?.label === "string"
            ? (entry.label as string)
            : name || email || "Unnamed user";
        deduped.set(id, {
          id,
          name,
          email,
          role,
          label: labelValue,
        });
      });

      setAssignableOwners(Array.from(deduped.values()));
    } catch (error) {
      console.error("Error fetching assignable owners:", error);
    } finally {
      setOwnersLoading(false);
    }
  }, []);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch.length) {
      params.set("search", trimmedSearch);
    }

    if (leadTypeFilter !== "all") {
      params.set("leadType", leadTypeFilter);
    }

    if (ownerFilter === "unassigned") {
      params.set("ownerId", "NULL");
    } else if (ownerFilter !== "all") {
      params.set("ownerId", ownerFilter);
    }

    if (nextActionFilter !== "all") {
      params.set("nextActionStatus", nextActionFilter);
    }

    const minNumeric = Number(dogsMin);
    if (!Number.isNaN(minNumeric) && dogsMin.trim().length) {
      params.set("dogsMin", String(minNumeric));
    }
    const maxNumeric = Number(dogsMax);
    if (!Number.isNaN(maxNumeric) && dogsMax.trim().length) {
      params.set("dogsMax", String(maxNumeric));
    }

    if (yardSizeFilter !== "all") {
      params.set("yardSize", yardSizeFilter);
    }

    const trimmedZip = zipFilter.trim();
    if (trimmedZip.length) {
      params.set("zipCode", trimmedZip);
    }

    if (frequencyFilter !== "all") {
      params.set("frequency", frequencyFilter);
    }

    if (lastCleanedBucketFilter !== "all") {
      params.set("lastCleanedBucket", lastCleanedBucketFilter);
    }

    if (lastCleanedAfter.trim().length) {
      params.set("lastCleanedAfter", lastCleanedAfter.trim());
    }

    if (lastCleanedBefore.trim().length) {
      params.set("lastCleanedBefore", lastCleanedBefore.trim());
    }

    if (addOnsFilter !== "any") {
      params.set("addOns", addOnsFilter);
    }

    if (divertModeFilter !== "all") {
      params.set("divertMode", divertModeFilter);
    }

    if (waitlistFilter !== "any") {
      params.set("waitlist", waitlistFilter);
    }

    if (wellnessFilter !== "any") {
      params.set("wellnessOptIn", wellnessFilter);
    }

    return params;
  }, [
    addOnsFilter,
    divertModeFilter,
    dogsMax,
    dogsMin,
    frequencyFilter,
    lastCleanedAfter,
    lastCleanedBefore,
    lastCleanedBucketFilter,
    leadTypeFilter,
    nextActionFilter,
    ownerFilter,
    page,
    pageSize,
    searchTerm,
    sortBy,
    sortOrder,
    waitlistFilter,
    wellnessFilter,
    yardSizeFilter,
    zipFilter,
  ]);

  const fetchLeads = useCallback(async () => {
    if (!hasAuthRef.current) return;
    setIsFetching(true);
    try {
      const params = buildQueryParams();
      const response = await fetch(`/api/admin/leads?${params.toString()}`);
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Unable to load leads");
      }
      const data = await response.json();
      const nextLeads = Array.isArray(data?.leads) ? (data.leads as Lead[]) : [];
      setLeads(nextLeads);
      setMeta({
        total: data?.meta?.total ?? 0,
        page: data?.meta?.page ?? page,
        pageSize: data?.meta?.pageSize ?? pageSize,
        pageCount: data?.meta?.pageCount ?? 1,
        sortBy: data?.meta?.sortBy ?? sortBy,
        sortOrder: data?.meta?.sortOrder === "asc" ? "asc" : "desc",
      });
      setStats({
        inboundCount: data?.stats?.inboundCount ?? 0,
        outboundCount: data?.stats?.outboundCount ?? 0,
        assignedCount: data?.stats?.assignedCount ?? 0,
        unassignedCount: data?.stats?.unassignedCount ?? 0,
        overdueCount: data?.stats?.overdueCount ?? 0,
        todayCount: data?.stats?.todayCount ?? 0,
        thisWeekCount: data?.stats?.thisWeekCount ?? 0,
      });
      setPage(data?.meta?.page ?? page);
      setPageSize(data?.meta?.pageSize ?? pageSize);
      setSelectedLeadIds((prev) =>
        prev.filter((id) => nextLeads.some((lead) => lead.id === id)),
      );
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to load leads",
      );
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [buildQueryParams, page, pageSize, sortBy]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/leads");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !SALES_PORTAL_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }

    hasAuthRef.current = true;
    setIsLoading(true);
    void fetchLeads();
    void fetchOwnerOptions();
  }, [session, status, router, fetchLeads, fetchOwnerOptions]);

  useEffect(() => {
    if (!hasAuthRef.current) return;
    void fetchLeads();
  }, [fetchLeads]);

  const ownerOptions = useMemo(() => {
    const map = new Map<string, OwnerOption>();

    assignableOwners.forEach((owner) => {
      if (!owner.id) return;
      map.set(owner.id, {
        ...owner,
        label:
          owner.id === currentUserId && owner.label && !owner.label.includes("(You)")
            ? `${owner.label} (You)`
            : owner.label,
      });
    });

    leads.forEach((lead) => {
      if (lead.owner?.id && !map.has(lead.owner.id)) {
        const label = lead.owner.name || lead.owner.email || "Unnamed rep";
        map.set(lead.owner.id, {
          id: lead.owner.id,
          name: lead.owner.name,
          email: lead.owner.email,
          role: null,
          label:
            lead.owner.id === currentUserId && label && !label.includes("(You)")
              ? `${label} (You)`
              : label,
        });
      }
    });

    if (currentUserId && !map.has(currentUserId)) {
      const existing = assignableOwners.find((owner) => owner.id === currentUserId);
      const baseLabel = existing?.label || sessionUserLabel || "You";
      const fallbackLabel =
        baseLabel !== "You" && !baseLabel.includes("(You)")
          ? `${baseLabel} (You)`
          : baseLabel;
      map.set(currentUserId, {
        id: currentUserId,
        name: sessionUserLabel,
        email: (session?.user as any)?.email ?? null,
        role: existing?.role ?? null,
        label: fallbackLabel,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [assignableOwners, leads, currentUserId, sessionUserLabel, session]);

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    ownerOptions.forEach((option) => {
      map.set(option.id, option.label);
    });
    return map;
  }, [ownerOptions]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch.length) {
      chips.push({
        key: "search",
        label: `Search · "${
          trimmedSearch.length > 24 ? `${trimmedSearch.slice(0, 24)}…` : trimmedSearch
        }"`,
        onClear: () => {
          setSearchTerm("");
          setPage(1);
        },
      });
    }

    if (leadTypeFilter !== "all") {
      const labelMap: Record<string, string> = {
        inbound: "Inbound quotes",
        outbound: "Outbound leads",
        referral: "Referral leads",
      };
      chips.push({
        key: "lead-type",
        label: `Lead type · ${labelMap[leadTypeFilter] ?? leadTypeFilter}`,
        onClear: () => {
          setLeadTypeFilter("all");
          setPage(1);
        },
      });
    }

    if (ownerFilter !== "all") {
      const label =
        ownerFilter === "unassigned"
          ? "Unassigned"
          : ownerLabelById.get(ownerFilter) ?? "Assigned";
      chips.push({
        key: "owner",
        label: `Sales rep · ${label}`,
        onClear: () => {
          setOwnerFilter("all");
          setPage(1);
        },
      });
    }

    if (nextActionFilter !== "all") {
      chips.push({
        key: "next-action",
        label: `Next action · ${nextActionLabelMap[nextActionFilter] ?? nextActionFilter}`,
        onClear: () => {
          setNextActionFilter("all");
          setPage(1);
        },
      });
    }

    if (dogsMin.trim().length || dogsMax.trim().length) {
      chips.push({
        key: "dogs",
        label: `Dogs · ${dogsMin.trim() || "0"}–${dogsMax.trim() || "∞"}`,
        onClear: () => {
          setDogsMin("");
          setDogsMax("");
          setPage(1);
        },
      });
    }

    if (yardSizeFilter !== "all") {
      chips.push({
        key: "yard",
        label: `Property · ${yardSizeOptions.find((o) => o.value === yardSizeFilter)?.label ?? yardSizeFilter}`,
        onClear: () => {
          setYardSizeFilter("all");
          setPage(1);
        },
      });
    }

    if (zipFilter.trim().length) {
      chips.push({
        key: "zip",
        label: `ZIP · ${zipFilter.trim()}`,
        onClear: () => {
          setZipFilter("");
          setPage(1);
        },
      });
    }

    if (frequencyFilter !== "all") {
      chips.push({
        key: "frequency",
        label: `Cadence · ${
          frequencyOptions.find((o) => o.value === frequencyFilter)?.label ?? frequencyFilter
        }`,
        onClear: () => {
          setFrequencyFilter("all");
          setPage(1);
        },
      });
    }

    if (lastCleanedBucketFilter !== "all") {
      chips.push({
        key: "last-cleaned",
        label: `Last cleaned · ${
          lastCleanedOptions.find((o) => o.value === lastCleanedBucketFilter)?.label ?? lastCleanedBucketFilter
        }`,
        onClear: () => {
          setLastCleanedBucketFilter("all");
          setPage(1);
        },
      });
    }

    if (lastCleanedAfter.trim().length || lastCleanedBefore.trim().length) {
      chips.push({
        key: "last-cleaned-range",
        label: `Last cleaned · ${lastCleanedAfter || "…"} to ${lastCleanedBefore || "…"}`,
        onClear: () => {
          setLastCleanedAfter("");
          setLastCleanedBefore("");
          setPage(1);
        },
      });
    }

    if (addOnsFilter !== "any") {
      chips.push({
        key: "addons",
        label: `Add-ons · ${addOnsLabelMap[addOnsFilter] ?? addOnsFilter}`,
        onClear: () => {
          setAddOnsFilter("any");
          setPage(1);
        },
      });
    }

    if (divertModeFilter !== "all") {
      chips.push({
        key: "divert",
        label: `Waste plan · ${divertLabelMap[divertModeFilter] ?? divertModeFilter}`,
        onClear: () => {
          setDivertModeFilter("all");
          setPage(1);
        },
      });
    }

    if (waitlistFilter !== "any") {
      chips.push({
        key: "waitlist",
        label: `Waitlist · ${waitlistLabelMap[waitlistFilter] ?? waitlistFilter}`,
        onClear: () => {
          setWaitlistFilter("any");
          setPage(1);
        },
      });
    }

    if (wellnessFilter !== "any") {
      chips.push({
        key: "wellness",
        label: `Wellness · ${wellnessLabelMap[wellnessFilter] ?? wellnessFilter}`,
        onClear: () => {
          setWellnessFilter("any");
          setPage(1);
        },
      });
    }

    if (sortBy !== "submittedAt" || sortOrder !== "desc") {
      chips.push({
        key: "sort",
        label: `Sort · ${
          sortOptions.find((option) => option.value === sortBy)?.label ?? sortBy
        } (${sortOrder === "asc" ? "Asc" : "Desc"})`,
        onClear: () => {
          setSortBy("submittedAt");
          setSortOrder("desc");
          setPage(1);
        },
      });
    }

    return chips;
  }, [
    addOnsFilter,
    divertModeFilter,
    dogsMax,
    dogsMin,
    frequencyFilter,
    lastCleanedAfter,
    lastCleanedBefore,
    lastCleanedBucketFilter,
    leadTypeFilter,
    nextActionFilter,
    ownerFilter,
    ownerLabelById,
    searchTerm,
    sortBy,
    sortOrder,
    waitlistFilter,
    wellnessFilter,
    yardSizeFilter,
    zipFilter,
  ]);

  const advancedFilterCount = useMemo(
    () =>
      activeFilterChips.filter((chip) => ADVANCED_FILTER_KEYS.has(chip.key))
        .length,
    [activeFilterChips],
  );

  const toggleLeadSelection = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(leadId)) return prev;
        return [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  }, []);

  const allVisibleSelected =
    leads.length > 0 && leads.every((lead) => selectedLeadIds.includes(lead.id));

  const someVisibleSelected = leads.some((lead) => selectedLeadIds.includes(lead.id));

  const selectAllChecked: CheckedState = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  const handleToggleSelectAll = (checked: boolean) => {
    if (!leads.length) return;
    if (checked) {
      const merged = new Set(selectedLeadIds);
      leads.forEach((lead) => merged.add(lead.id));
      setSelectedLeadIds(Array.from(merged));
    } else {
      const visibleIds = new Set(leads.map((lead) => lead.id));
      setSelectedLeadIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  };

  const handleDeleteLeads = async (ids: string[], options?: { bulk?: boolean }) => {
    if (!ids.length) return;
    const confirmationMessage =
      ids.length === 1
        ? "Are you sure you want to delete this lead? This cannot be undone."
        : `Delete ${ids.length} leads? This cannot be undone.`;
    if (!confirm(confirmationMessage)) {
      return;
    }

    if (options?.bulk) {
      setBulkDeleting(true);
    } else {
      setMutatingLeadId(ids[0]);
    }

    try {
      const response = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to delete leads");
      }

      const payload = await response.json().catch(() => ({}));
      const deletedCount = payload?.deleted ?? ids.length;
      toast.success(
        deletedCount === 1
          ? "Lead deleted successfully"
          : `${deletedCount} leads deleted successfully`,
      );
      setSelectedLeadIds((prev) => prev.filter((id) => !ids.includes(id)));
      void fetchLeads();
    } catch (error) {
      console.error("Failed to delete leads", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete leads",
      );
    } finally {
      if (options?.bulk) {
        setBulkDeleting(false);
      }
      setMutatingLeadId(null);
    }
  };

  const handleDeleteSelected = () => {
    void handleDeleteLeads(selectedLeadIds, { bulk: true });
  };

  const handleDeleteLead = (leadId: string) => {
    void handleDeleteLeads([leadId]);
  };

  const handleOwnerChange = useCallback(
    async (leadId: string, ownerId: string | null) => {
      setMutatingLeadId(leadId);
      try {
        const response = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Unable to update owner");
        }
        toast.success(ownerId ? "Lead assigned to rep" : "Lead unassigned");
        await fetchLeads();
      } catch (error) {
        console.error("Failed to update lead owner", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to update lead owner",
        );
      } finally {
        setMutatingLeadId(null);
      }
    },
    [fetchLeads],
  );

  const showLoading = status === "loading" || !hasAuthRef.current;

  const userRole = extractUserRole(session);
  const canCreateQuote = Boolean(
    userRole &&
      ["SALES_REP", "SALES_MANAGER", "ADMIN", "OWNER", "FRANCHISE_OWNER"].includes(
        userRole,
      ),
  );

  const handleCreateQuote = useCallback(() => {
    const params = new URLSearchParams();
    params.set("resume", "0");
    if (userOrgId) {
      params.set("businessId", userOrgId);
    }
    router.push(`/quote?${params.toString()}`);
  }, [router, userOrgId]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = Math.min(meta.page * meta.pageSize, meta.total);

  if (isLoading || showLoading) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-mint" />
      </div>
    );
  }

  const {
    inboundCount,
    outboundCount,
    assignedCount,
    unassignedCount,
    overdueCount,
    todayCount,
    thisWeekCount,
  } = stats;

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <MapIcon className="h-4 w-4" />
                <span>Pipeline insight</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">Lead Management</h1>
                <p className="admin-subtitle">
                  Track inbound quotes, outbound canvassing, and referral momentum in one lane.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canCreateQuote ? (
                <Button
                  onClick={handleCreateQuote}
                  className="rounded-xl bg-brand-coral text-white shadow-sm transition hover:bg-brand-coral/90"
                >
                  New quote
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void fetchLeads()}
                disabled={isFetching}
                className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh
              </Button>
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Total leads
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {meta.total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {inboundCount} inbound • {outboundCount} outbound
              </p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Assignment health
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {assignedCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unassignedCount} unassigned • {assignedCount} with reps
              </p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Overdue follow-ups
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {overdueCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{todayCount} due today</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                New this week
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {thisWeekCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Captured in the last 7 days</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <Card className="admin-card">
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Filter leads</CardTitle>
              <CardDescription>
                Refine by lead source, ownership, dog count, or follow-up urgency.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              onClick={handleResetFilters}
              className="text-brand-mint hover:text-brand-mint dark:text-brand-mint dark:hover:text-brand-mint"
            >
              Reset filters
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, phone, ZIP, or reference #"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setPage(1);
                    }}
                    className="h-11 w-full rounded-full border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:border-brand-mint/40 focus-visible:ring-2 focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Select
                    value={leadTypeFilter}
                    onValueChange={(value) => {
                      setLeadTypeFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 min-w-[160px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint/40 focus:border-brand-mint/40 focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-mint/40">
                      <SelectValue placeholder="Lead type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All lead types</SelectItem>
                      <SelectItem value="inbound">Inbound (online quote)</SelectItem>
                      <SelectItem value="outbound">Outbound (field sales)</SelectItem>
                      <SelectItem value="referral">Referral / partner</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={ownerFilter}
                    onValueChange={(value) => {
                      setOwnerFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 min-w-[160px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint/40 focus:border-brand-mint/40 focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-mint/40">
                      <SelectValue placeholder="Sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All reps</SelectItem>
                      <SelectItem value="unassigned">Unassigned only</SelectItem>
                      {ownerOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={nextActionFilter}
                    onValueChange={(value) => {
                      setNextActionFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 min-w-[160px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint/40 focus:border-brand-mint/40 focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-mint/40">
                      <SelectValue placeholder="Next action" />
                    </SelectTrigger>
                    <SelectContent>
                      {nextActionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFiltersOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:text-brand-mint"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Advanced filters
                    {advancedFilterCount ? (
                      <span className="ml-1 inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-brand-mint/10 px-2 text-xs font-semibold text-brand-mint dark:bg-brand-mint/10 dark:text-brand-mint">
                        {advancedFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </div>
              </div>

              {activeFilterChips.length ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    Active filters
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-2">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onClear}
                        className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-mint/30 hover:bg-brand-mint/10 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/10 dark:hover:text-brand-mint whitespace-nowrap"
                      >
                        <span className="max-w-[220px] truncate">{chip.label}</span>
                        <X className="h-3 w-3 text-slate-400 transition group-hover:text-brand-mint dark:text-slate-300 dark:group-hover:text-brand-mint" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tip: stack advanced filters like dog count, visit cadence, or add-ons to focus your pipeline view.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent
            side="right"
            className="w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white/95 p-6 text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
          >
            <SheetHeader className="space-y-2">
              <SheetTitle className="font-serif text-2xl text-slate-900 dark:text-white">
                Advanced filters
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
                Stack property, cadence, and sustainability filters to zero in on the right leads.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-8 pb-6">
              <section className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Property & dogs
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Dogs (min)
                    </Label>
                    <Input
                      inputMode="numeric"
                      placeholder="0"
                      value={dogsMin}
                      onChange={(event) => {
                        setDogsMin(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Dogs (max)
                    </Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Any"
                      value={dogsMax}
                      onChange={(event) => {
                        setDogsMax(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Property size
                    </Label>
                    <Select
                      value={yardSizeFilter}
                      onValueChange={(value) => {
                        setYardSizeFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="All sizes" />
                      </SelectTrigger>
                      <SelectContent>
                        {yardSizeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      ZIP code
                    </Label>
                    <Input
                      placeholder="e.g. 78704"
                      value={zipFilter}
                      onChange={(event) => {
                        setZipFilter(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Service cadence
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Visit cadence
                    </Label>
                    <Select
                      value={frequencyFilter}
                      onValueChange={(value) => {
                        setFrequencyFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any cadence" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Last cleaned bucket
                    </Label>
                    <Select
                      value={lastCleanedBucketFilter}
                      onValueChange={(value) => {
                        setLastCleanedBucketFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any history" />
                      </SelectTrigger>
                      <SelectContent>
                        {lastCleanedOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Last cleaned after
                    </Label>
                    <Input
                      type="date"
                      value={lastCleanedAfter}
                      onChange={(event) => {
                        setLastCleanedAfter(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Last cleaned before
                    </Label>
                    <Input
                      type="date"
                      value={lastCleanedBefore}
                      onChange={(event) => {
                        setLastCleanedBefore(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Sustainability & add-ons
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Add-ons
                    </Label>
                    <Select
                      value={addOnsFilter}
                      onValueChange={(value) => {
                        setAddOnsFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {addOnsOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Waste plan
                    </Label>
                    <Select
                      value={divertModeFilter}
                      onValueChange={(value) => {
                        setDivertModeFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {divertModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Waitlist status
                    </Label>
                    <Select
                      value={waitlistFilter}
                      onValueChange={(value) => {
                        setWaitlistFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any waitlist" />
                      </SelectTrigger>
                      <SelectContent>
                        {waitlistOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Wellness opt-in
                    </Label>
                    <Select
                      value={wellnessFilter}
                      onValueChange={(value) => {
                        setWellnessFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {wellnessOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Sorting
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Sort field
                    </Label>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => {
                        setSortBy(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Submitted at" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                      Order
                    </Label>
                    <Select
                      value={sortOrder}
                      onValueChange={(value) => {
                        setSortOrder(value === "asc" ? "asc" : "desc");
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Newest" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest first</SelectItem>
                        <SelectItem value="asc">Oldest first</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            </div>

            <SheetFooter>
              <SheetClose asChild>
                <Button className="rounded-xl bg-brand-coral text-white hover:bg-brand-coral/90">
                  Apply filters
                </Button>
              </SheetClose>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  handleResetFilters();
                  setFiltersOpen(false);
                }}
                className="rounded-xl text-brand-mint hover:text-brand-mint dark:text-brand-mint dark:hover:text-brand-mint"
              >
                Clear all
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Card className="admin-card">
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {meta.total.toLocaleString()} total • Showing {pageStart}-{pageEnd}
                {selectedLeadIds.length ? ` • ${selectedLeadIds.length} selected` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-32 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-inner focus:border-brand-mint/40 focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 150, 200].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={!selectedLeadIds.length || bulkDeleting}
              >
                {bulkDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {bulkDeleting ? "Deleting…" : "Delete selected"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAllChecked}
                        onCheckedChange={(checked) =>
                          handleToggleSelectAll(Boolean(checked))
                        }
                        aria-label="Select all leads"
                        disabled={!leads.length}
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">Lead</TableHead>
                    <TableHead className="min-w-[180px]">Contact</TableHead>
                    <TableHead className="min-w-[220px]">Service area</TableHead>
                    <TableHead className="min-w-[160px]">Next action</TableHead>
                    <TableHead className="min-w-[200px]">Owner</TableHead>
                    <TableHead className="min-w-[180px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length ? (
                    leads.map((lead) => {
                      const fullName = [lead.firstName, lead.lastName]
                        .filter(Boolean)
                        .join(" ") || lead.email || lead.phone || "Untitled lead";
                      const leadTypeMeta = getLeadTypeMeta(lead.leadType);
                      const nextStatus = computeNextActionStatus(lead);
                      const ServiceIcon = getServiceTypeIcon(lead.serviceType);
                      const serviceColor = getServiceTypeColor(lead.serviceType);
                      const ownerValue = lead.owner?.id ?? "unassigned";
                      const quoteReference = lead.id
                        ? lead.id.slice(-8).toUpperCase()
                        : "";
                      const quoteBusinessId = lead.orgId ?? userOrgId ?? "yardura";
                      const quoteLink = `/quote/sent?leadId=${lead.id}&businessId=${quoteBusinessId}&preview=1`;

                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="align-top">
                            <Checkbox
                              checked={selectedLeadIds.includes(lead.id)}
                              onCheckedChange={(checked) =>
                                toggleLeadSelection(lead.id, Boolean(checked))
                              }
                              aria-label={`Select lead ${quoteReference || lead.id}`}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                          <div className="space-y-1">
                            <Link
                              href={`/admin/leads/${lead.id}`}
                              className="inline-block font-medium text-slate-900 transition hover:text-brand-mint dark:text-white dark:hover:text-brand-mint"
                            >
                              {fullName}
                            </Link>
                            <Badge
                              variant="outline"
                              className={`inline-flex w-fit text-[11px] font-normal ${leadTypeMeta.badgeClass}`}
                            >
                              {leadTypeMeta.label}
                            </Badge>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Submitted {formatDate(lead.submittedAt)}
                            </p>
                              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                Ref #{quoteReference}
                              </p>
                              {lead.referralSource ? (
                                <p className="text-[11px] text-slate-400">
                                  Source: {lead.referralSource}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {lead.email ? (
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="flex items-center gap-2 hover:text-slate-900"
                                >
                                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                                  {lead.email}
                                </a>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <Mail className="h-3.5 w-3.5" />
                                  No email
                                </div>
                              )}
                              {lead.phone ? (
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="flex items-center gap-2 text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                                >
                                  <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                  {lead.phone}
                                </a>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                                  <Phone className="h-3.5 w-3.5" />
                                  No phone
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <div className="flex items-start gap-2">
                                <div
                                  className={`flex h-6 w-6 items-center justify-center rounded-full ${serviceColor}`}
                                >
                                  <ServiceIcon className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="text-slate-700 dark:text-slate-200">
                                    {lead.address ?? "Address pending"}
                                  </div>
                                  <div className="text-slate-500 dark:text-slate-400">
                                    {[lead.city, lead.zipCode].filter(Boolean).join(", ") || "—"}
                                  </div>
                                </div>
                              </div>
                              {lead.territory?.name ? (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] font-normal text-slate-600 dark:border-slate-600 dark:text-slate-200"
                                >
                                  {lead.territory.name}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                              <span className="font-medium">{nextStatus.label}</span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {lead.nextActionAt
                                  ? new Date(lead.nextActionAt).toLocaleString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "No follow-up scheduled"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={ownerValue}
                                  onValueChange={(value) =>
                                    handleOwnerChange(
                                      lead.id,
                                      value === "unassigned" ? null : value,
                                    )
                                  }
                                  disabled={mutatingLeadId === lead.id || ownersLoading}
                                >
                                  <SelectTrigger className="h-8 w-48 text-xs border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                    <SelectValue placeholder="Assign rep" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {ownerOptions.map((option) => (
                                      <SelectItem key={option.id} value={option.id}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {mutatingLeadId === lead.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                ) : null}
                              </div>
                              {lead.owner?.id ? (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Assigned to {ownerLabelById.get(lead.owner.id) ?? "rep"}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                  Not yet assigned
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:text-brand-mint"
                              >
                                <Link href={`/admin/leads/${lead.id}`}>
                                  View lead
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:text-brand-mint"
                              >
                                <Link
                                  href={quoteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" /> View quote
                                </Link>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLead(lead.id)}
                                disabled={bulkDeleting || mutatingLeadId === lead.id}
                                className="bg-rose-500 hover:bg-rose-400 dark:bg-rose-500 dark:hover:bg-rose-400"
                              >
                                {mutatingLeadId === lead.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-16 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No leads match your filters right now.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium text-slate-700 dark:text-slate-200">{pageStart}</span>
                {meta.total ? "" : ""} – <span className="font-medium text-slate-700 dark:text-slate-200">{pageEnd}</span> of
                <span className="ml-1 font-medium text-slate-700 dark:text-slate-200">{meta.total.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1 || isFetching}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Page {meta.page} of {meta.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.pageCount || isFetching}
                  onClick={() =>
                    setPage((prev) =>
                      prev >= meta.pageCount ? meta.pageCount : prev + 1,
                    )
                  }
                  className="border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
