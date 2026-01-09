import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type FilterType = 'all' | 'watch' | 'monitor' | 'vet_now';

const firmnessLabels = ['Very Firm', 'Firm', 'Formed', 'Ideal', 'Soft', 'Loose', 'Watery'];

const indicatorConfig = {
  watch: {
    icon: 'check-circle' as const,
    label: 'Normal',
    description: 'Healthy stool',
    bg: `${Colors.brand.mint}15`,
    color: Colors.brand.mint,
  },
  monitor: {
    icon: 'exclamation-circle' as const,
    label: 'Monitor',
    description: 'Keep watching',
    bg: `${Colors.brand.gold}15`,
    color: Colors.brand.gold,
  },
  vet_now: {
    icon: 'stethoscope' as const,
    label: 'See Vet',
    description: 'Seek care',
    bg: `${Colors.brand.coral}15`,
    color: Colors.brand.coral,
  },
};

const filterOptions: { key: FilterType; label: string; icon: keyof typeof FontAwesome.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'th-large' },
  { key: 'watch', label: 'Normal', icon: 'check-circle' },
  { key: 'monitor', label: 'Monitor', icon: 'exclamation-circle' },
  { key: 'vet_now', label: 'See Vet', icon: 'stethoscope' },
];

const getFirmnessColor = (scale: number) => {
  if (scale <= 2) return Colors.brand.coral; // Too firm
  if (scale >= 6) return Colors.brand.coral; // Too loose
  if (scale === 4) return Colors.brand.mint; // Ideal
  return Colors.brand.gold; // Acceptable
};

export default function WellnessStoolLibraryScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [entries, setEntries] = useState<StoolLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedImages, setRevealedImages] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return entries;
    return entries.filter((e) => e.indicator === activeFilter);
  }, [entries, activeFilter]);

  const counts = useMemo(() => {
    const result = { all: entries.length, watch: 0, monitor: 0, vet_now: 0 };
    entries.forEach((e) => {
      result[e.indicator]++;
    });
    return result;
  }, [entries]);

  const toggleReveal = (id: string) => {
    setRevealedImages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>VISUAL REFERENCE</Text>
          <Text style={[styles.title, { color: palette.text }]}>Stool Library</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Compare examples to quickly assess your dog's digestive health.
          </Text>
        </View>

        {/* Quick Guide Card */}
        <View style={[styles.guideCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.guideHeader}>
            <View style={[styles.guideIconWrap, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="lightbulb-o" size={18} color={Colors.brand.gold} />
            </View>
            <Text style={[styles.guideTitle, { color: palette.text }]}>Quick Guide</Text>
          </View>
          <View style={styles.guideGrid}>
            <View style={styles.guideItem}>
              <View style={[styles.guideDot, { backgroundColor: Colors.brand.mint }]} />
              <Text style={[styles.guideLabel, { color: palette.muted }]}>Normal - No concern</Text>
            </View>
            <View style={styles.guideItem}>
              <View style={[styles.guideDot, { backgroundColor: Colors.brand.gold }]} />
              <Text style={[styles.guideLabel, { color: palette.muted }]}>Monitor - Watch closely</Text>
            </View>
            <View style={styles.guideItem}>
              <View style={[styles.guideDot, { backgroundColor: Colors.brand.coral }]} />
              <Text style={[styles.guideLabel, { color: palette.muted }]}>See Vet - Seek care soon</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {filterOptions.map((option) => {
            const isActive = activeFilter === option.key;
            const count = counts[option.key];
            return (
              <Pressable
                key={option.key}
                onPress={() => setActiveFilter(option.key)}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isActive ? `${palette.tint}15` : 'transparent',
                    borderColor: isActive ? palette.tint : palette.border,
                  },
                ]}
              >
                <FontAwesome
                  name={option.icon}
                  size={12}
                  color={isActive ? palette.tint : palette.muted}
                />
                <Text style={[styles.filterLabel, { color: isActive ? palette.tint : palette.muted }]}>
                  {option.label}
                </Text>
                <View style={[styles.filterCount, { backgroundColor: isActive ? palette.tint : palette.border }]}>
                  <Text style={[styles.filterCountText, { color: isActive ? '#FFFFFF' : palette.muted }]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={[styles.loadingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading library...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Empty State */}
        {!loading && !error && filteredEntries.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <FontAwesome name="search" size={24} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No entries found</Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              {activeFilter === 'all'
                ? 'The library is empty.'
                : `No ${filterOptions.find((f) => f.key === activeFilter)?.label.toLowerCase()} entries.`}
            </Text>
          </View>
        )}

        {/* Entry Cards */}
        {filteredEntries.map((entry) => {
          const firmnessLabel = firmnessLabels[entry.firmnessScale - 1] ?? '—';
          const imageUri =
            entry.imageUrl && typeof entry.imageUrl === 'string'
              ? `${resolvedBaseUrl}${entry.imageUrl.startsWith('/') ? '' : '/'}${entry.imageUrl}`
              : null;
          const config = indicatorConfig[entry.indicator];
          const isRevealed = Boolean(revealedImages[entry.id]);
          const firmnessColor = getFirmnessColor(entry.firmnessScale);

          return (
            <View key={entry.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {/* Image Section */}
              {imageUri ? (
                <Pressable onPress={() => toggleReveal(entry.id)} style={styles.imageContainer}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="cover"
                    blurRadius={isRevealed ? 0 : 20}
                  />
                  {/* Gradient overlay */}
                  <View style={styles.imageGradient} />

                  {/* Blur overlay content */}
                  {!isRevealed ? (
                    <View style={styles.blurOverlay}>
                      <View style={styles.blurIconWrap}>
                        <FontAwesome name="eye" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.blurTitle}>Tap to reveal image</Text>
                      <Text style={styles.blurSubtitle}>Contains stool sample photo</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => toggleReveal(entry.id)} style={styles.hidePill}>
                      <FontAwesome name="eye-slash" size={11} color="#FFFFFF" />
                      <Text style={styles.hidePillText}>Hide</Text>
                    </Pressable>
                  )}

                  {/* Status Badge - Always visible */}
                  <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                    <FontAwesome name={config.icon} size={13} color={config.color} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={[styles.noImage, { backgroundColor: `${palette.muted}10` }]}>
                  <FontAwesome name="image" size={20} color={palette.muted} />
                  <Text style={[styles.noImageText, { color: palette.muted }]}>No image available</Text>
                  {/* Status Badge for no-image cards */}
                  <View style={[styles.statusBadgeInline, { backgroundColor: config.bg }]}>
                    <FontAwesome name={config.icon} size={12} color={config.color} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>
              )}

              {/* Content Section */}
              <View style={styles.content}>
                {/* Title & Color */}
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{entry.label}</Text>
                  {entry.color && (
                    <View style={styles.colorTag}>
                      <View style={[styles.colorDot, { backgroundColor: entry.color.toLowerCase() === 'brown' ? '#8B4513' : entry.color.toLowerCase() === 'yellow' ? '#DAA520' : entry.color.toLowerCase() === 'green' ? '#228B22' : entry.color.toLowerCase() === 'red' ? '#DC143C' : entry.color.toLowerCase() === 'black' ? '#1a1a1a' : palette.muted }]} />
                      <Text style={[styles.colorText, { color: palette.muted }]}>{entry.color}</Text>
                    </View>
                  )}
                </View>

                {/* Firmness Scale */}
                <View style={styles.firmnessSection}>
                  <View style={styles.firmnessHeader}>
                    <Text style={[styles.firmnessLabel, { color: palette.muted }]}>Firmness</Text>
                    <View style={[styles.firmnessBadge, { backgroundColor: `${firmnessColor}15` }]}>
                      <Text style={[styles.firmnessBadgeText, { color: firmnessColor }]}>
                        {entry.firmnessScale}/7 · {firmnessLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scaleRow}>
                    {Array.from({ length: 7 }).map((_, index) => {
                      const level = index + 1;
                      const active = level <= entry.firmnessScale;
                      const barColor = active
                        ? level <= 2
                          ? Colors.brand.coral
                          : level >= 6
                            ? Colors.brand.coral
                            : level === 4
                              ? Colors.brand.mint
                              : Colors.brand.gold
                        : palette.border;
                      return (
                        <View key={level} style={[styles.scaleBar, { backgroundColor: barColor }]} />
                      );
                    })}
                  </View>
                  <View style={styles.scaleLabels}>
                    <Text style={[styles.scaleLabelText, { color: palette.muted }]}>Firm</Text>
                    <Text style={[styles.scaleLabelText, { color: palette.muted }]}>Ideal</Text>
                    <Text style={[styles.scaleLabelText, { color: palette.muted }]}>Loose</Text>
                  </View>
                </View>

                {/* Summary & Guidance */}
                <View style={[styles.infoBox, { backgroundColor: `${palette.tint}08` }]}>
                  <Text style={[styles.summaryText, { color: palette.text }]}>{entry.summary}</Text>
                  {entry.guidance && (
                    <View style={styles.guidanceRow}>
                      <FontAwesome name="info-circle" size={12} color={palette.tint} />
                      <Text style={[styles.guidanceText, { color: palette.muted }]}>{entry.guidance}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Footer */}
        {!loading && filteredEntries.length > 0 && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: palette.muted }]}>
              Showing {filteredEntries.length} of {entries.length} entries
            </Text>
          </View>
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
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  guideCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  guideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  guideLabel: {
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
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
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
    borderWidth: 1,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
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
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  blurIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  blurTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  blurSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  hidePill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  hidePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noImage: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  noImageText: {
    fontSize: 12,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  colorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorText: {
    fontSize: 12,
    fontWeight: '500',
  },
  firmnessSection: {
    gap: 8,
  },
  firmnessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  firmnessLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  firmnessBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  firmnessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  scaleBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  scaleLabelText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoBox: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  guidanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
  },
});
