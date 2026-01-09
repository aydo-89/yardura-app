import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import OfferCard, { type OfferData } from '@/components/scooper/OfferCard';
import ScooperCalendarModal from '@/components/scooper/ScooperCalendarModal';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { parseDateInput } from '@/lib/dates';
import type {
  ScooperOffer,
  ScooperOffersPayload,
  ScooperRoutePlan,
  ScooperRouteVisit,
} from '@/lib/api/types';

type AvailabilityEntry = {
  weekday: number;
  window: string | null;
  tile?: { id: string } | null;
};

type FilterTab = 'all' | 'direct' | 'open';
type SortKey = 'soonest' | 'closest' | 'payout' | 'value';

const TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'direct', label: 'Direct' },
  { key: 'open', label: 'Open' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'soonest', label: 'Soonest' },
  { key: 'closest', label: 'Closest' },
  { key: 'payout', label: 'Payout' },
  { key: 'value', label: 'Value' },
];

const VISITS_PER_MONTH: Record<string, number> = {
  DAILY: 21.67,
  TWICE_WEEKLY: 8.67,
  WEEKLY: 4.33,
  BI_WEEKLY: 2.17,
  MONTHLY: 1,
  ONE_TIME: 1,
};

function resolveOfferWindowKey(offer: ScooperOffer): string | null {
  const slug = offer.preferredTimeWindowSlug?.toLowerCase() ?? '';
  const label = offer.preferredTimeWindowLabel?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'AM';
  if (slug.includes('afternoon') || slug.includes('evening')) return 'PM';
  if (slug.includes('flex') || label.includes('flex')) return 'FULL';
  if (slug.includes('custom') || offer.preferredTimeWindowRange) return 'CUSTOM';
  return null;
}

function isWindowCompatible(availWindow: string | null | undefined, offerWindow: string | null) {
  if (!offerWindow) return true;
  const key = availWindow === 'AM' || availWindow === 'PM' || availWindow === 'FULL' || availWindow === 'CUSTOM'
    ? availWindow : 'FULL';
  if (offerWindow === 'FULL') return true;
  if (offerWindow === 'CUSTOM') return key === 'CUSTOM' || key === 'FULL';
  if (key === 'FULL' || key === 'CUSTOM') return true;
  return key === offerWindow;
}

function isOfferCoveredByAvailability(offer: ScooperOffer, availability: AvailabilityEntry[]) {
  if (!offer.scheduledDate || !availability.length) return true;
  const scheduled = parseDateInput(offer.scheduledDate);
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

function resolveOfferTime(offer: ScooperOffer) {
  if (!offer.scheduledDate) return null;
  const time = parseDateInput(offer.scheduledDate).getTime();
  return Number.isNaN(time) ? null : time;
}

function resolveOfferDistance(offer: ScooperOffer) {
  if (typeof offer.distanceMiles !== 'number' || !Number.isFinite(offer.distanceMiles)) return null;
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

function compareNumberAsc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareNumberDesc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function sortOffers(list: ScooperOffer[], sortKey: SortKey) {
  const sorted = [...list];
  switch (sortKey) {
    case 'closest':
      return sorted.sort((a, b) => {
        const dist = compareNumberAsc(resolveOfferDistance(a), resolveOfferDistance(b));
        if (dist !== 0) return dist;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'payout':
      return sorted.sort((a, b) => {
        const payout = compareNumberDesc(resolveOfferPayoutCents(a), resolveOfferPayoutCents(b));
        if (payout !== 0) return payout;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'value':
      return sorted.sort((a, b) => {
        const value = compareNumberDesc(resolveOfferValueCents(a), resolveOfferValueCents(b));
        if (value !== 0) return value;
        return compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b));
      });
    case 'soonest':
    default:
      return sorted.sort((a, b) => compareNumberAsc(resolveOfferTime(a), resolveOfferTime(b)));
  }
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
    job: offer.jobId ? { id: offer.jobId, frequency: offer.frequency ?? null } : null,
  };
}

export default function ScooperOffers() {
  const { session } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  const [offers, setOffers] = useState<ScooperOffer[]>([]);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScooperOffersPayload['summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('soonest');
  const [showSort, setShowSort] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Calendar state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarVisits, setCalendarVisits] = useState<ScooperRoutePlan['visits']>([]);
  const [calendarCompareVisits, setCalendarCompareVisits] = useState<ScooperRouteVisit[]>([]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load offers.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const loadAvailability = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ availability: AvailabilityEntry[] }>(
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
      let message = err instanceof Error ? err.message : 'Unable to load calendar.';
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

  useFocusEffect(
    useCallback(() => {
      loadOffers();
      loadAvailability();
    }, [loadOffers, loadAvailability]),
  );

  const acceptOffer = useCallback(
    async (offerId: string, scope: 'visit' | 'job', jobId?: string | null): Promise<boolean> => {
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
          scope === 'job' && jobId
            ? prev.filter((o) => o.jobId !== jobId)
            : prev.filter((o) => o.id !== offerId),
        );
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError && err.message === 'scooper_strike_limit'
            ? (err.details as { message?: string })?.message ??
              'Missed visit limit reached this quarter.'
            : err instanceof Error
              ? err.message
              : 'Unable to accept offer.';
        setError(message);
        return false;
      } finally {
        setAcceptingId(null);
      }
    },
    [session?.token],
  );

  const declineOffer = useCallback(
    async (offerId: string): Promise<boolean> => {
      if (!session?.token) return false;
      setDecliningId(offerId);
      setError(null);
      try {
        await apiRequest(`/api/mobile/scooper/offers/${offerId}/decline`, {
          method: 'POST',
          token: session.token,
        });
        setOffers((prev) => prev.filter((o) => o.id !== offerId));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to decline offer.');
        return false;
      } finally {
        setDecliningId(null);
      }
    },
    [session?.token],
  );

  const handleAcceptVisit = useCallback(
    async (offerId: string) => acceptOffer(offerId, 'visit'),
    [acceptOffer],
  );

  const handleAcceptRecurring = useCallback(
    async (offerId: string, jobId: string) => {
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          'Accept ongoing customer?',
          'This assigns all existing and future visits for this customer to you until you release the recurring assignment.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Accept ongoing',
              onPress: async () => {
                const result = await acceptOffer(offerId, 'job', jobId);
                resolve(result);
              },
            },
          ],
        );
      });
    },
    [acceptOffer],
  );

  const handleCompareCalendar = useCallback(
    (offer: OfferData) => {
      const related = offers.filter(
        (o) => o.jobId === offer.jobId && o.isRecurring,
      );
      const compareVisits = related
        .map(offerToProposedVisit)
        .filter((v): v is ScooperRouteVisit => Boolean(v));
      setCalendarCompareVisits(compareVisits);
      setCalendarOpen(true);
      loadCalendarVisits();
    },
    [offers, loadCalendarVisits],
  );

  const openCalendar = useCallback(() => {
    setCalendarCompareVisits([]);
    setCalendarOpen(true);
    loadCalendarVisits();
  }, [loadCalendarVisits]);

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
  }, []);

  // Filter and sort offers
  const filteredOffers = useMemo(() => {
    let filtered = offers;
    if (activeTab === 'direct') {
      filtered = offers.filter((o) => o.isDirectOffer);
    } else if (activeTab === 'open') {
      filtered = offers.filter((o) => !o.isDirectOffer);
    }
    return sortOffers(filtered, sortKey);
  }, [offers, activeTab, sortKey]);

  const conflictSet = useMemo(() => {
    if (!availabilityLoaded) return new Set<string>();
    return new Set(
      offers
        .filter((o) => !isOfferCoveredByAvailability(o, availability))
        .map((o) => o.id),
    );
  }, [offers, availability, availabilityLoaded]);

  const renderOffer = useCallback(
    ({ item }: { item: ScooperOffer }) => (
      <OfferCard
        offer={item}
        palette={palette}
        colorScheme={colorScheme}
        now={now}
        hasConflict={conflictSet.has(item.id)}
        isAccepting={acceptingId === item.id}
        isDeclining={decliningId === item.id}
        onAcceptVisit={handleAcceptVisit}
        onAcceptRecurring={handleAcceptRecurring}
        onDecline={item.isDirectOffer ? declineOffer : undefined}
        onCompareCalendar={item.isRecurring ? handleCompareCalendar : undefined}
      />
    ),
    [
      palette,
      colorScheme,
      now,
      conflictSet,
      acceptingId,
      decliningId,
      handleAcceptVisit,
      handleAcceptRecurring,
      declineOffer,
      handleCompareCalendar,
    ],
  );

  const ListHeader = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.text }]}>Offers</Text>
          {summary ? (
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              {summary.total} available ({summary.direct} direct, {summary.broadcast} open)
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={openCalendar}
          style={[styles.calendarButton, { borderColor: cardBorder, backgroundColor: palette.card }]}
        >
          <FontAwesome name="calendar" size={14} color={palette.text} />
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === 'all'
              ? offers.length
              : tab.key === 'direct'
                ? offers.filter((o) => o.isDirectOffer).length
                : offers.filter((o) => !o.isDirectOffer).length;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? palette.tint : 'transparent',
                  backgroundColor: isActive ? `${palette.tint}15` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tabLabel, { color: isActive ? palette.tint : palette.muted }]}>
                {tab.label}
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: isActive ? palette.tint : palette.border }]}>
                <Text style={[styles.tabBadgeText, { color: isActive ? '#FFFFFF' : palette.muted }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Sort Toggle */}
      <Pressable onPress={() => setShowSort((prev) => !prev)} style={styles.sortToggle}>
        <FontAwesome name="sort" size={12} color={palette.muted} />
        <Text style={[styles.sortToggleText, { color: palette.muted }]}>
          {SORT_OPTIONS.find((s) => s.key === sortKey)?.label ?? 'Sort'}
        </Text>
        <FontAwesome name={showSort ? 'chevron-up' : 'chevron-down'} size={10} color={palette.muted} />
      </Pressable>

      {/* Sort Options */}
      {showSort ? (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => {
            const isActive = sortKey === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setSortKey(option.key);
                  setShowSort(false);
                }}
                style={[
                  styles.sortChip,
                  {
                    borderColor: isActive ? palette.tint : cardBorder,
                    backgroundColor: isActive ? palette.tint : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.sortChipText, { color: isActive ? '#FFFFFF' : palette.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Error */}
      {error ? (
        <View style={[styles.errorCard, { borderColor: palette.danger }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.muted }]}>Loading offers...</Text>
        </View>
      ) : null}

      {/* Profile Status */}
      {!loading && profileStatus && profileStatus !== 'CERTIFIED' ? (
        <View style={[styles.statusCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <FontAwesome name="clock-o" size={16} color={palette.muted} />
          <View style={styles.statusCardText}>
            <Text style={[styles.statusTitle, { color: palette.text }]}>Profile pending</Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              Your profile is {profileStatus.toLowerCase().replace('_', ' ')}. Offers unlock once
              certification is complete.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Empty State */}
      {!loading && profileStatus === 'CERTIFIED' && filteredOffers.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <FontAwesome name="inbox" size={24} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No offers</Text>
          <Text style={[styles.emptyBody, { color: palette.muted }]}>
            {activeTab === 'all'
              ? 'Set your availability to receive offers.'
              : activeTab === 'direct'
                ? 'No direct offers at this time.'
                : 'No open board offers at this time.'}
          </Text>
          <Pressable onPress={() => router.push('/(app)/(scooper)/availability')}>
            <Text style={[styles.emptyLink, { color: palette.tint }]}>Update availability</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <Screen>
      <FlatList
        data={filteredOffers}
        keyExtractor={(item) => item.id}
        renderItem={renderOffer}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <ScooperCalendarModal
        visible={calendarOpen}
        onClose={closeCalendar}
        visits={calendarVisits}
        compareVisits={calendarCompareVisits}
        compareLabel="Added"
        mode={calendarCompareVisits.length > 0 ? 'compare_offer' : 'view_schedule'}
        loading={calendarLoading}
        error={calendarError}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 40,
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
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
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  statusCardText: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyLink: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  separator: {
    height: 10,
  },
});
