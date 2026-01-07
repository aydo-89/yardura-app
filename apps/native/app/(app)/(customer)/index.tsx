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
      : 'Location unavailable';

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
  const showCheckInPrompt = !hasDogs || checkInStatus.pendingCount > 0;
  const buttonLabel = !hasDogs
    ? 'Add dogs to start check-ins'
    : checkInStatus.pendingCount === checkInStatus.totalDogs
        ? 'Start weekly check-in'
        : `Finish ${checkInStatus.pendingCount} check-in${checkInStatus.pendingCount === 1 ? '' : 's'}`;
  const buttonVariant = !hasDogs ? 'secondary' : 'primary';

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
  const lastVisitLabel = summary?.lastVisit
    ? formatDate(summary.lastVisit.scheduledDate)
    : 'None yet';

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

  const statusPillStyle = useMemo(() => {
    if (wellnessStatus.tone === 'good') {
      return { backgroundColor: Colors.brand.mint, color: Colors.brand.graphite };
    }
    if (wellnessStatus.tone === 'attention') {
      return { backgroundColor: palette.danger, color: '#FFFFFF' };
    }
    if (wellnessStatus.tone === 'alert') {
      return { backgroundColor: Colors.brand.gold, color: Colors.brand.graphite };
    }
    return { backgroundColor: palette.border, color: palette.text };
  }, [palette, wellnessStatus.tone]);

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  const visibleDogs = dogs.slice(0, MAX_DOGS_DISPLAY);
  const showServiceSnapshot = hasService || Boolean(summary?.nextVisit || summary?.lastVisit);
  const planLabel = access?.tier === 'PREMIUM' ? 'Premium wellness' : 'Free wellness';
  const scansLabel = access?.tier === 'PREMIUM' ? 'Unlimited scans' : `${scansRemaining ?? 0} scans left`;
  const chatsLabel = access?.tier === 'PREMIUM' ? 'Unlimited chat' : `${chatsRemaining ?? 0} chats left`;
  const heroPills = hasService
    ? [
        { icon: 'calendar' as const, label: `Next visit ${nextVisitLabel}` },
        { icon: 'heart' as const, label: `Wellness ${wellnessStatus.label}` },
      ]
    : [
        { icon: 'shield' as const, label: planLabel },
        { icon: 'camera' as const, label: scansLabel },
      ];

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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: heroBackground }]}
        >
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
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Welcome back
          </Text>
          <Text style={styles.heroTitle}>
            {session?.user?.name ?? session?.user?.email ?? 'Customer'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            {locationLabel}
          </Text>

          <View style={styles.heroPills}>
            {heroPills.map((pill) => (
              <View key={pill.label} style={styles.heroPill}>
                <FontAwesome name={pill.icon} size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroPillText}>{pill.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.packRow}>
            <View style={styles.avatarStack}>
              {visibleDogs.map((dog, index) => (
                <View
                  key={dog.id}
                  style={[
                    styles.avatarWrap,
                    { marginLeft: index === 0 ? 0 : -14, zIndex: 10 - index },
                  ]}
                >
                  {dog.photoUrl ? (
                    <Image source={{ uri: dog.photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: palette.card }]}>
                      <Text style={[styles.avatarFallbackText, { color: palette.text }]}
                      >
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
            <View style={styles.packCopy}>
              <Text style={styles.packTitle}>Your pack</Text>
              {dogsLoading ? (
                <Text style={styles.packMeta}>Loading pups...</Text>
              ) : dogsError ? (
                <Text style={styles.packMeta}>Unable to load pets.</Text>
              ) : dogs.length === 0 ? (
                <Text style={styles.packMeta}>Add a pet profile to start tracking wellness.</Text>
              ) : (
                <Text style={styles.packMeta}>
                  {dogs.map((dog) => dog.name).filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/account')}
              style={[styles.packAction, { borderColor: 'rgba(255,255,255,0.24)' }]}
            >
              <FontAwesome name="plus" size={12} color="#FFFFFF" />
              <Text style={styles.packActionText}>Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick actions</Text>
          <View style={styles.quickGrid}>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/capture' as Href)}
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <FontAwesome name="camera" size={16} color={palette.tint} />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Scan stool</Text>
              <Text style={[styles.quickSubtitle, { color: palette.muted }]}>1-tap capture</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/chat' as Href)}
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <FontAwesome name="comment" size={16} color={palette.tint} />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Ask AI</Text>
              <Text style={[styles.quickSubtitle, { color: palette.muted }]}>Symptom Q&A</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/wellness-walks' as Href)}
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <FontAwesome name="map" size={16} color={palette.tint} />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Walk tracking</Text>
              <Text style={[styles.quickSubtitle, { color: palette.muted }]}>GPS route</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/wellness-food-log' as Href)}
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <FontAwesome name="cutlery" size={16} color={palette.tint} />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Food & meds</Text>
              <Text style={[styles.quickSubtitle, { color: palette.muted }]}>Scan + log</Text>
            </Pressable>
          </View>
          <View style={styles.quickLinkRow}>
            <Pressable
              onPress={() => router.push('/(app)/(customer)/reminders' as Href)}
              style={[styles.quickLink, { borderColor: palette.border }]}
            >
              <FontAwesome name="bell" size={14} color={palette.tint} />
              <Text style={[styles.quickLinkText, { color: palette.text }]}>
                Reminders
              </Text>
            </Pressable>
            {weatherPill && !weatherError ? (
              <Pressable
                onPress={() => router.push('/(app)/(customer)/wellness-weather' as Href)}
                style={[
                  styles.quickLink,
                  { borderColor: weatherPill.tone, backgroundColor: `${weatherPill.tone}12` },
                ]}
              >
                <FontAwesome name={weatherPill.icon} size={14} color={weatherPill.tone} />
                <Text style={[styles.quickLinkText, { color: palette.text }]}>
                  {weatherPill.label}
                </Text>
                {weatherPill.hasAlert ? (
                  <FontAwesome name="exclamation-circle" size={12} color={weatherPill.tone} />
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {showServiceSnapshot ? 'Service snapshot' : 'Wellness snapshot'}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusPillStyle.backgroundColor }]}
            >
              <Text style={[styles.statusPillText, { color: statusPillStyle.color }]}>
                {wellnessStatus.label}
              </Text>
            </View>
          </View>

          {summary ? (
            <View style={styles.snapshotGrid}>
              {showServiceSnapshot ? (
                <>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Pets</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {summary.petsCount}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Next visit</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {nextVisitLabel}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Last visit</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {lastVisitLabel}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Latest check-in</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {summary.latestReport ? formatDate(summary.latestReport.weekStart) : 'None yet'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Plan</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {planLabel}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Scans left</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {scansLabel}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Chats left</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {chatsLabel}
                    </Text>
                  </View>
                  <View style={[styles.snapshotTile, { backgroundColor: palette.card, borderColor: palette.border }]}
                  >
                    <Text style={[styles.snapshotLabel, { color: palette.muted }]}>Check-in</Text>
                    <Text style={[styles.snapshotValue, { color: palette.text }]}>
                      {allSubmitted ? 'Complete' : 'Pending'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : loading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Loading summary...
              </Text>
            </View>
          ) : error ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
          ) : (
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              Summary will load after sign-in.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={[styles.checkInCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.checkInHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Weekly check-in</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  {checkInWeekLabel} - {allSubmitted ? 'Complete' : 'Pending'}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: allSubmitted ? Colors.brand.mint : Colors.brand.gold }]} />
            </View>
            {checkInLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Checking this week's status...
                </Text>
              </View>
            ) : checkInError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{checkInError}</Text>
            ) : allSubmitted ? (
              <View style={styles.subtleCheckIn}>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Thanks for keeping us updated. Want to edit a report?
                </Text>
                <Button
                  title="Edit this week's check-in"
                  onPress={handleCheckInPress}
                  variant="ghost"
                />
              </View>
            ) : (
              showCheckInPrompt ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}
                  >
                    {hasDogs
                      ? 'Help us personalize wellness insights with a quick check-in.'
                      : 'Add your dog profiles to unlock wellness check-ins.'}
                  </Text>
                  <Button
                    title={buttonLabel}
                    onPress={handleCheckInPress}
                    variant={buttonVariant}
                    disabled={!hasDogs}
                  />
                </>
              ) : null
            )}
          </View>
        </View>
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
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  heroPills: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroPillText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  packRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 16,
    fontWeight: '700',
  },
  avatarMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarMoreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  packCopy: {
    flex: 1,
    gap: 4,
  },
  packTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  packMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  packAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLinkRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLink: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '600',
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
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  snapshotTile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  snapshotLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  snapshotValue: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBody: {
    fontSize: 14,
  },
  checkInCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subtleCheckIn: {
    gap: 6,
  },
});
