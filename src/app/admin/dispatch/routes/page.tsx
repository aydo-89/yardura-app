"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  RefreshCcw,
  CheckCircle,
  Trash2,
  Plus,
} from "lucide-react";
import {
  DISPATCH_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import { formatServiceDate } from "@/lib/time-window";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  extractPreferredTimeWindow,
  type PreferredTimeWindowSlug,
} from "@/lib/time-window";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameWeek,
  isToday,
  isTomorrow,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import "maplibre-gl/dist/maplibre-gl.css";

interface VisitCustomerDto {
  id?: string | null;
  name?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface VisitDto {
  id: string;
  customerId: string | null;
  scheduledDate: string;
  assignedToId?: string | null;
  status?: string | null;
  customer: VisitCustomerDto | null;
  job?: {
    id: string;
    frequency: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowLabel?: string | null;
  preferredTimeWindowSlug?: PreferredTimeWindowSlug | null;
}

interface RouteStopDto {
  id: string;
  position: number;
  serviceVisitId: string | null;
  serviceVisit: VisitDto | null;
  technicianId?: string | null;
  technician?: { id: string; name?: string | null } | null;
}

interface RouteInstanceDto {
  id: string;
  scheduledDate: string;
  name?: string | null;
  technician?: { id: string; name?: string | null } | null;
  technicianId?: string | null;
  dispatcher?: { id: string; name?: string | null } | null;
  status: string;
  notes?: string | null;
  stops: RouteStopDto[];
}

interface CustomerResult {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  zip: string | null;
  jobs: Array<{ id: string; frequency: string; nextVisitAt: string | null }>;
}

interface UpcomingCustomerVisit {
  id: string;
  scheduledDate: string;
  status: string;
  frequency: string | null;
  jobId: string | null;
  windowLabel?: string | null;
  assignedTo?: { id: string; name?: string | null } | null;
  route?: {
    id: string;
    status: string;
    technician?: { id: string; name?: string | null } | null;
  } | null;
}

type RouteGroup = {
  date: Date;
  routes: RouteInstanceDto[];
};

type ScopeKey = "today" | "tomorrow" | "upcoming";

const scopeOrder: ScopeKey[] = ["today", "tomorrow", "upcoming"];

const scopeLabels: Record<ScopeKey, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  upcoming: "Upcoming",
};

const cloneRoutes = (input: RouteInstanceDto[]): RouteInstanceDto[] =>
  input.map((route) => ({
    ...route,
    stops: route.stops.map((stop) => ({
      ...stop,
      serviceVisit: stop.serviceVisit ? { ...stop.serviceVisit } : null,
      technician: stop.technician ? { ...stop.technician } : null,
    })),
    technician: route.technician ? { ...route.technician } : null,
    dispatcher: route.dispatcher ? { ...route.dispatcher } : null,
  }));

const determineScopeForDate = (date: Date): ScopeKey => {
  if (isToday(date)) return "today";
  if (isTomorrow(date)) return "tomorrow";
  return "upcoming";
};

const defaultDateForScope = (scope: ScopeKey): Date => {
  const today = startOfDay(new Date());
  switch (scope) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    default:
      return addDays(today, 2);
  }
};

function partitionRouteGroups(groups: RouteGroup[]): Record<ScopeKey, RouteGroup[]> {
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(today, 1));
  const buckets: Record<ScopeKey, RouteGroup[]> = {
    today: [],
    tomorrow: [],
    upcoming: [],
  };

  groups.forEach((group) => {
    const date = startOfDay(group.date);
    if (date.getTime() === today.getTime()) {
      buckets.today.push(group);
    } else if (date.getTime() === tomorrow.getTime()) {
      buckets.tomorrow.push(group);
    } else {
      buckets.upcoming.push(group);
    }
  });

  return buckets;
}

export default function DispatchRoutesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const orgId = (session?.user as any)?.orgId || "yardura";

  const [routes, setRoutes] = useState<RouteInstanceDto[]>([]);
  const [visits, setVisits] = useState<VisitDto[]>([]);
  const [technicians, setTechnicians] = useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [assigningRouteId, setAssigningRouteId] = useState<string | null>(null);
  const [routeTechInputs, setRouteTechInputs] = useState<Record<string, string>>({});
  const [mapPreviewRoute, setMapPreviewRoute] = useState<RouteInstanceDto | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<{
    open: boolean;
    customerId: string | null;
    customerName: string;
    frequency: string | null;
    loading: boolean;
    error: string | null;
    visits: UpcomingCustomerVisit[];
  }>({
    open: false,
    customerId: null,
    customerName: "",
    frequency: null,
    loading: false,
    error: null,
    visits: [],
  });
  const [autoAssigningVisitId, setAutoAssigningVisitId] = useState<string | null>(null);
  const [autoAssigningAll, setAutoAssigningAll] = useState(false);
  const [activeScope, setActiveScope] = useState<ScopeKey>("today");
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [createRouteDialog, setCreateRouteDialog] = useState<{
    open: boolean;
    date: Date | null;
    scope: ScopeKey | null;
  }>({
    open: false,
    date: null,
    scope: null,
  });
  const [createRouteForm, setCreateRouteForm] = useState<{
    technicianId: string;
    name: string;
    notes: string;
  }>({
    technicianId: "",
    name: "",
    notes: "",
  });
  const [creatingRoute, setCreatingRoute] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/dispatch/routes");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !DISPATCH_PORTAL_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
    }
  }, [session, status, router]);

  const parseJson = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    const text = await response.text();
    throw new Error(text || `Unexpected response (${response.status})`);
  };

  const closeCreateRouteDialogSafely = (force = false) => {
    if (!force && creatingRoute) return;
    setCreateRouteDialog({ open: false, date: null, scope: null });
    setCreateRouteForm({ technicianId: "", name: "", notes: "" });
  };

  const openCreateRouteDialogForDate = (targetDate: Date) => {
    const normalized = startOfDay(targetDate);
    const defaultTech =
      technicians.length === 1 && technicians[0]?.id ? technicians[0].id : "";
    setCreateRouteForm({ technicianId: defaultTech, name: "", notes: "" });
    setCreateRouteDialog({
      open: true,
      date: normalized,
      scope: determineScopeForDate(normalized),
    });
  };

  const handleCreateRouteDateChange = (value: string) => {
    const nextDate = value ? startOfDay(new Date(`${value}T00:00:00`)) : null;
    setCreateRouteDialog((prev) => ({
      open: prev.open,
      date: nextDate,
      scope: nextDate ? determineScopeForDate(nextDate) : prev.scope,
    }));
  };

  const handleSubmitCreateRoute = async () => {
    if (!createRouteDialog.date || !orgId || creatingRoute) return;
    setCreatingRoute(true);
    try {
      const response = await fetch(`/api/dispatch/routes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          scheduledDate: createRouteDialog.date.toISOString(),
          technicianId: createRouteForm.technicianId || undefined,
          name: createRouteForm.name.trim() || undefined,
          notes: createRouteForm.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let message = `Failed to create route (${response.status})`;
        try {
          const data = await parseJson<{ error?: string }>(response);
          if (data?.error === "validation_failed") {
            message = "Double-check the route details and try again.";
          } else if (data?.error === "internal_error") {
            message = "Dispatch couldn’t create that route right now.";
          } else if (data?.error) {
            message = data.error.replace(/_/g, " ");
          }
        } catch (parseError) {
          console.warn("dispatch.routes.createRoute.parse", parseError);
        }
        throw new Error(message);
      }

      toast.success("Route created for the selected day");
      setActiveScope(createRouteDialog.scope ?? activeScope);
      closeCreateRouteDialogSafely(true);
      await loadData();
    } catch (error) {
      console.error("dispatch.routes.createRoute", error);
      toast.error(error instanceof Error ? error.message : "Unable to create route");
    } finally {
      setCreatingRoute(false);
    }
  };

  const fetchTechnicians = async () => {
    if (!orgId) return;
    setTechniciansLoading(true);
    try {
      const params = new URLSearchParams({ orgId });
      const response = await fetch(
        `/api/dispatch/technicians?${params.toString()}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(`Tech fetch failed (${response.status})`);
      }
      const json = await parseJson<{
        ok: boolean;
        technicians: Array<{ id: string; name: string | null; email: string | null }>;
      }>(response);
      if (json?.ok) {
        setTechnicians(json.technicians);
      }
    } catch (error) {
      console.error(error);
      setTechnicians([]);
    } finally {
      setTechniciansLoading(false);
    }
  };

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const future = addDays(new Date(), 45).toISOString();
      const [routesRes, visitsRes] = await Promise.all([
        fetch(
          `/api/dispatch/routes?orgId=${encodeURIComponent(orgId)}&to=${encodeURIComponent(future)}`,
          {
            credentials: "include",
          },
        ),
        fetch(
          `/api/dispatch/visits?orgId=${encodeURIComponent(orgId)}&includeAssigned=false`,
          { credentials: "include" },
        ),
      ]);

      const routesJson = await parseJson<{ ok: boolean; routes: RouteInstanceDto[] }>(routesRes);
      const visitsJson = await parseJson<{ ok: boolean; visits: VisitDto[] }>(visitsRes);

      if (!routesRes.ok || !routesJson?.ok) {
        throw new Error("Failed to load routes");
      }
      if (!visitsRes.ok || !visitsJson?.ok) {
        throw new Error("Failed to load visits");
      }

      const enhancedRoutes = routesJson.routes.map((route) => ({
        ...route,
        stops: route.stops.map((stop) => ({
          ...stop,
          serviceVisit: stop.serviceVisit ? augmentVisit(stop.serviceVisit) : null,
        })),
      }));
      const enhancedVisits = visitsJson.visits.map(augmentVisit);

      setRoutes(enhancedRoutes);
      setVisits(enhancedVisits);

      const nextRouteTechInputs: Record<string, string> = {};
      enhancedRoutes.forEach((route) => {
        nextRouteTechInputs[route.id] = route.technician?.id ?? route.technicianId ?? "";
      });
      setRouteTechInputs(nextRouteTechInputs);

    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to load dispatch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchTechnicians();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  const augmentVisit = (visit: VisitDto): VisitDto => {
    const { slug, label } = extractPreferredTimeWindow(
      visit.metadata,
      visit.preferredTimeWindowLabel ?? visit.preferredTimeWindow ?? null,
    );
    return {
      ...visit,
      preferredTimeWindowSlug: slug ?? visit.preferredTimeWindowSlug ?? null,
      preferredTimeWindowLabel:
        label ?? visit.preferredTimeWindowLabel ?? visit.preferredTimeWindow ?? null,
    };
  };

  const availableVisits = useMemo(
    () =>
      visits.filter((visit) =>
        !routes.some((route) =>
          route.stops.some((stop) => stop.serviceVisitId === visit.id),
        )),
    [visits, routes],
  );

  const todayStats = useMemo(() => {
    const today = startOfDay(new Date());
    const todaysRoutes = routes.filter((route) =>
      startOfDay(new Date(route.scheduledDate)).getTime() === today.getTime(),
    );
    const todaysStops = todaysRoutes.reduce((acc, route) => acc + route.stops.length, 0);
    return { routes: todaysRoutes.length, stops: todaysStops };
  }, [routes]);

  const tomorrowStats = useMemo(() => {
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const tomorrowRoutes = routes.filter((route) =>
      startOfDay(new Date(route.scheduledDate)).getTime() === tomorrow.getTime(),
    );
    const tomorrowStops = tomorrowRoutes.reduce((acc, route) => acc + route.stops.length, 0);
    return { routes: tomorrowRoutes.length, stops: tomorrowStops };
  }, [routes]);

  const pendingRoutes = useMemo(
    () => routes.filter((route) => route.status.toUpperCase() !== "CONFIRMED"),
    [routes],
  );

  const confirmedRoutes = useMemo(
    () => routes.filter((route) => route.status.toUpperCase() === "CONFIRMED"),
    [routes],
  );

  const pendingGroups = useMemo<RouteGroup[]>(() => {
    const map = new Map<string, RouteGroup>();
    pendingRoutes.forEach((route) => {
      const date = startOfDay(new Date(route.scheduledDate));
      const key = date.toISOString();
      const group = map.get(key) ?? { date, routes: [] };
      group.routes.push(route);
      map.set(key, group);
    });
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [pendingRoutes]);

  const confirmedGroups = useMemo<RouteGroup[]>(() => {
    const map = new Map<string, RouteGroup>();
    confirmedRoutes.forEach((route) => {
      const date = startOfDay(new Date(route.scheduledDate));
      const key = date.toISOString();
      const group = map.get(key) ?? { date, routes: [] };
      group.routes.push(route);
      map.set(key, group);
    });
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [confirmedRoutes]);

  const pendingBuckets = useMemo(() => partitionRouteGroups(pendingGroups), [pendingGroups]);
  const confirmedBuckets = useMemo(() => partitionRouteGroups(confirmedGroups), [confirmedGroups]);

  const scopeTotals = useMemo(() => {
    const totals: Record<ScopeKey, { routes: number; pending: number; confirmed: number }> = {
      today: { routes: 0, pending: 0, confirmed: 0 },
      tomorrow: { routes: 0, pending: 0, confirmed: 0 },
      upcoming: { routes: 0, pending: 0, confirmed: 0 },
    };

    scopeOrder.forEach((scope) => {
      const pendingCount = pendingBuckets[scope].reduce((acc, group) => acc + group.routes.length, 0);
      const confirmedCount = confirmedBuckets[scope].reduce((acc, group) => acc + group.routes.length, 0);
      totals[scope] = {
        routes: pendingCount + confirmedCount,
        pending: pendingCount,
        confirmed: confirmedCount,
      };
    });

    return totals;
  }, [pendingBuckets, confirmedBuckets]);

  const technicianLabel = (id?: string | null) => {
    if (!id) return "Unassigned";
    const tech = technicians.find((t) => t.id === id);
    if (!tech) return id;
    return tech.name || tech.email || id;
  };

  const formatFrequency = (frequency?: string | null) => {
    if (!frequency) return "Mixed cadence";
    switch (frequency) {
      case "WEEKLY":
        return "Weekly";
      case "BI_WEEKLY":
      case "BIWEEKLY":
        return "Bi-weekly";
      case "TWICE_WEEKLY":
        return "Twice weekly";
      case "MONTHLY":
        return "Monthly";
      case "ONE_TIME":
        return "One-time";
      default:
        return frequency.replace(/_/g, " ").toLowerCase();
    }
  };

  const describeCadence = (frequency?: string | null) => {
    switch (frequency) {
      case "TWICE_WEEKLY":
        return "Initial clean + follow-up automatically held each week.";
      case "WEEKLY":
        return "Repeats on this day every week.";
      case "BI_WEEKLY":
      case "BIWEEKLY":
        return "Runs every other week once approved.";
      case "MONTHLY":
        return "Occurs monthly on the scheduled date.";
      case "ONE_TIME":
        return "One-time visit.";
      default:
        return "Custom cadence managed per job.";
    }
  };

  const schedulePreviewWeeks = useMemo(() => {
    if (!schedulePreview.visits.length) return [] as Array<{ start: Date; visits: UpcomingCustomerVisit[] }>;
    const map = new Map<string, { start: Date; visits: UpcomingCustomerVisit[] }>();
    schedulePreview.visits.forEach((visit) => {
      const date = new Date(visit.scheduledDate);
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const key = start.toISOString();
      const group = map.get(key) ?? { start, visits: [] };
      group.visits.push(visit);
      map.set(key, group);
    });
    return Array.from(map.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [schedulePreview.visits]);

  const handleRouteTechSelect = (routeId: string, value: string) => {
    const normalized = value === "none" ? "" : value;
    setRouteTechInputs((prev) => ({ ...prev, [routeId]: normalized }));
    void handleAssignRouteTechnician(routeId, normalized);
  };

  const handleAssignRouteTechnician = async (routeId: string, technician: string) => {
    setAssigningRouteId(routeId);
    try {
      const response = await fetch(`/api/dispatch/routes/${routeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ technicianId: technician || "" }),
      });
      const json = await parseJson<{
        ok: boolean;
        route?: RouteInstanceDto;
        error?: string;
      }>(response);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Failed with status ${response.status}`);
      }
      toast.success("Route technician updated");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update route technician",
      );
    } finally {
      setAssigningRouteId(null);
    }
  };

  const handleOptimize = async (routeId: string) => {
    setOptimizingRouteId(routeId);
    try {
      const response = await fetch(`/api/dispatch/routes/${routeId}/optimize`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await parseJson<{ ok: boolean }>(response);
      toast.success("Route optimized");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Optimization failed",
      );
    } finally {
      setOptimizingRouteId(null);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    const routeLabel = routes.find((route) => route.id === routeId)?.name;
    const confirmed = window.confirm(
      `Delete this route${routeLabel ? ` (${routeLabel})` : ""}? All visits on it will return to the unassigned queue.`,
    );
    if (!confirmed) return;

    setDeletingRouteId(routeId);
    try {
      const response = await fetch(`/api/dispatch/routes/${routeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed with status ${response.status}`);
      }

      toast.success("Route deleted. Visits are back in the unassigned list.");
      await loadData();
    } catch (error) {
      console.error("dispatch.route.delete", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to delete route",
      );
    } finally {
      setDeletingRouteId(null);
    }
  };

  const handleApproveRoute = async (routeId: string) => {
    try {
      const response = await fetch(`/api/dispatch/routes/${routeId}/finalize`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Finalize failed (${response.status})`);
      }
      await parseJson<{ ok: boolean }>(response);
      toast.success("Route approved");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to approve route");
    }
  };

  const handleAutoAssignVisit = async (visit: VisitDto) => {
    if (!orgId) return;
    setAutoAssigningVisitId(visit.id);
    try {
      const response = await fetch("/api/dispatch/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orgId,
          scheduledDate: visit.scheduledDate,
          visitIds: [visit.id],
        }),
      });
      const json = await parseJson<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Failed to auto-assign visit (${response.status})`);
      }
      toast.success("Visit routed automatically");
      await loadData();
    } catch (error) {
      console.error("dispatch.autoAssignVisit", error);
      toast.error(error instanceof Error ? error.message : "Unable to auto-assign visit");
    } finally {
      setAutoAssigningVisitId(null);
    }
  };

  const handleAutoAssignRemaining = async () => {
    if (!orgId || !availableVisits.length) return;
    setAutoAssigningAll(true);
    try {
      const future = addDays(new Date(), 60).toISOString();
      await fetch(
        `/api/dispatch/routes?orgId=${encodeURIComponent(orgId)}&to=${encodeURIComponent(future)}`,
        { credentials: "include" },
      );
      toast.success("Auto-routing remaining visits… refresh incoming");
      await loadData();
    } catch (error) {
      console.error("dispatch.autoAssignRemaining", error);
      toast.error(error instanceof Error ? error.message : "Unable to auto-assign remaining visits");
    } finally {
      setAutoAssigningAll(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const originalRoutes = cloneRoutes(routes);
    const optimisticRoutes = cloneRoutes(routes);
    try {
      const { source, destination, draggableId } = result;
      if (!destination) return;

      const [type, id, visitIdFromDraggable] = draggableId.split(":");
      const sourceRouteId = getRouteIdFromDroppable(source.droppableId);
      const destinationRouteId = getRouteIdFromDroppable(destination.droppableId);

      if (!sourceRouteId || !destinationRouteId) {
        return;
      }

      const destinationRoute = routes.find((r) => r.id === destinationRouteId);
      const sourceRoute = routes.find((r) => r.id === sourceRouteId);

      if (!destinationRoute || !sourceRoute) return;

      const destinationDate = startOfDay(new Date(destinationRoute.scheduledDate));
      const sourceDate = startOfDay(new Date(sourceRoute.scheduledDate));
      const requiresReschedule = destinationDate.getTime() !== sourceDate.getTime();

      if (requiresReschedule) {
        const proceed = window.confirm(
          `Move visit to ${format(destinationDate, "eeee, MMM d")}? This will reschedule the visit.`,
        );
        if (!proceed) return;
      }

      const destinationScheduledDate = destinationRoute.scheduledDate;

      if (type === "stop") {
        const stopId = id;
        let visitId = visitIdFromDraggable;
        const route = routes.find((r) => r.id === sourceRouteId);
        const stop = route?.stops.find((s) => s.id === stopId);
        visitId = visitId || stop?.serviceVisitId || "";

        if (!visitId) return;

        if (destinationRouteId === sourceRouteId) {
          const optimisticRoute = optimisticRoutes.find((r) => r.id === sourceRouteId);
          if (!optimisticRoute) return;
          const orderedStops = [...optimisticRoute.stops].sort((a, b) => a.position - b.position);
          const sourceIndex = orderedStops.findIndex((s) => s.id === stopId);
          if (sourceIndex === -1) return;
          const [moving] = orderedStops.splice(sourceIndex, 1);
          orderedStops.splice(destination.index, 0, moving);
          optimisticRoute.stops = orderedStops.map((stop, position) => ({
            ...stop,
            position,
          }));
          setRoutes([...optimisticRoutes]);
          await submitReorder(
            sourceRouteId,
            optimisticRoute.stops.map((stop) => ({ stopId: stop.id, position: stop.position })),
          );
          toast.success("Stop order updated");
          await loadData();
          return;
        }

        const sourceIdx = optimisticRoutes.findIndex((r) => r.id === sourceRouteId);
        const destIdx = optimisticRoutes.findIndex((r) => r.id === destinationRouteId);
        if (sourceIdx === -1 || destIdx === -1) return;

        const sourceRouteOptimistic = optimisticRoutes[sourceIdx];
        const destRouteOptimistic = optimisticRoutes[destIdx];
        const movingIndex = sourceRouteOptimistic.stops.findIndex((s) => s.id === stopId);
        if (movingIndex === -1) return;

        // ===== TIME WINDOW VALIDATION =====
        // Check if the visit's time window matches the destination route's time window
        const movingStopData = sourceRouteOptimistic.stops[movingIndex];
        const visitWindowSlug = movingStopData?.serviceVisit?.preferredTimeWindowSlug;
        const destRouteWindowType = getRouteTimeWindowType(destRouteOptimistic);
        const sourceRouteWindowType = getRouteTimeWindowType(sourceRouteOptimistic);
        
        // If both the visit and destination route have defined time windows that don't match
        if (visitWindowSlug && destRouteWindowType && visitWindowSlug !== destRouteWindowType) {
          const visitWindowLabel = visitWindowSlug === "morning" ? "Morning" : "Afternoon";
          const destWindowLabel = destRouteWindowType === "morning" ? "Morning" : "Afternoon";
          
          toast.error(
            `Cannot move: This visit requires a ${visitWindowLabel} window, but the destination is an ${destWindowLabel} route.`,
            { duration: 5000 }
          );
          return;
        }
        
        // Also warn if moving FROM a matching route TO a route with a different type
        if (sourceRouteWindowType && destRouteWindowType && sourceRouteWindowType !== destRouteWindowType) {
          const sourceLabel = sourceRouteWindowType === "morning" ? "☀️ Morning" : "🌤️ Afternoon";
          const destLabel = destRouteWindowType === "morning" ? "☀️ Morning" : "🌤️ Afternoon";
          
          const proceed = window.confirm(
            `You're moving this stop from a ${sourceLabel} route to an ${destLabel} route.\n\nThe customer may have a preferred time window. Continue anyway?`
          );
          if (!proceed) return;
        }
        // ===== END TIME WINDOW VALIDATION =====

        const [movingStop] = sourceRouteOptimistic.stops.splice(movingIndex, 1);
        const insertionIndex = Math.min(
          Math.max(destination.index, 0),
          destRouteOptimistic.stops.length,
        );
        destRouteOptimistic.stops.splice(insertionIndex, 0, movingStop);

        sourceRouteOptimistic.stops = sourceRouteOptimistic.stops.map((stop, position) => ({
          ...stop,
          position,
        }));
        destRouteOptimistic.stops = destRouteOptimistic.stops.map((stop, position) => ({
          ...stop,
          position,
        }));

        setRoutes([...optimisticRoutes]);

        const transferResponse = await fetch(`/api/dispatch/routes/${sourceRouteId}/stops/${stopId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            destinationRouteId,
            position: destination.index,
            scheduledDate: destinationScheduledDate,
          }),
        });
        if (!transferResponse.ok) {
          const text = await transferResponse.text();
          throw new Error(text || `Failed with status ${transferResponse.status}`);
        }
        try {
          await parseJson<{ ok: boolean }>(transferResponse);
        } catch (error) {
          console.warn("dispatch.stop.transfer.parse", error);
        }

        toast.success("Visit reassigned");
        await loadData();
      } else if (type === "visit") {
        // dragging unassigned visit onto a route
        const response = await fetch(`/api/dispatch/routes/${destinationRouteId}/stops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            visitId: id,
            position: destination.index,
            scheduledDate: destinationRoute.scheduledDate,
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed with status ${response.status}`);
        }
        try {
          await parseJson<{ ok: boolean }>(response);
        } catch (error) {
          console.warn("dispatch.stop.attach.parse", error);
        }
        toast.success("Visit added to route");
        await loadData();
      }
    } catch (error) {
      console.error(error);
      setRoutes(originalRoutes);
      const message =
        error instanceof Error && error.message
          ? error.message.includes("internal_error")
            ? "Dispatch couldn't move that stop right now. Please refresh and try again."
            : error.message
          : "Unable to update route";
      toast.error(message);
    }
  };

  const submitReorder = async (
    routeId: string,
    stops: Array<{ stopId: string; position: number }>,
  ) => {
    const response = await fetch(`/api/dispatch/routes/${routeId}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stops }),
    });
    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }
    await parseJson<{ ok: boolean }>(response);
  };

  const openSchedulePreview = async (
    customerId: string,
    customerName: string,
    frequency: string | null,
  ) => {
    setSchedulePreview({
      open: true,
      customerId,
      customerName,
      frequency,
      loading: true,
      error: null,
      visits: [],
    });

    try {
      const response = await fetch(
        `/api/dispatch/customers/${customerId}/upcoming?rangeDays=45`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load cadence (${response.status})`);
      }
      const data = await parseJson<{ ok: boolean; visits: UpcomingCustomerVisit[] }>(response);
      setSchedulePreview((prev) => ({
        ...prev,
        loading: false,
        visits: data.visits ?? [],
      }));
    } catch (error) {
      console.error("dispatch.customer.upcoming", error);
      setSchedulePreview((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load cadence",
      }));
    }
  };

  const closeSchedulePreview = () => {
    setSchedulePreview({
      open: false,
      customerId: null,
      customerName: "",
      frequency: null,
      loading: false,
      error: null,
      visits: [],
    });
  };

  const renderStopCard = (stop: RouteStopDto, index: number, route: RouteInstanceDto) => {
    const visit = stop.serviceVisit;
    const windowLabel = visit?.preferredTimeWindowLabel ?? "Window TBD";
    const frequency = visit?.job?.frequency ?? null;
    const cadenceLabel = formatFrequency(frequency);
    const cadenceText = describeCadence(frequency);
    const address = [visit?.customer?.addressLine1, visit?.customer?.city]
      .filter(Boolean)
      .join(", ") || "Address pending";
    const customerName = visit?.customer?.name ?? "Unnamed customer";

    return (
      <div
        key={stop.id}
        className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-slate-600 shadow-sm backdrop-blur-sm transition dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-slate-200"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-mint text-xs font-semibold uppercase tracking-wide text-white">
              {index + 1}
            </span>
            <div className="space-y-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {customerName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{address}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{windowLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Badge
            variant="outline"
            className="rounded-full border-brand-mint/30 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/20 dark:bg-brand-mint/10 dark:text-brand-mint"
          >
            {cadenceLabel}
          </Badge>
          <span>{cadenceText}</span>
          {visit?.customerId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                openSchedulePreview(
                  visit.customerId!,
                  visit.customer?.name ?? "Client",
                  visit?.job?.frequency ?? null,
                )
              }
              className="h-7 rounded-full px-2 text-[11px] text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              View cadence
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPendingRouteCard = (route: RouteInstanceDto) => (
    <RouteCard
      technicians={technicians}
      route={route}
      technicianLabel={technicianLabel}
      routeTechValue={routeTechInputs[route.id] || ""}
      assignRouteTechnician={handleRouteTechSelect}
      approveRoute={handleApproveRoute}
      optimizingRouteId={optimizingRouteId}
      handleOptimize={handleOptimize}
      renderStop={(stop, idx) => renderStopCard(stop, idx, route)}
      setMapPreviewRoute={setMapPreviewRoute}
      deleteRoute={handleDeleteRoute}
      deletingRouteId={deletingRouteId}
    />
  );

  const renderConfirmedRouteCard = (route: RouteInstanceDto) => (
    <RouteCard
      technicians={technicians}
      route={route}
      technicianLabel={technicianLabel}
      routeTechValue={routeTechInputs[route.id] || ""}
      assignRouteTechnician={handleRouteTechSelect}
      approveRoute={handleApproveRoute}
      optimizingRouteId={optimizingRouteId}
      handleOptimize={handleOptimize}
      renderStop={(stop, idx) => renderStopCard(stop, idx, route)}
      setMapPreviewRoute={setMapPreviewRoute}
      hideApprove
      deleteRoute={handleDeleteRoute}
      deletingRouteId={deletingRouteId}
    />
  );

  const renderDayPanel = (scope: ScopeKey) => {
    const pending = pendingBuckets[scope];
    const confirmed = confirmedBuckets[scope];

    const sections: React.ReactNode[] = [];

    if (pending.length) {
      sections.push(
        <PendingApprovalSection
          key="pending"
          groups={pending}
          renderRouteCard={renderPendingRouteCard}
          onCreateRoute={openCreateRouteDialogForDate}
        />,
      );
    }

    if (confirmed.length) {
      sections.push(
        <ConfirmedRoutesSection
          key="confirmed"
          groups={confirmed}
          renderRouteCard={renderConfirmedRouteCard}
          onCreateRoute={openCreateRouteDialogForDate}
        />,
      );
    }

    if (!sections.length) {
      const fallbackDate = defaultDateForScope(scope);
      return (
        <Card className="admin-card">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center text-sm text-slate-500">
            <p>No routes scheduled for {scopeLabels[scope].toLowerCase()}.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2 rounded-full border-slate-200 px-4 py-2 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
              onClick={() => openCreateRouteDialogForDate(fallbackDate)}
            >
              <Plus className="h-4 w-4" /> Add route
            </Button>
          </CardContent>
        </Card>
      );
    }

    return <div className="space-y-10">{sections}</div>;
  };

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-700/70 bg-white text-slate-900 dark:border-slate-900/40 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 py-12 space-y-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4">
              <p className="admin-kicker">Field dispatch</p>
              <div className="space-y-2">
                <h1 className="font-serif text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white">
                  Dispatch war room
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                  Approve routes, balance workloads, and keep recurring customers on schedule.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={loadData}
                disabled={loading}
                className="rounded-xl border border-brand-mint/30 bg-white px-4 py-2 text-slate-700 shadow-sm transition hover:border-brand-mint/40 hover:bg-brand-mint/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/10"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Refresh data
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="admin-card rounded-2xl p-4 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Today</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {todayStats.routes}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {todayStats.stops} stop{todayStats.stops === 1 ? "" : "s"} queued
              </p>
            </div>
            <div className="admin-card rounded-2xl p-4 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Tomorrow</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {tomorrowStats.routes}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tomorrowStats.stops} stop{tomorrowStats.stops === 1 ? "" : "s"} upcoming
              </p>
            </div>
            <div className="admin-card rounded-2xl p-4 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Pending approvals</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {pendingRoutes.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Waiting for manager sign-off</p>
            </div>
          </div>
        </div>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="container mx-auto px-6 py-10 space-y-10">
        {availableVisits.length ? (
          <Card className="rounded-3xl border border-amber-300/80 bg-amber-50/80 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-amber-900 dark:text-amber-100">
              <div>
                <CardTitle className="text-base font-semibold">
                  {availableVisits.length} visit{availableVisits.length === 1 ? "" : "s"} still unassigned
                </CardTitle>
                <CardDescription className="text-sm text-amber-800 dark:text-amber-200/80">
                  Auto-routing will sort these into suggested routes. Approve or adjust below.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAssignRemaining}
                  disabled={autoAssigningAll}
                  className="gap-2 rounded-full border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-300/60 dark:text-amber-100 dark:hover:bg-amber-400/10"
                >
                  {autoAssigningAll ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Auto assign remaining
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-amber-200/70 bg-white/95 dark:border-amber-300/30 dark:bg-slate-950/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Auto assign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <Badge variant="outline" className="border-amber-200 text-amber-700">
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-200 dark:text-slate-200">
                          <div className="flex flex-col">
                            <span>
                              {formatServiceDate(visit.scheduledDate, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }) ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-200 dark:text-slate-200">
                          {visit.customer?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {[visit.customer?.addressLine1, visit.customer?.city]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {visit.preferredTimeWindowLabel ?? "Window TBD"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {visit.job?.id ?? "—"} ({visit.job?.frequency ?? "n/a"})
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAutoAssignVisit(visit)}
                            disabled={autoAssigningVisitId === visit.id || autoAssigningAll}
                            className="gap-1 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-400/60 dark:text-amber-200 dark:hover:bg-amber-500/15"
                          >
                            {autoAssigningVisitId === visit.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Auto assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs
          value={activeScope}
          onValueChange={(value) => setActiveScope(value as ScopeKey)}
          className="space-y-6"
        >
          <TabsList className="admin-pill-tabs w-full flex-nowrap overflow-x-auto">
            {scopeOrder.map((scope) => {
              const totals = scopeTotals[scope];
              const hasPending = totals.pending > 0;
              return (
                <TabsTrigger
                  key={scope}
                  value={scope}
                  className="admin-pill-tab flex h-11 shrink-0 items-center justify-between gap-3"
                >
                  <span>{scopeLabels[scope]}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      hasPending
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-700 dark:text-slate-200 dark:text-slate-200 dark:bg-slate-700/60 dark:text-slate-200'
                    }`}
                  >
                    {totals.routes}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {scopeOrder.map((scope) => (
            <TabsContent key={scope} value={scope} className="focus-visible:outline-none">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {scopeTotals[scope].routes} route{scopeTotals[scope].routes === 1 ? "" : "s"} scheduled
                  {scopeTotals[scope].pending
                    ? ` • ${scopeTotals[scope].pending} awaiting approval`
                    : scopeTotals[scope].routes
                      ? " • all confirmed"
                      : ""}
                </span>
                {scopeTotals[scope].pending > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Manager review needed
                  </span>
                ) : null}
              </div>
              {renderDayPanel(scope)}
            </TabsContent>
          ))}
        </Tabs>

        </div>
      </DragDropContext>

      <Dialog
        open={createRouteDialog.open}
        onOpenChange={(open) => {
          if (open) return;
          closeCreateRouteDialogSafely();
        }}
      >
        <DialogContent className="admin-card max-w-md text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-slate-900 dark:text-white">
              Add a route
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
              {createRouteDialog.date
                ? `Plan coverage for ${format(createRouteDialog.date, "EEEE, MMM d")}.`
                : "Pick a day to stage a fresh route."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Scheduled date
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-mint/40 focus:outline-none focus:ring-2 focus:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                value={createRouteDialog.date ? format(createRouteDialog.date, "yyyy-MM-dd") : ""}
                onChange={(event) => handleCreateRouteDateChange(event.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Routes anchor to midnight so technicians see the correct service window.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Assign technician (optional)
              </label>
              <Select
                value={createRouteForm.technicianId || "none"}
                onValueChange={(value) =>
                  setCreateRouteForm((prev) => ({
                    ...prev,
                    technicianId: value === "none" ? "" : value,
                  }))
                }
                disabled={techniciansLoading}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 text-sm dark:border-slate-700">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name || tech.email || tech.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Route label (optional)
              </label>
              <Input
                value={createRouteForm.name}
                onChange={(event) =>
                  setCreateRouteForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Northside AM"
                className="rounded-xl border-slate-200 text-sm dark:border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Internal notes (optional)
              </label>
              <Textarea
                value={createRouteForm.notes}
                onChange={(event) =>
                  setCreateRouteForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={3}
                placeholder="Flag launch notes or special instructions for dispatch."
                className="rounded-xl border-slate-200 text-sm dark:border-slate-700"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeCreateRouteDialogSafely()}
              disabled={creatingRoute}
              className="rounded-full border-slate-200 text-slate-600 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:text-brand-mint"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitCreateRoute}
              disabled={!createRouteDialog.date || creatingRoute}
              className="inline-flex items-center gap-2 rounded-full bg-brand-coral text-white hover:bg-brand-coral/90"
            >
              {creatingRoute ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create route
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mapPreviewRoute)}
        onOpenChange={(open) => {
          if (!open) setMapPreviewRoute(null);
        }}
      >
        <DialogContent className="admin-card max-w-5xl text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-slate-900 dark:text-white">
              Route preview
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
              {mapPreviewRoute
                ? `${format(new Date(mapPreviewRoute.scheduledDate), "EEEE, MMM d")} · ${
                    computeRouteWindowLabel(mapPreviewRoute) ?? "Window TBD"
                  }`
                : "Explore the stop sequence on a live map."}
            </DialogDescription>
          </DialogHeader>
          {mapPreviewRoute ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Technician: {technicianLabel(mapPreviewRoute.technician?.id || mapPreviewRoute.technicianId)}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {mapPreviewRoute.stops.length} stop{mapPreviewRoute.stops.length === 1 ? "" : "s"}
                </Badge>
                {mapPreviewRoute.notes?.includes("[AUTO:") ? (
                  <Badge variant="outline" className="border-brand-mint/40 bg-brand-mint/10 text-brand-mint">
                    Auto-generated
                  </Badge>
                ) : null}
              </div>
              <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <RoutePreviewMap route={mapPreviewRoute} />
              </div>
              <div className="space-y-2">
                {[...mapPreviewRoute.stops]
                  .sort((a, b) => a.position - b.position)
                  .map((stop, index) => {
                    const visit = stop.serviceVisit;
                    const windowLabel = visit?.preferredTimeWindowLabel ?? "Window TBD";
                    const name = visit?.customer?.name || visit?.customer?.addressLine1 || "Unnamed";
                    return (
                      <div
                        key={stop.id}
                        className="flex items-center justify-between rounded-lg admin-card px-3 py-2 text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            Stop {index + 1}: {name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {[visit?.customer?.addressLine1, visit?.customer?.city]
                              .filter(Boolean)
                              .join(", ") || "Address pending"}
                          </span>
                        </div>
                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                          <p>{windowLabel}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={schedulePreview.open}
        onOpenChange={(open) => {
          if (!open) closeSchedulePreview();
        }}
      >
        <DialogContent className="admin-card max-h-[85vh] max-w-4xl overflow-y-auto text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-slate-900 dark:text-white">
              Cadence for {schedulePreview.customerName || "Customer"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
              {schedulePreview.frequency
                ? `${formatFrequency(schedulePreview.frequency)} cadence`
                : "Upcoming visits across the next six weeks."}
            </DialogDescription>
          </DialogHeader>
          {schedulePreview.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-16 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : schedulePreview.error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              {schedulePreview.error}
            </div>
          ) : schedulePreview.visits.length === 0 ? (
            <div className="rounded-lg admin-card p-6 text-sm text-slate-600 dark:text-slate-300">
              No follow-up visits scheduled in the next six weeks. Add another visit from the route board.
            </div>
          ) : (
            <div className="space-y-4">
              {schedulePreviewWeeks.map((week) => {
                const end = addDays(week.start, 6);
                const label = `${format(week.start, "MMM d")} – ${format(end, "MMM d")}`;
                const highlight = isSameWeek(new Date(), week.start, { weekStartsOn: 1 });
                return (
                  <div
                    key={week.start.toISOString()}
                    className={`rounded-xl border p-4 ${highlight ? "border-brand-200 bg-brand-50 dark:border-brand-mint/40 dark:bg-brand-mint/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Week of {label}
                      </p>
                      {highlight ? (
                        <Badge
                          variant="outline"
                          className="border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                        >
                          Current week
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {week.visits.map((visit) => (
                        <div
                          key={visit.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg admin-card px-3 py-2 text-sm"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {format(new Date(visit.scheduledDate), "eee MMM d")}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                              <span className="inline-flex items-center rounded-full bg-brand-mint/10 px-2 py-0.5 font-medium text-brand-mint">
                                {visit.windowLabel || "Window TBD"}
                              </span>
                              <span>Status: {visit.status.replace(/_/g, " ")}</span>
                              {visit.route?.technician?.name ? (
                                <span>Tech: {visit.route.technician.name}</span>
                              ) : visit.assignedTo?.name ? (
                                <span>Assigned: {visit.assignedTo.name}</span>
                              ) : null}
                            </div>
                          </div>
                          {visit.route ? (
                            <Badge variant="secondary">Planned route #{visit.route.id.slice(-6)}</Badge>
                          ) : (
                            <Badge variant="outline">Unassigned</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getRouteIdFromDroppable(droppableId: string): string | null {
  if (!droppableId) return null;
  const [, routeId] = droppableId.split("route-");
  return routeId || null;
}

function computeRouteWindowLabel(route: RouteInstanceDto): string | null {
  const counts = new Map<string, number>();
  route.stops.forEach((stop) => {
    const label = stop.serviceVisit?.preferredTimeWindowLabel;
    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });
  if (!counts.size) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Determines the time window type of a route: "morning", "afternoon", or null (mixed/unknown)
 * Checks the [AUTO:morning] or [AUTO:afternoon] tag in notes first, then falls back to dominant stop windows
 */
function getRouteTimeWindowType(route: RouteInstanceDto): "morning" | "afternoon" | null {
  // First check for explicit [AUTO:morning] or [AUTO:afternoon] tag in notes
  const noteMatch = route.notes?.match(/\[AUTO:(morning|afternoon)\]/);
  if (noteMatch) {
    return noteMatch[1] as "morning" | "afternoon";
  }

  // Fall back to dominant window from stops
  const slugCounts = new Map<string, number>();
  route.stops.forEach((stop) => {
    const slug = stop.serviceVisit?.preferredTimeWindowSlug;
    if (slug) {
      slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    }
  });

  if (!slugCounts.size) return null;

  const dominant = Array.from(slugCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant === "morning") return "morning";
  if (dominant === "afternoon") return "afternoon";
  return null;
}

/**
 * Gets CSS classes for route card based on time window type
 */
function getRouteTimeWindowStyles(windowType: "morning" | "afternoon" | null) {
  switch (windowType) {
    case "morning":
      return {
        card: "border-sky-200/70 dark:border-sky-400/30",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
        accent: "bg-sky-500",
        label: "☀️ Morning",
      };
    case "afternoon":
      return {
        card: "border-amber-200/70 dark:border-amber-400/30",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
        accent: "bg-amber-500",
        label: "🌤️ Afternoon",
      };
    default:
      return {
        card: "border-slate-200/70 dark:border-slate-700/70",
        badge: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-200",
        accent: "bg-slate-400",
        label: null,
      };
  }
}

function PendingApprovalSection({
  groups,
  renderRouteCard,
  onCreateRoute,
}: {
  groups: RouteGroup[];
  renderRouteCard: (route: RouteInstanceDto) => React.ReactNode;
  onCreateRoute: (date: Date) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Pending approval</h2>
        <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          Routes awaiting manager sign-off
        </Badge>
      </div>
      {groups.length === 0 ? (
        <div className="admin-card rounded-3xl p-6">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            All routes are confirmed
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            New signups and recurring visits will appear here when they need approval.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const count = group.routes.length;
            return (
              <section
                key={group.date.toISOString()}
                className="admin-card rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70"
              >
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {format(group.date, "EEEE, MMMM d")}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {count} route{count === 1 ? "" : "s"} pending approval
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="self-start rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                      Needs review
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="inline-flex items-center gap-2 rounded-full border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
                      onClick={() => onCreateRoute(new Date(group.date))}
                    >
                      <Plus className="h-4 w-4" /> Add route
                    </Button>
                  </div>
                </header>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.routes.map((route) => (
                    <div key={route.id} className="flex flex-col">
                      {renderRouteCard(route)}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ConfirmedRoutesSection({
  groups,
  renderRouteCard,
  onCreateRoute,
}: {
  groups: RouteGroup[];
  renderRouteCard: (route: RouteInstanceDto) => React.ReactNode;
  onCreateRoute: (date: Date) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Confirmed routes</h2>
        <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          Drag and drop to fine-tune the week
        </Badge>
      </div>
      {groups.length === 0 ? (
        <div className="admin-card rounded-3xl p-6">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            No confirmed routes yet
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Approve upcoming visits to populate the board.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section
              key={group.date.toISOString()}
              className="admin-card rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70"
            >
              <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {format(group.date, "EEEE, MMMM d")}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {group.routes.length} route{group.routes.length === 1 ? "" : "s"} locked in
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="self-start rounded-full bg-brand-mint/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-mint dark:bg-brand-mint/10 dark:text-brand-mint">
                    Ready to roll
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-2 rounded-full border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
                    onClick={() => onCreateRoute(new Date(group.date))}
                  >
                    <Plus className="h-4 w-4" /> Add route
                  </Button>
                </div>
              </header>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.routes.map((route) => (
                  <div key={route.id} className="flex flex-col">
                    {renderRouteCard(route)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function RouteCard({
  technicians,
  route,
  technicianLabel,
  routeTechValue,
  assignRouteTechnician,
  approveRoute,
  optimizingRouteId,
  handleOptimize,
  renderStop,
  setMapPreviewRoute,
  hideApprove,
  deleteRoute,
  deletingRouteId,
}: {
  technicians: Array<{ id: string; name: string | null; email: string | null }>;
  route: RouteInstanceDto;
  technicianLabel: (id?: string | null) => string;
  routeTechValue: string;
  assignRouteTechnician: (routeId: string, value: string) => void;
  approveRoute: (routeId: string) => Promise<void>;
  optimizingRouteId: string | null;
  handleOptimize: (routeId: string) => Promise<void>;
  renderStop: (stop: RouteStopDto, index: number) => React.ReactNode;
  setMapPreviewRoute: (route: RouteInstanceDto | null) => void;
  hideApprove?: boolean;
  deleteRoute?: (routeId: string) => Promise<void>;
  deletingRouteId?: string | null;
}) {
  const orderedStops = [...route.stops].sort((a, b) => a.position - b.position);
  const routeDate = new Date(route.scheduledDate);
  const routeWindowLabel = computeRouteWindowLabel(route) ?? "Window TBD";
  const routeTechValueNormalized = routeTechValue || route.technicianId || route.technician?.id || "";
  const routeIsConfirmed = route.status?.toUpperCase() === "CONFIRMED";
  const routeWindowType = getRouteTimeWindowType(route);
  const windowStyles = getRouteTimeWindowStyles(routeWindowType);

  return (
    <Droppable droppableId={`route-${route.id}`}>
      {(provided, snapshot) => {
        const isDraggingOver = snapshot.isDraggingOver;
        return (
          <div
            className={`group relative flex h-full w-full flex-col rounded-3xl border bg-white/95 p-5 shadow-sm transition hover:shadow-lg dark:bg-slate-950/60 ${windowStyles.card} ${
              isDraggingOver ? "ring-2 ring-brand-mint/30" : "ring-0"
            }`}
          >
          {/* Time window accent stripe at top */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl ${windowStyles.accent}`} />
          
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {/* Time window badge */}
                {windowStyles.label ? (
                  <Badge className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${windowStyles.badge}`}>
                    {windowStyles.label}
                  </Badge>
                ) : null}
                {!routeIsConfirmed ? (
                  <Badge className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                    Needs approval
                  </Badge>
                ) : (
                  <Badge className="rounded-full bg-brand-mint/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-mint dark:bg-brand-mint/10 dark:text-brand-mint">
                    Confirmed
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full border-slate-200/70 bg-white/70 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300">
                  {orderedStops.length} stop{orderedStops.length === 1 ? "" : "s"}
                </Badge>
                {route.dispatcher?.name ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                    Planned by {route.dispatcher.name}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline gap-3 text-slate-900 dark:text-white">
                <h3 className="text-lg font-semibold lg:text-xl">{format(routeDate, "EEEE, MMM d")}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${windowStyles.badge}`}>
                  {routeWindowLabel}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Technician: {technicianLabel(routeTechValueNormalized)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMapPreviewRoute(route)}
                className="w-full rounded-xl border-slate-200/80 bg-white/90 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-brand-mint/40"
              >
                View map
              </Button>
              <Select
                value={routeTechValueNormalized || "none"}
                onValueChange={(value) => assignRouteTechnician(route.id, value)}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200/80 text-sm dark:border-slate-700/70 sm:w-52">
                  <SelectValue placeholder="Assign technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name || tech.email || tech.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOptimize(route.id)}
                disabled={optimizingRouteId === route.id}
                className="w-full rounded-xl border-slate-200/80 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700/70 dark:text-slate-200"
              >
                {optimizingRouteId === route.id ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Optimize order
              </Button>
              {deleteRoute ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => deleteRoute(route.id)}
                  disabled={deletingRouteId === route.id}
                  className="w-full rounded-xl border-red-200/80 text-red-600 hover:bg-red-50 dark:border-red-400/40 dark:text-red-300"
                >
                  {deletingRouteId === route.id ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-3 w-3" />
                  )}
                  Delete
                </Button>
              ) : null}
              {!hideApprove ? (
                <Button
                  type="button"
                  onClick={() => approveRoute(route.id)}
                  className="w-full rounded-xl bg-brand-mint text-sm font-semibold text-white shadow-sm hover:bg-brand-mint/90"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              ) : null}
            </div>
          </div>

          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`mt-5 flex flex-col gap-3 rounded-2xl border border-transparent p-1 transition ${
              isDraggingOver ? "border-brand-mint/40 bg-brand-mint/5" : "border-transparent"
            }`}
          >
            {orderedStops.map((stop, index) => {
              const explicitTechId = stop.technician?.id ?? stop.technicianId ?? null;
              const stopTechLabel = explicitTechId
                ? technicianLabel(explicitTechId)
                : technicianLabel(routeTechValueNormalized) || "Unassigned";
              const stopWindowLabel =
                stop.serviceVisit?.preferredTimeWindowLabel ||
                stop.serviceVisit?.preferredTimeWindow ||
                routeWindowLabel ||
                "Flexible";
              const stopStatusLabel = stop.serviceVisit?.status
                ? stop.serviceVisit.status.replace(/_/g, " ")
                : null;

              return (
                <Draggable
                  key={`stop:${stop.id}:${stop.serviceVisitId ?? ""}`}
                  draggableId={`stop:${stop.id}:${stop.serviceVisitId ?? ""}`}
                  index={index}
                >
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`rounded-2xl border border-dashed border-slate-200/70 bg-white/90 p-3 shadow-sm transition hover:border-brand-mint/30 dark:border-slate-700/60 dark:bg-slate-950/50 ${
                        dragSnapshot.isDragging ? "ring-2 ring-brand-mint/30" : ""
                      }`}
                    >
                      <div className="space-y-3">
                        {renderStop(stop, index)}
                        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 text-[11px] font-medium text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
                            Tech · {stopTechLabel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
                            Window · {stopWindowLabel}
                          </span>
                          {stopStatusLabel ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
                              Status · {stopStatusLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        </div>
        );
      }}
    </Droppable>
  );
}

function RoutePreviewMap({ route }: { route: RouteInstanceDto }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapLibRef = useRef<any>(null);
  const lineLayerRef = useRef<string | null>(null);

  const orderedStops = useMemo(
    () => [...route.stops].sort((a, b) => a.position - b.position),
    [route],
  );

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const maplibreModule = await import("maplibre-gl");
      if (!isMounted) return;
      const maplibre = maplibreModule.default ?? maplibreModule;
      mapLibRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [-93.265, 44.9778],
        zoom: 11,
      });
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      mapRef.current = map;
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = mapLibRef.current;
    if (!map || !maplibre) return;

    const render = () => {
      if (typeof map.resize === "function") {
        map.resize();
      }

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      if (lineLayerRef.current) {
        const existingLayer = lineLayerRef.current;
        if (map.getLayer(existingLayer)) map.removeLayer(existingLayer);
        if (map.getSource(existingLayer)) map.removeSource(existingLayer);
        lineLayerRef.current = null;
      }

      const coordinates: [number, number][] = [];
      orderedStops.forEach((stop, index) => {
        const lat = (stop.serviceVisit as any)?.customer?.latitude as number | undefined;
        const lng = (stop.serviceVisit as any)?.customer?.longitude as number | undefined;
        if (
          typeof lat !== "number" ||
          typeof lng !== "number" ||
          Number.isNaN(lat) ||
          Number.isNaN(lng)
        ) {
          return;
        }

        const markerEl = document.createElement("div");
        markerEl.className = "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-xs font-semibold text-white shadow";
        markerEl.textContent = String(index + 1);

        const marker = new maplibre.Marker({ element: markerEl })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.push(marker);

        coordinates.push([lng, lat]);
      });

      if (coordinates.length === 0) {
        return;
      }

      if (coordinates.length === 1) {
        map.setCenter(coordinates[0]);
        map.setZoom(14);
        return;
      }

      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibre.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });

      const sourceId = `preview-route-${route.id}`;
      if (map.getLayer(sourceId)) {
        map.removeLayer(sourceId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });
      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
      lineLayerRef.current = sourceId;
    };

    if (!map.isStyleLoaded()) {
      const handler = () => {
        render();
      };
      map.once("load", handler);
      return () => {
        map.off("load", handler as any);
      };
    }

    render();
  }, [orderedStops, route.id]);

  return <div ref={containerRef} className="h-full w-full" />;
}
