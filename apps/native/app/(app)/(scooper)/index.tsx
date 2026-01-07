import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import ScooperCalendarModal from '@/components/scooper/ScooperCalendarModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
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

type VisitGroup = {
  label: string;
  visits: ScooperRouteVisit[];
};

const COMPLETED_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'SKIPPED']);
const DAILY_ROUTE_SNAPSHOT_KEY = 'insightscoop_scooper_daily_route';
const RELEASE_REASON_OPTIONS = [
  { key: 'schedule', label: 'Schedule conflict' },
  { key: 'vehicle', label: 'Vehicle issue' },
  { key: 'weather', label: 'Weather/safety' },
  { key: 'access', label: 'Access issue' },
  { key: 'illness', label: 'Illness/emergency' },
  { key: 'other', label: 'Other' },
] as const;

type ReleaseReasonKey = (typeof RELEASE_REASON_OPTIONS)[number]['key'];

function isVisitComplete(status?: string | null) {
  if (!status) return false;
  return COMPLETED_STATUSES.has(status);
}

function formatDayLabel(value: string) {
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatVisitWindow(
  visit: Pick<ScooperRouteVisit, 'preferredTimeWindowLabel' | 'preferredTimeWindowSlug'>,
): string | null {
  const labelFromSlug = () => {
    const slug = visit.preferredTimeWindowSlug?.toLowerCase() ?? '';
    if (slug.includes('morning')) return 'Morning';
    if (slug.includes('afternoon')) return 'Afternoon';
    if (slug.includes('evening')) return 'Evening';
    if (slug.includes('flex')) return 'Flexible';
    return null;
  };

  const label = visit.preferredTimeWindowLabel ?? labelFromSlug();
  if (!label) return null;

  return compactWindowLabel(label);
}

function compactWindowLabel(label: string): string {
  const match = label.match(
    /(\d{1,2})(?::\d{2})?\s*(AM|PM)\s*-\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)/i,
  );
  if (!match) return label;

  const [, startHour, startMeridiem, endHour, endMeridiem] = match;
  const startSuffix = startMeridiem.toLowerCase().startsWith('a') ? 'a' : 'p';
  const endSuffix = endMeridiem.toLowerCase().startsWith('a') ? 'a' : 'p';
  const range =
    startSuffix === endSuffix
      ? `${startHour}-${endHour}${endSuffix}`
      : `${startHour}${startSuffix}-${endHour}${endSuffix}`;

  return label.replace(match[0], range);
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

function dayKey(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(value?: string | null, compareDate: Date = new Date()): boolean {
  if (!value) return false;
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(compareDate);
}

function parseCheckDate(value: string) {
  return parseDateInput(value);
}

function formatShortDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatCompactDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function resolveVisitGroupRangeLabel(visits: ScooperRouteVisit[]): string | null {
  const dates = visits
    .map((visit) => parseDateInput(visit.scheduledDate))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  const min = new Date(Math.min(...dates.map((date) => date.getTime())));
  const max = new Date(Math.max(...dates.map((date) => date.getTime())));
  const startLabel = formatCompactDateLabel(min);
  const endLabel = formatCompactDateLabel(max);
  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

function resolveLateReleaseCutoff(value: string): Date | null {
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const cutoff = new Date(date);
  cutoff.setHours(cutoff.getHours() - 48);
  return cutoff;
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

function formatFrequencyLabel(frequency?: string | null): string {
  if (!frequency) return 'recurring';
  return frequency.toLowerCase().replace(/_/g, ' ');
}

function formatDogSummary(
  dogs?: Array<{ name: string; breed?: string | null }>,
): string | null {
  if (!dogs?.length) return null;
  const label = dogs.length === 1 ? 'Dog' : 'Dogs';
  const names = dogs
    .map((dog) => {
      if (!dog.name) return null;
      return dog.breed ? `${dog.name} (${dog.breed})` : dog.name;
    })
    .filter((value): value is string => Boolean(value));
  if (!names.length) return `${label}: ${dogs.length}`;
  const preview = names.slice(0, 2).join(', ');
  const remaining = names.length - 2;
  const suffix = remaining > 0 ? ` +${remaining} more` : '';
  return `${label}: ${dogs.length} • ${preview}${suffix}`;
}

function formatCurrencyFromCents(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function resolveVisitPayoutCents(visit: ScooperRouteVisit): number {
  if (typeof visit.payoutCents === 'number') return visit.payoutCents;
  if (typeof visit.projectedPayoutCents === 'number') return visit.projectedPayoutCents;
  return 0;
}

function deriveRouteSummaryFromVisits(
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

export default function ScooperHome() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mintTone = Colors.brand.mint;
  const rewardTone = mintTone;
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const heroCardBackground =
    colorScheme === 'dark' ? Colors.brand.graphiteSoft : Colors.brand.slate100;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const checkboxBorder = colorScheme === 'dark'
    ? 'rgba(248, 250, 252, 0.7)'
    : 'rgba(15, 23, 42, 0.4)';
  const checkboxBackground = colorScheme === 'dark'
    ? 'rgba(248, 250, 252, 0.12)'
    : 'rgba(15, 23, 42, 0.06)';
  const [routePlan, setRoutePlan] = useState<ScooperRoutePlan | null>(null);
  const [todayRoutePlan, setTodayRoutePlan] = useState<ScooperRoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [routeErrorCode, setRouteErrorCode] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInLoggedToday, setCheckInLoggedToday] = useState<boolean | null>(null);
  const [checkInSelfieSkipped, setCheckInSelfieSkipped] = useState(false);
  const [checkInUploadStatus, setCheckInUploadStatus] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  const [checkInRewards, setCheckInRewards] = useState<ScooperDailyCheckRewards | null>(null);
  const [routeLegsExpanded, setRouteLegsExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Upcoming: true,
    'This week': true,
  });
  const [releaseVisit, setReleaseVisit] = useState<ScooperRouteVisit | null>(null);
  const [releaseScope, setReleaseScope] = useState<'visit' | 'job'>('visit');
  const [releaseReasonOption, setReleaseReasonOption] = useState<ReleaseReasonKey | null>(
    null,
  );
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseChecks, setReleaseChecks] = useState({
    availability: false,
    scope: false,
    policy: false,
  });
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
      const todayVisits = todaySource.filter(
        (visit) => isSameLocalDay(visit.scheduledDate) && !isVisitComplete(visit.status),
      );
      const todayVisitsCount = todayVisits.length ?? 0;
      const hasHaulAway = todayVisits.some((visit) =>
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

  const groupedVisits = useMemo<VisitGroup[]>(() => {
    if (!routePlan?.visits?.length) {
      return [];
    }
    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const todayKey = dayKey(now);
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
      if (scheduledKey === todayKey) {
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

  const isSectionCollapsed = useCallback(
    (label: string) => collapsedSections[label] ?? (label === 'Upcoming' || label === 'This week'),
    [collapsedSections],
  );

  const toggleSection = useCallback((label: string) => {
    setCollapsedSections((prev) => {
      const current = prev[label] ?? (label === 'Upcoming' || label === 'This week');
      return { ...prev, [label]: !current };
    });
  }, []);

  const todayVisits = useMemo(
    () =>
      (todayRoutePlan?.visits ?? routePlan?.visits ?? []).filter(
        (visit) => isSameLocalDay(visit.scheduledDate) && !isVisitComplete(visit.status),
      ),
    [todayRoutePlan, routePlan],
  );
  const hasTodayVisits = todayVisits.length > 0;
  const checkInUploadSkipped = checkInUploadStatus === 'skipped';
  const checkInComplete =
    Boolean(checkInLoggedToday) &&
    !(hasTodayVisits && (checkInSelfieSkipped || checkInUploadSkipped));
  const checkInBlocked = hasTodayVisits && checkInComplete === false;

  const todayRouteVisits = useMemo(
    () =>
      todayRoutePlan?.visits ??
      routePlan?.visits?.filter((visit) => isSameLocalDay(visit.scheduledDate)) ??
      [],
    [todayRoutePlan, routePlan],
  );

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

  const routeSummary =
    todayRoutePlan?.summary ?? deriveRouteSummaryFromVisits(todayRouteVisits);
  const routeStops = todayRouteVisits.length;
  const stopsWithGeo = useMemo(
    () => todayRouteVisits.filter((visit) => visit.geo).length,
    [todayRouteVisits],
  );
  const summaryDistance = routeSummary?.totalDistanceMeters ?? 0;
  const summaryDuration = routeSummary?.totalDurationSeconds ?? 0;
  const summaryAvailable = summaryDistance > 0 && summaryDuration > 0;
  const totalMiles = summaryAvailable ? (summaryDistance / 1609.34).toFixed(1) : null;
  const totalMinutes = summaryAvailable
    ? Math.max(0, Math.round(summaryDuration / 60))
    : null;
  const betweenStopsMiles =
    routeSummary?.betweenStopsDistanceMeters !== undefined && summaryAvailable
      ? (routeSummary.betweenStopsDistanceMeters / 1609.34).toFixed(1)
      : null;
  const betweenStopsMinutes =
    routeSummary?.betweenStopsDurationSeconds !== undefined && summaryAvailable
      ? Math.max(0, Math.round(routeSummary.betweenStopsDurationSeconds / 60))
      : null;
  const startLegMiles =
    routeSummary?.startToFirstDistanceMeters !== undefined && summaryAvailable
      ? (routeSummary.startToFirstDistanceMeters / 1609.34).toFixed(1)
      : null;
  const startLegMinutes =
    routeSummary?.startToFirstDurationSeconds !== undefined && summaryAvailable
      ? Math.max(0, Math.round(routeSummary.startToFirstDurationSeconds / 60))
      : null;
  const endLegMiles =
    routeSummary?.endToHomeDistanceMeters !== undefined && summaryAvailable
      ? (routeSummary.endToHomeDistanceMeters / 1609.34).toFixed(1)
      : null;
  const endLegMinutes =
    routeSummary?.endToHomeDurationSeconds !== undefined && summaryAvailable
      ? Math.max(0, Math.round(routeSummary.endToHomeDurationSeconds / 60))
      : null;
  const showAnchorLegs =
    summaryAvailable &&
    Boolean(todayRoutePlan?.summary) &&
    routeStops > 0 &&
    stopsWithGeo > 0;
  const geoCoverageLabel =
    routeStops > 0 ? `${stopsWithGeo}/${routeStops} stops mapped` : null;
  const driveSummaryLabel =
    summaryAvailable && totalMiles && totalMinutes !== null
      ? `${totalMiles} mi • ${totalMinutes} min`
      : null;
  const todayDriveLabel =
    routeStops > 0 ? driveSummaryLabel ?? 'Drive pending' : null;
  const routeDetailLabel =
    routeStops > 0
      ? stopsWithGeo === 0
        ? 'Drive time unavailable until at least one stop has a valid address.'
        : routeStops > stopsWithGeo
          ? 'Drive time uses mapped stops only.'
          : null
      : null;
  const routeLegs = showAnchorLegs
    ? [
        {
          label: 'Start',
          value: `${startLegMiles ?? '—'} mi • ${startLegMinutes ?? '—'} min`,
        },
        {
          label: 'Between',
          value: `${betweenStopsMiles ?? '—'} mi • ${betweenStopsMinutes ?? '—'} min`,
        },
        {
          label: 'Return',
          value: `${endLegMiles ?? '—'} mi • ${endLegMinutes ?? '—'} min`,
        },
      ]
    : summaryAvailable && betweenStopsMiles !== null && betweenStopsMinutes !== null
      ? [
          {
            label: 'Between',
            value: `${betweenStopsMiles} mi • ${betweenStopsMinutes} min`,
          },
        ]
      : [];
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
  const isPendingProfile =
    typeof profileStatus === 'string' && profileStatus !== 'CERTIFIED';
  const profileStatusLabel = profileStatus
    ? profileStatus.toLowerCase().replace(/_/g, ' ')
    : null;
  const backgroundStatusLabel = backgroundStatus
    ? backgroundStatus.toLowerCase().replace(/_/g, ' ')
    : null;

  const headerSubtitle = routeStops
    ? `${routeStops} stop${routeStops === 1 ? '' : 's'} today${totalMiles ? ` • ${totalMiles} mi` : ''}${totalMinutes ? ` • ${totalMinutes} min` : ''}`
    : 'No stops scheduled today.';

  const totalPayoutCents = todayRouteVisits.reduce(
    (sum, visit) => sum + resolveVisitPayoutCents(visit),
    0,
  );
  const todayPayoutLabel =
    totalPayoutCents > 0 ? formatCurrencyFromCents(totalPayoutCents) : '—';

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
  const weekPayoutLabel =
    weekPayoutCents > 0 ? formatCurrencyFromCents(weekPayoutCents) : '—';

  const checkInSummary = checkInRewards
    ? checkInLoggedToday
      ? `${checkInRewards.streakCount} day streak • ${checkInRewards.pointsBalance} check-in points`
      : `${checkInRewards.streakIfSubmit} day streak if you check in • Earn ${checkInRewards.pointsPreview.totalPoints} points`
    : null;
  const checkInStatusLabel = checkInComplete
    ? 'Checked in'
    : checkInLoggedToday && hasTodayVisits
      ? checkInSelfieSkipped || checkInUploadSkipped
        ? 'Check-in incomplete'
        : 'Check-in required'
      : hasTodayVisits
        ? 'Check-in required'
        : 'Optional today';
  const checkInStatusTone = checkInComplete
    ? palette.tint
    : hasTodayVisits
      ? palette.danger
      : palette.border;
  const checkInRequired = hasTodayVisits && checkInComplete === false;
  const showCheckInCard = checkInLoading || checkInError || checkInRequired;
  const showCheckInBubble = true;
  const checkInBubbleLabel = checkInComplete
    ? 'Checked in'
    : checkInRequired
      ? 'Check-in required'
      : 'Check-in optional';
  const checkInBubbleMeta = checkInComplete
    ? checkInRewards?.lastPointsAwarded
      ? `+${checkInRewards.lastPointsAwarded} pts`
      : null
    : checkInRewards?.pointsPreview?.totalPoints
      ? `Earn ${checkInRewards.pointsPreview.totalPoints} pts`
      : null;
  const checkInBubbleTone = checkInComplete
    ? rewardTone
    : checkInRequired
      ? palette.danger
      : palette.muted;

  const openCalendar = () => {
    setCalendarOpen(true);
  };

  const closeCalendar = () => setCalendarOpen(false);

  const openNavigation = async (url?: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // No-op: navigation is optional.
    }
  };

  const handleOpenNextStop = () => {
    if (!nextVisit) return;
    if (checkInBlocked) {
      Alert.alert(
        'Daily check-in required',
        'Complete your daily check-in to unlock today’s stops.',
        [
          {
            text: 'Go to check-in',
            onPress: () => router.push('/(app)/(scooper)/daily-check'),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    if (!nextVisitIsToday) {
      Alert.alert(
        'Visit locked',
        `You can open this visit on ${formatDayLabel(nextVisit.scheduledDate)}.`,
      );
      return;
    }
    router.push(`/(app)/(scooper)/visits/${nextVisit.id}`);
  };

  const releaseFrequencyLabel = releaseVisit?.job?.frequency
    ? formatFrequencyLabel(releaseVisit.job.frequency)
    : null;
  const releaseJobOwnerId = releaseVisit?.job?.primaryScooperId ?? null;
  const isReleaseJobOwner = Boolean(
    releaseJobOwnerId && session?.user?.id && releaseJobOwnerId === session.user.id,
  );
  const isReleaseJobOwnedByAnother = Boolean(
    releaseJobOwnerId && session?.user?.id && releaseJobOwnerId !== session.user.id,
  );
  const canReleaseJob = Boolean(
    releaseVisit?.job?.id &&
      releaseVisit.job.frequency &&
      releaseVisit.job.frequency !== 'ONE_TIME' &&
      isReleaseJobOwner,
  );
  const releaseCommitment = isReleaseJobOwnedByAnother
    ? 'This route stays with its current owner.'
    : releaseVisit?.job?.id
      ? 'Your recurring route remains assigned unless you release the job.'
      : 'No recurring schedule is affected.';
  const releaseSummary =
    releaseScope === 'job'
      ? {
          title: 'Release recurring job',
          description: `Removes all upcoming ${releaseFrequencyLabel ?? 'recurring'} visits from your route.`,
          commitment: 'Future visits return to the offer board for reassignment.',
        }
      : {
          title: 'Release this visit',
          description: 'Returns this single visit to the offer board.',
          commitment: releaseCommitment,
        };
  const releaseScopeLabel = releaseScope === 'job' ? 'recurring job' : 'visit';
  const releaseIsSameDay = releaseVisit ? isSameLocalDay(releaseVisit.scheduledDate) : false;
  const selectedReasonLabel =
    RELEASE_REASON_OPTIONS.find((option) => option.key === releaseReasonOption)?.label ??
    null;
  const isOtherReason = releaseReasonOption === 'other';
  const reasonReady =
    Boolean(releaseReasonOption) && (!isOtherReason || Boolean(releaseReason.trim()));
  const canConfirmRelease =
    releaseChecks.availability &&
    releaseChecks.scope &&
    releaseChecks.policy &&
    reasonReady &&
    !releaseIsSameDay;

  const openReleaseDialog = (visit: ScooperRouteVisit) => {
    if (visit.status !== 'SCHEDULED') return;
    setReleaseVisit(visit);
    setReleaseScope('visit');
    setReleaseReasonOption(null);
    setReleaseReason('');
    setReleaseChecks({
      availability: false,
      scope: false,
      policy: false,
    });
    setReleaseError(null);
  };

  const closeReleaseDialog = () => {
    setReleaseVisit(null);
    setReleaseScope('visit');
    setReleaseReasonOption(null);
    setReleaseReason('');
    setReleaseChecks({
      availability: false,
      scope: false,
      policy: false,
    });
    setReleaseError(null);
  };

  const handleReleaseScopeChange = (value: 'visit' | 'job') => {
    if (value === 'job' && !canReleaseJob) return;
    setReleaseScope(value);
    setReleaseChecks((prev) => ({ ...prev, scope: false }));
  };

  const submitRelease = async () => {
    if (!session?.token || !releaseVisit) return;
    if (releaseIsSameDay) {
      setReleaseError('Same-day releases are not available. Contact dispatch for help.');
      return;
    }
    if (releaseScope === 'job' && !releaseVisit.job?.id) {
      setReleaseError('This visit is not tied to a recurring job.');
      return;
    }
    const resolvedReason =
      releaseReasonOption === 'other' ? releaseReason.trim() : selectedReasonLabel;
    if (!resolvedReason) {
      setReleaseError('Select a release reason to continue.');
      return;
    }

    setReleaseSubmitting(true);
    setReleaseError(null);
    try {
      const endpoint =
        releaseScope === 'job'
          ? `/api/field-tech/jobs/${releaseVisit.job?.id}/handoff`
          : `/api/field-tech/visits/${releaseVisit.id}/handoff`;
      await apiRequest(endpoint, {
        method: 'POST',
        token: session.token,
        body: {
          reason: resolvedReason || undefined,
        },
      });
      const releasedJobId = releaseScope === 'job' ? releaseVisit.job?.id ?? null : null;
      const shouldRemove = (visit: ScooperRouteVisit) =>
        releasedJobId ? visit.job?.id === releasedJobId : visit.id === releaseVisit.id;
      setRoutePlan((prev) =>
        prev ? { ...prev, visits: prev.visits.filter((visit) => !shouldRemove(visit)) } : prev,
      );
      setTodayRoutePlan((prev) =>
        prev ? { ...prev, visits: prev.visits.filter((visit) => !shouldRemove(visit)) } : prev,
      );
      closeReleaseDialog();
      loadRoute();
    } catch (err) {
      const message =
        err instanceof ApiError && err.details && typeof err.details === 'object'
          ? typeof (err.details as { message?: string }).message === 'string'
            ? (err.details as { message?: string }).message
            : err.message
          : err instanceof Error
            ? err.message
            : undefined;
      setReleaseError(message ?? 'Unable to release this work.');
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const now = new Date();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderRow}>
            <View style={styles.pageHeaderText}>
              <Text style={[styles.kicker, { color: palette.muted }]}>
                Today's route
              </Text>
              <Text style={[styles.title, { color: palette.text }]}>
                Hey {session?.user?.name ?? 'Scooper'}
              </Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                {headerSubtitle}
              </Text>
            </View>
            <View style={styles.pageHeaderActions}>
              {showCheckInBubble ? (
                <Pressable
                  onPress={() => router.push('/(app)/(scooper)/daily-check')}
                  style={({ pressed }) => [
                    styles.checkInBubble,
                    { borderColor: cardBorder, backgroundColor: palette.card },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.checkInBubbleLabel, { color: checkInBubbleTone }]}>
                    {checkInBubbleLabel}
                  </Text>
                  {checkInBubbleMeta ? (
                    <Text style={[styles.checkInBubbleMeta, { color: checkInBubbleTone }]}>
                      {checkInBubbleMeta}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
              <Pressable
                onPress={openCalendar}
                style={({ pressed }) => [
                  styles.calendarButton,
                  { borderColor: cardBorder, backgroundColor: palette.card },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <FontAwesome name="calendar" size={14} color={palette.text} />
                <Text style={[styles.calendarButtonText, { color: palette.text }]}>
                  Calendar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(app)/(scooper)/ongoing-customers' as any)}
                style={({ pressed }) => [
                  styles.calendarButton,
                  { borderColor: cardBorder, backgroundColor: palette.card },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <FontAwesome name="users" size={14} color={palette.text} />
                <Text style={[styles.calendarButtonText, { color: palette.text }]}>
                  Ongoing
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isPendingProfile ? (
          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Profile under review</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Your application is {profileStatusLabel}. We will notify you as soon as certification is complete.
            </Text>
            {backgroundStatusLabel ? (
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                Background check: {backgroundStatusLabel}
              </Text>
            ) : null}
            {statusLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Checking status...
                </Text>
              </View>
            ) : null}
            <View style={styles.pendingActions}>
              <Button
                title="Update availability"
                onPress={() => router.push('/(app)/(scooper)/availability')}
                variant="secondary"
                style={styles.pendingButton}
              />
            </View>
          </View>
        ) : null}

        {nextVisit ? (
          <View
            style={[
              styles.heroCard,
              cardShadowStyle,
              { backgroundColor: heroCardBackground, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.heroKicker, { color: palette.muted }]}>Next stop</Text>
            <Text style={[styles.heroTitle, { color: palette.text }]}>
              {nextVisit.customer?.name ?? 'Customer'}
            </Text>
            <Text style={[styles.heroMeta, { color: palette.muted }]}>
              {formatDayLabel(nextVisit.scheduledDate)} • {nextVisit.customer?.addressLine1 ?? 'Address on file'}
              {nextVisit.customer?.city ? `, ${nextVisit.customer.city}` : ''}
            </Text>
            {formatDogSummary(nextVisit.customer?.dogs) ? (
              <Text style={[styles.heroMeta, { color: palette.muted }]}>
                {formatDogSummary(nextVisit.customer?.dogs)}
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              <Button
                title="Open next stop"
                onPress={handleOpenNextStop}
                variant="primary"
                style={styles.primaryCta}
                disabled={nextVisitBlocked}
              />
              {nextVisit.navigationUrl ? (
                <Button
                  title="Navigate"
                  onPress={() => openNavigation(nextVisit.navigationUrl)}
                  variant="secondary"
                  style={styles.secondaryCta}
                  disabled={nextVisitBlocked}
                />
              ) : null}
            </View>
            {checkInBlocked ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Complete today&apos;s check-in to open your stops.
              </Text>
            ) : !nextVisitIsToday ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                You can open this visit on {formatDayLabel(nextVisit.scheduledDate)}.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View
            style={[
              styles.summaryCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={styles.summaryHeaderRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Today</Text>
              {todayDriveLabel ? (
                <View
                  style={[
                    styles.summaryChip,
                    { borderColor: palette.border, backgroundColor: palette.background },
                  ]}
                >
                  <Text style={[styles.summaryChipText, { color: palette.muted }]}>
                    {todayDriveLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.summaryValue, { color: palette.text }]}>
              {routeStops > 0 ? `${routeStops} stop${routeStops === 1 ? '' : 's'}` : 'No stops'}
            </Text>
            <Text style={[styles.summaryMeta, { color: palette.muted }]}>
              {routeStops > 0 ? `Est payout ${todayPayoutLabel}` : 'Check offers for new work.'}
            </Text>
            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Syncing route...
                </Text>
              </View>
            ) : error ? (
              <Text style={[styles.summaryHelper, { color: palette.danger }]}>
                {routeErrorCode === 'home_anchor_missing'
                  ? 'Set your home base to unlock drive estimates.'
                  : 'Route details unavailable.'}
              </Text>
            ) : routeStops > 0 ? (
              <>
                {geoCoverageLabel ? (
                  <View
                    style={[
                      styles.infoPill,
                      { borderColor: palette.border, backgroundColor: palette.background },
                    ]}
                  >
                    <Text style={[styles.infoPillText, { color: palette.muted }]}>
                      {geoCoverageLabel}
                    </Text>
                  </View>
                ) : null}
                {routeLegs.length > 0 ? (
                  <>
                    <Pressable
                      onPress={() => setRouteLegsExpanded((prev) => !prev)}
                      style={[
                        styles.routeToggle,
                        { borderColor: palette.border, backgroundColor: palette.background },
                      ]}
                    >
                      <Text style={[styles.routeToggleLabel, { color: palette.text }]}>
                        Route legs
                      </Text>
                      <View style={styles.routeToggleMeta}>
                        <Text style={[styles.routeToggleMetaText, { color: palette.muted }]}>
                          {routeLegsExpanded ? 'Hide' : 'Show'}
                        </Text>
                        <FontAwesome
                          name={routeLegsExpanded ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={palette.muted}
                        />
                      </View>
                    </Pressable>
                    {routeLegsExpanded ? (
                      <View style={styles.routeChipRow}>
                        {routeLegs.map((leg) => (
                          <View
                            key={leg.label}
                            style={[
                              styles.routeChip,
                              { borderColor: palette.border, backgroundColor: palette.background },
                            ]}
                          >
                            <Text style={[styles.routeChipLabel, { color: palette.muted }]}>
                              {leg.label}
                            </Text>
                            <Text style={[styles.routeChipValue, { color: palette.text }]}>
                              {leg.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}
                {routeDetailLabel ? (
                  <Text style={[styles.summaryHelper, { color: palette.muted }]}>
                    {routeDetailLabel}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
          <View
            style={[
              styles.summaryCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={styles.summaryHeaderRow}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>This week</Text>
              <View
                style={[
                  styles.summaryChip,
                  { borderColor: palette.border, backgroundColor: palette.background },
                ]}
              >
                <Text style={[styles.summaryChipText, { color: palette.muted }]}>
                  {weekLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.summaryValue, { color: palette.text }]}>
              {weekRemainingVisits.length} remaining
            </Text>
            <Text style={[styles.summaryMeta, { color: palette.muted }]}>
              {weekCompletedVisits} completed
            </Text>
            <Text style={[styles.summaryMeta, { color: palette.muted }]}>
              Est payout {weekPayoutLabel}
            </Text>
          </View>
        </View>

        {showCheckInCard ? (
          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.checkInHeaderLeft}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  Daily check-in
                </Text>
                <View style={[styles.statusPill, { backgroundColor: checkInStatusTone }]}>
                  <Text style={styles.statusPillText}>{checkInStatusLabel}</Text>
                </View>
              </View>
            </View>
            {checkInLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Checking status...
                </Text>
              </View>
            ) : checkInError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{checkInError}</Text>
            ) : (
              <>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Complete your daily check-in before starting visits.
                </Text>
                {checkInSummary ? (
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    {checkInSummary}
                  </Text>
                ) : null}
                {checkInRewards ? (
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    Redeem points for Amazon gift cards.
                  </Text>
                ) : null}
                <View style={styles.actionRow}>
                  <Button
                    title="Start check-in"
                    onPress={() => router.push('/(app)/(scooper)/daily-check')}
                    variant="primary"
                    style={styles.primaryCta}
                  />
                  {checkInRewards ? (
                    <Button
                      title="View rewards"
                      onPress={() => router.push('/(app)/(scooper)/rewards')}
                      variant="ghost"
                      style={styles.secondaryCta}
                    />
                  ) : null}
                </View>
              </>
            )}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Loading visits...
            </Text>
          </View>
        ) : error ? (
          routeErrorCode === 'home_anchor_missing' ? (
            <View style={[styles.noticeCard, { borderColor: palette.border }]}>
              <Text style={[styles.noticeTitle, { color: palette.text }]}>
                Set your home base
              </Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Add your home address so we can show drive times and routes.
              </Text>
              <Button
                title="Go to account"
                onPress={() => router.push('/(app)/(scooper)/account')}
                variant="primary"
              />
            </View>
          ) : (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
          )
        ) : groupedVisits.length === 0 ? (
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            No upcoming jobs yet.
          </Text>
        ) : (
          groupedVisits.map((group) => {
            const countLabel = `${group.visits.length} stop${group.visits.length === 1 ? '' : 's'}`;
            const groupPayoutCents = group.visits.reduce(
              (sum, visit) => sum + resolveVisitPayoutCents(visit),
              0,
            );
            const groupPayoutLabel =
              groupPayoutCents > 0 ? formatCurrencyFromCents(groupPayoutCents) : '—';
            const groupRangeLabel = resolveVisitGroupRangeLabel(group.visits);
            const showRangeChip = group.label === 'This week' || group.label === 'Upcoming';
            const collapsed = isSectionCollapsed(group.label);
            return (
              <View key={group.label} style={styles.section}>
                <View
                  style={[
                    styles.sectionShell,
                    { backgroundColor: palette.background, borderColor: cardBorder },
                  ]}
                >
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(group.label)}
                  >
                    <View style={styles.sectionHeaderMain}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: palette.text }]}>
                          {group.label}
                        </Text>
                        {!showRangeChip && groupRangeLabel ? (
                          <Text style={[styles.sectionRangeText, { color: palette.muted }]}>
                            {groupRangeLabel}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.sectionMetaRow}>
                        <View
                          style={[
                            styles.sectionBadge,
                            { borderColor: palette.border, backgroundColor: palette.card },
                          ]}
                        >
                          <Text style={[styles.sectionBadgeText, { color: palette.muted }]}>
                            {countLabel}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.sectionBadge,
                            { borderColor: palette.border, backgroundColor: palette.card },
                          ]}
                        >
                          <Text style={[styles.sectionBadgeText, { color: mintTone }]}>
                            Est {groupPayoutLabel}
                          </Text>
                        </View>
                        {showRangeChip && groupRangeLabel ? (
                          <View
                            style={[
                              styles.sectionBadge,
                              { borderColor: palette.border, backgroundColor: palette.card },
                            ]}
                          >
                            <Text style={[styles.sectionBadgeText, { color: palette.muted }]}>
                              {groupRangeLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <FontAwesome
                      name={collapsed ? 'chevron-down' : 'chevron-up'}
                      size={14}
                      color={palette.muted}
                    />
                  </Pressable>
                  {!collapsed ? (
                    <>
                      <View style={[styles.sectionDivider, { backgroundColor: palette.border }]} />
                      <View style={styles.sectionBody}>
                        {group.visits.map((visit) => {
                          const customerName = visit.customer?.name ?? 'Customer';
                          const address = visit.customer?.addressLine1 ?? 'Address on file';
                          const city = visit.customer?.city ? `, ${visit.customer.city}` : '';
                          const windowLabel = formatVisitWindow(visit);
                          const scheduleLine = windowLabel
                            ? `${formatDayLabel(visit.scheduledDate)} • ${windowLabel}`
                            : formatDayLabel(visit.scheduledDate);
                          const sequenceBlocked = blockedVisitIds.has(visit.id);
                          const isScheduledToday = isSameLocalDay(visit.scheduledDate);
                          const dateBlocked = !isScheduledToday;
                          const openBlocked = checkInBlocked || sequenceBlocked || dateBlocked;
                          const isNext = visit.id === nextVisitId;
                          const completed = isVisitComplete(visit.status);
                          const payoutCents = resolveVisitPayoutCents(visit);
                          const payoutLabel =
                            payoutCents > 0 ? formatCurrencyFromCents(payoutCents) : null;
                          const canReleaseVisit = visit.status === 'SCHEDULED';
                          const lateReleaseCutoff = canReleaseVisit
                            ? resolveLateReleaseCutoff(visit.scheduledDate)
                            : null;
                          const lateReleaseLabel = lateReleaseCutoff
                            ? formatShortDateLabel(lateReleaseCutoff)
                            : null;
                          const isLateRelease = Boolean(
                            lateReleaseCutoff && now >= lateReleaseCutoff,
                          );
                          const lateReleaseText = lateReleaseLabel
                            ? isLateRelease
                              ? `Late release window started ${lateReleaseLabel}`
                              : `Late release after ${lateReleaseLabel}`
                            : null;
                          const lateReleaseTone = isLateRelease ? palette.danger : palette.muted;
                          const statusLabel = completed
                            ? 'Completed'
                            : dateBlocked
                              ? 'Scheduled'
                              : isNext
                                ? 'Next'
                                : sequenceBlocked
                                  ? 'Locked'
                                  : 'Ready';
                          const statusTone = completed
                            ? palette.accent
                            : dateBlocked
                              ? palette.border
                              : isNext
                                ? palette.tint
                                : sequenceBlocked
                                  ? palette.border
                                  : palette.tint;
                          return (
                            <View
                              key={visit.id}
                              style={[
                                styles.card,
                                styles.visitCard,
                                cardShadowStyle,
                                { backgroundColor: palette.card, borderColor: isNext ? palette.tint : cardBorder },
                              ]}
                            >
                              <View style={styles.visitHeader}>
                                <View style={styles.nameRow}>
                                  <FontAwesome name="user" size={14} color={palette.muted} />
                                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                                    {customerName}
                                  </Text>
                                </View>
                                <View style={[styles.statusPill, { backgroundColor: statusTone }]}>
                                  <Text
                                    style={[
                                      styles.statusPillText,
                                      { color: sequenceBlocked ? palette.text : '#FFFFFF' },
                                    ]}
                                  >
                                    {statusLabel}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.scheduleRow}>
                                <FontAwesome name="calendar" size={12} color={palette.muted} />
                                <Text
                                  style={[styles.metaText, styles.scheduleText, { color: palette.muted }]}
                                >
                                  {scheduleLine}
                                </Text>
                              </View>
                          <View style={styles.metaRow}>
                            <FontAwesome name="map-marker" size={12} color={palette.muted} />
                            <Text style={[styles.metaText, { color: palette.muted }]}>
                              {address}
                              {city}
                            </Text>
                          </View>
                          {formatDogSummary(visit.customer?.dogs) ? (
                            <View style={styles.metaRow}>
                              <FontAwesome name="paw" size={12} color={palette.muted} />
                              <Text style={[styles.metaText, { color: palette.muted }]}>
                                {formatDogSummary(visit.customer?.dogs)}
                              </Text>
                            </View>
                          ) : null}
                          {payoutLabel ? (
                            <View style={styles.metaRow}>
                              <FontAwesome name="usd" size={12} color={palette.muted} />
                              <View style={styles.payoutStack}>
                                <Text style={[styles.metaText, styles.payoutText, { color: mintTone }]}>
                                  {payoutLabel} payout
                                </Text>
                                <Text style={[styles.payoutNote, { color: palette.muted }]}>
                                  Includes mileage + PPE est.
                                </Text>
                              </View>
                            </View>
                          ) : null}
                          <View style={styles.visitActions}>
                            <Button
                              title="Open"
                              onPress={() => router.push(`/(app)/(scooper)/visits/${visit.id}`)}
                              variant="primary"
                              disabled={openBlocked}
                              style={styles.visitActionButton}
                              labelStyle={styles.visitActionLabel}
                            />
                            {visit.navigationUrl ? (
                              <Button
                                title="Navigate"
                                onPress={() => openNavigation(visit.navigationUrl)}
                                variant="secondary"
                                disabled={openBlocked}
                                style={styles.visitActionButton}
                                labelStyle={styles.visitActionLabel}
                              />
                            ) : null}
                            {canReleaseVisit ? (
                              <Button
                                title="Release"
                                onPress={() => openReleaseDialog(visit)}
                                variant="secondary"
                                disabled={releaseSubmitting}
                                style={[
                                  styles.visitActionButton,
                                  styles.releaseButton,
                                  { borderColor: palette.danger },
                                ]}
                                labelStyle={[styles.visitActionLabel, { color: palette.danger }]}
                              />
                            ) : null}
                          </View>
                          {lateReleaseText ? (
                            <Text style={[styles.lateReleaseText, { color: lateReleaseTone }]}>
                              {lateReleaseText}
                            </Text>
                          ) : null}
                          {checkInBlocked ? (
                            <Text style={[styles.helperText, { color: palette.muted }]}>
                              Complete daily check-in to unlock visits.
                            </Text>
                          ) : dateBlocked ? (
                            <Text style={[styles.helperText, { color: palette.muted }]}>
                              Available on {formatDayLabel(visit.scheduledDate)}.
                            </Text>
                          ) : sequenceBlocked ? (
                            <Text style={[styles.helperText, { color: palette.muted }]}>
                              Finish the previous stop before opening this visit.
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <ScooperCalendarModal
        visible={calendarOpen}
        onClose={closeCalendar}
        visits={routePlan?.visits ?? []}
        loading={loading}
        error={error}
      />
      <Modal
        visible={Boolean(releaseVisit)}
        transparent
        animationType="fade"
        onRequestClose={closeReleaseDialog}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <Pressable style={styles.modalBackdrop} onPress={Keyboard.dismiss} />
          <View style={styles.modalContent}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{releaseSummary.title}</Text>
                <Text style={[styles.modalBody, { color: palette.muted }]}>
                  Return work to the offer board so another scooper can cover it.
                </Text>

                  <View style={[styles.modalSection, { borderColor: palette.border, backgroundColor: palette.background }]}>
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>Release scope</Text>
                    <View style={styles.scopeRow}>
                      <Pressable
                        onPress={() => handleReleaseScopeChange('visit')}
                        style={[
                          styles.scopeOption,
                          { borderColor: palette.border },
                          releaseScope === 'visit' && { borderColor: palette.tint, backgroundColor: palette.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scopeText,
                            { color: releaseScope === 'visit' ? '#FFFFFF' : palette.text },
                          ]}
                        >
                          This visit only
                        </Text>
                      </Pressable>
                      {canReleaseJob ? (
                        <Pressable
                          onPress={() => handleReleaseScopeChange('job')}
                          style={[
                            styles.scopeOption,
                            { borderColor: palette.border },
                            releaseScope === 'job' && { borderColor: palette.tint, backgroundColor: palette.tint },
                          ]}
                        >
                          <Text
                            style={[
                              styles.scopeText,
                              { color: releaseScope === 'job' ? '#FFFFFF' : palette.text },
                            ]}
                          >
                            Entire recurring job
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {!canReleaseJob ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        {releaseVisit?.job?.frequency === 'ONE_TIME'
                          ? 'This stop is a one-time visit, so only the visit can be released.'
                          : isReleaseJobOwnedByAnother
                            ? 'This visit is part of a route owned by another scooper, so only this visit can be released.'
                            : 'Only this visit can be released.'}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.modalSection, { borderColor: palette.border, backgroundColor: palette.background }]}>
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>What happens next</Text>
                    <Text style={[styles.modalBody, { color: palette.text }]}>{releaseSummary.description}</Text>
                    <Text style={[styles.modalBody, { color: palette.muted }]}>{releaseSummary.commitment}</Text>
                    {releaseScope === 'job' && releaseFrequencyLabel ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        Schedule: {releaseFrequencyLabel}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.modalSection, { borderColor: palette.border, backgroundColor: palette.background }]}>
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>Reliability note</Text>
                    <Text style={[styles.modalBody, { color: palette.muted }]}>
                      We track releases to keep schedules reliable. Three missed visits in a quarter pause
                      new offers. Late releases within 48 hours are capped at five per quarter.
                    </Text>
                    {releaseIsSameDay ? (
                      <Text style={[styles.modalBody, { color: palette.danger }]}>
                        Same-day releases are locked so routes stay reliable. Reach out to dispatch for help.
                      </Text>
                    ) : null}
                    {releaseScope === 'visit' ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        If you can't keep the recurring schedule, release the entire job instead.
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>Reason (required)</Text>
                    <View style={styles.reasonChips}>
                      {RELEASE_REASON_OPTIONS.map((option) => (
                        <ChoiceChip
                          key={option.key}
                          label={option.label}
                          selected={releaseReasonOption === option.key}
                          onPress={() => {
                            setReleaseReasonOption(option.key);
                            if (option.key !== 'other') {
                              setReleaseReason('');
                            }
                          }}
                        />
                      ))}
                    </View>
                    {!reasonReady ? (
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        Select a reason to continue.
                      </Text>
                    ) : null}
                    {isOtherReason ? (
                      <TextInput
                        value={releaseReason}
                        onChangeText={setReleaseReason}
                        placeholder="Tell us what happened"
                        placeholderTextColor={palette.muted}
                        style={[styles.input, styles.textArea, { color: palette.text, borderColor: palette.border }]}
                        multiline
                        textAlignVertical="top"
                      />
                    ) : null}
                  </View>

                  <View style={styles.checkboxGroup}>
                    <Pressable
                      onPress={() =>
                        setReleaseChecks((prev) => ({
                          ...prev,
                          availability: !prev.availability,
                        }))
                      }
                      style={styles.checkboxRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: checkboxBorder, backgroundColor: checkboxBackground },
                          releaseChecks.availability && {
                            backgroundColor: palette.tint,
                            borderColor: palette.tint,
                          },
                        ]}
                      >
                        {releaseChecks.availability ? <Text style={styles.checkboxMark}>X</Text> : null}
                      </View>
                      <Text style={[styles.checkboxText, { color: palette.text }]}>
                        I can't complete this {releaseScopeLabel} and need to release it.
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setReleaseChecks((prev) => ({
                          ...prev,
                          scope: !prev.scope,
                        }))
                      }
                      style={styles.checkboxRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: checkboxBorder, backgroundColor: checkboxBackground },
                          releaseChecks.scope && {
                            backgroundColor: palette.tint,
                            borderColor: palette.tint,
                          },
                        ]}
                      >
                        {releaseChecks.scope ? <Text style={styles.checkboxMark}>X</Text> : null}
                      </View>
                      <Text style={[styles.checkboxText, { color: palette.text }]}>
                        I understand this releases the {releaseScopeLabel} back to the offer board.
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setReleaseChecks((prev) => ({
                          ...prev,
                          policy: !prev.policy,
                        }))
                      }
                      style={styles.checkboxRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: checkboxBorder, backgroundColor: checkboxBackground },
                          releaseChecks.policy && {
                            backgroundColor: palette.tint,
                            borderColor: palette.tint,
                          },
                        ]}
                      >
                        {releaseChecks.policy ? <Text style={styles.checkboxMark}>X</Text> : null}
                      </View>
                      <Text style={[styles.checkboxText, { color: palette.text }]}>
                        I understand late releases within 48 hours are capped and missed visits can pause offers.
                      </Text>
                    </Pressable>
                  </View>

                  {releaseError ? (
                    <View style={[styles.errorBox, { borderColor: palette.danger }]}>
                      <Text style={[styles.errorText, { color: palette.danger }]}>{releaseError}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={closeReleaseDialog}
                      style={styles.modalButton}
                    />
                    <Button
                      title={releaseSubmitting ? 'Releasing...' : 'Release work'}
                      onPress={submitRelease}
                      disabled={!canConfirmRelease || releaseSubmitting}
                      style={[
                        styles.modalButton,
                        { backgroundColor: palette.danger, borderColor: palette.danger },
                      ]}
                      labelStyle={{ color: '#FFFFFF' }}
                    />
                  </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 18,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  pageHeaderText: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  pageHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  checkInBubble: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
    gap: 2,
  },
  checkInBubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  checkInBubbleMeta: {
    fontSize: 10,
    fontWeight: '600',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    gap: 8,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroActions: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 160,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryMeta: {
    fontSize: 12,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  summaryChipText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  summaryHelper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  checkInHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardBody: {
    fontSize: 14,
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  pendingButton: {
    flex: 1,
  },
  routeToggle: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeToggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  routeToggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeToggleMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  routeChip: {
    flexGrow: 1,
    flexBasis: 90,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  routeChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  routeChipValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  section: {
    marginTop: 16,
  },
  sectionShell: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderMain: {
    flex: 1,
    gap: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionRangeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionDivider: {
    height: 1,
    opacity: 0.6,
  },
  sectionBody: {
    gap: 12,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  scheduleText: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  payoutText: {
    fontWeight: '700',
  },
  payoutStack: {
    gap: 2,
  },
  payoutNote: {
    fontSize: 11,
    lineHeight: 14,
  },
  visitCard: {
    marginBottom: 0,
  },
  visitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  visitActionButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  visitActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  primaryCta: {
    minWidth: 160,
  },
  secondaryCta: {
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
  },
  lateReleaseText: {
    fontSize: 12,
    marginTop: 8,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  releaseButton: {
    minWidth: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    flex: 1,
    zIndex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingVertical: 12,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 13,
  },
  modalSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeOption: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scopeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 80,
  },
  checkboxGroup: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
