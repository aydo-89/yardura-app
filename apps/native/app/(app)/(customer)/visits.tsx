import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/config';
import { getContactCopy } from '@/lib/contact';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import { parseDateInput } from '@/lib/dates';
import type { CustomerSummary, CustomerVisit } from '@/lib/api/types';

type AvailabilityDay = {
  date: string;
  available: boolean;
  totalCapacity?: number;
  bookedCount?: number;
  reason?: string | null;
};

type ArrivalWindow = 'morning' | 'afternoon' | 'flexible';

type WindowOption = {
  id: ArrivalWindow;
  label: string;
  window: string;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toVisitKey = (value: string) => toDateKey(parseDateInput(value));

const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};

const formatWindowLabel = (visit: CustomerVisit) => {
  if (visit.preferredTimeWindow) {
    const normalized = visit.preferredTimeWindow.toLowerCase();
    if (normalized.includes('morning')) return 'Morning window';
    if (normalized.includes('afternoon')) return 'Afternoon window';
    if (normalized.includes('flex')) return 'Flexible window';
    return visit.preferredTimeWindow;
  }
  if (visit.preferredTimeWindowSlug) {
    const slug = visit.preferredTimeWindowSlug.replace(/_/g, '-').toLowerCase();
    if (slug.includes('morning')) return 'Morning window';
    if (slug.includes('afternoon')) return 'Afternoon window';
    return 'Flexible window';
  }
  return null;
};

const formatCurrencyFromCents = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);

const TIP_OPTIONS = [
  { label: 'No tip', value: 0 },
  { label: '$2', value: 200 },
  { label: '$5', value: 500 },
  { label: '$10', value: 1000 },
  { label: '$15', value: 1500 },
] as const;
const MAX_TIP_CENTS = 5000;

export default function CustomerVisits() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [customerZip, setCustomerZip] = useState<string | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<CustomerVisit | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<ArrivalWindow>('flexible');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingVisit, setRatingVisit] = useState<CustomerVisit | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingTipCents, setRatingTipCents] = useState(0);
  const [ratingCustomTip, setRatingCustomTip] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const contactCopy = useMemo(() => getContactCopy(summary?.contact), [summary?.contact]);

  const windowOptions = useMemo<WindowOption[]>(
    () => [
      { id: 'morning', label: 'Morning', window: '8:00 - 12:00' },
      { id: 'afternoon', label: 'Afternoon', window: '12:00 - 4:00' },
      { id: 'flexible', label: 'Flexible', window: contactCopy.etaLabel },
    ],
    [contactCopy.etaLabel],
  );

  const maybeRedirectToSetup = useCallback((err: unknown) => {
    if (isCustomerSetupRequired(err)) {
      router.replace('/(app)/(customer)/setup');
      return true;
    }
    return false;
  }, []);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [visitsPayload, summaryPayload] = await Promise.all([
        apiRequest<{ visits: CustomerVisit[] }>('/api/mobile/customer/visits?limit=20', {
          token: session.token,
        }),
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', { token: session.token }),
      ]);
      setVisits(visitsPayload.visits ?? []);
      setSummary(summaryPayload);
      setCustomerZip(summaryPayload.customer?.zip ?? null);
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to load visits.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [maybeRedirectToSetup, session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const todayKey = toDateKey(new Date());
  const upcomingVisits = useMemo(() => {
    return visits
      .filter(
        (visit) =>
          visit.status === 'SCHEDULED' &&
          toVisitKey(visit.scheduledDate) >= todayKey,
      )
      .sort(
        (a, b) =>
          parseDateInput(a.scheduledDate).getTime() -
          parseDateInput(b.scheduledDate).getTime(),
      );
  }, [todayKey, visits]);

  const pastVisits = useMemo(() => {
    return visits
      .filter((visit) => toVisitKey(visit.scheduledDate) < todayKey)
      .sort(
        (a, b) =>
          parseDateInput(b.scheduledDate).getTime() -
          parseDateInput(a.scheduledDate).getTime(),
      );
  }, [todayKey, visits]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    availability.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [availability]);

  const calendarDays = useMemo(() => {
    if (availability.length === 0) return [] as Date[];
    const sorted = [...availability]
      .map((entry) => entry.date)
      .sort();
    const first = parseDateInput(sorted[0]);
    const last = parseDateInput(sorted[sorted.length - 1]);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [availability]);

  const openReschedule = (visit: CustomerVisit) => {
    setActiveVisit(visit);
    setRescheduleOpen(true);
    setActionError(null);
  };

  const openSkip = (visit: CustomerVisit) => {
    setActiveVisit(visit);
    setSkipOpen(true);
    setActionError(null);
  };

  const openRating = (visit: CustomerVisit) => {
    setRatingVisit(visit);
    setRatingScore(visit.rating?.score ?? 0);
    setRatingComment(visit.rating?.comment ?? '');
    setRatingTipCents(0);
    setRatingCustomTip('');
    setRatingError(null);
    setRatingOpen(true);
  };

  const closeRating = () => {
    setRatingOpen(false);
    setRatingVisit(null);
    setRatingScore(0);
    setRatingComment('');
    setRatingTipCents(0);
    setRatingCustomTip('');
    setRatingError(null);
  };

  const handleSelectTip = (value: number) => {
    setRatingTipCents(value);
    setRatingCustomTip('');
  };

  const handleCustomTipChange = (value: string) => {
    setRatingCustomTip(value);
    const numeric = Number(value.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric)) {
      setRatingTipCents(0);
      return;
    }
    const cents = Math.min(Math.round(numeric * 100), MAX_TIP_CENTS);
    setRatingTipCents(cents);
  };

  const loadAvailability = useCallback(async () => {
    if (!customerZip) {
      setAvailabilityError('Add a service address to unlock rescheduling.');
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const data = await apiRequest<{ availability: AvailabilityDay[] }>(
        `/api/schedule/availability?zipCode=${encodeURIComponent(customerZip)}&days=30`,
      );
      const list = data.availability ?? [];
      setAvailability(list);
      const firstAvailable = list.find((entry) => entry.available);
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date);
      }
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to load availability.';
      setAvailabilityError(message);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [customerZip, maybeRedirectToSetup]);

  const handleReschedule = async () => {
    if (!activeVisit) return;
    if (!selectedDate) {
      setActionError('Select a new date to reschedule.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await apiRequest('/api/schedule/request', {
        method: 'POST',
        token: session?.token ?? undefined,
        body: {
          visitId: activeVisit.id,
          action: 'reschedule',
          nextVisitAt: selectedDate,
          preferredWindow: selectedWindow,
        },
      });
      setRescheduleOpen(false);
      await loadData();
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to reschedule right now.';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!activeVisit) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiRequest('/api/schedule/request', {
        method: 'POST',
        token: session?.token ?? undefined,
        body: {
          visitId: activeVisit.id,
          action: 'skip',
        },
      });
      setSkipOpen(false);
      await loadData();
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to skip right now.';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingVisit || ratingScore <= 0) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      await apiRequest(`/api/mobile/customer/visits/${ratingVisit.id}/rating`, {
        method: 'POST',
        token: session?.token ?? undefined,
        body: {
          score: ratingScore,
          comment: ratingComment.trim() ? ratingComment.trim() : null,
          tipCents: ratingTipCents,
        },
      });
      closeRating();
      await loadData();
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to submit rating.';
      setRatingError(message);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const primaryVisit = upcomingVisits[0] ?? null;
  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;
  const access = summary?.wellnessAccess ?? null;
  const hasService = access?.hasActiveService ?? false;
  const showServiceTimeline = hasService || visits.length > 0;
  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;
  const planLabel = access?.tier === 'PREMIUM' ? 'Premium wellness' : 'Free wellness';
  const scansLabel = access?.tier === 'PREMIUM' ? 'Unlimited' : `${scansRemaining ?? 0}`;
  const chatsLabel = access?.tier === 'PREMIUM' ? 'Unlimited' : `${chatsRemaining ?? 0}`;
  const ratingScooper = ratingVisit?.scooper ?? null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View
            style={[
              styles.heroGlow,
              { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.25 : 0.4 },
            ]}
          />
          <View
            style={[
              styles.heroGlowSecondary,
              { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.2 : 0.3 },
            ]}
          />
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Visits
          </Text>
          <Text style={styles.heroTitleText}>Service timeline</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            {showServiceTimeline
              ? 'Upcoming appointments and recent service history.'
              : 'Wellness plans, scooping options, and care coverage.'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading visits...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : !showServiceTimeline ? (
          <View style={styles.section}>
            <View style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.planHeader}>
                <View style={styles.planHeaderCopy}>
                  <Text style={[styles.planTitle, { color: palette.text }]}>{planLabel}</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {access?.tier === 'PREMIUM'
                      ? 'Unlimited scans + AI chat'
                      : '5 scans + 12 chats per month'}
                  </Text>
                </View>
                <View style={[styles.planBadge, { backgroundColor: palette.tint }]}>
                  <Text style={styles.planBadgeText}>
                    {access?.tier === 'PREMIUM' ? 'Premium' : 'Free'}
                  </Text>
                </View>
              </View>
              <View style={styles.planStats}>
                <View style={[styles.planStat, { borderColor: palette.border }]}>
                  <Text style={[styles.planStatLabel, { color: palette.muted }]}>Scans left</Text>
                  <Text style={[styles.planStatValue, { color: palette.text }]}>{scansLabel}</Text>
                </View>
                <View style={[styles.planStat, { borderColor: palette.border }]}>
                  <Text style={[styles.planStatLabel, { color: palette.muted }]}>Chat left</Text>
                  <Text style={[styles.planStatValue, { color: palette.text }]}>{chatsLabel}</Text>
                </View>
              </View>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Sign up for scooping by 4/30/26 to unlock a free year of premium insights.
              </Text>
              <Button
                title={access?.tier === 'PREMIUM' ? 'Manage wellness' : 'Upgrade wellness'}
                onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as any)}
              />
            </View>

            <View style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.planHeader}>
                <View style={styles.planHeaderCopy}>
                  <Text style={[styles.planTitle, { color: palette.text }]}>Scooping service</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Pro-verified cleanup with auto-capture wellness timelines.
                  </Text>
                </View>
                <FontAwesome name="paw" size={20} color={palette.tint} />
              </View>
              <View style={styles.planList}>
                <Text style={[styles.planBullet, { color: palette.muted }]}>• Auto-capture stool samples</Text>
                <Text style={[styles.planBullet, { color: palette.muted }]}>• Consistent visit cadence</Text>
                <Text style={[styles.planBullet, { color: palette.muted }]}>• Vet-ready reporting</Text>
              </View>
              <Button title="Get scooping quote" onPress={() => Linking.openURL(`${API_BASE_URL}/quote`)} />
            </View>
          </View>
        ) : primaryVisit ? (
          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.heroTitle, { color: palette.text }]}>Next visit</Text>
            <Text style={[styles.heroDate, { color: palette.text }]}>
              {formatDate(primaryVisit.scheduledDate)}
            </Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              {primaryVisit.serviceType?.toLowerCase() ?? 'service'} • {primaryVisit.status.toLowerCase()}
            </Text>
            {formatWindowLabel(primaryVisit) ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {formatWindowLabel(primaryVisit)}
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              <Button title="Reschedule" onPress={() => openReschedule(primaryVisit)} />
              <Button title="Skip" onPress={() => openSkip(primaryVisit)} variant="secondary" />
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>No visits yet</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              Book scooping to unlock pro-verified wellness capture.
            </Text>
            <Button title="Start scooping service" onPress={() => Linking.openURL(`${API_BASE_URL}/quote`)} />
          </View>
        )}

        {hasService ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Service plan & add-ons</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Update dogs, yard areas, and service add-ons for future visits.
            </Text>
            <Button title="Manage plan" onPress={() => router.push('/(app)/(customer)/service-plan' as any)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/(app)/(customer)/wellness-poop-map' as any)}
            style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.inlineRow}>
              <FontAwesome name="map-marker" size={16} color={palette.tint} />
              <Text style={[styles.cardTitle, { color: palette.text }]}>Poop map</Text>
            </View>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              See yard hotspots to focus scooping and track patterns over time.
            </Text>
          </Pressable>
        </View>

        {showServiceTimeline && upcomingVisits.length > 1 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Upcoming</Text>
            {upcomingVisits.slice(1).map((visit) => (
              <View
                key={visit.id}
                style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {formatDate(visit.scheduledDate)}
                </Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  {visit.serviceType?.toLowerCase() ?? 'service'} • {visit.status.toLowerCase()}
                </Text>
                {formatWindowLabel(visit) ? (
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {formatWindowLabel(visit)}
                  </Text>
                ) : null}
                <View style={styles.visitActions}>
                  <Pressable
                    style={[styles.visitActionChip, { borderColor: palette.border }]}
                    onPress={() => openReschedule(visit)}
                  >
                    <Text style={[styles.visitActionText, { color: palette.text }]}>
                      Reschedule
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.visitActionChip, { borderColor: palette.border }]}
                    onPress={() => openSkip(visit)}
                  >
                    <Text style={[styles.visitActionText, { color: palette.danger }]}>
                      Skip
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {showServiceTimeline && pastVisits.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent visits</Text>
            {pastVisits.slice(0, 6).map((visit) => (
              <View
                key={visit.id}
                style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {formatDate(visit.scheduledDate)}
                </Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  {visit.status.toLowerCase()} • {visit.serviceType?.toLowerCase() ?? 'service'}
                </Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Samples: {visit.insightscoopCount} • Flagged: {visit.flaggedMediaCount}
                </Text>
                {visit.insight?.wellnessFlag ? (
                  <Text style={[styles.cardBody, { color: palette.danger }]}
                  >
                    Wellness alert: {visit.insight.flagReason ?? 'Needs review'}
                  </Text>
                ) : null}
                {visit.rating ? (
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Rated {visit.rating.score}/5
                  </Text>
                ) : visit.status === 'COMPLETED' ? (
                  <View style={styles.ratingAction}>
                    <Button title="Rate visit" onPress={() => openRating(visit)} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={rescheduleOpen}
        animationType="slide"
        transparent
        onShow={() => {
          if (!availability.length) {
            loadAvailability();
          }
        }}
        onRequestClose={() => setRescheduleOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Reschedule visit</Text>
              <Pressable onPress={() => setRescheduleOpen(false)}>
                <Text style={[styles.modalClose, { color: palette.muted }]}>Close</Text>
              </Pressable>
            </View>

            {availabilityLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>Loading availability...</Text>
              </View>
            ) : availabilityError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{availabilityError}</Text>
            ) : (
              <>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Select a new date and preferred window. {contactCopy.confirmLabel}
                </Text>
                <View style={styles.calendarHeader}>
                  {DAY_LABELS.map((label) => (
                    <Text key={label} style={[styles.calendarLabel, { color: palette.muted }]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date) => {
                    const key = toDateKey(date);
                    const entry = availabilityMap.get(key);
                    const available = entry?.available ?? false;
                    const isSelected = selectedDate === key;
                    const isToday = key === todayKey;
                    return (
                      <Pressable
                        key={key}
                        disabled={!available}
                        onPress={() => available && setSelectedDate(key)}
                        style={({ pressed }) => [
                          styles.calendarCell,
                          {
                            borderColor: isSelected
                              ? palette.tint
                              : isToday
                                ? palette.accent
                                : palette.border,
                            backgroundColor: isSelected
                              ? palette.tint
                              : available
                                ? palette.background
                                : palette.card,
                            opacity: available ? 1 : 0.4,
                          },
                          pressed && available ? { opacity: 0.7 } : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#FFFFFF' : palette.text,
                            fontWeight: '600',
                          }}
                        >
                          {date.getDate()}
                        </Text>
                        {isToday ? (
                          <View style={[styles.todayDot, { backgroundColor: palette.accent }]} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: palette.text }]}>Preferred window</Text>
                <View style={styles.rowWrap}>
                  {windowOptions.map((option) => (
                    <ChoiceChip
                      key={option.id}
                      label={option.label}
                      selected={selectedWindow === option.id}
                      onPress={() => setSelectedWindow(option.id)}
                    />
                  ))}
                </View>
                {selectedDate ? (
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Selected: {formatDate(selectedDate)} • {windowOptions.find((option) => option.id === selectedWindow)?.window}
                  </Text>
                ) : null}
              </>
            )}

            {actionError ? (
              <Text style={[styles.error, { color: palette.danger }]}>{actionError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                title={actionLoading ? 'Submitting...' : 'Submit request'}
                onPress={handleReschedule}
                disabled={actionLoading || !selectedDate}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={skipOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSkipOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>Skip this visit?</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              We will remove this visit from the schedule. You can reschedule anytime.
            </Text>
            {actionError ? (
              <Text style={[styles.error, { color: palette.danger }]}>{actionError}</Text>
            ) : null}
            <View style={styles.modalActionsRow}>
              <Button title="Keep visit" onPress={() => setSkipOpen(false)} variant="secondary" />
              <Button
                title={actionLoading ? 'Skipping...' : 'Skip visit'}
                onPress={handleSkip}
                disabled={actionLoading}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={ratingOpen}
        animationType="fade"
        transparent
        onRequestClose={closeRating}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Rate this visit</Text>
              <Pressable onPress={closeRating}>
                <Text style={[styles.modalClose, { color: palette.muted }]}>Close</Text>
              </Pressable>
            </View>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Share feedback and earn care credits for completed visits.
            </Text>
            {ratingScooper ? (
              <View style={styles.scooperRow}>
                {ratingScooper.photoUrl ? (
                  <Image source={{ uri: ratingScooper.photoUrl }} style={styles.scooperAvatar} />
                ) : (
                  <View style={[styles.scooperAvatar, { backgroundColor: palette.border }]}>
                    <Text style={[styles.scooperInitials, { color: palette.text }]}>
                      {ratingScooper.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.scooperMeta}>
                  <Text style={[styles.scooperName, { color: palette.text }]}>
                    {ratingScooper.name}
                  </Text>
                  <Text style={[styles.scooperSubtext, { color: palette.muted }]}>
                    {ratingScooper.avgRating
                      ? `${ratingScooper.avgRating.toFixed(1)} ★ (${ratingScooper.ratingCount ?? 0} ratings)`
                      : 'New scooper'}
                  </Text>
                  <Text style={[styles.scooperSubtext, { color: palette.muted }]}>
                    {ratingScooper.completedVisits} visits completed
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.ratingStars}>
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                const isActive = ratingScore >= value;
                return (
                  <Pressable key={value} onPress={() => setRatingScore(value)} style={styles.starButton}>
                    <Text style={[styles.starText, { color: isActive ? palette.tint : palette.muted }]}>★</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[
                styles.ratingInput,
                { borderColor: palette.border, color: palette.text },
              ]}
              placeholder="Optional note"
              placeholderTextColor={palette.muted}
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={3}
            />
            <Text style={[styles.inputLabel, { color: palette.text }]}>
              Add a tip (optional)
            </Text>
            <View style={styles.rowWrap}>
              {TIP_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  selected={ratingTipCents === option.value && ratingCustomTip.length === 0}
                  onPress={() => handleSelectTip(option.value)}
                />
              ))}
            </View>
            <View style={styles.tipInputRow}>
              <TextInput
                style={[
                  styles.tipInput,
                  { borderColor: palette.border, color: palette.text },
                ]}
                placeholder="$ Custom amount"
                placeholderTextColor={palette.muted}
                value={ratingCustomTip}
                onChangeText={handleCustomTipChange}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.tipPreview, { color: palette.muted }]}>
                {ratingTipCents > 0 ? formatCurrencyFromCents(ratingTipCents) : '—'}
              </Text>
            </View>
            <Text style={[styles.tipHelper, { color: palette.muted }]}>
              Tips go 100% to your scooper.
            </Text>
            {ratingError ? (
              <Text style={[styles.error, { color: palette.danger }]}>{ratingError}</Text>
            ) : null}
            <View style={styles.modalActionsRow}>
              <Button title="Cancel" onPress={closeRating} variant="secondary" />
              <Button
                title={ratingSubmitting ? 'Submitting...' : 'Submit rating'}
                onPress={handleSubmitRating}
                disabled={ratingSubmitting || ratingScore <= 0}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -80,
    left: -40,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitleText: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    marginBottom: 14,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planStats: {
    flexDirection: 'row',
    gap: 12,
  },
  planStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  planStatLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planStatValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  planList: {
    gap: 6,
  },
  planBullet: {
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 18,
    gap: 6,
  },
  heroTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroDate: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  heroActions: {
    marginTop: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
  },
  visitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  visitActionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  visitActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingAction: {
    marginTop: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 6,
  },
  calendarLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  error: {
    fontSize: 13,
  },
  modalActions: {
    marginTop: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  starButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  starText: {
    fontSize: 20,
    fontWeight: '700',
  },
  ratingInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    textAlignVertical: 'top',
    minHeight: 70,
    fontSize: 14,
  },
  scooperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  scooperAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scooperInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  scooperMeta: {
    flex: 1,
    gap: 2,
  },
  scooperName: {
    fontSize: 15,
    fontWeight: '700',
  },
  scooperSubtext: {
    fontSize: 12,
  },
  tipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tipInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  tipPreview: {
    fontSize: 12,
    fontWeight: '600',
  },
  tipHelper: {
    fontSize: 12,
  },
});
