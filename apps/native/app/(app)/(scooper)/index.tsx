import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import ScooperCalendarModal from '@/components/scooper/ScooperCalendarModal';
import VisitTimeline from '@/components/scooper/VisitTimeline';
import ReleaseSheet from '@/components/scooper/ReleaseSheet';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { parseDateInput } from '@/lib/dates';
import {
  useRoutePlan,
  isVisitComplete,
  isSameLocalDay,
  formatDayLabel,
  formatFrequencyLabel,
  formatCurrencyFromCents,
  resolveLateReleaseCutoff,
  formatShortDateLabel,
  resolveVisitPayoutCents,
  deriveRouteSummaryFromVisits,
} from '@/lib/scooper/useRoutePlan';
import type { ScooperRouteVisit } from '@/lib/api/types';

// Helper functions for visit display

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

function resolveVisitGroupRangeLabel(
  visits: Array<{ scheduledDate: string }>,
): string | null {
  if (!visits.length) return null;
  const sorted = [...visits].sort((a, b) => {
    const dateA = parseDateInput(a.scheduledDate);
    const dateB = parseDateInput(b.scheduledDate);
    return dateA.getTime() - dateB.getTime();
  });
  const first = parseDateInput(sorted[0].scheduledDate);
  const last = parseDateInput(sorted[sorted.length - 1].scheduledDate);
  if (first.getTime() === last.getTime()) {
    return formatDayLabel(sorted[0].scheduledDate);
  }
  const firstLabel = first.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const lastLabel = last.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${firstLabel} - ${lastLabel}`;
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

  // Use the useRoutePlan hook for all route/check-in state and logic
  const {
    routePlan,
    todayRoutePlan,
    loading,
    error,
    routeErrorCode,
    profileStatus,
    statusLoading,
    checkInLoading,
    checkInError,
    checkInLoggedToday,
    checkInSelfieSkipped,
    checkInUploadStatus,
    checkInRewards,
    groupedVisits,
    orderedTodayVisits,
    blockedVisitIds,
    nextVisit,
    nextVisitIsToday,
    timelineVisits,
    currentVisitId,
    routeStops,
    totalMiles,
    totalMinutes,
    totalPayoutCents,
    weekLabel,
    weekCompletedVisits,
    weekRemainingVisits,
    weekPayoutCents,
    isPendingProfile,
    profileStatusLabel,
    backgroundStatusLabel,
    checkInStatusKnown,
    checkInComplete,
    checkInNeedsSelfie,
    checkInBlocked,
    checkInUploadFailed,
    hasTodayVisits,
    loadRoute,
    setRoutePlan,
    setTodayRoutePlan,
  } = useRoutePlan();

  // UI state
  const [routeLegsExpanded, setRouteLegsExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Upcoming: true,
    'This week': true,
  });
  const [releaseVisit, setReleaseVisit] = useState<ScooperRouteVisit | null>(null);
  const [releaseSheetOpen, setReleaseSheetOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);

  // Section collapse helpers

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

  // Derived UI values (using hook-provided data)
  const todayRouteVisits = useMemo(
    () =>
      todayRoutePlan?.visits ??
      routePlan?.visits?.filter((visit) => isSameLocalDay(visit.scheduledDate)) ??
      [],
    [todayRoutePlan, routePlan],
  );

  const stopsWithGeo = useMemo(
    () => todayRouteVisits.filter((visit) => visit.geo).length,
    [todayRouteVisits],
  );

  // Route summary and leg breakdown (UI-specific calculations)
  const routeSummary = todayRoutePlan?.summary ?? deriveRouteSummaryFromVisits(todayRouteVisits);
  const summaryDistance = routeSummary?.totalDistanceMeters ?? 0;
  const summaryDuration = routeSummary?.totalDurationSeconds ?? 0;
  const summaryAvailable = summaryDistance > 0 && summaryDuration > 0;

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
        { label: 'Start', value: `${startLegMiles ?? '—'} mi • ${startLegMinutes ?? '—'} min` },
        { label: 'Between', value: `${betweenStopsMiles ?? '—'} mi • ${betweenStopsMinutes ?? '—'} min` },
        { label: 'Return', value: `${endLegMiles ?? '—'} mi • ${endLegMinutes ?? '—'} min` },
      ]
    : summaryAvailable && betweenStopsMiles !== null && betweenStopsMinutes !== null
      ? [{ label: 'Between', value: `${betweenStopsMiles} mi • ${betweenStopsMinutes} min` }]
      : [];

  const nextVisitBlocked = !nextVisitIsToday || checkInBlocked;

  const headerSubtitle = routeStops
    ? `${routeStops} stop${routeStops === 1 ? '' : 's'} today${totalMiles ? ` • ${totalMiles} mi` : ''}${totalMinutes ? ` • ${totalMinutes} min` : ''}`
    : 'No stops scheduled today.';

  const todayPayoutLabel =
    totalPayoutCents > 0 ? formatCurrencyFromCents(totalPayoutCents) : '—';

  const weekPayoutLabel =
    weekPayoutCents > 0 ? formatCurrencyFromCents(weekPayoutCents) : '—';

  const checkInSummary = checkInRewards
    ? checkInLoggedToday
      ? `${checkInRewards.streakCount} day streak • ${checkInRewards.pointsBalance} check-in points`
      : `${checkInRewards.streakIfSubmit} day streak if you check in • Earn ${checkInRewards.pointsPreview.totalPoints} points`
    : null;
  const checkInStatusLabel = !checkInStatusKnown
    ? 'Checking status'
    : checkInComplete
      ? checkInUploadFailed
        ? 'Checked in (upload pending)'
        : checkInNeedsSelfie
          ? 'Checked in (selfie missing)'
          : 'Checked in'
      : hasTodayVisits
        ? 'Check-in required'
        : 'Optional today';
  const checkInStatusTone = !checkInStatusKnown
    ? palette.border
    : checkInComplete
      ? checkInNeedsSelfie
        ? palette.danger
        : palette.tint
      : hasTodayVisits
        ? palette.danger
        : palette.border;
  const checkInRequired = hasTodayVisits && checkInStatusKnown && !checkInComplete;
  const showCheckInCard =
    checkInLoading ||
    checkInError ||
    checkInRequired ||
    checkInUploadFailed ||
    checkInNeedsSelfie;
  const showCheckInBubble = true;
  const checkInBubbleLabel = checkInComplete
    ? checkInNeedsSelfie
      ? 'Selfie missing'
      : 'Checked in'
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
  const checkInBubbleTone = checkInNeedsSelfie || checkInRequired
    ? palette.danger
    : checkInComplete
      ? rewardTone
      : palette.muted;
  const checkInCardBody = checkInComplete
    ? checkInUploadFailed
      ? 'Your check-in is saved, but the selfie upload is pending. Open check-in to retry when you have a strong signal.'
      : checkInNeedsSelfie
        ? 'You checked in without a selfie. Add one to stay compliant and keep rewards.'
        : 'You’re checked in and ready to start visits.'
    : hasTodayVisits
      ? 'Complete your daily check-in before starting visits.'
      : 'Check-ins are optional today, but you can earn points by completing one.';
  const checkInActionLabel = checkInComplete
    ? checkInUploadFailed
      ? 'Retry selfie'
      : checkInNeedsSelfie
        ? 'Add selfie'
        : 'Open check-in'
    : 'Start check-in';

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

  // Release dialog state (using new ReleaseSheet component)
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
  const releaseIsSameDay = releaseVisit ? isSameLocalDay(releaseVisit.scheduledDate) : false;

  const openReleaseDialog = (visit: ScooperRouteVisit) => {
    if (visit.status !== 'SCHEDULED') return;
    setReleaseVisit(visit);
    setReleaseSheetOpen(true);
  };

  const closeReleaseDialog = () => {
    setReleaseSheetOpen(false);
    setReleaseVisit(null);
  };

  const handleReleaseSubmit = async (scope: 'visit' | 'job', reason: string) => {
    if (!session?.token || !releaseVisit) {
      throw new Error('Unable to release. Please try again.');
    }
    const endpoint =
      scope === 'job'
        ? `/api/field-tech/jobs/${releaseVisit.job?.id}/handoff`
        : `/api/field-tech/visits/${releaseVisit.id}/handoff`;
    await apiRequest(endpoint, {
      method: 'POST',
      token: session.token,
      body: { reason: reason || undefined },
    });
    const releasedJobId = scope === 'job' ? releaseVisit.job?.id ?? null : null;
    const shouldRemove = (visit: ScooperRouteVisit) =>
      releasedJobId ? visit.job?.id === releasedJobId : visit.id === releaseVisit.id;
    setRoutePlan((prev) =>
      prev ? { ...prev, visits: prev.visits.filter((visit) => !shouldRemove(visit)) } : prev,
    );
    setTodayRoutePlan((prev) =>
      prev ? { ...prev, visits: prev.visits.filter((visit) => !shouldRemove(visit)) } : prev,
    );
    loadRoute();
  };

  const now = new Date();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Compact Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderMain}>
            <Text style={[styles.title, { color: palette.text }]}>
              Hey {session?.user?.name?.split(' ')[0] ?? 'Scooper'}
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={openCalendar}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <FontAwesome name="calendar" size={16} color={palette.text} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/(app)/(scooper)/ongoing-customers' as any)}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <FontAwesome name="users" size={16} color={palette.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Stats Row - Stops, Miles, Payout */}
        <View style={styles.statsRow}>
          <Pressable
            onPress={() => router.push('/(app)/(scooper)/daily-check')}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: palette.card, borderColor: cardBorder },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: checkInComplete ? `${Colors.brand.mint}15` : `${palette.danger}15` }]}>
              <FontAwesome name="check-circle" size={14} color={checkInComplete ? Colors.brand.mint : palette.danger} />
            </View>
            <Text style={[styles.statValue, { color: checkInComplete ? Colors.brand.mint : palette.danger }]}>
              {checkInComplete ? 'Done' : 'Due'}
            </Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Check-in</Text>
          </Pressable>
          <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={[styles.statIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="map-marker" size={14} color={palette.tint} />
            </View>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {activeTab === 'today' ? routeStops : weekRemainingVisits.length}
            </Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Stops</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="dollar" size={14} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.statValue, { color: Colors.brand.mint }]}>
              {activeTab === 'today' ? todayPayoutLabel : weekPayoutLabel}
            </Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Payout</Text>
          </View>
        </View>

        {/* Tab Bar: Today | Week */}
        <View style={[styles.tabBar, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <Pressable
            onPress={() => setActiveTab('today')}
            style={[
              styles.tabButton,
              activeTab === 'today' && { backgroundColor: palette.tint },
            ]}
          >
            <Text style={[
              styles.tabButtonText,
              { color: activeTab === 'today' ? '#FFFFFF' : palette.muted },
            ]}>
              Today
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('week')}
            style={[
              styles.tabButton,
              activeTab === 'week' && { backgroundColor: palette.tint },
            ]}
          >
            <Text style={[
              styles.tabButtonText,
              { color: activeTab === 'week' ? '#FFFFFF' : palette.muted },
            ]}>
              This Week
            </Text>
            {weekRemainingVisits.length > 0 ? (
              <View style={[styles.tabBadge, { backgroundColor: activeTab === 'week' ? '#FFFFFF' : palette.tint }]}>
                <Text style={[styles.tabBadgeText, { color: activeTab === 'week' ? palette.tint : '#FFFFFF' }]}>
                  {weekRemainingVisits.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
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

        {/* Route Timeline - visual progress of today's stops */}
        {timelineVisits.length > 0 ? (
          <View
            style={[
              styles.timelineCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <VisitTimeline
              visits={timelineVisits}
              currentVisitId={currentVisitId}
              onVisitPress={(visitId) => {
                const visit = orderedTodayVisits.find((v) => v.id === visitId);
                if (!visit) return;
                const isBlocked = blockedVisitIds.has(visitId) || checkInBlocked;
                const isToday = isSameLocalDay(visit.scheduledDate);
                if (!isBlocked && isToday && !isVisitComplete(visit.status)) {
                  router.push(`/(app)/(scooper)/visits/${visitId}`);
                }
              }}
              showLabels={true}
            />
          </View>
        ) : null}

        {/* Drive info chip (when available) */}
        {todayDriveLabel && activeTab === 'today' ? (
          <View style={[styles.driveInfoChip, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <FontAwesome name="car" size={12} color={palette.muted} />
            <Text style={[styles.driveInfoText, { color: palette.muted }]}>{todayDriveLabel}</Text>
            {geoCoverageLabel ? (
              <Text style={[styles.driveInfoText, { color: palette.muted }]}>• {geoCoverageLabel}</Text>
            ) : null}
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
          <View style={[styles.emptyState, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="calendar-check-o" size={24} color={palette.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No stops scheduled</Text>
            <Text style={[styles.emptyBody, { color: palette.muted }]}>
              Check offers for new work opportunities.
            </Text>
            <Button
              title="View offers"
              onPress={() => router.push('/(app)/(scooper)/offers')}
              variant="primary"
              style={{ marginTop: 12 }}
            />
          </View>
        ) : activeTab === 'today' && !groupedVisits.some((g) => g.label === 'Today') ? (
          <View style={[styles.emptyState, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="check" size={24} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>All done for today</Text>
            <Text style={[styles.emptyBody, { color: palette.muted }]}>
              {weekRemainingVisits.length > 0
                ? `You have ${weekRemainingVisits.length} more stop${weekRemainingVisits.length === 1 ? '' : 's'} this week.`
                : 'Check offers for new work opportunities.'}
            </Text>
            {weekRemainingVisits.length > 0 ? (
              <Button
                title="View week"
                onPress={() => setActiveTab('week')}
                variant="secondary"
                style={{ marginTop: 12 }}
              />
            ) : (
              <Button
                title="View offers"
                onPress={() => router.push('/(app)/(scooper)/offers')}
                variant="primary"
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        ) : (
          (activeTab === 'today'
            ? groupedVisits.filter((g) => g.label === 'Today')
            : groupedVisits
          ).map((group) => {
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
                          const isNext = visit.id === nextVisit?.id;
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
                          const isExpanded = expandedVisitId === visit.id;
                          const dogsLabel = formatDogSummary(visit.customer?.dogs);
                          const dogCount = visit.customer?.dogs?.length ?? 0;
                          return (
                            <Pressable
                              key={visit.id}
                              onPress={() => setExpandedVisitId(isExpanded ? null : visit.id)}
                              style={[
                                styles.visitCard,
                                cardShadowStyle,
                                {
                                  backgroundColor: palette.card,
                                  borderColor: cardBorder,
                                  borderWidth: 1,
                                },
                              ]}
                            >
                              {/* "Next" indicator accent bar */}
                              {isNext ? (
                                <View style={[styles.visitNextAccent, { backgroundColor: palette.tint }]} />
                              ) : null}
                              {/* Compact Header Row */}
                              <View style={styles.visitCompactHeader}>
                                <View style={[styles.visitAvatar, { backgroundColor: `${statusTone}15` }]}>
                                  <FontAwesome
                                    name={completed ? 'check' : 'user'}
                                    size={14}
                                    color={statusTone}
                                  />
                                </View>
                                <View style={styles.visitCompactInfo}>
                                  <Text style={[styles.visitCustomerName, { color: palette.text }]} numberOfLines={1}>
                                    {customerName}
                                  </Text>
                                  <View style={styles.visitCompactMeta}>
                                    <Text style={[styles.visitMetaText, { color: palette.muted }]}>
                                      {windowLabel ?? formatDayLabel(visit.scheduledDate)}
                                    </Text>
                                    {dogCount > 0 ? (
                                      <>
                                        <View style={[styles.visitMetaDot, { backgroundColor: palette.border }]} />
                                        <FontAwesome name="paw" size={10} color={palette.muted} />
                                        <Text style={[styles.visitMetaText, { color: palette.muted }]}>
                                          {dogCount}
                                        </Text>
                                      </>
                                    ) : null}
                                    {payoutLabel ? (
                                      <>
                                        <View style={[styles.visitMetaDot, { backgroundColor: palette.border }]} />
                                        <Text style={[styles.visitMetaText, styles.visitPayoutText, { color: mintTone }]}>
                                          {payoutLabel}
                                        </Text>
                                      </>
                                    ) : null}
                                  </View>
                                </View>
                                <View style={styles.visitCompactRight}>
                                  <View style={[styles.statusPill, { backgroundColor: statusTone }]}>
                                    <Text style={[styles.statusPillText, { color: sequenceBlocked ? palette.text : '#FFFFFF' }]}>
                                      {statusLabel}
                                    </Text>
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
                                <View style={styles.visitExpandedContent}>
                                  <View style={[styles.visitExpandedDivider, { backgroundColor: palette.border }]} />
                                  <View style={styles.visitDetailRow}>
                                    <View style={[styles.visitDetailIcon, { backgroundColor: `${palette.muted}15` }]}>
                                      <FontAwesome name="map-marker" size={12} color={palette.muted} />
                                    </View>
                                    <Text style={[styles.visitDetailText, { color: palette.text }]}>
                                      {address}{city}
                                    </Text>
                                  </View>
                                  {dogsLabel ? (
                                    <View style={styles.visitDetailRow}>
                                      <View style={[styles.visitDetailIcon, { backgroundColor: `${palette.muted}15` }]}>
                                        <FontAwesome name="paw" size={12} color={palette.muted} />
                                      </View>
                                      <Text style={[styles.visitDetailText, { color: palette.text }]}>
                                        {dogsLabel}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {payoutLabel ? (
                                    <View style={styles.visitDetailRow}>
                                      <View style={[styles.visitDetailIcon, { backgroundColor: `${mintTone}15` }]}>
                                        <FontAwesome name="usd" size={12} color={mintTone} />
                                      </View>
                                      <View>
                                        <Text style={[styles.visitDetailText, { color: mintTone }]}>
                                          {payoutLabel} estimated
                                        </Text>
                                        <Text style={[styles.visitDetailSubtext, { color: palette.muted }]}>
                                          Includes mileage + PPE
                                        </Text>
                                      </View>
                                    </View>
                                  ) : null}
                                  {lateReleaseText ? (
                                    <View style={styles.visitDetailRow}>
                                      <View style={[styles.visitDetailIcon, { backgroundColor: `${lateReleaseTone}15` }]}>
                                        <FontAwesome name="clock-o" size={12} color={lateReleaseTone} />
                                      </View>
                                      <Text style={[styles.visitDetailText, { color: lateReleaseTone }]}>
                                        {lateReleaseText}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {/* Inline Actions */}
                                  <View style={styles.visitExpandedActions}>
                                    <Pressable
                                      onPress={() => router.push(`/(app)/(scooper)/visits/${visit.id}`)}
                                      disabled={openBlocked}
                                      style={[
                                        styles.visitInlineAction,
                                        { backgroundColor: openBlocked ? palette.border : palette.tint },
                                      ]}
                                    >
                                      <FontAwesome name="play" size={12} color={openBlocked ? palette.muted : '#FFFFFF'} />
                                      <Text style={[styles.visitInlineActionText, { color: openBlocked ? palette.muted : '#FFFFFF' }]}>
                                        Start
                                      </Text>
                                    </Pressable>
                                    {visit.navigationUrl ? (
                                      <Pressable
                                        onPress={() => openNavigation(visit.navigationUrl)}
                                        disabled={openBlocked}
                                        style={[styles.visitInlineAction, { backgroundColor: palette.card, borderWidth: 1, borderColor: cardBorder }]}
                                      >
                                        <FontAwesome name="location-arrow" size={12} color={openBlocked ? palette.muted : palette.text} />
                                        <Text style={[styles.visitInlineActionText, { color: openBlocked ? palette.muted : palette.text }]}>
                                          Navigate
                                        </Text>
                                      </Pressable>
                                    ) : null}
                                    {canReleaseVisit ? (
                                      <Pressable
                                        onPress={() => openReleaseDialog(visit)}
                                        style={[styles.visitInlineAction, { backgroundColor: `${palette.danger}10`, borderWidth: 1, borderColor: palette.danger }]}
                                      >
                                        <FontAwesome name="times" size={12} color={palette.danger} />
                                        <Text style={[styles.visitInlineActionText, { color: palette.danger }]}>
                                          Release
                                        </Text>
                                      </Pressable>
                                    ) : null}
                                  </View>
                                  {/* Blocked Messages */}
                                  {checkInBlocked ? (
                                    <View style={[styles.visitBlockedBanner, { backgroundColor: `${palette.danger}10` }]}>
                                      <FontAwesome name="lock" size={10} color={palette.danger} />
                                      <Text style={[styles.visitBlockedText, { color: palette.danger }]}>
                                        Complete daily check-in to unlock
                                      </Text>
                                    </View>
                                  ) : dateBlocked ? (
                                    <View style={[styles.visitBlockedBanner, { backgroundColor: `${palette.muted}15` }]}>
                                      <FontAwesome name="calendar" size={10} color={palette.muted} />
                                      <Text style={[styles.visitBlockedText, { color: palette.muted }]}>
                                        Available on {formatDayLabel(visit.scheduledDate)}
                                      </Text>
                                    </View>
                                  ) : sequenceBlocked ? (
                                    <View style={[styles.visitBlockedBanner, { backgroundColor: `${palette.muted}15` }]}>
                                      <FontAwesome name="lock" size={10} color={palette.muted} />
                                      <Text style={[styles.visitBlockedText, { color: palette.muted }]}>
                                        Complete previous stop first
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              ) : null}
                            </Pressable>
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
      {/* New ReleaseSheet component - progressive disclosure */}
      <ReleaseSheet
        visible={releaseSheetOpen}
        onClose={closeReleaseDialog}
        onRelease={handleReleaseSubmit}
        customerName={releaseVisit?.customer?.name ?? undefined}
        frequency={releaseVisit?.job?.frequency}
        canReleaseJob={canReleaseJob}
        isJobOwnedByAnother={isReleaseJobOwnedByAnother}
        isSameDay={releaseIsSameDay}
        isLateRelease={Boolean(
          resolveLateReleaseCutoff(releaseVisit?.scheduledDate ?? '') &&
            new Date() >= (resolveLateReleaseCutoff(releaseVisit?.scheduledDate ?? '') ?? new Date()),
        )}
        lateReleaseLabel={
          resolveLateReleaseCutoff(releaseVisit?.scheduledDate ?? '')
            ? formatShortDateLabel(resolveLateReleaseCutoff(releaseVisit?.scheduledDate ?? '') ?? new Date())
            : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  pageHeader: {
    marginBottom: 12,
  },
  pageHeaderMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  driveInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  driveInfoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
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
    fontSize: 24,
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
  timelineCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  visitNextAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  visitCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  visitAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitCompactInfo: {
    flex: 1,
    gap: 3,
  },
  visitCustomerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  visitCompactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  visitMetaText: {
    fontSize: 12,
  },
  visitMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  visitPayoutText: {
    fontWeight: '700',
  },
  visitCompactRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  visitExpandedContent: {
    marginTop: 12,
    gap: 10,
  },
  visitExpandedDivider: {
    height: 1,
    marginBottom: 2,
  },
  visitDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visitDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitDetailText: {
    fontSize: 13,
    flex: 1,
  },
  visitDetailSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  visitExpandedActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  visitInlineAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  visitInlineActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  visitBlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  visitBlockedText: {
    fontSize: 12,
    fontWeight: '500',
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
});
