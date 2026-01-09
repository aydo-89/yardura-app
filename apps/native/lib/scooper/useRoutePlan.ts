import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { setJson } from '@/lib/storage';
import { parseDateInput } from '@/lib/dates';
import { isHaulAwayMode } from '@/lib/scooper/disposal';
import type {
  ScooperDailyCheckRewards,
  ScooperDailyCheckStatus,
  ScooperSummary,
  ScooperRoutePlan,
  ScooperRouteSummary,
  ScooperRouteVisit,
} from '@/lib/api/types';

const COMPLETED_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'SKIPPED']);
const DAILY_ROUTE_SNAPSHOT_KEY = 'insightscoop_scooper_daily_route';

export type VisitGroup = {
  label: string;
  visits: ScooperRouteVisit[];
};

export type VisitStatus = 'completed' | 'current' | 'upcoming' | 'locked';

export type TimelineVisit = {
  id: string;
  status: VisitStatus;
  customerName?: string;
  sequence?: number;
  estimatedMinutes?: number;
};

export function isVisitComplete(status?: string | null) {
  if (!status) return false;
  return COMPLETED_STATUSES.has(status);
}

function dayKey(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(value?: string | null, compareDate: Date = new Date()): boolean {
  if (!value) return false;
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(compareDate);
}

function parseCheckDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateInput(value);
  }
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }
  return parseDateInput(value);
}

function isTodayValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(new Date());
}

function startOfWeekMonday(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function formatFrequencyLabel(frequency?: string | null): string {
  if (!frequency) return 'recurring';
  return frequency.toLowerCase().replace(/_/g, ' ');
}

export function formatDayLabel(value: string) {
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function getVisitDisposalMode(visit: ScooperRouteVisit): string | null {
  const metadata = asRecord(visit.metadata);
  const disposalPreferences = asRecord(metadata?.disposalPreferences);
  return readString(disposalPreferences, 'mode');
}

export function deriveRouteSummaryFromVisits(
  visits: ScooperRouteVisit[],
): ScooperRouteSummary | null {
  if (!visits.length) return null;
  let betweenStopsDistanceMeters = 0;
  let betweenStopsDurationSeconds = 0;

  visits.forEach((visit) => {
    if (!visit.travelFromPrevious) return;
    betweenStopsDistanceMeters += visit.travelFromPrevious.distanceMeters ?? 0;
    betweenStopsDurationSeconds += visit.travelFromPrevious.durationSeconds ?? 0;
  });

  if (betweenStopsDistanceMeters <= 0 || betweenStopsDurationSeconds <= 0) {
    return null;
  }

  return {
    betweenStopsDistanceMeters,
    betweenStopsDurationSeconds,
    totalDistanceMeters: betweenStopsDistanceMeters,
    totalDurationSeconds: betweenStopsDurationSeconds,
  };
}

export function resolveVisitPayoutCents(visit: ScooperRouteVisit): number {
  if (typeof visit.payoutCents === 'number') return visit.payoutCents;
  if (typeof visit.projectedPayoutCents === 'number') return visit.projectedPayoutCents;
  return 0;
}

export function formatCurrencyFromCents(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function resolveLateReleaseCutoff(value: string): Date | null {
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const cutoff = new Date(date);
  cutoff.setHours(cutoff.getHours() - 48);
  return cutoff;
}

export function formatShortDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type UseRoutePlanReturn = {
  // State
  routePlan: ScooperRoutePlan | null;
  todayRoutePlan: ScooperRoutePlan | null;
  loading: boolean;
  error: string | null;
  routeErrorCode: string | null;
  profileStatus: string | null;
  backgroundStatus: string | null;
  statusLoading: boolean;

  // Check-in state
  checkInLoading: boolean;
  checkInError: string | null;
  checkInLoggedToday: boolean | null;
  checkInSelfieSkipped: boolean;
  checkInUploadStatus: string | null;
  lastCheckInAt: string | null;
  checkInRewards: ScooperDailyCheckRewards | null;

  // Derived data
  groupedVisits: VisitGroup[];
  todayVisits: ScooperRouteVisit[];
  orderedTodayVisits: ScooperRouteVisit[];
  orderedVisits: ScooperRouteVisit[];
  blockedVisitIds: Set<string>;
  nextVisit: ScooperRouteVisit | null;
  nextVisitIsToday: boolean;
  nextVisitBlocked: boolean;

  // Timeline data for VisitTimeline component
  timelineVisits: TimelineVisit[];
  currentVisitId: string | null;

  // Route stats
  routeStops: number;
  totalMiles: string | null;
  totalMinutes: number | null;
  totalPayoutCents: number;

  // Week stats
  weekLabel: string;
  weekVisits: ScooperRouteVisit[];
  weekCompletedVisits: number;
  weekRemainingVisits: ScooperRouteVisit[];
  weekPayoutCents: number;

  // Profile checks
  isPendingProfile: boolean;
  profileStatusLabel: string | null;
  backgroundStatusLabel: string | null;

  // Check-in computed values
  checkInStatusKnown: boolean;
  checkInComplete: boolean;
  checkInNeedsSelfie: boolean;
  checkInBlocked: boolean;
  checkInUploadFailed: boolean;
  hasTodayVisits: boolean;

  // Actions
  loadRoute: () => Promise<void>;
  loadDailyCheck: () => Promise<void>;
  loadStatus: () => Promise<string | null>;
  setRoutePlan: React.Dispatch<React.SetStateAction<ScooperRoutePlan | null>>;
  setTodayRoutePlan: React.Dispatch<React.SetStateAction<ScooperRoutePlan | null>>;
};

export function useRoutePlan(): UseRoutePlanReturn {
  const { session } = useAuth();

  // Route state
  const [routePlan, setRoutePlan] = useState<ScooperRoutePlan | null>(null);
  const [todayRoutePlan, setTodayRoutePlan] = useState<ScooperRoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeErrorCode, setRouteErrorCode] = useState<string | null>(null);

  // Profile state
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Check-in state
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInLoggedToday, setCheckInLoggedToday] = useState<boolean | null>(null);
  const [checkInSelfieSkipped, setCheckInSelfieSkipped] = useState(false);
  const [checkInUploadStatus, setCheckInUploadStatus] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  const [checkInRewards, setCheckInRewards] = useState<ScooperDailyCheckRewards | null>(null);

  // Load status
  const loadStatus = useCallback(async () => {
    if (!session?.token) return null;
    setStatusLoading(true);
    try {
      const data = await apiRequest<ScooperSummary>(
        '/api/mobile/scooper/summary',
        { token: session.token },
      );
      setProfileStatus(data.profileStatus ?? null);
      setBackgroundStatus(data.backgroundCheckStatus ?? null);
      return data.profileStatus ?? null;
    } catch {
      setProfileStatus(null);
      setBackgroundStatus(null);
      return null;
    } finally {
      setStatusLoading(false);
    }
  }, [session?.token]);

  // Load route
  const loadRoute = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    setRouteErrorCode(null);
    try {
      const todayKey = localDayKey(new Date());
      const data = await apiRequest<ScooperRoutePlan>('/api/field-tech/visits', {
        token: session.token,
      });
      let todayData: ScooperRoutePlan | null = null;
      try {
        todayData = await apiRequest<ScooperRoutePlan>(
          `/api/field-tech/visits?date=${encodeURIComponent(todayKey)}`,
          { token: session.token },
        );
      } catch (todayError) {
        console.warn('[scooper.route] Unable to load today route plan', todayError);
      }
      const normalizedToday = todayData?.visits?.length ? todayData : null;
      setRoutePlan(data);
      setTodayRoutePlan(normalizedToday);
      const todaySource = normalizedToday?.visits ?? data?.visits ?? [];
      const todayVisitsForSnapshot = todaySource.filter(
        (visit) => isSameLocalDay(visit.scheduledDate) && !isVisitComplete(visit.status),
      );
      const todayVisitsCount = todayVisitsForSnapshot.length ?? 0;
      const hasHaulAway = todayVisitsForSnapshot.some((visit) =>
        isHaulAwayMode(getVisitDisposalMode(visit)),
      );
      void setJson(DAILY_ROUTE_SNAPSHOT_KEY, {
        dayKey: todayKey,
        hasVisits: todayVisitsCount > 0,
        visitCount: todayVisitsCount,
        hasHaulAway,
      });
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Unable to load route.';
      let code: string | null = null;
      if (err instanceof ApiError) {
        const details = err.details as { error?: string } | undefined;
        if (typeof details?.error === 'string') {
          code = details.error;
        }
        if (code === 'home_anchor_missing') {
          message = 'Set your home base to unlock routing and drive estimates.';
        }
      }
      setRouteErrorCode(code);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  // Load daily check
  const loadDailyCheck = useCallback(async () => {
    if (!session?.token) return;
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      const data = await apiRequest<ScooperDailyCheckStatus>(
        '/api/field-tech/gear-check',
        { token: session.token },
      );
      const lastLogged = data?.lastGearCheckAt ?? null;
      setLastCheckInAt(lastLogged);
      setCheckInLoggedToday(isTodayValue(lastLogged));
      setCheckInSelfieSkipped(Boolean(data?.check?.selfieSkipped));
      setCheckInUploadStatus(data?.check?.uploadStatus ?? null);
      setCheckInRewards(data?.rewards ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load daily check-in.';
      setCheckInError(message);
      setCheckInLoggedToday(false);
      setCheckInSelfieSkipped(false);
      setCheckInUploadStatus(null);
      setCheckInRewards(null);
    } finally {
      setCheckInLoading(false);
    }
  }, [session?.token]);

  // Auto-load on focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        const status = await loadStatus();
        if (!active) return;
        if (status && status !== 'CERTIFIED') {
          setRoutePlan(null);
          setTodayRoutePlan(null);
          setError(null);
          setRouteErrorCode(null);
          setLoading(false);
          setCheckInLoading(false);
          return;
        }
        loadRoute();
        loadDailyCheck();
      };
      run();
      return () => {
        active = false;
      };
    }, [loadStatus, loadRoute, loadDailyCheck]),
  );

  // Grouped visits
  const groupedVisits = useMemo<VisitGroup[]>(() => {
    if (!routePlan?.visits?.length) {
      return [];
    }
    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const todayKeyVal = dayKey(now);
    const tomorrowKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const groups: Record<string, ScooperRouteVisit[]> = {
      Today: [],
      Tomorrow: [],
      'This week': [],
      Upcoming: [],
    };

    routePlan.visits.forEach((visit) => {
      const scheduled = parseDateInput(visit.scheduledDate);
      const scheduledKey = dayKey(scheduled);
      if (scheduledKey === todayKeyVal) {
        groups.Today.push(visit);
      } else if (scheduledKey === tomorrowKey) {
        groups.Tomorrow.push(visit);
      } else if (scheduled >= weekStart && scheduled < weekEnd) {
        groups['This week'].push(visit);
      } else {
        groups.Upcoming.push(visit);
      }
    });

    return Object.entries(groups)
      .filter(([, visits]) => visits.length > 0)
      .map(([label, visits]) => ({ label, visits }));
  }, [routePlan]);

  // Today visits
  const todayRouteVisits = useMemo(
    () =>
      todayRoutePlan?.visits ??
      routePlan?.visits?.filter((visit) => isSameLocalDay(visit.scheduledDate)) ??
      [],
    [todayRoutePlan, routePlan],
  );

  const todayVisits = useMemo(
    () =>
      (todayRoutePlan?.visits ?? routePlan?.visits ?? []).filter(
        (visit) => isSameLocalDay(visit.scheduledDate) && !isVisitComplete(visit.status),
      ),
    [todayRoutePlan, routePlan],
  );

  const hasTodayVisits = todayVisits.length > 0;

  // Ordered visits
  const orderedVisits = useMemo(() => {
    if (!routePlan?.visits?.length) return [];
    return [...routePlan.visits].sort((a, b) => {
      const seqA = a.routeSequence;
      const seqB = b.routeSequence;
      if (typeof seqA === 'number' && typeof seqB === 'number') {
        return seqA - seqB;
      }
      if (typeof seqA === 'number') return -1;
      if (typeof seqB === 'number') return 1;
      return (
        parseDateInput(a.scheduledDate).getTime() -
        parseDateInput(b.scheduledDate).getTime()
      );
    });
  }, [routePlan]);

  const orderedTodayVisits = useMemo(() => {
    if (!todayRouteVisits.length) return [];
    return [...todayRouteVisits].sort((a, b) => {
      const seqA = a.routeSequence;
      const seqB = b.routeSequence;
      if (typeof seqA === 'number' && typeof seqB === 'number') {
        return seqA - seqB;
      }
      if (typeof seqA === 'number') return -1;
      if (typeof seqB === 'number') return 1;
      return (
        parseDateInput(a.scheduledDate).getTime() -
        parseDateInput(b.scheduledDate).getTime()
      );
    });
  }, [todayRouteVisits]);

  // Blocked visit IDs
  const blockedVisitIds = useMemo(() => {
    const sequencingVisits = orderedTodayVisits.length ? orderedTodayVisits : orderedVisits;
    if (!sequencingVisits.length) return new Set<string>();
    const firstIncompleteIndex = sequencingVisits.findIndex(
      (visit) => !isVisitComplete(visit.status),
    );
    if (firstIncompleteIndex === -1) return new Set<string>();
    return new Set(
      sequencingVisits.slice(firstIncompleteIndex + 1).map((visit) => visit.id),
    );
  }, [orderedTodayVisits, orderedVisits]);

  // Check-in computed values
  const checkInStatusKnown = checkInLoggedToday !== null;
  const checkInUploadFailed = checkInUploadStatus === 'skipped' && !checkInSelfieSkipped;
  const checkInComplete = Boolean(checkInLoggedToday);
  const checkInNeedsSelfie = hasTodayVisits && checkInComplete && checkInSelfieSkipped;
  const checkInBlocked = hasTodayVisits && checkInStatusKnown && !checkInComplete;

  // Next visit
  const nextVisitSource = orderedTodayVisits.some((visit) => !isVisitComplete(visit.status))
    ? orderedTodayVisits
    : orderedVisits;
  const nextVisitId =
    nextVisitSource.find((visit) => !isVisitComplete(visit.status))?.id ?? null;
  const nextVisit = nextVisitId
    ? nextVisitSource.find((visit) => visit.id === nextVisitId) ?? null
    : null;
  const nextVisitIsToday = nextVisit ? isSameLocalDay(nextVisit.scheduledDate) : false;
  const nextVisitBlocked = !nextVisitIsToday || checkInBlocked;

  // Timeline visits for VisitTimeline component
  const timelineVisits = useMemo<TimelineVisit[]>(() => {
    return orderedTodayVisits.map((visit, index) => {
      const isComplete = isVisitComplete(visit.status);
      const isCurrent = visit.id === nextVisitId && nextVisitIsToday;
      const isBlocked = blockedVisitIds.has(visit.id) || checkInBlocked;

      let status: VisitStatus;
      if (isComplete) {
        status = 'completed';
      } else if (isCurrent) {
        status = 'current';
      } else if (isBlocked) {
        status = 'locked';
      } else {
        status = 'upcoming';
      }

      const travelMinutes = visit.travelFromPrevious?.durationSeconds
        ? Math.round(visit.travelFromPrevious.durationSeconds / 60)
        : undefined;

      return {
        id: visit.id,
        status,
        customerName: visit.customer?.name ?? undefined,
        sequence: visit.routeSequence ?? index + 1,
        estimatedMinutes: travelMinutes,
      };
    });
  }, [orderedTodayVisits, nextVisitId, nextVisitIsToday, blockedVisitIds, checkInBlocked]);

  const currentVisitId = nextVisitIsToday ? nextVisitId : null;

  // Route stats
  const routeSummary =
    todayRoutePlan?.summary ?? deriveRouteSummaryFromVisits(todayRouteVisits);
  const routeStops = todayRouteVisits.length;
  const summaryDistance = routeSummary?.totalDistanceMeters ?? 0;
  const summaryDuration = routeSummary?.totalDurationSeconds ?? 0;
  const summaryAvailable = summaryDistance > 0 && summaryDuration > 0;
  const totalMiles = summaryAvailable ? (summaryDistance / 1609.34).toFixed(1) : null;
  const totalMinutes = summaryAvailable
    ? Math.max(0, Math.round(summaryDuration / 60))
    : null;

  const totalPayoutCents = todayRouteVisits.reduce(
    (sum, visit) => sum + resolveVisitPayoutCents(visit),
    0,
  );

  // Week stats
  const weekStart = startOfWeekMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekLabel = useMemo(() => {
    const startLabel = weekStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endLabel = new Date(weekEnd.getTime() - 86400000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${startLabel}-${endLabel}`;
  }, [weekStart, weekEnd]);

  const weekVisits = useMemo(() => {
    if (!routePlan?.visits?.length) return [];
    return routePlan.visits.filter((visit) => {
      const scheduled = parseDateInput(visit.scheduledDate);
      return scheduled >= weekStart && scheduled < weekEnd;
    });
  }, [routePlan, weekStart, weekEnd]);

  const weekRemainingVisits = weekVisits.filter(
    (visit) => !isVisitComplete(visit.status),
  );
  const weekCompletedVisits = weekVisits.length - weekRemainingVisits.length;
  const weekPayoutCents = weekRemainingVisits.reduce(
    (sum, visit) => sum + resolveVisitPayoutCents(visit),
    0,
  );

  // Profile checks
  const isPendingProfile =
    typeof profileStatus === 'string' && profileStatus !== 'CERTIFIED';
  const profileStatusLabel = profileStatus
    ? profileStatus.toLowerCase().replace(/_/g, ' ')
    : null;
  const backgroundStatusLabel = backgroundStatus
    ? backgroundStatus.toLowerCase().replace(/_/g, ' ')
    : null;

  return {
    // State
    routePlan,
    todayRoutePlan,
    loading,
    error,
    routeErrorCode,
    profileStatus,
    backgroundStatus,
    statusLoading,

    // Check-in state
    checkInLoading,
    checkInError,
    checkInLoggedToday,
    checkInSelfieSkipped,
    checkInUploadStatus,
    lastCheckInAt,
    checkInRewards,

    // Derived data
    groupedVisits,
    todayVisits,
    orderedTodayVisits,
    orderedVisits,
    blockedVisitIds,
    nextVisit,
    nextVisitIsToday,
    nextVisitBlocked,

    // Timeline data
    timelineVisits,
    currentVisitId,

    // Route stats
    routeStops,
    totalMiles,
    totalMinutes,
    totalPayoutCents,

    // Week stats
    weekLabel,
    weekVisits,
    weekCompletedVisits,
    weekRemainingVisits,
    weekPayoutCents,

    // Profile checks
    isPendingProfile,
    profileStatusLabel,
    backgroundStatusLabel,

    // Check-in computed values
    checkInStatusKnown,
    checkInComplete,
    checkInNeedsSelfie,
    checkInBlocked,
    checkInUploadFailed,
    hasTodayVisits,

    // Actions
    loadRoute,
    loadDailyCheck,
    loadStatus,
    setRoutePlan,
    setTodayRoutePlan,
  };
}
