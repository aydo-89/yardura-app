import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/config';

type StoolLibraryEntry = {
  id: string;
  label: string;
  firmnessScale: number;
  color: string;
  indicator: 'watch' | 'monitor' | 'vet_now';
  summary: string;
  guidance: string;
  imageUrl?: string | null;
};

const firmnessLabels = ['Very firm', 'Firm', 'Formed', 'Ideal', 'Soft', 'Loose', 'Watery'];

const indicatorConfig = {
  watch: { icon: 'check-circle' as const, label: 'Normal', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', color: '#34D399' },
  monitor: { icon: 'exclamation-circle' as const, label: 'Monitor', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#FBBF24' },
  vet_now: { icon: 'stethoscope' as const, label: 'See Vet', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)', color: '#FB7185' },
};

export default function WellnessStoolLibraryScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [entries, setEntries] = useState<StoolLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<{ entries: StoolLibraryEntry[] }>(
        '/api/mobile/customer/stool-library',
        { token: session.token },
      );
      setEntries(payload.entries ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load stool library.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.headerIcon}>
            <FontAwesome name="book" size={20} color="#FBBF24" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>VISUAL REFERENCE</Text>
            <Text style={[styles.title, { color: palette.text }]}>Stool Library</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Compare examples to quickly assess your dog's digestive health.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading library...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {entries.map((entry) => {
          const firmnessLabel = firmnessLabels[entry.firmnessScale - 1] ?? '—';
          const imageUri =
            entry.imageUrl && typeof entry.imageUrl === 'string'
              ? `${resolvedBaseUrl}${entry.imageUrl.startsWith('/') ? '' : '/'}${entry.imageUrl}`
              : null;
          const config = indicatorConfig[entry.indicator];

          return (
            <View key={entry.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {/* Image with overlay badge */}
              {imageUri ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                  <View style={styles.imageGradient} />
                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
                    <FontAwesome name={config.icon} size={12} color={config.color} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.noImage, { backgroundColor: palette.background }]}>
                  <Text style={{ color: palette.muted, fontSize: 12 }}>No image</Text>
                </View>
              )}

              {/* Content */}
              <View style={styles.content}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>{entry.label}</Text>
                <Text style={[styles.cardMeta, { color: palette.muted }]}>
                  Firmness {entry.firmnessScale}/7 · {firmnessLabel}
                </Text>

                {/* Summary & Guidance combined */}
                <View style={[styles.textBox, { backgroundColor: palette.background }]}>
                  <Text style={[styles.summaryText, { color: palette.text }]}>{entry.summary}</Text>
                  <Text style={[styles.guidanceText, { color: palette.muted }]}>{entry.guidance}</Text>
                </View>

                {/* Firmness Scale */}
                <View style={styles.scaleContainer}>
                  <Text style={styles.scaleLabel}>Firm</Text>
                  <View style={styles.scaleRow}>
                    {Array.from({ length: 7 }).map((_, index) => {
                      const level = index + 1;
                      const active = level <= entry.firmnessScale;
                      return (
                        <View
                          key={level}
                          style={[
                            styles.scaleBar,
                            { backgroundColor: active ? Colors.brand.gold : palette.border },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.scaleLabel}>Loose</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#64748B',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  noImage: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
    marginTop: -4,
  },
  textBox: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  guidanceText: {
    fontSize: 13,
    lineHeight: 18,
  },
  scaleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#475569',
  },
  scaleRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  scaleBar: {
    flex: 1,
    height: 5,
    borderRadius: 5,
  },
});
