import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import { parseDateInput } from '@/lib/dates';
import { assessSymptomRisk, labelForSymptomRisk } from '@/lib/wellness/symptomRisk';
import type {
  CustomerSummary,
  WellnessCheckInContext,
  WellnessReading,
  WellnessReport,
} from '@/lib/api/types';

type WeatherAlertLevel = 'caution' | 'danger';
type WeatherAlertWindow = 'now' | 'soon';
type WeatherAlert = {
  type: 'heat' | 'cold';
  level: WeatherAlertLevel;
  window: WeatherAlertWindow;
  headline: string;
  message: string;
};

type WeatherAlertPayload = {
  location?: { city?: string | null; state?: string | null };
  weather?: {
    currentTemp: number | null;
    feelsLike: number | null;
    dailyHigh: number | null;
    dailyLow: number | null;
    next6High?: number | null;
    next6Low?: number | null;
  } | null;
  alert?: WeatherAlert | null;
  alerts?: { heat: WeatherAlert | null; cold: WeatherAlert | null };
};

function getWeekStart(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function normalizeColor(value?: string | null) {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized.includes('brown') || normalized.includes('normal')) return 'normal';
  if (normalized.includes('yellow')) return 'yellow';
  if (normalized.includes('red')) return 'red';
  if (normalized.includes('black')) return 'black';
  if (normalized.includes('other')) return 'unknown';
  return 'unknown';
}

function normalizeConsistency(value?: string | null) {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized.includes('normal')) return 'normal';
  if (normalized.includes('soft') || normalized.includes('loose')) return 'soft';
  if (normalized.includes('dry') || normalized.includes('hard')) return 'dry';
  if (normalized.includes('other')) return 'unknown';
  return 'unknown';
}

function normalizeContent(value?: string | null) {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized.includes('typical') || normalized.includes('normal')) return 'typical';
  if (normalized.includes('mucus')) return 'mucus';
  if (normalized.includes('blood')) return 'blood';
  if (normalized.includes('foreign')) return 'foreign';
  if (normalized.includes('other')) return 'other';
  return 'unknown';
}

export default function CustomerWellness() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [reports, setReports] = useState<WellnessReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readings, setReadings] = useState<WellnessReading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [readingsError, setReadingsError] = useState<string | null>(null);
  const [checkInContext, setCheckInContext] = useState<WellnessCheckInContext | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<{
    message: string;
    headline: string;
    label: string;
    level: WeatherAlertLevel;
    type: WeatherAlert['type'];
    window: WeatherAlertWindow;
    currentTemp: number | null;
    feelsLike: number | null;
  } | null>(null);
  const [showToolkit, setShowToolkit] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);
  const readingList = readings ?? [];
  const reportList = reports ?? [];
  const access = summary?.wellnessAccess ?? null;
  const hasService = access?.hasActiveService ?? false;
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || hasService;
  const isFree = !isPremium;
  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;
  const scansLabel = isPremium ? 'Unlimited' : `${scansRemaining ?? 0}`;
  const chatsLabel = isPremium ? 'Unlimited' : `${chatsRemaining ?? 0}`;
  const planLabel = isPremium ? 'Premium wellness' : 'Free wellness';
  const planMeta = access?.planEndsAt
    ? `Active through ${new Date(access.planEndsAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    : isPremium
      ? 'Unlimited scans + chat'
      : '5 scans + 12 chats per month';

  const toolkitItems = useMemo(() => {
    const items = [
      {
        key: 'scan',
        title: 'Scan stool',
        subtitle: '1-tap capture',
        icon: 'camera',
        href: '/(app)/(customer)/capture' as Href,
      },
      {
        key: 'chat',
        title: 'Ask AI',
        subtitle: 'Symptom Q&A',
        icon: 'comment',
        href: '/(app)/(customer)/chat' as Href,
      },
      {
        key: 'food',
        title: 'Food & meds',
        subtitle: 'Scan + log',
        icon: 'cutlery',
        href: '/(app)/(customer)/wellness-food-log' as Href,
      },
      {
        key: 'reminders',
        title: 'Reminders',
        subtitle: 'Meds & care',
        icon: 'bell',
        href: '/(app)/(customer)/reminders' as Href,
      },
      {
        key: 'walks',
        title: 'Walk tracking',
        subtitle: isPremium ? 'GPS routes + distance' : 'Premium only',
        icon: 'map',
        href: '/(app)/(customer)/wellness-walks' as Href,
      },
      {
        key: 'dogs',
        title: 'Dog profiles',
        subtitle: 'Weights & vet info',
        icon: 'paw',
        href: '/(app)/(customer)/wellness-dogs' as Href,
      },
      {
        key: 'parasite',
        title: 'Parasite risk',
        subtitle: 'Seasonal calendar',
        icon: 'bug',
        href: '/(app)/(customer)/wellness-parasite-risk' as Href,
      },
      {
        key: 'library',
        title: 'Stool library',
        subtitle: 'Quick compare',
        icon: 'book',
        href: '/(app)/(customer)/wellness-stool-library' as Href,
      },
    ];

    if (isFree && !hasService) {
      items.push({
        key: 'upgrade',
        title: 'Upgrade',
        subtitle: 'Premium + pro',
        icon: 'star',
        href: '/(app)/(customer)/wellness-upgrade' as Href,
      });
    }

    return items;
  }, [hasService, isFree, isPremium]);
  const toolkitCount = toolkitItems.length;

  const loadReports = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ reports: WellnessReport[] }>(
        '/api/mobile/customer/wellness-reports?limit=6',
        { token: session.token },
      );
      setReports(data.reports ?? []);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load reports.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const loadSummary = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
        token: session.token,
      });
      setSummary(data);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
      }
    }
  }, [session?.token]);

  const loadReadings = useCallback(async () => {
    if (!session?.token) return;
    setReadingsLoading(true);
    setReadingsError(null);
    try {
      const data = await apiRequest<{ readings: WellnessReading[] }>(
        '/api/mobile/customer/wellness-readings',
        { token: session.token },
      );
      setReadings(data.readings ?? []);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load insights.';
      setReadingsError(message);
    } finally {
      setReadingsLoading(false);
    }
  }, [session?.token]);

  const loadCheckInContext = useCallback(async () => {
    if (!session?.token) return;
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      const data = await apiRequest<WellnessCheckInContext>(
        '/api/mobile/customer/wellness-check-in',
        { token: session.token },
      );
      setCheckInContext(data);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load check-in status.';
      setCheckInError(message);
    } finally {
      setCheckInLoading(false);
    }
  }, [session?.token]);

  const loadWeather = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<WeatherAlertPayload>('/api/mobile/customer/weather', {
        token: session.token,
      });
      const alert = data.alert ?? data.alerts?.heat ?? data.alerts?.cold ?? null;
      if (alert) {
        const locationLabel =
          data.location?.city && data.location?.state
            ? `${data.location.city}, ${data.location.state}`
            : 'Your area';
        setWeatherAlert({
          message: alert.message,
          headline: alert.headline,
          label: locationLabel,
          level: alert.level,
          type: alert.type,
          window: alert.window,
          currentTemp: data.weather?.currentTemp ?? null,
          feelsLike: data.weather?.feelsLike ?? null,
        });
      } else {
        setWeatherAlert(null);
      }
    } catch {
      setWeatherAlert(null);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
      loadReadings();
      loadCheckInContext();
      loadWeather();
      loadSummary();
    }, [loadReports, loadReadings, loadCheckInContext, loadWeather, loadSummary]),
  );

  const checkInMeta = useMemo(() => {
    const dogs = checkInContext?.dogs ?? [];
    const totalDogs = dogs.length;
    const pending = dogs.filter((dog) => !dog.currentWeekReport).length;
    const hasDogs = totalDogs > 0;
    const allSubmitted = hasDogs && pending === 0;
    const label = !hasDogs
      ? 'Add dogs to start check-ins'
      : allSubmitted
        ? 'Edit this week\'s check-in'
        : pending === totalDogs
          ? 'Start weekly check-in'
          : `Finish ${pending} check-in${pending === 1 ? '' : 's'}`;
    const helper = checkInContext?.weekStart
      ? `Week of ${parseDateInput(checkInContext.weekStart).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}`
      : 'This week';
    const pendingLabel = !hasDogs
      ? 'Add dogs to start weekly check-ins.'
      : allSubmitted
        ? 'All dogs checked in.'
        : `${pending} of ${totalDogs} dogs still need a check-in.`;
    return {
      hasDogs,
      allSubmitted,
      label,
      helper,
      pending,
      totalDogs,
      pendingLabel,
      weekStart: checkInContext?.weekStart ?? null,
    };
  }, [checkInContext]);

  const handleCheckInPress = () => {
    if (!checkInMeta.hasDogs) {
      router.push('/(app)/(customer)/account');
      return;
    }
    if (checkInMeta.weekStart) {
      router.push({
        pathname: '/(app)/(customer)/check-in',
        params: { weekStart: checkInMeta.weekStart },
      });
      return;
    }
    router.push('/(app)/(customer)/check-in');
  };

  const wellnessSummary = useMemo(() => {
    const totalSamples = readingList.length;
    const flaggedSamples = readingList.filter((reading) => reading.issues.length > 0).length;
    if (totalSamples === 0) {
      return {
        title: 'No samples yet',
        subtitle: hasService
          ? 'Wellness insights appear after your next service visit.'
          : 'Capture a stool photo to start wellness insights.',
        status: 'pending' as const,
        totalSamples,
        flaggedSamples,
      };
    }
    if (flaggedSamples > 0) {
      return {
        title: 'Keep an eye on recent samples',
        subtitle: 'We detected signals in recent samples. Review the notes below.',
        status: 'alert' as const,
        totalSamples,
        flaggedSamples,
      };
    }
    return {
      title: 'Everything looks stable',
      subtitle: 'Recent samples look healthy. Keep up the great work.',
      status: 'good' as const,
      totalSamples,
      flaggedSamples,
    };
  }, [readingList]);

  const checkInStatusLabel = checkInMeta.hasDogs
    ? checkInMeta.allSubmitted
      ? 'Complete'
      : 'Pending'
    : 'Setup';
  const checkInStatusColor = checkInMeta.hasDogs
    ? checkInMeta.allSubmitted
      ? Colors.brand.mint
      : Colors.brand.gold
    : palette.border;
  const checkInStatusTextColor = checkInMeta.hasDogs ? Colors.brand.graphite : palette.muted;

  const weeklyPulse = useMemo(() => {
    if (readingList.length === 0) return [] as Array<{
      label: string;
      count: number;
      status: 'good' | 'alert' | 'pending';
      issueCount: number;
    }>;

    const buckets = new Map<string, { start: Date; count: number; issueCount: number }>();
    readingList.forEach((reading) => {
      const date = new Date(reading.timestamp);
      if (Number.isNaN(date.getTime())) return;
      const weekStart = getWeekStart(date);
      const key = weekStart.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? { start: weekStart, count: 0, issueCount: 0 };
      bucket.count += 1;
      if (reading.issues.length > 0) bucket.issueCount += 1;
      buckets.set(key, bucket);
    });

    return Array.from(buckets.values())
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, 4)
      .map((bucket) => {
        const status = bucket.issueCount > 0 ? 'alert' : 'good';
        return {
          label: formatWeekLabel(bucket.start),
          count: bucket.count,
          issueCount: bucket.issueCount,
          status,
        };
      });
  }, [readingList]);

  const colorStack = useMemo(() => {
    const counts = { normal: 0, yellow: 0, red: 0, black: 0, unknown: 0 };
    readingList.forEach((reading) => {
      const key = normalizeColor(reading.color);
      if (key === 'unknown') {
        counts.unknown += 1;
      } else {
        counts[key as keyof typeof counts] += 1;
      }
    });
    const total = counts.normal + counts.yellow + counts.red + counts.black;
    return {
      total,
      unknown: counts.unknown,
      segments: [
        { key: 'normal', label: 'Normal', value: counts.normal, color: '#22C55E' },
        { key: 'yellow', label: 'Yellow', value: counts.yellow, color: '#FBBF24' },
        { key: 'red', label: 'Red', value: counts.red, color: '#F97316' },
        { key: 'black', label: 'Black', value: counts.black, color: '#111827' },
      ],
    };
  }, [readingList]);

  const consistencyStack = useMemo(() => {
    const counts = { normal: 0, soft: 0, dry: 0, unknown: 0 };
    readingList.forEach((reading) => {
      const key = normalizeConsistency(reading.consistencyLabel);
      if (key === 'unknown') {
        counts.unknown += 1;
      } else {
        counts[key as keyof typeof counts] += 1;
      }
    });
    const total = counts.normal + counts.soft + counts.dry;
    return {
      total,
      unknown: counts.unknown,
      segments: [
        { key: 'normal', label: 'Normal', value: counts.normal, color: '#22C55E' },
        { key: 'soft', label: 'Soft', value: counts.soft, color: '#FBBF24' },
        { key: 'dry', label: 'Dry', value: counts.dry, color: '#F97316' },
      ],
    };
  }, [readingList]);

  const contentStack = useMemo(() => {
    const counts = { typical: 0, mucus: 0, blood: 0, foreign: 0, other: 0, unknown: 0 };
    readingList.forEach((reading) => {
      const key = normalizeContent(reading.contentLabel);
      if (key === 'unknown') {
        counts.unknown += 1;
      } else {
        counts[key as keyof typeof counts] += 1;
      }
    });
    const total = counts.typical + counts.mucus + counts.blood + counts.foreign + counts.other;
    return {
      total,
      unknown: counts.unknown,
      segments: [
        { key: 'typical', label: 'Typical', value: counts.typical, color: '#22C55E' },
        { key: 'mucus', label: 'Mucus', value: counts.mucus, color: '#FBBF24' },
        { key: 'blood', label: 'Blood', value: counts.blood, color: '#EF4444' },
        { key: 'foreign', label: 'Foreign', value: counts.foreign, color: '#F97316' },
        { key: 'other', label: 'Other', value: counts.other, color: '#94A3B8' },
      ],
    };
  }, [readingList]);

  const trendData = useMemo(() => {
    if (!access || !isPremium) return null;
    const buckets = new Map<string, { start: Date; total: number; issues: number }>();
    readingList.forEach((reading) => {
      const date = new Date(reading.timestamp);
      if (Number.isNaN(date.getTime())) return;
      const weekStart = getWeekStart(date);
      const key = weekStart.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? { start: weekStart, total: 0, issues: 0 };
      bucket.total += 1;
      if (
        reading.issues.length > 0 ||
        reading.indicator === 'monitor' ||
        reading.indicator === 'vet_now'
      ) {
        bucket.issues += 1;
      }
      buckets.set(key, bucket);
    });
    const weeks = Array.from(buckets.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
    if (weeks.length === 0) {
      return { availableWeeks: 0 };
    }
    if (weeks.length < 4) {
      return { availableWeeks: weeks.length };
    }
    const recent = weeks.slice(0, 4);
    const previous = weeks.slice(4, 8);
    const recentTotals = recent.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.issues += item.issues;
        return acc;
      },
      { total: 0, issues: 0 },
    );
    const previousTotals = previous.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.issues += item.issues;
        return acc;
      },
      { total: 0, issues: 0 },
    );
    const recentRate = recentTotals.total ? recentTotals.issues / recentTotals.total : 0;
    const previousRate = previousTotals.total ? previousTotals.issues / previousTotals.total : recentRate;
    const delta = recentRate - previousRate;
    const changePct = previousTotals.total ? Math.round(delta * 100) : 0;
    const trend = delta < -0.05 ? 'improving' : delta > 0.05 ? 'declining' : 'stable';
    const earlyWarning = trend === 'declining' && recentRate >= 0.25;

    return {
      availableWeeks: weeks.length,
      recentRate,
      previousRate,
      changePct,
      trend,
      earlyWarning,
    };
  }, [access, readingList]);

  const riskScore = useMemo(() => {
    if (!access || access.tier !== 'PREMIUM') return null;
    if (readingList.length === 0) return 82;
    const recent = readingList.slice(0, 6);
    let score = 92;
    recent.forEach((reading) => {
      if (reading.indicator === 'vet_now') score -= 20;
      else if (reading.indicator === 'monitor') score -= 12;
      else if (reading.issues.length > 0) score -= 8;
    });
    return Math.max(25, Math.min(98, score));
  }, [access, readingList]);

  const riskNudge = useMemo(() => {
    if (!riskScore) return null;
    if (riskScore < 50) {
      return 'Lean on hydration goals and share notes for the next few days.';
    }
    if (riskScore < 70) {
      return 'Keep weekly check-ins up to spot subtle shifts early.';
    }
    return 'Great momentum—keep your routine steady this week.';
  }, [riskScore]);

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  const statusStyle = useMemo(() => {
    if (wellnessSummary.status === 'good') {
      return { backgroundColor: Colors.brand.mint, color: Colors.brand.graphite };
    }
    if (wellnessSummary.status === 'alert') {
      return { backgroundColor: Colors.brand.gold, color: Colors.brand.graphite };
    }
    return { backgroundColor: palette.border, color: palette.text };
  }, [palette, wellnessSummary.status]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: heroBackground }]}
        >
          <View
            style={[
              styles.heroGlow,
              { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.28 : 0.4 },
            ]}
          />
          <View
            style={[
              styles.heroGlowSecondary,
              { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.2 : 0.3 },
            ]}
          />
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}
          >
            Wellness dashboard
          </Text>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>{wellnessSummary.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}
            >
              <Text style={[styles.statusPillText, { color: statusStyle.color }]}
              >
                {wellnessSummary.status === 'good'
                  ? 'Stable'
                  : wellnessSummary.status === 'alert'
                    ? 'Monitor'
                    : 'Pending'}
              </Text>
            </View>
          </View>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}
          >
            {wellnessSummary.subtitle}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Samples</Text>
              <Text style={styles.metricValue}>{wellnessSummary.totalSamples}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Flags</Text>
              <Text style={styles.metricValue}>{wellnessSummary.flaggedSamples}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Reports</Text>
              <Text style={styles.metricValue}>{reportList.length}</Text>
            </View>
          </View>

          <View style={styles.heroAction}>
            {checkInLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Button
                title={checkInMeta.label}
                onPress={handleCheckInPress}
                variant={checkInMeta.allSubmitted || !checkInMeta.hasDogs ? 'secondary' : 'primary'}
              />
            )}
            {checkInError ? (
              <Text style={[styles.heroHelper, { color: 'rgba(255,255,255,0.65)' }]}
              >
                {checkInError}
              </Text>
            ) : (
              <Text style={[styles.heroHelper, { color: 'rgba(255,255,255,0.65)' }]}
              >
                {checkInMeta.helper} - {checkInMeta.allSubmitted ? 'Check-in complete' : 'Check-in pending'}
              </Text>
            )}
          </View>
        </View>

        {access ? (
          <View style={styles.section}>
            <View style={[styles.accessTag, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.accessTagRow}>
                <Text style={[styles.accessTagTitle, { color: palette.text }]}>{planLabel}</Text>
                <View
                  style={[
                    styles.accessTagPill,
                    { backgroundColor: isPremium ? Colors.brand.mint : palette.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.accessTagPillText,
                      { color: isPremium ? Colors.brand.graphite : '#FFFFFF' },
                    ]}
                  >
                    {isPremium ? 'Premium' : 'Free'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.accessTagMeta, { color: palette.muted }]}>{planMeta}</Text>
              <View style={styles.accessTagRow}>
                <Text style={[styles.accessTagMeta, { color: palette.muted }]}>
                  Scans {scansLabel} · Chat {chatsLabel}
                </Text>
                {isFree && !hasService ? (
                  <Pressable onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as any)}>
                    <Text style={[styles.accessTagLink, { color: palette.tint }]}>Upgrade</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {weatherAlert ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/wellness-weather' as Href)}
              style={[
                styles.weatherCard,
                {
                  backgroundColor: palette.card,
                  borderColor:
                    weatherAlert.level === 'danger'
                      ? palette.danger
                      : weatherAlert.type === 'heat'
                        ? Colors.brand.gold
                        : Colors.brand.mint,
                },
              ]}
            >
              <View style={styles.inlineRow}>
                <FontAwesome
                  name={weatherAlert.type === 'heat' ? 'sun-o' : 'snowflake-o'}
                  size={14}
                  color={
                    weatherAlert.level === 'danger'
                      ? palette.danger
                      : weatherAlert.type === 'heat'
                        ? Colors.brand.gold
                        : Colors.brand.mint
                  }
                />
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {weatherAlert.headline ?? 'Weather alert'} · {weatherAlert.label}
                </Text>
              </View>
              {typeof weatherAlert.currentTemp === 'number' ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Now {Math.round(weatherAlert.currentTemp)}°F
                  {typeof weatherAlert.feelsLike === 'number'
                    ? ` (feels ${Math.round(weatherAlert.feelsLike)}°F)`
                    : ''}
                  {weatherAlert.window === 'soon' ? ' · Later today' : ''}
                </Text>
              ) : null}
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {weatherAlert.message}
              </Text>
              <Text style={[styles.helperLink, { color: palette.tint }]}>
                View safety details
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Wellness toolkit</Text>
            <Pressable onPress={() => setShowToolkit((prev) => !prev)} style={styles.toolkitToggle}>
              <Text style={[styles.helperLink, { color: palette.tint }]}>
                {showToolkit ? 'Hide tools' : `View all (${toolkitCount})`}
              </Text>
              <FontAwesome
                name={showToolkit ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={palette.tint}
              />
            </Pressable>
          </View>
          {!showToolkit ? (
            <Pressable
              onPress={() => setShowToolkit(true)}
              style={[
                styles.toolkitCollapsedCard,
                { backgroundColor: palette.card, borderColor: palette.tint },
              ]}
            >
              <View
                style={[
                  styles.toolkitCollapsedGlow,
                  {
                    backgroundColor: palette.tint,
                    opacity: colorScheme === 'light' ? 0.08 : 0.16,
                  },
                ]}
              />
              <View style={styles.toolkitCollapsedHeader}>
                <View style={[styles.toolkitCollapsedIcon, { backgroundColor: palette.tint }]}>
                  <FontAwesome name="th-large" size={12} color="#FFFFFF" />
                </View>
                <Text style={[styles.toolkitCollapsedEyebrow, { color: palette.muted }]}>
                  Wellness toolkit
                </Text>
              </View>
              <Text style={[styles.toolkitCollapsedTitle, { color: palette.text }]}>
                Tap to explore your tools
              </Text>
              <Text style={[styles.toolkitCollapsedSubtitle, { color: palette.muted }]}>
                {toolkitCount} wellness tools ready for you.
              </Text>
              <View style={styles.toolkitCollapsedCta}>
                <Text style={[styles.toolkitCollapsedCtaText, { color: palette.tint }]}>View tools</Text>
                <FontAwesome name="arrow-right" size={12} color={palette.tint} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.quickGrid}>
              {toolkitItems.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.href)}
                  style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <FontAwesome name={item.icon as any} size={16} color={palette.tint} />
                  <Text style={[styles.quickTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.quickSubtitle, { color: palette.muted }]}>{item.subtitle}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {isFree ? (
          <View style={styles.section}>
            <View style={[styles.upgradeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.upgradeHeader}>
                <Text style={[styles.upgradeTitle, { color: palette.text }]}>Premium wellness</Text>
                <Text style={[styles.upgradePrice, { color: palette.tint }]}>$19.99/mo</Text>
              </View>
              <Text style={[styles.upgradeBody, { color: palette.muted }]}>
                Unlimited scans + chat, multi-dog households, and advanced trends. Scooping keeps the
                yard clean and adds auto-captured wellness scans.
              </Text>
              <Button title="Upgrade wellness" onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as any)} />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Weekly pulse</Text>
          {readingsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading insights...</Text>
            </View>
          ) : readingsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}
            >
              {readingsError}
            </Text>
          ) : weeklyPulse.length === 0 ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              We will map weekly wellness once samples start coming in.
            </Text>
          ) : (
            weeklyPulse.map((week) => (
              <View
                key={week.label}
                style={[styles.pulseRow, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View>
                  <Text style={[styles.pulseLabel, { color: palette.text }]}
                  >
                    {week.label}
                  </Text>
                  <Text style={[styles.pulseMeta, { color: palette.muted }]}
                  >
                    {week.count} samples - {week.issueCount} flagged
                  </Text>
                </View>
                <View
                  style={[
                    styles.pulseStatus,
                    {
                      backgroundColor:
                        week.status === 'good'
                          ? Colors.brand.mint
                          : Colors.brand.gold,
                    },
                  ]}
                >
                  <FontAwesome
                    name={week.status === 'good' ? 'check' : 'exclamation'}
                    size={12}
                    color={palette.background}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {isPremium ? (
          <View style={styles.section}>
            <View style={[styles.trendCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.trendHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Trend analytics</Text>
                <Text style={[styles.trendBadge, { color: palette.muted }]}>Premium</Text>
              </View>
              {trendData && 'trend' in trendData ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Last 4 weeks: {((trendData.recentRate ?? 0) * 100).toFixed(0)}% of samples flagged.
                  </Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Trend: {trendData.trend === 'improving' ? 'Improving' : trendData.trend === 'declining' ? 'Declining' : 'Stable'}
                    {trendData.changePct ? ` (${trendData.changePct > 0 ? '+' : ''}${trendData.changePct}%)` : ''}.
                  </Text>
                  {trendData.earlyWarning ? (
                    <Text style={[styles.cardBody, { color: palette.danger }]}>
                      Early warning: flagged samples are trending up. Complete your weekly check-in and share notes.
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Log at least 4 weeks of samples to unlock long-term trends.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}
          >
            Sample profile (3 Cs)
          </Text>
          <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.chartTitle, { color: palette.text }]}>Color profile</Text>
            <View style={[styles.stackBar, { backgroundColor: palette.border }]}>
              {colorStack.total > 0
                ? colorStack.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <View
                        key={segment.key}
                        style={{
                          flex: segment.value,
                          backgroundColor: segment.color,
                        }}
                      />
                    ))
                : null}
            </View>
            <View style={styles.legendRow}>
              {colorStack.segments.map((segment) => (
                <View key={segment.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={[styles.legendText, { color: palette.muted }]}
                  >
                    {segment.label} {segment.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.chartTitle, { color: palette.text }]}
            >
              Consistency range
            </Text>
            <View style={[styles.stackBar, { backgroundColor: palette.border }]}>
              {consistencyStack.total > 0
                ? consistencyStack.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <View
                        key={segment.key}
                        style={{
                          flex: segment.value,
                          backgroundColor: segment.color,
                        }}
                      />
                    ))
                : null}
            </View>
            <View style={styles.legendRow}>
              {consistencyStack.segments.map((segment) => (
                <View key={segment.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={[styles.legendText, { color: palette.muted }]}
                  >
                    {segment.label} {segment.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.chartTitle, { color: palette.text }]}>
              Content signals
            </Text>
            <View style={[styles.stackBar, { backgroundColor: palette.border }]}>
              {contentStack.total > 0
                ? contentStack.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <View
                        key={segment.key}
                        style={{
                          flex: segment.value,
                          backgroundColor: segment.color,
                        }}
                      />
                    ))
                : null}
            </View>
            <View style={styles.legendRow}>
              {contentStack.segments.map((segment) => (
                <View key={segment.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={[styles.legendText, { color: palette.muted }]}>
                    {segment.label} {segment.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {colorStack.unknown + consistencyStack.unknown + contentStack.unknown > 0 ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Some samples were unclear and excluded from the 3C totals.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}
          >
            Latest sample insights
          </Text>
          {readingsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Loading insights...
              </Text>
            </View>
          ) : readingsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{readingsError}</Text>
          ) : readingList.length === 0 ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              No analyzed samples yet. Insights appear after your next service visit.
            </Text>
          ) : (
            readingList.slice(0, 5).map((reading) => {
              const dateLabel = new Date(reading.timestamp).toLocaleDateString();
              const issuesLabel =
                reading.issues.length > 0 ? reading.issues.join(', ') : 'No issues detected';
              const colorLabel = reading.color ?? 'Other';
              const consistencyLabel = reading.consistencyLabel ?? 'Other';
              const contentLabel = reading.contentLabel ?? 'Other';
              return (
                <View
                  key={reading.id}
                  style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}
                    >
                      {dateLabel}
                    </Text>
                    <View
                      style={[
                        styles.cardStatus,
                        {
                          backgroundColor:
                            reading.issues.length > 0
                              ? Colors.brand.gold
                              : Colors.brand.mint,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.cardBody, { color: palette.muted }]}
                  >
                    Color: {colorLabel} • Consistency: {consistencyLabel} • Content: {contentLabel}
                  </Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}
                  >
                    {issuesLabel}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Weekly check-ins
            </Text>
          </View>
          <View
            style={[
              styles.checkInSummaryCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.checkInSummaryHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>This week</Text>
              <View
                style={[
                  styles.checkInStatusPill,
                  { backgroundColor: checkInStatusColor },
                ]}
              >
                <Text style={[styles.checkInStatusText, { color: checkInStatusTextColor }]}>
                  {checkInStatusLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              {checkInMeta.helper}
            </Text>
            {checkInLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>Loading check-in status...</Text>
              </View>
            ) : checkInError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{checkInError}</Text>
            ) : (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {checkInMeta.pendingLabel}
              </Text>
            )}
            <View style={styles.checkInSummaryActions}>
              <Button
                title={checkInMeta.label}
                onPress={handleCheckInPress}
                variant={checkInMeta.allSubmitted || !checkInMeta.hasDogs ? 'secondary' : 'primary'}
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading reports...</Text>
            </View>
          ) : error ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
          ) : reportList.length === 0 ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              No reports yet. Share your first check-in to unlock insights.
            </Text>
          ) : (
            <View
              style={[
                styles.reportListCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              {reportList.slice(0, showAllReports ? reportList.length : 3).map((report, index, list) => {
                const weekLabel = parseDateInput(report.weekStart).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                const risk = assessSymptomRisk(report.symptomTags ?? []);
                const statusLabel = report.noIssues ? 'All good' : labelForSymptomRisk(risk.level);
                const badgeBackground = report.noIssues
                  ? Colors.brand.mint
                  : risk.level === 'vet_now'
                    ? palette.danger
                    : Colors.brand.gold;
                const badgeTextColor =
                  report.noIssues || risk.level !== 'vet_now'
                    ? Colors.brand.graphite
                    : '#FFFFFF';
                const dogLabel =
                  report.dogName ?? (report.scope === 'HOUSEHOLD' ? 'All dogs' : 'Unknown dog');
                const aiFlagCount = report.aiFlagCount ?? 0;
                const detailBits = [
                  report.mediaCount ? `${report.mediaCount} samples` : null,
                  report.symptomTags.length ? `${report.symptomTags.length} symptoms` : null,
                ].filter(Boolean);
                return (
                  <View key={report.id}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/(customer)/check-in',
                          params: { weekStart: report.weekStart },
                        })
                      }
                      style={styles.reportRow}
                    >
                      <View style={styles.reportRowMeta}>
                        <Text style={[styles.reportRowTitle, { color: palette.text }]}>
                          Week of {weekLabel}
                        </Text>
                        <Text style={[styles.helperText, { color: palette.muted }]}>{dogLabel}</Text>
                        {detailBits.length > 0 ? (
                          <Text style={[styles.helperText, { color: palette.muted }]}>
                            {detailBits.join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.reportRowBadges}>
                        <View
                          style={[
                            styles.reportBadge,
                            { backgroundColor: badgeBackground },
                          ]}
                        >
                          <Text style={[styles.reportBadgeText, { color: badgeTextColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                        {aiFlagCount > 0 ? (
                          <View style={[styles.reportBadge, { backgroundColor: palette.danger }]}>
                            <Text style={[styles.reportBadgeText, { color: '#FFFFFF' }]}>
                              Flags {aiFlagCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                    {index < list.length - 1 ? (
                      <View style={[styles.reportDivider, { backgroundColor: palette.border }]} />
                    ) : null}
                  </View>
                );
              })}
              {reportList.length > 3 ? (
                <Pressable onPress={() => setShowAllReports((prev) => !prev)}>
                  <Text style={[styles.helperLink, { color: palette.tint }]}>
                    {showAllReports ? 'Show fewer' : `View all (${reportList.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View
            style={[
              styles.reportExportRow,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.reportExportCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Vet report export</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Share a 1-page PDF with scans, check-ins, and diet notes.
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(app)/(customer)/wellness-review' as Href)}>
              <Text style={[styles.helperLink, { color: palette.tint }]}>Share</Text>
            </Pressable>
          </View>
        </View>

        {riskScore !== null ? (
          <View style={styles.section}>
            <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.riskHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Wellness Risk Score</Text>
                <Text style={[styles.riskBadge, { color: palette.muted }]}>Premium</Text>
              </View>
              <Text style={[styles.riskScore, { color: palette.text }]}>{riskScore}</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>out of 100</Text>
              <View style={[styles.riskBar, { backgroundColor: palette.border }]}>
                <View style={[styles.riskBarFill, { width: `${riskScore}%`, backgroundColor: palette.tint }]} />
              </View>
              {riskNudge ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>{riskNudge}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -120,
    right: -80,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -80,
    left: -40,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metricValue: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroAction: {
    marginTop: 16,
    gap: 8,
  },
  heroHelper: {
    fontSize: 12,
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  accessTag: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  accessTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accessTagTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  accessTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  accessTagPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  accessTagMeta: {
    fontSize: 12,
  },
  accessTagLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  toolkitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolkitCollapsedCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  toolkitCollapsedGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -90,
    right: -80,
  },
  toolkitCollapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolkitCollapsedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolkitCollapsedEyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  toolkitCollapsedTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toolkitCollapsedSubtitle: {
    fontSize: 12,
  },
  toolkitCollapsedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  toolkitCollapsedCtaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickSubtitle: {
    fontSize: 12,
  },
  upgradeCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  upgradePrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  upgradeBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardBody: {
    fontSize: 14,
  },
  checkInSummaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  checkInSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkInStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkInStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  checkInSummaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reportListCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  reportExportRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportExportCopy: {
    flex: 1,
    gap: 4,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  reportRowMeta: {
    flex: 1,
    gap: 2,
  },
  reportRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
  reportRowBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  reportBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reportBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reportDivider: {
    height: 1,
    opacity: 0.6,
  },
  pulseRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  pulseMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  pulseStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendBadge: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  weatherCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stackBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardActions: {
    alignItems: 'flex-start',
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskBadge: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  riskScore: {
    fontSize: 32,
    fontWeight: '800',
  },
  riskBar: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 999,
  },
});
