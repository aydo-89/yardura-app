import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ScooperCalendarModal from '@/components/scooper/ScooperCalendarModal';
import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import type {
  ScooperOffer,
  ScooperOffersPayload,
  ScooperRoutePlan,
  ScooperRouteVisit,
} from '@/lib/api/types';

type AvailabilityEntry = {
  weekday: number;
  window: string | null;
  tile?: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type AvailabilityWindowKey = 'AM' | 'PM' | 'FULL' | 'CUSTOM';
type OfferSortKey = 'soonest' | 'closest' | 'payout' | 'value';

const SORT_OPTIONS: Array<{ key: OfferSortKey; label: string }> = [
  { key: 'soonest', label: 'Soonest' },
  { key: 'closest', label: 'Closest' },
  { key: 'payout', label: 'Highest payout' },
  { key: 'value', label: 'Highest wk/mo' },
];

function formatFrequencyLabel(frequency: string) {
  return frequency.toLowerCase().replace(/_/g, ' ');
}

function formatCadenceShort(frequency: string) {
  switch (frequency) {
    case 'TWICE_WEEKLY':
      return '2x per week';
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'BI_WEEKLY':
      return 'Every other week';
    case 'MONTHLY':
      return 'Monthly';
    case 'ONE_TIME':
      return 'One-time';
    default:
      return formatFrequencyLabel(frequency);
  }
}

function formatOfferDate(value?: string | null) {
  if (!value) return 'Flexible day';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Flexible day';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatOfferWindow(
  offer: Pick<ScooperOffer, 'preferredTimeWindowLabel' | 'preferredTimeWindowRange' | 'preferredTimeWindowSlug'>,
) {
  const range = offer.preferredTimeWindowRange;
  if (offer.preferredTimeWindowLabel) {
    if (range && !offer.preferredTimeWindowLabel.includes(range)) {
      return `${offer.preferredTimeWindowLabel} (${range})`;
    }
    return offer.preferredTimeWindowLabel;
  }
  const slug = offer.preferredTimeWindowSlug?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'Morning';
  if (slug.includes('afternoon')) return 'Afternoon';
  if (slug.includes('evening')) return 'Evening';
  if (slug.includes('flex')) return 'Flexible';
  if (slug.includes('custom') || range) {
    return range ? `Custom (${range})` : 'Custom window';
  }
  return null;
}

function formatCountdown(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  const diffMs = expiry.getTime() - now;
  if (diffMs <= 0) return 'Expiring now';
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Expires in ${minutes}m ${seconds}s`;
  return `Expires in ${seconds}s`;
}

const VISITS_PER_MONTH: Record<string, number> = {
  DAILY: 21.67,
  TWICE_WEEKLY: 8.67,
  WEEKLY: 4.33,
  BI_WEEKLY: 2.17,
  MONTHLY: 1,
  ONE_TIME: 1,
};

function formatPayout(cents?: number | null) {
  if (typeof cents !== 'number') return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRecurringPayout(cents: number, frequency: string) {
  const visitsPerMonth = VISITS_PER_MONTH[frequency] ?? 0;
  if (!visitsPerMonth) return null;
  const visitsPerWeek = visitsPerMonth / 4.33;
  const weekly = formatPayout(cents * visitsPerWeek);
  const monthly = formatPayout(cents * visitsPerMonth);
  if (visitsPerMonth <= 1.1) {
    return `Est. ${monthly}/mo`;
  }
  return `Est. ${weekly}/wk • ${monthly}/mo`;
}

function compareNumberAsc(a: number | null | undefined, b: number | null | undefined) {
  const aValid = typeof a === 'number' && Number.isFinite(a);
  const bValid = typeof b === 'number' && Number.isFinite(b);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return a - b;
}

function compareNumberDesc(a: number | null | undefined, b: number | null | undefined) {
  const aValid = typeof a === 'number' && Number.isFinite(a);
  const bValid = typeof b === 'number' && Number.isFinite(b);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return b - a;
}

function resolveOfferTime(offer: ScooperOffer) {
  if (!offer.scheduledDate) return null;
  const time = new Date(offer.scheduledDate).getTime();
  return Number.isNaN(time) ? null : time;
}

function resolveOfferDistance(offer: ScooperOffer) {
  if (typeof offer.distanceMiles !== 'number') return null;
  if (!Number.isFinite(offer.distanceMiles)) return null;
  return offer.distanceMiles;
}

function resolveOfferPayoutCents(offer: ScooperOffer) {
  if (typeof offer.estimatedPayout?.totalAmountCents !== 'number') return null;
  return offer.estimatedPayout.totalAmountCents;
}

function resolveOfferValueCents(offer: ScooperOffer) {
  const payoutCents = resolveOfferPayoutCents(offer);
  const visitsPerMonth = VISITS_PER_MONTH[offer.frequency] ?? 0;
  if (payoutCents == null || !visitsPerMonth) return null;
  return payoutCents * visitsPerMonth;
}

function offerToProposedVisit(offer: ScooperOffer): ScooperRouteVisit | null {
  if (!offer.scheduledDate) return null;
  return {
    id: `offer-${offer.id}`,
    scheduledDate: offer.scheduledDate,
    status: 'PROPOSED',
    preferredTimeWindowLabel: offer.preferredTimeWindowLabel ?? null,
    preferredTimeWindowSlug: offer.preferredTimeWindowSlug ?? null,
    payoutCents: offer.estimatedPayout?.totalAmountCents ?? null,
    customer: offer.customer?.id
      ? {
          id: offer.customer.id,
          name: offer.customer.name ?? null,
          addressLine1: offer.customer.addressLine1 ?? null,
          city: offer.customer.city ?? null,
          zip: offer.customer.zip ?? null,
          dogs: offer.customer.dogs ?? [],
        }
      : null,
    job: offer.jobId
      ? {
          id: offer.jobId,
          frequency: offer.frequency ?? null,
        }
      : null,
  };
}

function sortOffers(list: ScooperOffer[], sortKey: OfferSortKey) {
  const sorted = [...list];
  switch (sortKey) {
    case 'closest':
      return sorted.sort((a, b) => {
        const distanceSort = compareNumberAsc(resolveOfferDistance(a), resolveOfferDistance(b));
        if (distanceSort !== 0) return distanceSort;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'payout':
      return sorted.sort((a, b) => {
        const payoutSort = compareNumberDesc(resolveOfferPayoutCents(a), resolveOfferPayoutCents(b));
        if (payoutSort !== 0) return payoutSort;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'value':
      return sorted.sort((a, b) => {
        const valueSort = compareNumberDesc(resolveOfferValueCents(a), resolveOfferValueCents(b));
        if (valueSort !== 0) return valueSort;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'soonest':
    default:
      return sorted.sort((a, b) =>
        compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b)),
      );
  }
}

function startOfWeekMonday(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function groupOffersByTimeframe(offers: ScooperOffer[], now: Date) {
  const thisWeekStart = startOfWeekMonday(now);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(thisWeekStart.getDate() + 7);
  const laterStart = new Date(nextWeekStart);
  laterStart.setDate(nextWeekStart.getDate() + 7);

  const groups: Array<{ id: string; title: string; offers: ScooperOffer[] }> = [
    { id: 'flex', title: 'Flexible timing', offers: [] },
    { id: 'this-week', title: 'This week', offers: [] },
    { id: 'next-week', title: 'Next week', offers: [] },
    { id: 'later', title: 'Later', offers: [] },
  ];

  offers.forEach((offer) => {
    if (!offer.scheduledDate) {
      groups[0].offers.push(offer);
      return;
    }
    const scheduled = new Date(offer.scheduledDate);
    if (Number.isNaN(scheduled.getTime())) {
      groups[0].offers.push(offer);
      return;
    }
    if (scheduled < nextWeekStart) {
      groups[1].offers.push(offer);
    } else if (scheduled < laterStart) {
      groups[2].offers.push(offer);
    } else {
      groups[3].offers.push(offer);
    }
  });

  return groups.filter((group) => group.offers.length);
}

function resolveBundleWindowLabel(offers: ScooperOffer[]) {
  const labels = offers
    .map((offer) => formatOfferWindow(offer))
    .filter((value): value is string => Boolean(value));
  if (!labels.length) return null;
  const unique = new Set(labels);
  return unique.size === 1 ? labels[0] ?? null : 'Multiple windows';
}


function formatDistance(distanceMiles?: number | null) {
  if (typeof distanceMiles !== 'number' || Number.isNaN(distanceMiles)) return null;
  return `${distanceMiles.toFixed(1)} mi from home`;
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

function resolveOfferWindowKey(
  offer: Pick<ScooperOffer, 'preferredTimeWindowSlug' | 'preferredTimeWindowRange' | 'preferredTimeWindowLabel'>,
): AvailabilityWindowKey | null {
  const slug = offer.preferredTimeWindowSlug?.toLowerCase() ?? '';
  const label = offer.preferredTimeWindowLabel?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'AM';
  if (slug.includes('afternoon') || slug.includes('evening')) return 'PM';
  if (slug.includes('flex')) return 'FULL';
  if (label.includes('flex')) return 'FULL';
  if (slug.includes('custom')) return 'CUSTOM';
  if (offer.preferredTimeWindowRange) return 'CUSTOM';
  return null;
}

function isWindowCompatible(
  availabilityWindow: string | null | undefined,
  offerWindow: AvailabilityWindowKey | null,
) {
  if (!offerWindow) return true;
  const windowKey: AvailabilityWindowKey =
    availabilityWindow === 'AM' ||
    availabilityWindow === 'PM' ||
    availabilityWindow === 'FULL' ||
    availabilityWindow === 'CUSTOM'
      ? availabilityWindow
      : 'FULL';
  if (offerWindow === 'FULL') return true;
  if (offerWindow === 'CUSTOM') return windowKey === 'CUSTOM' || windowKey === 'FULL';
  if (windowKey === 'FULL' || windowKey === 'CUSTOM') return true;
  return windowKey === offerWindow;
}

function isOfferCoveredByAvailability(
  offer: ScooperOffer,
  availability: AvailabilityEntry[],
) {
  if (!offer.scheduledDate) return true;
  if (!availability.length) return true;
  const scheduled = new Date(offer.scheduledDate);
  if (Number.isNaN(scheduled.getTime())) return true;
  const weekday = scheduled.getDay();
  const offerWindow = resolveOfferWindowKey(offer);
  const matching = availability.filter((entry) => {
    if (entry.weekday !== weekday) return false;
    if (offer.tileId && entry.tile?.id && entry.tile.id !== offer.tileId) return false;
    return true;
  });
  if (!matching.length) return false;
  return matching.some((entry) => isWindowCompatible(entry.window, offerWindow));
}

function summarizeAvailabilityConflicts(conflicts: ScooperOffer[]) {
  const labels = conflicts.map((offer) => {
    const dateLabel = formatOfferDate(offer.scheduledDate);
    const windowLabel = formatOfferWindow(offer);
    return windowLabel ? `${dateLabel} ${windowLabel}` : dateLabel;
  });
  const unique = Array.from(new Set(labels));
  const preview = unique.slice(0, 2).join(', ');
  const remaining = unique.length - 2;
  return remaining > 0 ? `${preview} +${remaining} more` : preview;
}


export default function ScooperOffers() {
  const { session } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const checkboxBorder = colorScheme === 'dark'
    ? 'rgba(248, 250, 252, 0.7)'
    : 'rgba(15, 23, 42, 0.4)';
  const checkboxBackground = colorScheme === 'dark'
    ? 'rgba(248, 250, 252, 0.12)'
    : 'rgba(15, 23, 42, 0.06)';
  const [offers, setOffers] = useState<ScooperOffer[]>([]);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScooperOffersPayload['summary'] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [confirmOffer, setConfirmOffer] = useState<ScooperOffer | null>(null);
  const [confirmChecks, setConfirmChecks] = useState({
    availability: false,
    commitment: false,
    policy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sortKey, setSortKey] = useState<OfferSortKey>('soonest');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarVisits, setCalendarVisits] = useState<ScooperRoutePlan['visits']>(
    [],
  );
  const [calendarCompareVisits, setCalendarCompareVisits] = useState<ScooperRouteVisit[]>(
    [],
  );
  const [calendarTitle, setCalendarTitle] = useState<string | null>(null);
  const [calendarSubtitle, setCalendarSubtitle] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadOffers = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ScooperOffersPayload>(
        '/api/mobile/scooper/offers?limit=40',
        { token: session.token },
      );
      setOffers(data.offers);
      setProfileStatus(data.profileStatus);
      setSummary(data.summary ?? null);
      setGeneratedAt(data.generatedAt ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load offers.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const loadAvailability = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ orgId: string; availability: AvailabilityEntry[] }>(
        '/api/mobile/scooper/availability',
        { token: session.token },
      );
      setAvailability(data.availability ?? []);
      setAvailabilityLoaded(true);
    } catch {
      setAvailabilityLoaded(false);
    }
  }, [session?.token]);

  const loadCalendarVisits = useCallback(async () => {
    if (!session?.token) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const data = await apiRequest<ScooperRoutePlan>('/api/field-tech/visits', {
        token: session.token,
      });
      setCalendarVisits(data.visits ?? []);
    } catch (err) {
      let message =
        err instanceof Error ? err.message : 'Unable to load calendar.';
      if (err instanceof ApiError) {
        const details = err.details as { error?: string; message?: string } | undefined;
        if (details?.error === 'home_anchor_missing') {
          message = 'Set your home base to unlock calendar routing.';
        } else if (typeof details?.message === 'string') {
          message = details.message;
        }
      }
      setCalendarError(message);
    } finally {
      setCalendarLoading(false);
    }
  }, [session?.token]);

  const openCalendar = () => {
    setCalendarCompareVisits([]);
    setCalendarTitle(null);
    setCalendarSubtitle(null);
    setCalendarOpen(true);
    loadCalendarVisits();
  };

  const closeCalendar = () => setCalendarOpen(false);

  useFocusEffect(
    useCallback(() => {
      loadOffers();
      loadAvailability();
    }, [loadOffers, loadAvailability]),
  );

  const acceptOffer = async (offerId: string, scope: 'visit' | 'job', jobId?: string | null) => {
    if (!session?.token) return false;
    setAcceptingId(offerId);
    setError(null);
    try {
      await apiRequest(`/api/mobile/scooper/offers/${offerId}/accept`, {
        method: 'POST',
        token: session.token,
        body: { scope },
      });
      setOffers((prev) =>
        scope === 'job' && jobId ? prev.filter((offer) => offer.jobId !== jobId) : prev.filter((offer) => offer.id !== offerId),
      );
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError && err.message === 'scooper_strike_limit'
          ? err.details && typeof err.details === 'object' && 'message' in err.details
            ? String((err.details as { message?: string }).message ?? err.message)
            : 'Missed visit limit reached this quarter. Resolve with dispatch before taking new offers.'
          : err instanceof Error
            ? err.message
            : 'Unable to accept offer.';
      setError(message);
      return false;
    } finally {
      setAcceptingId(null);
    }
  };

  const declineOffer = async (offerId: string) => {
    if (!session?.token) return false;
    setDecliningId(offerId);
    setError(null);
    try {
      await apiRequest(`/api/mobile/scooper/offers/${offerId}/decline`, {
        method: 'POST',
        token: session.token,
      });
      setOffers((prev) => prev.filter((offer) => offer.id !== offerId));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to decline offer.';
      setError(message);
      return false;
    } finally {
      setDecliningId(null);
    }
  };

  const openConfirm = (offer: ScooperOffer) => {
    setConfirmOffer(offer);
    setConfirmChecks({
      availability: false,
      commitment: false,
      policy: false,
    });
  };

  const closeConfirm = () => {
    setConfirmOffer(null);
    setConfirmChecks({
      availability: false,
      commitment: false,
      policy: false,
    });
  };

  const openCompareCalendar = () => {
    const visits = compareVisits;
    closeConfirm();
    setCalendarCompareVisits(visits);
    setCalendarTitle('Compare schedule');
    setCalendarSubtitle('Overlay added stops on your current route.');
    setCalendarOpen(true);
    loadCalendarVisits();
  };

  const confirmDecline = async () => {
    if (!confirmOffer) return;
    const success = await declineOffer(confirmOffer.id);
    if (success) {
      closeConfirm();
      await loadOffers();
    }
  };

  const confirmAcceptVisit = async () => {
    if (!confirmOffer) return;
    const success = await acceptOffer(confirmOffer.id, 'visit', confirmOffer.jobId);
    if (success) {
      closeConfirm();
      await loadOffers();
    }
  };

  const confirmAcceptRecurring = async () => {
    if (!confirmOffer?.jobId) return;
    const success = await acceptOffer(confirmOffer.id, 'job', confirmOffer.jobId);
    if (success) {
      closeConfirm();
      await loadOffers();
    }
  };

  const requestAcceptRecurring = () => {
    if (!confirmOffer) return;
    Alert.alert(
      'Accept ongoing customer?',
      'This assigns all existing and future visits for this customer to you until you release the recurring assignment. Only accept if your availability can support the cadence.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept ongoing customer',
          onPress: () => {
            void confirmAcceptRecurring();
          },
        },
      ],
    );
  };

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? 'Soonest',
    [sortKey],
  );
  const sortedOffers = useMemo(() => sortOffers(offers, sortKey), [offers, sortKey]);
  const groupedOffers = useMemo(() => {
    if (sortKey === 'soonest') {
      return groupOffersByTimeframe(sortedOffers, new Date(now));
    }
    return [
      {
        id: 'sorted',
        title: `Sorted by ${sortLabel}`,
        offers: sortedOffers,
      },
    ];
  }, [sortedOffers, now, sortKey, sortLabel]);

  const relatedRecurringOffers = useMemo(() => {
    if (!confirmOffer?.jobId || !confirmOffer.isRecurring) return [];
    return offers.filter(
      (offer) => offer.jobId === confirmOffer.jobId && offer.isRecurring,
    );
  }, [confirmOffer, offers]);
  const compareVisits = useMemo(
    () =>
      relatedRecurringOffers
        .map(offerToProposedVisit)
        .filter((visit): visit is ScooperRouteVisit => Boolean(visit)),
    [relatedRecurringOffers],
  );
  const compareAvailable = compareVisits.length > 0;

  const recurringAvailability = useMemo(() => {
    if (!availabilityLoaded || !relatedRecurringOffers.length) {
      return { conflicts: [] as ScooperOffer[], summary: null as string | null };
    }
    const conflicts = relatedRecurringOffers.filter(
      (offer) => !isOfferCoveredByAvailability(offer, availability),
    );
    return {
      conflicts,
      summary: conflicts.length ? summarizeAvailabilityConflicts(conflicts) : null,
    };
  }, [availability, availabilityLoaded, relatedRecurringOffers]);

  const canConfirm =
    confirmChecks.availability && confirmChecks.commitment && confirmChecks.policy;
  const canAcceptRecurring = Boolean(confirmOffer?.jobId && confirmOffer?.isRecurring);
  const hasVisitConflict = Boolean(
    confirmOffer && availabilityLoaded && !isOfferCoveredByAvailability(confirmOffer, availability),
  );
  const isAcceptingOffer = Boolean(acceptingId && confirmOffer?.id === acceptingId);
  const recurringCount = relatedRecurringOffers.length;
  const recurringWindowLabel =
    confirmOffer?.isRecurring && relatedRecurringOffers.length
      ? resolveBundleWindowLabel(relatedRecurringOffers)
      : null;
  const confirmPayoutCents = confirmOffer?.estimatedPayout?.totalAmountCents ?? null;
  const recurringPayoutLabel =
    confirmOffer?.isRecurring && confirmPayoutCents
      ? formatRecurringPayout(confirmPayoutCents, confirmOffer.frequency)
      : null;
  const confirmIsCoverage = Boolean(
    confirmOffer?.jobId && !confirmOffer?.isRecurring && !confirmOffer?.handoffType,
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderRow}>
            <View style={styles.pageHeaderText}>
              <Text style={[styles.kicker, { color: palette.muted }]}>Offers</Text>
              <Text style={[styles.title, { color: palette.text }]}>Open offers</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                Claim jobs that match your availability and route coverage.
              </Text>
            </View>
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
          </View>
        </View>

        {summary ? (
          <View
            style={[
              styles.summaryCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBlock}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Total</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>{summary.total}</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Direct to you</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>{summary.direct}</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Open board</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>{summary.broadcast}</Text>
              </View>
            </View>
            <Text style={[styles.summaryNote, { color: palette.muted }]}>
              Direct offers are held for you. Open board offers are visible to all scoopers in your tiles.
            </Text>
            {generatedAt ? (
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                Updated {new Date(generatedAt).toLocaleString()}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: palette.muted }]}>Sort by</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortOptions}
            style={styles.sortScroll}
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = sortKey === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSortKey(option.key)}
                  style={[
                    styles.sortChip,
                    {
                      borderColor: isActive ? palette.tint : cardBorder,
                      backgroundColor: isActive ? palette.tint : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: isActive ? '#FFFFFF' : palette.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading offers...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : profileStatus && profileStatus !== 'CERTIFIED' ? (
          <View style={[styles.card, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Profile pending</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Your profile is {profileStatus.toLowerCase().replace('_', ' ')}. Offers unlock
              once certification is complete.
            </Text>
          </View>
        ) : sortedOffers.length === 0 ? (
          <View style={[styles.card, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No offers yet</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Set your availability and keep certifications current to receive work.
            </Text>
          </View>
        ) : (
          groupedOffers.map((group) => (
            <View key={group.id} style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{group.title}</Text>
              <View style={styles.sectionList}>
                {group.offers.map((offer) => {
                  const scheduled = formatOfferDate(offer.scheduledDate);
                  const windowLabel = formatOfferWindow(offer);
                  const scheduleLine = windowLabel ? `${scheduled} • ${windowLabel}` : scheduled;
                  const cadenceLabel = formatCadenceShort(offer.frequency);
                  const payoutCents = offer.estimatedPayout?.totalAmountCents ?? null;
                  const payoutLabel = formatPayout(payoutCents);
                  const recurringPayoutLabel =
                    offer.isRecurring && payoutCents
                      ? formatRecurringPayout(payoutCents, offer.frequency)
                      : null;
                  const countdown = formatCountdown(offer.expiresAt, now);
                  const distanceLabel = formatDistance(offer.distanceMiles ?? null);
                  const isRecurring = offer.isRecurring;
                  const isCoverageVisit =
                    Boolean(offer.jobId) && !offer.isRecurring && !offer.handoffType;
                  const cadenceNote = isRecurring ? `${cadenceLabel} ongoing` : null;
                  const availabilityConflict =
                    availabilityLoaded && !isOfferCoveredByAvailability(offer, availability);
                  const isAcceptingOffer = acceptingId === offer.id;
                  return (
                    <View
                      key={offer.id}
                      style={[
                        styles.card,
                        cardShadowStyle,
                        { backgroundColor: palette.card, borderColor: cardBorder },
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.headerInfo}>
                          <View style={styles.nameRow}>
                            <FontAwesome name="tag" size={14} color={palette.muted} />
                            <Text style={[styles.cardTitle, { color: palette.text }]}>
                              Open offer
                            </Text>
                          </View>
                          <View style={styles.metaRow}>
                            <FontAwesome name="map" size={12} color={palette.muted} />
                            <Text style={[styles.metaText, { color: palette.muted }]}>
                              {offer.tile?.name ?? 'Service tile'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.headerStack}>
                          {countdown ? (
                            <View style={[styles.countdownPill, { borderColor: cardBorder }]}>
                              <Text style={[styles.countdownText, { color: palette.muted }]}>
                                {countdown}
                              </Text>
                            </View>
                          ) : null}
                          <View
                            style={[
                              styles.offerPill,
                              {
                                borderColor: cardBorder,
                                backgroundColor: offer.isDirectOffer ? palette.accent : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.offerPillText,
                                { color: offer.isDirectOffer ? palette.card : palette.muted },
                              ]}
                            >
                              {offer.isDirectOffer ? 'Direct to you' : 'Open board'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {distanceLabel ? (
                        <View style={styles.metaRowWrap}>
                          {distanceLabel ? (
                            <View style={styles.metaItem}>
                              <FontAwesome name="home" size={12} color={palette.muted} />
                              <Text style={[styles.metaText, { color: palette.muted }]}>
                                {distanceLabel}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.scheduleRow}>
                        <View style={styles.metaRow}>
                          <FontAwesome name="calendar" size={12} color={palette.muted} />
                          <Text style={[styles.scheduleTitle, { color: palette.text }]}>
                            {scheduleLine}
                          </Text>
                        </View>
                        <View style={styles.tagRow}>
                          {cadenceNote ? (
                            <View style={[styles.tagPill, { borderColor: cardBorder }]}>
                              <Text style={[styles.tagText, { color: palette.muted }]}>
                                {cadenceNote}
                              </Text>
                            </View>
                          ) : null}
                          {isCoverageVisit ? (
                            <View style={[styles.tagPill, { borderColor: cardBorder }]}>
                              <Text style={[styles.tagText, { color: palette.muted }]}>
                                Coverage visit (job owned)
                              </Text>
                            </View>
                          ) : null}
                          {availabilityConflict ? (
                            <View style={[styles.tagPill, { borderColor: Colors.brand.gold }]}>
                              <Text style={[styles.tagText, { color: Colors.brand.evergreen }]}>
                                Availability conflict
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.payoutRow}>
                        <View>
                          <Text style={[styles.payoutValue, { color: Colors.brand.mint }]}>
                            {payoutLabel}
                          </Text>
                          <Text style={[styles.payoutCaption, { color: palette.muted }]}>
                            {offer.isRecurring ? 'Per visit payout' : 'Visit payout'}
                          </Text>
                          {recurringPayoutLabel ? (
                            <Text style={[styles.payoutCaption, { color: palette.muted }]}>
                              {recurringPayoutLabel}
                            </Text>
                          ) : null}
                          <Text style={[styles.payoutCaption, { color: palette.muted }]}>
                            Includes mileage + PPE estimate
                          </Text>
                        </View>
                        <Button
                          title={isAcceptingOffer ? 'Opening...' : 'Review'}
                          onPress={() => openConfirm(offer)}
                          disabled={isAcceptingOffer}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <ScooperCalendarModal
        visible={calendarOpen}
        onClose={closeCalendar}
        visits={calendarVisits}
        compareVisits={calendarCompareVisits}
        compareLabel="Added"
        title={calendarTitle ?? undefined}
        subtitle={calendarSubtitle ?? undefined}
        loading={calendarLoading}
        error={calendarError}
      />
      <Modal
        visible={Boolean(confirmOffer)}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalTitle, { color: palette.text }]}>
                Visit offer
              </Text>
              <Text style={[styles.modalBody, { color: palette.muted }]}>
                Choose whether to accept just this visit or take over all existing and future visits for this customer.
              </Text>
              {confirmOffer ? (
                <>
                  <View style={[styles.modalSection, { borderColor: palette.border, backgroundColor: palette.background }]}>
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>Visit details</Text>
                    <Text style={[styles.modalSectionTitle, { color: palette.text }]}>
                      {formatOfferDate(confirmOffer.scheduledDate)}
                    </Text>
                    {formatOfferWindow(confirmOffer) ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        Window: {formatOfferWindow(confirmOffer)}
                      </Text>
                    ) : (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        Flexible window
                      </Text>
                    )}
                    {confirmIsCoverage ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        Coverage visit (job owned by another scooper)
                      </Text>
                    ) : null}
                    <Text style={[styles.modalBody, { color: palette.text }]}>
                      {confirmOffer.customer?.name ?? 'Customer'}
                    </Text>
                    {formatDistance(confirmOffer.distanceMiles ?? null) ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        {formatDistance(confirmOffer.distanceMiles ?? null)}
                      </Text>
                    ) : null}
                    {formatDogSummary(confirmOffer.customer?.dogs) ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        {formatDogSummary(confirmOffer.customer?.dogs)}
                      </Text>
                    ) : null}
                    <Text style={[styles.modalBody, { color: palette.muted }]}>
                      {confirmOffer.customer?.addressLine1 ?? 'Address on file'}
                    </Text>
                    {confirmOffer.customer?.city ? (
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        {confirmOffer.customer.city} {confirmOffer.customer.zip ?? ''}
                      </Text>
                    ) : null}
                  </View>
                  {canAcceptRecurring ? (
                    <View
                      style={[
                        styles.modalSection,
                        { borderColor: palette.border, backgroundColor: palette.background },
                      ]}
                    >
                      <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>
                        Ongoing customer (optional)
                      </Text>
                      <Text style={[styles.modalBody, { color: palette.text }]}>
                        Cadence: {formatCadenceShort(confirmOffer.frequency)}
                      </Text>
                      {recurringWindowLabel ? (
                        <Text style={[styles.modalBody, { color: palette.muted }]}>
                          Window: {recurringWindowLabel}
                        </Text>
                      ) : null}
                      {recurringCount > 1 ? (
                        <Text style={[styles.modalBody, { color: palette.muted }]}>
                          {recurringCount} upcoming visits already scheduled.
                        </Text>
                      ) : null}
                      {recurringPayoutLabel ? (
                        <Text style={[styles.modalBody, { color: palette.muted }]}>
                          {recurringPayoutLabel} based on per-visit payout.
                        </Text>
                      ) : null}
                      <Text style={[styles.modalBody, { color: palette.muted }]}>
                        Accepting ongoing assigns all existing and future visits for this customer until you release the recurring assignment.
                      </Text>
                      {compareAvailable ? (
                        <Button
                          title="Compare with my schedule"
                          onPress={openCompareCalendar}
                          variant="secondary"
                        />
                      ) : (
                        <Text style={[styles.modalBody, { color: palette.muted }]}>
                          Calendar comparison will appear once upcoming visits are scheduled.
                        </Text>
                      )}
                    </View>
                  ) : null}
                  {(hasVisitConflict || recurringAvailability.conflicts.length > 0) ? (
                    <View
                      style={[
                        styles.modalSection,
                        styles.warningCard,
                        { borderColor: Colors.brand.gold },
                      ]}
                    >
                      <Text style={[styles.modalSectionLabel, { color: Colors.brand.evergreen }]}>
                        Availability check
                      </Text>
                      <Text style={[styles.modalBody, { color: palette.text }]}>
                        {recurringAvailability.summary
                          ? `Some upcoming visits fall outside your availability: ${recurringAvailability.summary}.`
                          : 'This visit may fall outside your current availability.'}
                      </Text>
                      <Pressable
                        onPress={() => router.push('/(app)/(scooper)/availability')}
                        style={styles.warningLink}
                      >
                        <Text style={[styles.warningLinkText, { color: Colors.brand.evergreen }]}>
                          Update availability
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.modalSection,
                      { borderColor: palette.border, backgroundColor: palette.background },
                    ]}
                  >
                    <Text style={[styles.modalSectionLabel, { color: palette.muted }]}>Confirm before accepting</Text>
                    <View style={styles.checkboxGroup}>
                      <Pressable
                        onPress={() =>
                          setConfirmChecks((prev) => ({
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
                            confirmChecks.availability && {
                              backgroundColor: palette.tint,
                              borderColor: palette.tint,
                            },
                          ]}
                        >
                          {confirmChecks.availability ? (
                            <Text style={styles.checkboxMark}>X</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.checkboxText, { color: palette.text }]}>
                          I can complete this visit within the scheduled window.
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setConfirmChecks((prev) => ({
                            ...prev,
                            commitment: !prev.commitment,
                          }))
                        }
                        style={styles.checkboxRow}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            { borderColor: checkboxBorder, backgroundColor: checkboxBackground },
                            confirmChecks.commitment && {
                              backgroundColor: palette.tint,
                              borderColor: palette.tint,
                            },
                          ]}
                        >
                          {confirmChecks.commitment ? (
                            <Text style={styles.checkboxMark}>X</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.checkboxText, { color: palette.text }]}>
                          I understand missed visits pause offers after three per quarter and late releases within 48 hours are capped separately.
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setConfirmChecks((prev) => ({
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
                            confirmChecks.policy && {
                              backgroundColor: palette.tint,
                              borderColor: palette.tint,
                            },
                          ]}
                        >
                          {confirmChecks.policy ? (
                            <Text style={styles.checkboxMark}>X</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.checkboxText, { color: palette.text }]}>
                          I won’t accept visits I cannot fulfill.
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
            <View style={styles.modalActionStack}>
              <View style={styles.acceptActions}>
                <Button
                  title={isAcceptingOffer ? 'Accepting...' : 'Accept this visit'}
                  onPress={() => void confirmAcceptVisit()}
                  disabled={!confirmOffer || !canConfirm || isAcceptingOffer}
                  style={styles.modalButton}
                  variant="primary"
                />
                {canAcceptRecurring ? (
                  <Button
                    title={isAcceptingOffer ? 'Accepting...' : 'Accept ongoing customer'}
                    onPress={requestAcceptRecurring}
                    disabled={!confirmOffer || !canConfirm || isAcceptingOffer}
                    style={styles.modalButton}
                    variant="cta"
                  />
                ) : null}
              </View>
              <View style={styles.secondaryActions}>
                {confirmOffer?.isDirectOffer ? (
                  <Button
                    title={decliningId === confirmOffer.id ? 'Declining...' : 'Decline offer'}
                    variant="secondary"
                    onPress={confirmDecline}
                    disabled={decliningId === confirmOffer.id}
                    style={styles.modalButton}
                  />
                ) : (
                  <Button
                    title="Close"
                    variant="secondary"
                    onPress={closeConfirm}
                    style={styles.modalButton}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 18,
    gap: 6,
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
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sortScroll: {
    flex: 1,
  },
  sortOptions: {
    gap: 8,
    paddingRight: 4,
  },
  sortChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBlock: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryNote: {
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
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
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerStack: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600',
  },
  countdownPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 12,
  },
  scheduleRow: {
    marginTop: 12,
    gap: 4,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  payoutRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  payoutValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  payoutCaption: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: '85%',
  },
  modalScrollView: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  modalScroll: {
    gap: 12,
    paddingBottom: 12,
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
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
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
  modalActionStack: {
    gap: 10,
  },
  acceptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
  warningCard: {
    backgroundColor: 'rgba(255, 194, 77, 0.12)',
  },
  warningLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  warningLinkText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionBlock: {
    marginBottom: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionList: {
    gap: 12,
  },
});
