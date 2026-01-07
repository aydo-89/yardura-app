import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const alertTone = activeAlert
    ? activeAlert.level === 'danger'
      ? palette.danger
      : activeAlert.type === 'heat'
        ? Colors.brand.gold
        : Colors.brand.mint
    : Colors.brand.mint;
  const observedAtLabel = data?.weather?.observedAt
    ? new Date(data.weather.observedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Weather safety</Text>
          <Text style={[styles.title, { color: palette.text }]}>Heat & cold alerts</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Alerts use live conditions and the next 6 hours at your address.
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading weather...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {!data?.weather ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Weather not available</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Add your address to enable local safety alerts.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.alertCard,
                { backgroundColor: palette.card, borderColor: alertTone },
              ]}
            >
              <View style={styles.inlineRow}>
                <FontAwesome
                  name={activeAlert ? (activeAlert.type === 'heat' ? 'sun-o' : 'snowflake-o') : 'check-circle'}
                  size={16}
                  color={alertTone}
                />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  {activeAlert?.headline ?? 'All clear'}
                </Text>
              </View>
              <Text style={[styles.helperText, { color: palette.muted }]}>{locationLabel}</Text>
              <Text style={[styles.alertMessage, { color: palette.text }]}>
                {activeAlert?.message ??
                  'No extreme heat or cold expected in the next 6 hours.'}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.inlineRow}>
                <FontAwesome name="thermometer-half" size={16} color={palette.tint} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Right now</Text>
              </View>
              <Text style={[styles.conditionText, { color: palette.text }]}>{data.weather.condition}</Text>
              <Text style={[styles.currentTemp, { color: palette.text }]}>
                {typeof data.weather.currentTemp === 'number'
                  ? `${Math.round(data.weather.currentTemp)}°F`
                  : '—'}
              </Text>
              <Text style={[styles.currentMeta, { color: palette.muted }]}>
                Feels like{' '}
                {typeof data.weather.feelsLike === 'number'
                  ? `${Math.round(data.weather.feelsLike)}°F`
                  : '—'}
                {observedAtLabel ? ` · Updated ${observedAtLabel}` : ''}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Forecast</Text>
              <View style={styles.metricRow}>
                <View style={[styles.metricCard, { borderColor: palette.border }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Next 6h high</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {typeof data.weather.next6High === 'number'
                      ? `${Math.round(data.weather.next6High)}°F`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.metricCard, { borderColor: palette.border }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Next 6h low</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {typeof data.weather.next6Low === 'number'
                      ? `${Math.round(data.weather.next6Low)}°F`
                      : '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.metricRow}>
                <View style={[styles.metricCard, { borderColor: palette.border }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Today high</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {typeof data.weather.dailyHigh === 'number'
                      ? `${Math.round(data.weather.dailyHigh)}°F`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.metricCard, { borderColor: palette.border }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Today low</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {typeof data.weather.dailyLow === 'number'
                      ? `${Math.round(data.weather.dailyLow)}°F`
                      : '—'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
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
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  conditionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertMessage: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentTemp: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  currentMeta: {
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
});
