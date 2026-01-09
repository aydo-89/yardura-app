import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import type {
  ScooperOngoingCustomer,
  ScooperOngoingCustomerSummary,
  ScooperRoutePlan,
  ScooperRouteVisit,
} from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';
import Button from '@/components/ui/Button';
import ScooperCalendarModal from '@/components/scooper/ScooperCalendarModal';

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  TWICE_WEEKLY: 'Twice weekly',
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  ONE_TIME: 'One-time',
};

const parseDateValue = (value: string) => {
  return parseDateInput(value);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Next visit not scheduled';
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return 'Next visit not scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatWindowLabel = (
  preferredTimeWindow?: string | null,
  preferredTimeWindowSlug?: string | null,
) => {
  if (preferredTimeWindow) return preferredTimeWindow;
  const slug = preferredTimeWindowSlug?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'Morning';
  if (slug.includes('afternoon')) return 'Afternoon';
  if (slug.includes('evening')) return 'Evening';
  if (slug.includes('flex')) return 'Flexible';
  return null;
};

export default function ScooperOngoingCustomers() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle = colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const [customers, setCustomers] = useState<ScooperOngoingCustomer[]>([]);
  const [summary, setSummary] = useState<ScooperOngoingCustomerSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarVisits, setCalendarVisits] = useState<ScooperRouteVisit[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [compareJobId, setCompareJobId] = useState<string | null>(null);
  const [compareCustomerName, setCompareCustomerName] = useState<string | null>(null);
  const [calendarTitle, setCalendarTitle] = useState<string | null>(null);
  const [calendarSubtitle, setCalendarSubtitle] = useState<string | null>(null);
  const [releasingJobId, setReleasingJobId] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ customers: ScooperOngoingCustomer[]; summary?: ScooperOngoingCustomerSummary }>(
        '/api/mobile/scooper/ongoing-customers',
        { token: session.token },
      );
      setCustomers(data.customers ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load ongoing customers.';
      setError(message);
    } finally {
      setLoading(false);
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCustomers(), loadCalendarVisits()]);
    setRefreshing(false);
  }, [loadCustomers, loadCalendarVisits]);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers]),
  );

  const compareVisits = useMemo(() => {
    if (!compareJobId) return [];
    return calendarVisits.filter((visit) => visit.job?.id === compareJobId);
  }, [calendarVisits, compareJobId]);

  const calendarCompareLabel = compareCustomerName
    ? `${compareCustomerName} highlighted`
    : 'This customer';

  const openCompareCalendar = (entry: ScooperOngoingCustomer) => {
    setCompareJobId(entry.jobId);
    setCompareCustomerName(entry.customer?.name ?? 'This customer');
    setCalendarTitle('Compare schedule');
    setCalendarSubtitle('Highlighted stops belong to this recurring customer.');
    setCalendarOpen(true);
    loadCalendarVisits();
  };

  const closeCalendar = () => setCalendarOpen(false);

  const releaseOngoingCustomer = async (entry: ScooperOngoingCustomer) => {
    if (!session?.token) return;
    setReleasingJobId(entry.jobId);
    setError(null);
    try {
      await apiRequest(`/api/field-tech/jobs/${entry.jobId}/handoff`, {
        method: 'POST',
        token: session.token,
      });
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof ApiError && err.details && typeof err.details === 'object'
          ? ('message' in err.details && typeof err.details.message === 'string'
              ? err.details.message
              : err.message)
          : err instanceof Error
            ? err.message
            : 'Unable to release ongoing customer.';
      setError(message);
    } finally {
      setReleasingJobId(null);
    }
  };

  const activeCustomers = useMemo(
    () => customers.filter((entry) => Boolean(entry.customer)),
    [customers],
  );
  const capacityPct = summary?.limit
    ? Math.min(100, Math.round((summary.currentCount / summary.limit) * 100))
    : 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.tint}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={14} color={palette.tint} />
            <Text style={[styles.backText, { color: palette.tint }]}>Jobs</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Ongoing Customers</Text>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading customers...</Text>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Capacity Hero */}
        {summary ? (
          <View style={[styles.heroCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name="users" size={18} color={palette.tint} />
              </View>
              <View style={styles.heroText}>
                <Text style={[styles.heroKicker, { color: palette.muted }]}>{summary.tier.name} Tier</Text>
                <Text style={[styles.heroTitle, { color: palette.text }]}>
                  {summary.currentCount} of {summary.limit}
                </Text>
              </View>
              <View style={[styles.capacityBadge, { backgroundColor: `${palette.tint}15` }]}>
                <Text style={[styles.capacityBadgeText, { color: palette.tint }]}>{capacityPct}%</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${capacityPct}%`, backgroundColor: capacityPct >= 90 ? Colors.brand.coral : palette.tint },
                ]}
              />
            </View>
            {summary.nextTier ? (
              <View style={styles.nextTierRow}>
                <FontAwesome name="arrow-up" size={10} color={Colors.brand.mint} />
                <Text style={[styles.nextTierText, { color: palette.muted }]}>
                  {summary.nextTier.pointsToNext ?? 0} pts to {summary.nextTier.name} ({summary.nextTier.limit} limit)
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Empty State */}
        {!loading && !error && activeCustomers.length === 0 ? (
          <View style={[styles.emptyCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
              <FontAwesome name="users" size={24} color={palette.muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No ongoing customers</Text>
            <Text style={[styles.emptyBody, { color: palette.muted }]}>
              Accept an ongoing offer to build your recurring schedule.
            </Text>
            <Button
              title="View offers"
              onPress={() => router.push('/(app)/(scooper)/offers')}
              variant="primary"
            />
          </View>
        ) : null}

        {/* Customer List */}
        {activeCustomers.length > 0 ? (
          <View style={styles.customerList}>
            {activeCustomers.map((entry) => {
              if (!entry.customer) return null;
              const frequencyLabel = FREQUENCY_LABELS[entry.frequency] ?? entry.frequency;
              const nextVisitLabel = formatDateLabel(entry.nextVisitAt);
              const windowLabel = formatWindowLabel(
                entry.preferredTimeWindow,
                entry.preferredTimeWindowSlug,
              );
              const dogCount = entry.customer.dogs?.length ?? 0;
              const dogNames = entry.customer.dogs.map((dog) => dog.name).filter(Boolean);
              const addressLine = `${entry.customer.addressLine1}, ${entry.customer.city}`;
              const isReleasing = releasingJobId === entry.jobId;
              const isExpanded = expandedId === entry.jobId;

              return (
                <Pressable
                  key={entry.jobId}
                  onPress={() => setExpandedId(isExpanded ? null : entry.jobId)}
                  style={[styles.customerCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}
                >
                  {/* Compact Header */}
                  <View style={styles.customerHeader}>
                    <View style={[styles.customerAvatar, { backgroundColor: `${palette.tint}15` }]}>
                      <FontAwesome name="user" size={14} color={palette.tint} />
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={[styles.customerName, { color: palette.text }]} numberOfLines={1}>
                        {entry.customer.name}
                      </Text>
                      <View style={styles.customerMeta}>
                        <Text style={[styles.customerMetaText, { color: palette.muted }]}>
                          {frequencyLabel}
                        </Text>
                        {dogCount > 0 ? (
                          <>
                            <View style={[styles.metaDot, { backgroundColor: palette.border }]} />
                            <FontAwesome name="paw" size={10} color={palette.muted} />
                            <Text style={[styles.customerMetaText, { color: palette.muted }]}>{dogCount}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.customerRight}>
                      <View style={[styles.nextBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
                        <Text style={[styles.nextBadgeText, { color: Colors.brand.mint }]}>{nextVisitLabel}</Text>
                      </View>
                      <FontAwesome
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={10}
                        color={palette.muted}
                      />
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {isExpanded ? (
                    <View style={styles.customerExpanded}>
                      <View style={[styles.customerDivider, { backgroundColor: palette.border }]} />
                      <View style={styles.detailRow}>
                        <View style={[styles.detailIcon, { backgroundColor: `${palette.muted}15` }]}>
                          <FontAwesome name="map-marker" size={12} color={palette.muted} />
                        </View>
                        <Text style={[styles.detailText, { color: palette.text }]}>{addressLine}</Text>
                      </View>
                      {windowLabel ? (
                        <View style={styles.detailRow}>
                          <View style={[styles.detailIcon, { backgroundColor: `${palette.muted}15` }]}>
                            <FontAwesome name="clock-o" size={12} color={palette.muted} />
                          </View>
                          <Text style={[styles.detailText, { color: palette.text }]}>{windowLabel} window</Text>
                        </View>
                      ) : null}
                      {dogNames.length > 0 ? (
                        <View style={styles.detailRow}>
                          <View style={[styles.detailIcon, { backgroundColor: `${palette.muted}15` }]}>
                            <FontAwesome name="paw" size={12} color={palette.muted} />
                          </View>
                          <View style={styles.dogTags}>
                            {dogNames.map((name) => (
                              <View key={name} style={[styles.dogTag, { backgroundColor: `${palette.tint}10`, borderColor: cardBorder }]}>
                                <Text style={[styles.dogTagText, { color: palette.text }]}>{name}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.customerActions}>
                        <Pressable
                          onPress={() => openCompareCalendar(entry)}
                          style={[styles.inlineAction, { backgroundColor: palette.card, borderWidth: 1, borderColor: cardBorder }]}
                        >
                          <FontAwesome name="calendar" size={12} color={palette.text} />
                          <Text style={[styles.inlineActionText, { color: palette.text }]}>Schedule</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Alert.alert(
                              'Release customer?',
                              'This removes future visits and returns them to offers.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Release', style: 'destructive', onPress: () => void releaseOngoingCustomer(entry) },
                              ],
                            )
                          }
                          disabled={isReleasing}
                          style={[styles.inlineAction, { backgroundColor: `${palette.danger}10`, borderWidth: 1, borderColor: palette.danger }]}
                        >
                          <FontAwesome name="times" size={12} color={palette.danger} />
                          <Text style={[styles.inlineActionText, { color: palette.danger }]}>
                            {isReleasing ? 'Releasing...' : 'Release'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      <ScooperCalendarModal
        visible={calendarOpen}
        onClose={closeCalendar}
        visits={calendarVisits}
        compareVisits={compareVisits}
        compareLabel={calendarCompareLabel}
        compareColor={Colors.brand.coral}
        mode="view_customer"
        title={calendarTitle ?? undefined}
        subtitle={calendarSubtitle ?? undefined}
        loading={calendarLoading}
        error={calendarError}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    gap: 4,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  capacityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  capacityBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  nextTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextTierText: {
    fontSize: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  customerList: {
    gap: 10,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfo: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerMetaText: {
    fontSize: 12,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  customerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  nextBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  nextBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerExpanded: {
    marginTop: 12,
    gap: 10,
  },
  customerDivider: {
    height: 1,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  dogTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  dogTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dogTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inlineAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: '600',
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
  // Legacy styles kept for compatibility
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
  },
});
