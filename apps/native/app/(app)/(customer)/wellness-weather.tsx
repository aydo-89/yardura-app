import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';

type WeatherPayload = {
  location: {
    city: string | null;
    state: string | null;
    lat: number | null;
    lng: number | null;
  };
  weather: {
    currentTemp: number | null;
    feelsLike: number | null;
    condition: string;
    dailyHigh: number | null;
    dailyLow: number | null;
    next6High?: number | null;
    next6Low?: number | null;
    next24High?: number | null;
    next24Low?: number | null;
    observedAt?: string | null;
  } | null;
  alert?: {
    type: 'heat' | 'cold';
    level: 'caution' | 'danger';
    window: 'now' | 'soon';
    headline: string;
    message: string;
  } | null;
  alerts?: {
    heat: {
      type: 'heat' | 'cold';
      level: 'caution' | 'danger';
      window: 'now' | 'soon';
      headline: string;
      message: string;
    } | null;
    cold: {
      type: 'heat' | 'cold';
      level: 'caution' | 'danger';
      window: 'now' | 'soon';
      headline: string;
      message: string;
    } | null;
  };
};

const getWalkSafetyStatus = (temp: number | null) => {
  if (temp === null) return { status: 'unknown', label: 'Unknown', color: Colors.brand.gold };
  if (temp >= 90) return { status: 'danger', label: 'Too Hot', color: Colors.brand.coral };
  if (temp >= 80) return { status: 'caution', label: 'Use Caution', color: Colors.brand.gold };
  if (temp <= 32) return { status: 'danger', label: 'Too Cold', color: '#6CB4EE' };
  if (temp <= 40) return { status: 'caution', label: 'Bundle Up', color: '#6CB4EE' };
  return { status: 'good', label: 'Great for Walks', color: Colors.brand.mint };
};

const getWalkIcon = (status: string): keyof typeof FontAwesome.glyphMap => {
  if (status === 'danger') return 'exclamation-triangle';
  if (status === 'caution') return 'minus-circle';
  return 'check-circle';
};

export default function WellnessWeatherScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<WeatherPayload>('/api/mobile/customer/weather', {
        token: session.token,
      });
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load weather.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const locationLabel =
    data?.location?.city && data?.location?.state
      ? `${data.location.city}, ${data.location.state}`
      : 'Location unavailable';

  const activeAlert = data?.alert ?? data?.alerts?.heat ?? data?.alerts?.cold ?? null;
  const walkStatus = getWalkSafetyStatus(data?.weather?.currentTemp ?? null);

  const observedAtLabel = data?.weather?.observedAt
    ? new Date(data.weather.observedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const currentTemp = data?.weather?.currentTemp;
  const feelsLike = data?.weather?.feelsLike;
  const condition = data?.weather?.condition ?? 'Unknown';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>WALK CONDITIONS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Weather Safety</Text>
          {data?.location?.city && (
            <View style={styles.locationBadge}>
              <FontAwesome name="map-marker" size={12} color={palette.tint} />
              <Text style={[styles.locationText, { color: palette.muted }]}>{locationLabel}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={[styles.loadingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading weather...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        {!data?.weather && !loading && !error ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${palette.muted}15` }]}>
              <FontAwesome name="cloud" size={24} color={palette.muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Weather not available</Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Add your address in settings to enable local weather safety alerts.
            </Text>
          </View>
        ) : null}

        {data?.weather ? (
          <>
            {/* Walk Safety Hero */}
            <View style={[styles.heroCard, { backgroundColor: `${walkStatus.color}15`, borderColor: walkStatus.color }]}>
              <View style={styles.heroHeader}>
                <View style={[styles.heroIconWrap, { backgroundColor: `${walkStatus.color}25` }]}>
                  <FontAwesome name={getWalkIcon(walkStatus.status)} size={22} color={walkStatus.color} />
                </View>
                <View style={styles.heroTitleWrap}>
                  <Text style={[styles.heroLabel, { color: walkStatus.color }]}>{walkStatus.label}</Text>
                  <Text style={[styles.heroCondition, { color: palette.text }]}>{condition}</Text>
                </View>
                <View style={styles.heroTempWrap}>
                  <Text style={[styles.heroTemp, { color: palette.text }]}>
                    {typeof currentTemp === 'number' ? `${Math.round(currentTemp)}°` : '—'}
                  </Text>
                  {typeof feelsLike === 'number' && (
                    <Text style={[styles.heroFeelsLike, { color: palette.muted }]}>
                      Feels {Math.round(feelsLike)}°
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.heroHint, { color: palette.muted }]}>
                {walkStatus.status === 'danger'
                  ? 'Consider keeping walks very short or staying indoors.'
                  : walkStatus.status === 'caution'
                    ? 'Take precautions - bring water and watch for overheating.'
                    : 'Perfect conditions for outdoor activity with your pup!'}
              </Text>
            </View>

            {/* Active Alert */}
            {activeAlert ? (
              <View style={[styles.alertCard, { backgroundColor: activeAlert.level === 'danger' ? `${palette.danger}10` : `${Colors.brand.gold}10`, borderColor: activeAlert.level === 'danger' ? palette.danger : Colors.brand.gold }]}>
                <View style={styles.alertHeader}>
                  <FontAwesome
                    name={activeAlert.type === 'heat' ? 'sun-o' : 'snowflake-o'}
                    size={18}
                    color={activeAlert.level === 'danger' ? palette.danger : Colors.brand.gold}
                  />
                  <Text style={[styles.alertTitle, { color: activeAlert.level === 'danger' ? palette.danger : Colors.brand.gold }]}>
                    {activeAlert.headline}
                  </Text>
                </View>
                <Text style={[styles.alertMessage, { color: palette.text }]}>
                  {activeAlert.message}
                </Text>
              </View>
            ) : (
              <View style={[styles.noAlertCard, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
                <FontAwesome name="check-circle" size={16} color={Colors.brand.mint} />
                <Text style={[styles.noAlertText, { color: palette.text }]}>
                  No weather advisories for the next 6 hours
                </Text>
              </View>
            )}

            {/* Forecast Card */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="calendar" size={16} color={palette.tint} />
                </View>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Walk Window Forecast</Text>
              </View>

              <View style={styles.forecastGrid}>
                <View style={[styles.forecastItem, { backgroundColor: `${palette.tint}08` }]}>
                  <Text style={[styles.forecastLabel, { color: palette.muted }]}>Next 6 Hours</Text>
                  <View style={styles.forecastRange}>
                    <View style={styles.forecastTemp}>
                      <FontAwesome name="arrow-up" size={10} color={Colors.brand.coral} />
                      <Text style={[styles.forecastValue, { color: palette.text }]}>
                        {typeof data.weather.next6High === 'number' ? `${Math.round(data.weather.next6High)}°` : '—'}
                      </Text>
                    </View>
                    <View style={styles.forecastTemp}>
                      <FontAwesome name="arrow-down" size={10} color="#6CB4EE" />
                      <Text style={[styles.forecastValue, { color: palette.text }]}>
                        {typeof data.weather.next6Low === 'number' ? `${Math.round(data.weather.next6Low)}°` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.forecastItem, { backgroundColor: `${palette.tint}08` }]}>
                  <Text style={[styles.forecastLabel, { color: palette.muted }]}>Today</Text>
                  <View style={styles.forecastRange}>
                    <View style={styles.forecastTemp}>
                      <FontAwesome name="arrow-up" size={10} color={Colors.brand.coral} />
                      <Text style={[styles.forecastValue, { color: palette.text }]}>
                        {typeof data.weather.dailyHigh === 'number' ? `${Math.round(data.weather.dailyHigh)}°` : '—'}
                      </Text>
                    </View>
                    <View style={styles.forecastTemp}>
                      <FontAwesome name="arrow-down" size={10} color="#6CB4EE" />
                      <Text style={[styles.forecastValue, { color: palette.text }]}>
                        {typeof data.weather.dailyLow === 'number' ? `${Math.round(data.weather.dailyLow)}°` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Walk Tips */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${Colors.brand.gold}15` }]}>
                  <FontAwesome name="lightbulb-o" size={16} color={Colors.brand.gold} />
                </View>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Walk Tips</Text>
              </View>
              <View style={styles.tipsList}>
                {currentTemp !== null && currentTemp >= 80 && (
                  <>
                    <View style={styles.tipItem}>
                      <FontAwesome name="tint" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Bring water for both you and your dog</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <FontAwesome name="road" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Check pavement temp - if too hot for your hand, it's too hot for paws</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <FontAwesome name="clock-o" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Walk during cooler morning or evening hours</Text>
                    </View>
                  </>
                )}
                {currentTemp !== null && currentTemp <= 40 && (
                  <>
                    <View style={styles.tipItem}>
                      <FontAwesome name="clock-o" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Keep walks shorter in cold weather</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <FontAwesome name="paw" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Consider dog booties to protect paws from salt and ice</Text>
                    </View>
                  </>
                )}
                {currentTemp !== null && currentTemp > 40 && currentTemp < 80 && (
                  <>
                    <View style={styles.tipItem}>
                      <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Great weather for longer walks and outdoor play!</Text>
                    </View>
                    <View style={styles.tipItem}>
                      <FontAwesome name="tint" size={12} color={palette.tint} />
                      <Text style={[styles.tipText, { color: palette.muted }]}>Still bring water for walks over 30 minutes</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Last Updated */}
            {observedAtLabel && (
              <Pressable onPress={loadData} style={styles.refreshRow}>
                <FontAwesome name="refresh" size={12} color={palette.muted} />
                <Text style={[styles.refreshText, { color: palette.muted }]}>
                  Updated {observedAtLabel} · Tap to refresh
                </Text>
              </Pressable>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 13,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  heroCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroCondition: {
    fontSize: 13,
  },
  heroTempWrap: {
    alignItems: 'flex-end',
  },
  heroTemp: {
    fontSize: 36,
    fontWeight: '700',
  },
  heroFeelsLike: {
    fontSize: 12,
  },
  heroHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 20,
  },
  noAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  noAlertText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  forecastItem: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  forecastLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  forecastRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastTemp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forecastValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  refreshText: {
    fontSize: 12,
  },
});
