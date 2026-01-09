import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  DogSummary,
  WellnessCheckInContext,
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

const MAX_DOGS_DISPLAY = 4;

export default function CustomerHome() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<{
    pendingCount: number;
    totalDogs: number;
    weekStart: string | null;
  }>({ pendingCount: 0, totalDogs: 0, weekStart: null });
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [dogsLoading, setDogsLoading] = useState(false);
  const [dogsError, setDogsError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherAlertPayload | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  const access = summary?.wellnessAccess ?? null;
  const hasService = access?.hasActiveService ?? false;
  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;

  useFocusEffect(
    useCallback(() => {
      if (!session?.token) return undefined;
      let cancelled = false;
      let routed = false;

      const redirectToSetup = (err: unknown) => {
        if (routed) return true;
        if (isCustomerSetupRequired(err)) {
          routed = true;
          if (!cancelled) {
            router.replace('/(app)/(customer)/setup');
          }
          return true;
        }
        return false;
      };

      const loadSummary = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await apiRequest<CustomerSummary>(
            '/api/mobile/customer/summary',
            { token: session.token },
          );
          if (!cancelled) setSummary(data);
        } catch (err) {
          if (cancelled || redirectToSetup(err)) return;
          const message =
            err instanceof Error ? err.message : 'Unable to load summary.';
          setError(message);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      const loadCheckInStatus = async () => {
        setCheckInLoading(true);
        setCheckInError(null);
        try {
          const data = await apiRequest<WellnessCheckInContext>(
            '/api/mobile/customer/wellness-check-in',
            { token: session.token },
          );
          if (!cancelled) {
            const pending = data.dogs.filter((dog) => !dog.currentWeekReport).length;
            setCheckInStatus({
              pendingCount: pending,
              totalDogs: data.dogs.length,
              weekStart: data.weekStart,
            });
          }
        } catch (err) {
          if (cancelled || redirectToSetup(err)) return;
          const message =
            err instanceof Error ? err.message : 'Unable to load check-in status.';
          setCheckInError(message);
        } finally {
          if (!cancelled) setCheckInLoading(false);
        }
      };

      const loadDogs = async () => {
        setDogsLoading(true);
        setDogsError(null);
        try {
          const data = await apiRequest<{ dogs: DogSummary[] }>(
            '/api/mobile/customer/dogs',
            { token: session.token },
          );
          if (!cancelled) setDogs(data.dogs ?? []);
        } catch (err) {
          if (cancelled || redirectToSetup(err)) return;
          const message =
            err instanceof Error ? err.message : 'Unable to load pets.';
          setDogsError(message);
        } finally {
          if (!cancelled) setDogsLoading(false);
        }
      };

      const loadWeather = async () => {
        setWeatherError(false);
        try {
          const data = await apiRequest<WeatherAlertPayload>(
            '/api/mobile/customer/weather',
            { token: session.token },
          );
          if (!cancelled) {
            setWeather(data);
          }
        } catch {
          if (!cancelled) setWeatherError(true);
        }
      };

      loadSummary();
      loadCheckInStatus();
      loadDogs();
      loadWeather();
      return () => {
        cancelled = true;
      };
    }, [session?.token]),
  );

  const locationLabel =
    summary?.customer?.city && summary?.customer?.state
      ? `${summary.customer.city}, ${summary.customer.state}`
      : null;

  const formatDate = (value?: string | null) => {
    if (!value) return 'Not scheduled';
    const date = parseDateInput(value);
    if (Number.isNaN(date.getTime())) return 'Not scheduled';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const checkInWeekLabel = useMemo(() => {
    if (!checkInStatus.weekStart) return 'This week';
    const date = parseDateInput(checkInStatus.weekStart);
    if (Number.isNaN(date.getTime())) return 'This week';
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [checkInStatus.weekStart]);

  const hasDogs = checkInStatus.totalDogs > 0;
  const allSubmitted = hasDogs && checkInStatus.pendingCount === 0;
  const showCheckInPrompt = hasDogs && checkInStatus.pendingCount > 0;
  const buttonLabel = !hasDogs
    ? 'Add dogs to start'
    : checkInStatus.pendingCount === checkInStatus.totalDogs
      ? 'Start check-in'
      : `Finish ${checkInStatus.pendingCount} check-in${checkInStatus.pendingCount === 1 ? '' : 's'}`;

  const handleCheckInPress = () => {
    if (!hasDogs) {
      router.push('/(app)/(customer)/account');
      return;
    }
    if (checkInStatus.weekStart) {
      router.push({
        pathname: '/(app)/(customer)/check-in',
        params: { weekStart: checkInStatus.weekStart },
      });
    } else {
      router.push('/(app)/(customer)/check-in');
    }
  };

  const nextVisitLabel = formatDate(summary?.nextVisit?.scheduledDate);

  const wellnessStatus = useMemo(() => {
    if (!summary?.latestReport) {
      return { label: 'Awaiting samples', tone: 'pending' } as const;
    }
    if (summary.latestReport.noIssues) {
      return { label: 'All clear', tone: 'good' } as const;
    }
    const risk = assessSymptomRisk(summary.latestReport.symptomTags ?? []);
    const label = labelForSymptomRisk(risk.level);
    const tone = risk.level === 'vet_now' ? 'attention' : 'alert';
    return { label, tone } as const;
  }, [summary?.latestReport]);

  const statusColor = useMemo(() => {
    if (wellnessStatus.tone === 'good') return Colors.brand.mint;
    if (wellnessStatus.tone === 'attention') return palette.danger;
    if (wellnessStatus.tone === 'alert') return Colors.brand.gold;
    return palette.border;
  }, [palette, wellnessStatus.tone]);

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  const visibleDogs = dogs.slice(0, MAX_DOGS_DISPLAY);

  const weatherPill = useMemo(() => {
    const currentTemp = weather?.weather?.currentTemp ?? null;
    if (currentTemp == null || Number.isNaN(currentTemp)) return null;
    const alert = weather?.alert ?? weather?.alerts?.heat ?? weather?.alerts?.cold ?? null;
    const tempValue = Math.round(currentTemp);
    const icon: 'snowflake-o' | 'sun-o' | 'cloud' =
      alert?.type === 'cold'
        ? 'snowflake-o'
        : alert?.type === 'heat'
          ? 'sun-o'
          : currentTemp <= 40
            ? 'snowflake-o'
            : currentTemp >= 80
              ? 'sun-o'
              : 'cloud';
    const tone =
      alert?.level === 'danger'
        ? palette.danger
        : alert?.level === 'caution'
          ? Colors.brand.gold
          : Colors.brand.mint;
    return {
      icon,
      label: `${tempValue}°F`,
      tone,
      hasAlert: Boolean(alert),
    };
  }, [palette.danger, weather]);

  // Quick actions - primary (always shown) and secondary (expandable)
  const primaryActions = [
    {
      key: 'scan',
      icon: 'camera' as const,
      title: 'Scan stool',
      route: '/(app)/(customer)/capture' as Href,
    },
    {
      key: 'chat',
      icon: 'comment' as const,
      title: 'Ask AI',
      route: '/(app)/(customer)/chat' as Href,
    },
  ];

  const secondaryActions = [
    {
      key: 'food',
      icon: 'cutlery' as const,
      title: 'Food & meds',
      route: '/(app)/(customer)/food-log' as Href,
    },
    {
      key: 'walks',
      icon: 'road' as const,
      title: 'Walks',
      route: '/(app)/(customer)/wellness-walks' as Href,
    },
    {
      key: 'reminders',
      icon: 'bell' as const,
      title: 'Reminders',
      route: '/(app)/(customer)/reminders' as Href,
    },
    {
      key: 'wellness',
      icon: 'heart' as const,
      title: 'Wellness',
      route: '/(app)/(customer)/wellness' as Href,
    },
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View
            style={[
              styles.heroGlow,
              { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.25 : 0.35 },
            ]}
          />
          <View
            style={[
              styles.heroGlowSecondary,
              { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.18 : 0.28 },
            ]}
          />

          <View style={styles.heroHeader}>
            <View style={styles.heroText}>
              <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
                Welcome back
              </Text>
              <Text style={styles.heroTitle}>
                {session?.user?.name?.split(' ')[0] ?? 'Hi there'}
              </Text>
            </View>

            {/* Weather pill in hero */}
            {weatherPill && !weatherError ? (
              <Pressable
                onPress={() => router.push('/(app)/(customer)/wellness-weather' as Href)}
                style={[
                  styles.weatherPill,
                  { backgroundColor: `${weatherPill.tone}20`, borderColor: weatherPill.tone },
                ]}
              >
                <FontAwesome name={weatherPill.icon} size={14} color={weatherPill.tone} />
                <Text style={[styles.weatherPillText, { color: '#FFFFFF' }]}>
                  {weatherPill.label}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Compact status row */}
          <View style={styles.statusRow}>
            {hasService ? (
              <View style={styles.statusItem}>
                <FontAwesome name="calendar" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statusText}>Next: {nextVisitLabel}</Text>
              </View>
            ) : null}
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>{wellnessStatus.label}</Text>
            </View>
            {locationLabel ? (
              <View style={styles.statusItem}>
                <FontAwesome name="map-marker" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statusText}>{locationLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Pack avatars */}
          {dogs.length > 0 ? (
            <View style={styles.packRow}>
              <View style={styles.avatarStack}>
                {visibleDogs.map((dog, index) => (
                  <View
                    key={dog.id}
                    style={[
                      styles.avatarWrap,
                      { marginLeft: index === 0 ? 0 : -12, zIndex: 10 - index },
                    ]}
                  >
                    {dog.photoUrl ? (
                      <Image source={{ uri: dog.photoUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: palette.card }]}>
                        <Text style={[styles.avatarFallbackText, { color: palette.text }]}>
                          {dog.name?.slice(0, 1)?.toUpperCase() ?? 'D'}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                {dogs.length > MAX_DOGS_DISPLAY ? (
                  <View style={[styles.avatarWrap, styles.avatarMore]}>
                    <Text style={styles.avatarMoreText}>+{dogs.length - MAX_DOGS_DISPLAY}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.packNames}>
                {dogs.map((d) => d.name).filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : !dogsLoading ? (
            <Pressable
              onPress={() => router.push('/(app)/(customer)/account')}
              style={styles.addDogPrompt}
            >
              <FontAwesome name="plus-circle" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.addDogText}>Add your first dog</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Elevated Check-in CTA - shown when pending */}
        {showCheckInPrompt && !checkInLoading ? (
          <Pressable
            onPress={handleCheckInPress}
            style={[styles.checkInBanner, { backgroundColor: palette.card, borderColor: Colors.brand.gold }]}
          >
            <View style={styles.checkInBannerLeft}>
              <View style={[styles.checkInIconWrap, { backgroundColor: `${Colors.brand.gold}20` }]}>
                <FontAwesome name="paw" size={20} color={Colors.brand.gold} />
              </View>
              <View style={styles.checkInBannerText}>
                <View style={styles.checkInTitleRow}>
                  <Text style={[styles.checkInBannerTitle, { color: palette.text }]}>
                    Weekly check-in
                  </Text>
                  <View style={[styles.checkInPendingBadge, { backgroundColor: `${Colors.brand.gold}20` }]}>
                    <View style={[styles.checkInDot, { backgroundColor: Colors.brand.gold }]} />
                    <Text style={[styles.checkInPendingText, { color: Colors.brand.gold }]}>Due</Text>
                  </View>
                </View>
                <Text style={[styles.checkInBannerMeta, { color: palette.muted }]}>
                  {checkInWeekLabel} · {checkInStatus.pendingCount} of {checkInStatus.totalDogs} dogs pending
                </Text>
              </View>
            </View>
            <View style={[styles.checkInBannerButton, { backgroundColor: Colors.brand.gold }]}>
              <FontAwesome name="chevron-right" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : null}

        {/* Primary Actions - Always visible */}
        <View style={styles.actionsSection}>
          <View style={styles.primaryActions}>
            {primaryActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.route)}
                style={[styles.primaryAction, { backgroundColor: palette.tint }]}
              >
                <FontAwesome name={action.icon} size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>{action.title}</Text>
              </Pressable>
            ))}
          </View>

          {/* More actions toggle */}
          <Pressable
            onPress={() => setShowMoreActions(!showMoreActions)}
            style={[styles.moreToggle, { borderColor: palette.border }]}
          >
            <Text style={[styles.moreToggleText, { color: palette.text }]}>
              {showMoreActions ? 'Less' : 'More tools'}
            </Text>
            <FontAwesome
              name={showMoreActions ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={palette.muted}
            />
          </Pressable>

          {/* Secondary actions - expandable */}
          {showMoreActions ? (
            <View style={styles.secondaryActions}>
              {secondaryActions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={() => router.push(action.route)}
                  style={[styles.secondaryAction, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <FontAwesome name={action.icon} size={16} color={palette.tint} />
                  <Text style={[styles.secondaryActionText, { color: palette.text }]}>
                    {action.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>At a glance</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
            </View>
          ) : error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.statLabel, { color: palette.muted }]}>Dogs</Text>
                <Text style={[styles.statValue, { color: palette.text }]}>{dogs.length}</Text>
              </View>
              {hasService ? (
                <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Next visit</Text>
                  <Text style={[styles.statValue, { color: palette.text }]}>{nextVisitLabel}</Text>
                </View>
              ) : (
                <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Scans left</Text>
                  <Text style={[styles.statValue, { color: palette.text }]}>
                    {access?.tier === 'PREMIUM' ? 'Unlimited' : scansRemaining ?? 0}
                  </Text>
                </View>
              )}
              <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.statLabel, { color: palette.muted }]}>Wellness</Text>
                <View style={styles.statValueRow}>
                  <View style={[styles.miniDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statValue, { color: palette.text }]}>{wellnessStatus.label}</Text>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.statLabel, { color: palette.muted }]}>Check-in</Text>
                <Text style={[styles.statValue, { color: palette.text }]}>
                  {allSubmitted ? 'Done' : hasDogs ? 'Pending' : 'Add dogs'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Check-in card for completed state or errors */}
        {!showCheckInPrompt && hasDogs ? (
          <View style={[styles.checkInCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.checkInHeader}>
              <View>
                <Text style={[styles.checkInTitle, { color: palette.text }]}>Weekly check-in</Text>
                <Text style={[styles.checkInMeta, { color: palette.muted }]}>
                  {checkInWeekLabel}
                </Text>
              </View>
              <View style={[styles.checkInStatusDot, { backgroundColor: Colors.brand.mint }]} />
            </View>
            {checkInError ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>{checkInError}</Text>
            ) : (
              <Button
                title="Edit this week's check-in"
                onPress={handleCheckInPress}
                variant="ghost"
              />
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    right: -60,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -60,
    left: -30,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroText: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  weatherPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  packRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarMoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  packNames: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  addDogPrompt: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  addDogText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  checkInBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  checkInBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkInIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBannerText: {
    flex: 1,
    gap: 4,
  },
  checkInTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkInBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkInPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  checkInDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkInPendingText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkInBannerMeta: {
    fontSize: 12,
  },
  checkInBannerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsSection: {
    marginTop: 20,
    gap: 12,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  moreToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkInCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkInMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  checkInStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
