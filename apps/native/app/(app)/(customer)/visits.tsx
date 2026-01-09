import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
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
};

type ArrivalWindow = 'morning' | 'afternoon' | 'flexible';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toVisitKey = (value: string) => toDateKey(parseDateInput(value));

const formatDate = (value?: string | null, short = false) => {
  if (!value) return 'Not scheduled';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: short ? undefined : 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatRelative = (value?: string | null) => {
  if (!value) return null;
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  return null;
};

const TIP_OPTIONS = [
  { label: 'No tip', value: 0 },
  { label: '$2', value: 200 },
  { label: '$5', value: 500 },
  { label: '$10', value: 1000 },
] as const;

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function CustomerVisits() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [customerZip, setCustomerZip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sheet states
  const [rescheduleSheet, setRescheduleSheet] = useState(false);
  const [skipSheet, setSkipSheet] = useState(false);
  const [ratingSheet, setRatingSheet] = useState(false);
  const [activeVisit, setActiveVisit] = useState<CustomerVisit | null>(null);

  // Reschedule state
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<ArrivalWindow>('flexible');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Rating state
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingTip, setRatingTip] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const contactCopy = useMemo(() => getContactCopy(summary?.contact), [summary?.contact]);

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
      setError(err instanceof Error ? err.message : 'Unable to load visits.');
    } finally {
      setLoading(false);
    }
  }, [maybeRedirectToSetup, session?.token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const todayKey = toDateKey(new Date());

  const upcomingVisits = useMemo(() => {
    return visits
      .filter((v) => v.status === 'SCHEDULED' && toVisitKey(v.scheduledDate) >= todayKey)
      .sort((a, b) => parseDateInput(a.scheduledDate).getTime() - parseDateInput(b.scheduledDate).getTime());
  }, [todayKey, visits]);

  const pastVisits = useMemo(() => {
    return visits
      .filter((v) => toVisitKey(v.scheduledDate) < todayKey)
      .sort((a, b) => parseDateInput(b.scheduledDate).getTime() - parseDateInput(a.scheduledDate).getTime());
  }, [todayKey, visits]);

  const unratedVisits = useMemo(() => {
    return pastVisits.filter((v) => v.status === 'COMPLETED' && !v.rating);
  }, [pastVisits]);

  const primaryVisit = upcomingVisits[0] ?? null;
  const hasService = summary?.wellnessAccess?.hasActiveService ?? false;
  const showTimeline = hasService || visits.length > 0;

  // Calendar data for reschedule
  const availabilityMap = useMemo(() => new Map(availability.map((a) => [a.date, a])), [availability]);
  const calendarDays = useMemo(() => {
    if (availability.length === 0) return [];
    const sorted = [...availability].map((e) => e.date).sort();
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

  const loadAvailability = useCallback(async () => {
    if (!customerZip) return;
    setAvailabilityLoading(true);
    setActionError(null);
    try {
      const data = await apiRequest<{ availability: AvailabilityDay[] }>(
        `/api/schedule/availability?zipCode=${encodeURIComponent(customerZip)}&days=30`,
      );
      setAvailability(data.availability ?? []);
      const first = data.availability?.find((a) => a.available);
      if (first) setSelectedDate(first.date);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [customerZip]);

  const openReschedule = (visit: CustomerVisit) => {
    setActiveVisit(visit);
    setActionError(null);
    setRescheduleSheet(true);
    if (availability.length === 0) loadAvailability();
  };

  const openSkip = (visit: CustomerVisit) => {
    setActiveVisit(visit);
    setActionError(null);
    setSkipSheet(true);
  };

  const openRating = (visit: CustomerVisit) => {
    setActiveVisit(visit);
    setRatingScore(visit.rating?.score ?? 0);
    setRatingComment('');
    setRatingTip(0);
    setRatingSheet(true);
  };

  const handleReschedule = async () => {
    if (!activeVisit || !selectedDate) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiRequest('/api/schedule/request', {
        method: 'POST',
        token: session?.token,
        body: { visitId: activeVisit.id, action: 'reschedule', nextVisitAt: selectedDate, preferredWindow: selectedWindow },
      });
      setRescheduleSheet(false);
      loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to reschedule.');
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
        token: session?.token,
        body: { visitId: activeVisit.id, action: 'skip' },
      });
      setSkipSheet(false);
      loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to skip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!activeVisit || ratingScore <= 0) return;
    setRatingSubmitting(true);
    try {
      await apiRequest(`/api/mobile/customer/visits/${activeVisit.id}/rating`, {
        method: 'POST',
        token: session?.token,
        body: { score: ratingScore, comment: ratingComment.trim() || null, tipCents: ratingTip },
      });
      setRatingSheet(false);
      loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit rating.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const heroBackground = colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Compact hero */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View style={[styles.heroGlow, { backgroundColor: palette.tint, opacity: 0.25 }]} />
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>Visits</Text>
          <Text style={styles.heroTitle}>Service timeline</Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        ) : !showTimeline ? (
          // No service - show plans
          <View style={styles.section}>
            <Pressable
              style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => Linking.openURL(`${API_BASE_URL}/quote`)}
            >
              <View style={styles.planRow}>
                <FontAwesome name="paw" size={24} color={palette.tint} />
                <View style={styles.planContent}>
                  <Text style={[styles.planTitle, { color: palette.text }]}>Get scooping service</Text>
                  <Text style={[styles.planSubtitle, { color: palette.muted }]}>
                    Pro cleanup with auto-capture wellness tracking
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={palette.muted} />
              </View>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Unrated visits prompt */}
            {unratedVisits.length > 0 && (
              <Pressable
                style={[styles.alertBanner, { backgroundColor: `${palette.tint}15`, borderColor: palette.tint }]}
                onPress={() => openRating(unratedVisits[0])}
              >
                <FontAwesome name="star-o" size={16} color={palette.tint} />
                <Text style={[styles.alertText, { color: palette.text }]}>
                  Rate your last visit and earn care credits
                </Text>
                <FontAwesome name="chevron-right" size={12} color={palette.tint} />
              </Pressable>
            )}

            {/* Primary visit card */}
            {primaryVisit ? (
              <View style={[styles.nextVisitCard, { backgroundColor: palette.card, borderColor: palette.tint }]}>
                <View style={styles.nextVisitHeader}>
                  <View>
                    <Text style={[styles.nextVisitLabel, { color: palette.muted }]}>Next visit</Text>
                    <Text style={[styles.nextVisitDate, { color: palette.text }]}>
                      {formatDate(primaryVisit.scheduledDate)}
                    </Text>
                    {formatRelative(primaryVisit.scheduledDate) && (
                      <View style={[styles.relativeBadge, { backgroundColor: palette.tint }]}>
                        <Text style={styles.relativeBadgeText}>
                          {formatRelative(primaryVisit.scheduledDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.nextVisitMeta}>
                    <Text style={[styles.metaText, { color: palette.muted }]}>
                      {primaryVisit.serviceType?.toLowerCase() ?? 'scooping'}
                    </Text>
                  </View>
                </View>
                <View style={styles.inlineActions}>
                  <Pressable
                    style={[styles.inlineAction, { borderColor: palette.border }]}
                    onPress={() => openReschedule(primaryVisit)}
                  >
                    <FontAwesome name="calendar" size={12} color={palette.tint} />
                    <Text style={[styles.inlineActionText, { color: palette.text }]}>Reschedule</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.inlineAction, { borderColor: palette.border }]}
                    onPress={() => openSkip(primaryVisit)}
                  >
                    <FontAwesome name="times" size={12} color={palette.danger} />
                    <Text style={[styles.inlineActionText, { color: palette.danger }]}>Skip</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.emptyText, { color: palette.muted }]}>No upcoming visits scheduled.</Text>
                <Button title="Schedule now" onPress={() => Linking.openURL(`${API_BASE_URL}/quote`)} />
              </View>
            )}

            {/* Timeline for upcoming visits */}
            {upcomingVisits.length > 1 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Upcoming</Text>
                <View style={styles.timeline}>
                  {upcomingVisits.slice(1, 6).map((visit, index) => (
                    <Pressable
                      key={visit.id}
                      style={styles.timelineItem}
                      onPress={() => openReschedule(visit)}
                    >
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { backgroundColor: palette.tint }]} />
                        {index < upcomingVisits.length - 2 && (
                          <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />
                        )}
                      </View>
                      <View style={[styles.timelineContent, { borderColor: palette.border }]}>
                        <Text style={[styles.timelineDate, { color: palette.text }]}>
                          {formatDate(visit.scheduledDate, true)}
                        </Text>
                        <Text style={[styles.timelineMeta, { color: palette.muted }]}>
                          {visit.serviceType?.toLowerCase() ?? 'scooping'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Past visits - collapsible */}
            {pastVisits.length > 0 && (
              <View style={styles.section}>
                <CollapsibleSection
                  title={`Past visits (${pastVisits.length})`}
                  defaultOpen={false}
                >
                  {pastVisits.slice(0, 5).map((visit) => (
                    <View
                      key={visit.id}
                      style={[styles.pastVisitCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                    >
                      <View style={styles.pastVisitHeader}>
                        <Text style={[styles.pastVisitDate, { color: palette.text }]}>
                          {formatDate(visit.scheduledDate)}
                        </Text>
                        <View style={[styles.statusPill, { borderColor: palette.border }]}>
                          <Text style={[styles.statusText, { color: palette.muted }]}>
                            {visit.status.toLowerCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.pastVisitMeta}>
                        <Text style={[styles.metaText, { color: palette.muted }]}>
                          Samples: {visit.insightscoopCount ?? 0}
                        </Text>
                        {visit.flaggedMediaCount > 0 && (
                          <Text style={[styles.metaText, { color: Colors.brand.gold }]}>
                            Flags: {visit.flaggedMediaCount}
                          </Text>
                        )}
                      </View>
                      {visit.status === 'COMPLETED' && !visit.rating && (
                        <Pressable
                          style={[styles.rateLink, { borderColor: palette.tint }]}
                          onPress={() => openRating(visit)}
                        >
                          <Text style={[styles.rateLinkText, { color: palette.tint }]}>Rate this visit</Text>
                        </Pressable>
                      )}
                      {visit.rating && (
                        <Text style={[styles.ratedText, { color: palette.muted }]}>
                          Rated {visit.rating.score}/5
                        </Text>
                      )}
                    </View>
                  ))}
                </CollapsibleSection>
              </View>
            )}

            {/* Quick links */}
            <View style={styles.section}>
              <Pressable
                style={[styles.linkCard, { borderColor: palette.border }]}
                onPress={() => router.push('/(app)/(customer)/wellness-poop-map' as any)}
              >
                <FontAwesome name="map-marker" size={16} color={palette.tint} />
                <Text style={[styles.linkText, { color: palette.text }]}>View poop map</Text>
                <FontAwesome name="chevron-right" size={12} color={palette.muted} />
              </Pressable>
              {hasService && (
                <Pressable
                  style={[styles.linkCard, { borderColor: palette.border }]}
                  onPress={() => router.push('/(app)/(customer)/service-plan' as any)}
                >
                  <FontAwesome name="cog" size={16} color={palette.tint} />
                  <Text style={[styles.linkText, { color: palette.text }]}>Manage service plan</Text>
                  <FontAwesome name="chevron-right" size={12} color={palette.muted} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Reschedule sheet */}
      <BottomSheet visible={rescheduleSheet} onClose={() => setRescheduleSheet(false)} snapPoints={[0.7]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Reschedule visit</Text>
          <Text style={[styles.sheetSubtitle, { color: palette.muted }]}>
            Pick a new date. {contactCopy.confirmLabel}
          </Text>

          {availabilityLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
            </View>
          ) : (
            <>
              <View style={styles.calendarHeader}>
                {DAY_LABELS.map((label) => (
                  <Text key={label} style={[styles.calendarLabel, { color: palette.muted }]}>{label}</Text>
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
                      onPress={() => setSelectedDate(key)}
                      style={[
                        styles.calendarCell,
                        {
                          borderColor: isSelected ? palette.tint : isToday ? palette.accent : palette.border,
                          backgroundColor: isSelected ? palette.tint : palette.background,
                          opacity: available ? 1 : 0.3,
                        },
                      ]}
                    >
                      <Text style={{ color: isSelected ? '#FFF' : palette.text, fontWeight: '600' }}>
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: palette.muted }]}>Preferred window</Text>
              <View style={styles.chipRow}>
                <ChoiceChip label="Morning" selected={selectedWindow === 'morning'} onPress={() => setSelectedWindow('morning')} />
                <ChoiceChip label="Afternoon" selected={selectedWindow === 'afternoon'} onPress={() => setSelectedWindow('afternoon')} />
                <ChoiceChip label="Flexible" selected={selectedWindow === 'flexible'} onPress={() => setSelectedWindow('flexible')} />
              </View>
            </>
          )}

          {actionError && <Text style={[styles.errorText, { color: palette.danger }]}>{actionError}</Text>}

          <View style={styles.sheetActions}>
            <Button
              title={actionLoading ? 'Submitting...' : 'Confirm reschedule'}
              onPress={handleReschedule}
              disabled={actionLoading || !selectedDate}
            />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Skip sheet */}
      <BottomSheet visible={skipSheet} onClose={() => setSkipSheet(false)} snapPoints={[0.35]}>
        <Text style={[styles.sheetTitle, { color: palette.text }]}>Skip this visit?</Text>
        <Text style={[styles.sheetSubtitle, { color: palette.muted }]}>
          This removes the visit from your schedule. You can reschedule anytime.
        </Text>
        {actionError && <Text style={[styles.errorText, { color: palette.danger }]}>{actionError}</Text>}
        <View style={styles.sheetActionsRow}>
          <Button title="Keep visit" variant="secondary" onPress={() => setSkipSheet(false)} style={styles.halfButton} />
          <Button title={actionLoading ? 'Skipping...' : 'Skip'} onPress={handleSkip} disabled={actionLoading} style={styles.halfButton} />
        </View>
      </BottomSheet>

      {/* Rating sheet */}
      <BottomSheet visible={ratingSheet} onClose={() => setRatingSheet(false)} snapPoints={[0.65]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Rate this visit</Text>

          {activeVisit?.scooper && (
            <View style={styles.scooperRow}>
              {activeVisit.scooper.photoUrl ? (
                <Image source={{ uri: activeVisit.scooper.photoUrl }} style={styles.scooperAvatar} />
              ) : (
                <View style={[styles.scooperAvatar, { backgroundColor: palette.border }]}>
                  <Text style={[styles.scooperInitials, { color: palette.text }]}>
                    {activeVisit.scooper.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={[styles.scooperName, { color: palette.text }]}>{activeVisit.scooper.name}</Text>
                <Text style={[styles.metaText, { color: palette.muted }]}>
                  {activeVisit.scooper.completedVisits} visits completed
                </Text>
              </View>
            </View>
          )}

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRatingScore(value)} style={styles.starButton}>
                <Text style={[styles.starText, { color: ratingScore >= value ? palette.tint : palette.muted }]}>★</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.commentInput, { borderColor: palette.border, color: palette.text }]}
            placeholder="Add a note (optional)"
            placeholderTextColor={palette.muted}
            value={ratingComment}
            onChangeText={setRatingComment}
            multiline
          />

          <Text style={[styles.label, { color: palette.muted }]}>Add a tip (optional)</Text>
          <View style={styles.chipRow}>
            {TIP_OPTIONS.map((opt) => (
              <ChoiceChip key={opt.value} label={opt.label} selected={ratingTip === opt.value} onPress={() => setRatingTip(opt.value)} />
            ))}
          </View>
          {ratingTip > 0 && (
            <Text style={[styles.tipNote, { color: palette.muted }]}>
              {formatCurrency(ratingTip)} goes 100% to your scooper
            </Text>
          )}

          <View style={styles.sheetActions}>
            <Button
              title={ratingSubmitting ? 'Submitting...' : 'Submit rating'}
              onPress={handleSubmitRating}
              disabled={ratingSubmitting || ratingScore <= 0}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    right: -60,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertText: { flex: 1, fontSize: 14 },
  nextVisitCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    marginBottom: 18,
  },
  nextVisitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nextVisitLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  nextVisitDate: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  nextVisitMeta: { alignItems: 'flex-end' },
  relativeBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  relativeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  metaText: { fontSize: 13 },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: { fontSize: 13, fontWeight: '500' },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  emptyText: { fontSize: 14 },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', minHeight: 56 },
  timelineLeft: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineContent: {
    flex: 1,
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginLeft: 8,
  },
  timelineDate: { fontSize: 15, fontWeight: '600' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  pastVisitCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  pastVisitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastVisitDate: { fontSize: 15, fontWeight: '600' },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  pastVisitMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  rateLink: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  rateLinkText: { fontSize: 12, fontWeight: '500' },
  ratedText: { fontSize: 12, marginTop: 6 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  planContent: { flex: 1 },
  planTitle: { fontSize: 16, fontWeight: '600' },
  planSubtitle: { fontSize: 13, marginTop: 2 },
  // Sheet styles
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sheetSubtitle: { fontSize: 14, marginBottom: 16 },
  sheetActions: { marginTop: 16 },
  sheetActionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  halfButton: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendarHeader: { flexDirection: 'row', marginBottom: 8 },
  calendarLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  scooperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  scooperAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scooperInitials: { fontSize: 16, fontWeight: '700' },
  scooperName: { fontSize: 16, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  starButton: { padding: 4 },
  starText: { fontSize: 28, fontWeight: '700' },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 12,
  },
  tipNote: { fontSize: 12, marginTop: 8 },
});
