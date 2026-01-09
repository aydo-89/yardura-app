import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import IndicatorPill from '@/components/wellness/IndicatorPill';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/config';
import type { WellnessSampleDetail } from '@/lib/api/types';

const goBackToSamples = () => {
  router.replace({
    pathname: '/(app)/(customer)/wellness',
    params: { tab: 'samples' },
  } as Href);
};

type ParsedAnalysis = {
  color?: string;
  consistency?: string;
  content?: string;
  hydrationScore?: number;
  firmnessScale?: number;
  indicator?: 'watch' | 'monitor' | 'vet_now';
  summary?: string;
  whatThisCouldMean?: string;
  tipsTonight?: string[];
  redFlags?: string[];
  flagReason?: string | null;
  needsReview?: boolean;
  wellnessFlag?: boolean;
  cleared?: boolean;
};

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const parseAnalysis = (result: Record<string, unknown> | null): ParsedAnalysis | null => {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  const indicatorRaw = typeof record.indicator === 'string' ? record.indicator : undefined;
  const indicator =
    indicatorRaw === 'watch' || indicatorRaw === 'monitor' || indicatorRaw === 'vet_now'
      ? indicatorRaw
      : undefined;
  const tips = Array.isArray(record.tips_tonight)
    ? record.tips_tonight.filter((tip) => typeof tip === 'string')
    : undefined;
  const redFlags = Array.isArray(record.red_flags)
    ? record.red_flags.filter((flag) => typeof flag === 'string')
    : undefined;
  return {
    color: typeof record.color === 'string' ? record.color : undefined,
    consistency: typeof record.consistency === 'string' ? record.consistency : undefined,
    content: typeof record.content === 'string' ? record.content : undefined,
    hydrationScore:
      typeof record.hydration_score === 'number' ? record.hydration_score : undefined,
    firmnessScale:
      typeof record.firmness_scale === 'number' ? record.firmness_scale : undefined,
    indicator,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    whatThisCouldMean:
      typeof record.what_this_could_mean === 'string' ? record.what_this_could_mean : undefined,
    tipsTonight: tips,
    redFlags,
    flagReason: typeof record.flag_reason === 'string' ? record.flag_reason : null,
    needsReview: Boolean(record.needs_review),
    wellnessFlag: Boolean(record.wellness_flag),
    cleared: Boolean(record.customer_flag_cleared || record.customer_cleared),
  };
};

const buildIssues = (result: Record<string, unknown> | null): string[] => {
  if (!result) return [];
  const cleared = Boolean(result.customer_flag_cleared || result.customer_cleared);
  if (cleared) return [];
  const issues = new Set<string>();
  const content = normalizeText(result.content);
  const flagReason = normalizeText(result.flag_reason);
  const hasWellnessFlag = Boolean(result.wellness_flag);
  const needsReview = Boolean(result.needs_review);

  if (content === 'mucus') issues.add('Mucous');
  if (content === 'blood') issues.add('Blood detected');
  if (content === 'foreign material') issues.add('Foreign material');
  if (flagReason.includes('parasite') || flagReason.includes('worm')) issues.add('Parasite risk');
  if (hasWellnessFlag && issues.size === 0) issues.add('Wellness alert');
  if (needsReview) issues.add('Unclear sample');

  return Array.from(issues);
};

export default function WellnessSampleScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const params = useLocalSearchParams();
  const sampleId = typeof params.id === 'string' ? params.id : null;
  const source = typeof params.source === 'string' ? params.source : 'PRO';
  const [sample, setSample] = useState<WellnessSampleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [clearingFlag, setClearingFlag] = useState(false);

  const resolvedBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  const imageUri = useMemo(() => {
    if (!sample?.imageUrl || typeof sample.imageUrl !== 'string') return null;
    if (sample.imageUrl.startsWith('http')) return sample.imageUrl;
    return `${resolvedBaseUrl}${sample.imageUrl.startsWith('/') ? '' : '/'}${sample.imageUrl}`;
  }, [resolvedBaseUrl, sample?.imageUrl]);

  const analysis = useMemo(
    () => parseAnalysis((sample?.analysisResult as Record<string, unknown> | null) ?? null),
    [sample?.analysisResult],
  );

  const issues = useMemo(() => buildIssues((sample?.analysisResult as Record<string, unknown> | null) ?? null), [
    sample?.analysisResult,
  ]);

  const loadSample = useCallback(async () => {
    if (!session?.token || !sampleId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<{ sample: WellnessSampleDetail }>(
        `/api/mobile/customer/wellness-samples/${sampleId}?source=${source}`,
        { token: session.token },
      );
      setSample(payload.sample);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load sample.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sampleId, session?.token, source]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const clearFlag = useCallback(async () => {
    if (!session?.token || !sampleId) return;
    setClearingFlag(true);
    try {
      await apiRequest('/api/mobile/customer/wellness-flags', {
        method: 'POST',
        token: session.token,
        body: { id: sampleId, source },
      });
      // Reload sample to show updated state
      await loadSample();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to clear flag.';
      Alert.alert('Error', message);
    } finally {
      setClearingFlag(false);
    }
  }, [sampleId, session?.token, source, loadSample]);

  const handleClearFlag = useCallback(() => {
    Alert.alert(
      'Clear wellness flag?',
      'This marks the issue as reviewed and resolved. The sample will no longer appear as flagged.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear flag', onPress: clearFlag },
      ],
    );
  }, [clearFlag]);

  const showClearButton = (issues.length > 0 || analysis?.wellnessFlag || analysis?.needsReview) && !analysis?.cleared;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBackToSamples} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={16} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Sample details</Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading sample...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {sample ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {new Date(sample.capturedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={[styles.cardMeta, { color: palette.muted }]}>
                  {sample.source === 'PRO' ? 'Scooper scan' : 'Owner scan'}
                  {sample.dogName ? ` · ${sample.dogName}` : ''}
                </Text>
              </View>
              <IndicatorPill indicator={analysis?.indicator ?? null} />
            </View>

            {imageUri ? (
              expanded ? (
                <View>
                  <Pressable onPress={() => setRevealed((prev) => !prev)} style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" blurRadius={revealed ? 0 : 18} />
                    <View style={styles.imageGradient} />
                    {!revealed ? (
                      <View style={styles.blurOverlay}>
                        <FontAwesome name="eye" size={16} color="#F8FAFC" />
                        <Text style={styles.blurTitle}>Tap to reveal</Text>
                        <Text style={styles.blurCaption}>Tap again to blur</Text>
                      </View>
                    ) : (
                      <View style={styles.revealPill}>
                        <FontAwesome name="eye-slash" size={12} color="#F8FAFC" />
                        <Text style={styles.revealPillText}>Tap to blur</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setExpanded(false);
                      setRevealed(false);
                    }}
                    style={styles.collapseButton}
                  >
                    <FontAwesome name="chevron-up" size={12} color={palette.muted} />
                    <Text style={[styles.collapseText, { color: palette.muted }]}>Hide image</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setExpanded(true)}
                  style={[styles.collapsedImageCard, { backgroundColor: palette.background, borderColor: palette.border }]}
                >
                  <View style={[styles.collapsedIcon, { backgroundColor: `${palette.muted}20` }]}>
                    <FontAwesome name="image" size={18} color={palette.muted} />
                  </View>
                  <View style={styles.collapsedContent}>
                    <Text style={[styles.collapsedTitle, { color: palette.text }]}>Sample photo available</Text>
                    <Text style={[styles.collapsedSubtitle, { color: palette.muted }]}>Tap to view (blurred by default)</Text>
                  </View>
                  <FontAwesome name="chevron-down" size={12} color={palette.muted} />
                </Pressable>
              )
            ) : (
              <View style={[styles.noImage, { backgroundColor: palette.background }]}>
                <Text style={[styles.helperText, { color: palette.muted }]}>No photo available</Text>
              </View>
            )}

            <View style={styles.metricRow}>
              <View style={[styles.metricCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Color</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>{analysis?.color ?? '—'}</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Consistency</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>{analysis?.consistency ?? '—'}</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Content</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>{analysis?.content ?? '—'}</Text>
              </View>
            </View>

            {(analysis?.hydrationScore ?? null) !== null || (analysis?.firmnessScale ?? null) !== null ? (
              <View style={styles.metricRow}>
                <View style={[styles.metricCard, { backgroundColor: palette.background }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Hydration score</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {analysis?.hydrationScore ?? '—'}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: palette.background }]}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Firmness scale</Text>
                  <Text style={[styles.metricValue, { color: palette.text }]}>
                    {analysis?.firmnessScale ?? '—'}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.sectionCard, { backgroundColor: palette.background }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Signals</Text>
                {analysis?.cleared ? (
                  <View style={[styles.clearedBadge, { backgroundColor: `${Colors.brand.mint}20` }]}>
                    <FontAwesome name="check" size={10} color={Colors.brand.mint} />
                    <Text style={[styles.clearedText, { color: Colors.brand.mint }]}>Cleared</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.sectionBody, { color: palette.muted }]}>
                {issues.length > 0 ? issues.join(' • ') : 'No issues detected.'}
              </Text>
              {analysis?.flagReason ? (
                <Text style={[styles.sectionBody, { color: palette.muted }]}>
                  {analysis.flagReason}
                </Text>
              ) : null}
              {analysis?.needsReview ? (
                <Text style={[styles.sectionBody, { color: palette.muted }]}>
                  Sample was marked for additional review.
                </Text>
              ) : null}
              {showClearButton ? (
                <Button
                  title={clearingFlag ? 'Clearing...' : 'Clear flag'}
                  variant="secondary"
                  onPress={handleClearFlag}
                  disabled={clearingFlag}
                  style={styles.clearButton}
                />
              ) : null}
            </View>

            {analysis?.summary ? (
              <View style={[styles.sectionCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Summary</Text>
                <Text style={[styles.sectionBody, { color: palette.muted }]}>{analysis.summary}</Text>
              </View>
            ) : null}

            {analysis?.whatThisCouldMean ? (
              <View style={[styles.sectionCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>What this could mean</Text>
                <Text style={[styles.sectionBody, { color: palette.muted }]}>{analysis.whatThisCouldMean}</Text>
              </View>
            ) : null}

            {analysis?.tipsTonight?.length ? (
              <View style={[styles.sectionCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>What to do tonight</Text>
                {analysis.tipsTonight.map((tip, index) => (
                  <Text key={`${tip}-${index}`} style={[styles.sectionBody, { color: palette.muted }]}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}

            {analysis?.redFlags?.length ? (
              <View style={[styles.sectionCard, { backgroundColor: palette.background }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Red flags</Text>
                {analysis.redFlags.map((flag, index) => (
                  <Text key={`${flag}-${index}`} style={[styles.sectionBody, { color: palette.muted }]}>
                    • {flag}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.footerRow}>
              <Button title="Back to samples" variant="secondary" onPress={goBackToSamples} />
            </View>
          </View>
        ) : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  blurOverlay: {
    position: 'absolute',
    alignItems: 'center',
    gap: 6,
  },
  blurTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  blurCaption: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  revealPill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  revealPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  noImage: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  clearedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  clearedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 8,
  },
  collapsedImageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  collapsedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedContent: {
    flex: 1,
    gap: 2,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  collapsedSubtitle: {
    fontSize: 12,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  collapseText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerRow: {
    paddingTop: 4,
  },
});
