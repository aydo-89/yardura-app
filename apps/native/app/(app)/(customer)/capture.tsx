import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Location from 'expo-location';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload, ApiError } from '@/lib/api/client';
import type { CustomerSummary, DogSummary, WellnessCapture } from '@/lib/api/types';
import { captureWithFallback } from '@/lib/media/imagePicker';
import IndicatorPill from '@/components/wellness/IndicatorPill';

type CaptureStatus = 'idle' | 'capturing' | 'uploading';

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
};

const parseAnalysis = (result: Record<string, unknown> | null): ParsedAnalysis | null => {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  const indicatorRaw = typeof record.indicator === 'string' ? record.indicator : undefined;
  const indicator =
    indicatorRaw === 'watch' || indicatorRaw === 'monitor' || indicatorRaw === 'vet_now'
      ? indicatorRaw
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
    tipsTonight: Array.isArray(record.tips_tonight)
      ? record.tips_tonight.filter((tip) => typeof tip === 'string')
      : undefined,
    redFlags: Array.isArray(record.red_flags)
      ? record.red_flags.filter((flag) => typeof flag === 'string')
      : undefined,
  };
};

export default function OwnerCaptureScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [notSure, setNotSure] = useState(false);
  const [asset, setAsset] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [captures, setCaptures] = useState<WellnessCapture[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const access = summary?.wellnessAccess ?? null;
  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || access?.hasActiveService;
  const scansLabel = isPremium ? 'Unlimited' : `${scansRemaining ?? 0}`;
  const multiDogLocked = access?.maxDogs === 1 && dogs.length > 1;

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
        token: session.token,
      });
      setDogs(data.dogs ?? []);
    } catch (err) {
      console.warn('load-dogs.failed', err);
    }
  }, [session?.token]);

  const loadCaptures = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ captures: WellnessCapture[] }>(
        '/api/mobile/customer/wellness-captures?limit=8',
        { token: session.token },
      );
      setCaptures(data.captures ?? []);
    } catch (err) {
      console.warn('load-captures.failed', err);
    }
  }, [selectedCaptureId, session?.token]);

  const loadAccess = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
        token: session.token,
      });
      setSummary(data);
    } catch (err) {
      console.warn('load-summary.failed', err);
    }
  }, [session?.token]);

  useEffect(() => {
    loadDogs();
    loadCaptures();
    loadAccess();
  }, [loadDogs, loadCaptures, loadAccess]);

  useEffect(() => {
    setSelectedCaptureId(null);
    setRecentOpen(false);
  }, []);

  useEffect(() => {
    if (multiDogLocked) {
      setSelectedDogId(null);
      setNotSure(true);
    }
  }, [multiDogLocked]);

  useEffect(() => {
    if (multiDogLocked) return;
    if (dogs.length === 1) {
      setSelectedDogId(dogs[0].id);
      setNotSure(false);
    }
  }, [dogs, multiDogLocked]);

  const selectedCapture = useMemo(() => {
    if (!captures.length || !selectedCaptureId) return null;
    return captures.find((capture) => capture.id === selectedCaptureId) ?? null;
  }, [captures, selectedCaptureId]);

  const analysis = useMemo(
    () => parseAnalysis(selectedCapture?.analysisResult ?? null),
    [selectedCapture?.analysisResult],
  );

  const handleCapture = useCallback(async () => {
    if (!session?.token) return;
    setError(null);
    setStatus('capturing');
    const result = await captureWithFallback({ kind: 'photo', source: 'camera' });
    if (!result) {
      setStatus('idle');
      setError('Camera capture was cancelled.');
      return;
    }
    setAsset({
      uri: result.uri,
      type: result.mimeType ?? 'image/jpeg',
      name: result.fileName ?? `capture-${Date.now()}.jpg`,
    });
    setSelectedCaptureId(null);
    setStatus('idle');
  }, [session?.token]);

  const handleAnalyze = useCallback(async () => {
    if (!session?.token || !asset) return;
    setStatus('uploading');
    setError(null);
    try {
      let position: Location.LocationObject | null = null;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          const last = await Location.getLastKnownPositionAsync();
          const candidates = [current, last].filter(
            (entry): entry is Location.LocationObject => Boolean(entry?.coords),
          );
          if (candidates.length) {
            candidates.sort(
              (a, b) => (a.coords.accuracy ?? 9999) - (b.coords.accuracy ?? 9999),
            );
            position = candidates[0];
          }
        }
      } catch (locationError) {
        console.warn('capture.location.skipped', locationError);
      }

      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: asset.name ?? `capture-${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      } as any);
      const isSpecificDog = Boolean(selectedDogId) && !notSure;
      const resolvedScope = isSpecificDog ? 'DOG' : 'HOUSEHOLD';
      formData.append('scope', resolvedScope);
      if (isSpecificDog && selectedDogId) {
        formData.append('dogId', selectedDogId);
      }
      if (!isSpecificDog && dogs.length > 0) {
        formData.append('suspectedDogIds', JSON.stringify(dogs.map((dog) => dog.id)));
      }
      if (position?.coords) {
        formData.append('lat', String(position.coords.latitude));
        formData.append('lng', String(position.coords.longitude));
        if (Number.isFinite(position.coords.accuracy)) {
          formData.append('accuracy', String(position.coords.accuracy));
        }
      }

      const data = await apiUpload<{ capture: WellnessCapture }>(
        '/api/mobile/customer/wellness-captures',
        {
          token: session.token,
          body: formData,
        },
      );
      if (data.capture) {
        setCaptures((prev) => [data.capture, ...prev]);
        setSelectedCaptureId(data.capture.id);
      }
      setAsset(null);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { error?: string } | null;
        if (details?.error === 'limit_reached') {
          setError('Free scans are used up for this month. Upgrade for unlimited scans.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to analyze capture.');
      }
    } finally {
      setStatus('idle');
    }
  }, [asset, dogs, notSure, selectedDogId, session?.token]);

  const isReadyToAnalyze = Boolean(asset && status === 'idle');

  const handleDeleteCapture = useCallback(
    (capture: WellnessCapture) => {
      if (!session?.token || deletingId) return;
      Alert.alert('Delete scan?', 'This removes the scan and its results.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(capture.id);
            setError(null);
            try {
              await apiRequest(`/api/mobile/customer/wellness-captures/${capture.id}`, {
                method: 'DELETE',
                token: session.token,
              });
              setCaptures((prev) => prev.filter((item) => item.id !== capture.id));
              if (selectedCaptureId === capture.id) {
                setSelectedCaptureId(null);
              }
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Unable to delete scan.';
              setError(message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [deletingId, selectedCaptureId, session?.token],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Owner stool scan</Text>
          <Text style={[styles.title, { color: palette.text }]}>Capture & analyze</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            1-tap capture with hydration, firmness, and a watch/monitor/vet-now indicator.
          </Text>
        </View>

        {access ? (
          <View style={[styles.accessCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.accessHeader}>
              <Text style={[styles.accessTitle, { color: palette.text }]}>Monthly scans</Text>
              <Text style={[styles.accessValue, { color: palette.text }]}>{scansLabel}</Text>
            </View>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              {isPremium ? 'Unlimited scans included with your plan.' : 'Upgrade for unlimited scans.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Which dog?</Text>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Pick a dog or tap Not sure to tag the household.
          </Text>
          <View style={styles.chipRow}>
            {dogs.map((dog) => (
              <ChoiceChip
                key={dog.id}
                label={dog.name}
                selected={!notSure && selectedDogId === dog.id}
                onPress={() => {
                  setNotSure(false);
                  setSelectedDogId(dog.id);
                }}
                disabled={multiDogLocked}
              />
            ))}
            <ChoiceChip
              label="Not sure"
              selected={notSure}
              onPress={() => {
                setNotSure(true);
                setSelectedDogId(null);
              }}
            />
          </View>
          {multiDogLocked ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Premium unlocks per-dog tagging for multi-dog households.
            </Text>
          ) : null}
          {dogs.length === 0 ? (
            <Pressable onPress={() => router.push('/(app)/(customer)/account')}>
              <Text style={[styles.helperText, { color: palette.tint }]}
              >
                Add a dog profile to personalize insights.
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.captureCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          {asset ? (
            <Image
              source={{ uri: asset.uri }}
              style={styles.preview}
            />
          ) : (
            <View style={[styles.previewPlaceholder, { borderColor: palette.border }]}
            >
              <FontAwesome name="camera" size={26} color={palette.muted} />
              <Text style={[styles.previewText, { color: palette.muted }]}
              >
                Ready when you are
              </Text>
            </View>
          )}
          <View style={styles.captureActions}>
            <Button
              title={status === 'capturing' ? 'Opening camera...' : 'Capture stool'}
              onPress={handleCapture}
              disabled={status === 'capturing' || status === 'uploading'}
            />
            <Button
              title={status === 'uploading' ? 'Analyzing...' : 'Analyze stool'}
              onPress={handleAnalyze}
              disabled={!isReadyToAnalyze || status === 'uploading'}
              variant="secondary"
            />
          </View>
          {status === 'uploading' ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.helperText, { color: palette.muted }]}
              >
                Analyzing the capture...
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}
        </View>

        {selectedCapture ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Results
            </Text>
            <View style={[styles.indicatorCard, { borderColor: palette.border }]}
            >
              <IndicatorPill indicator={analysis?.indicator ?? null} />
              <Text style={[styles.helperText, { color: palette.muted }]}>
                This is not a diagnosis — use this as guidance only.
              </Text>
            </View>

            <View style={styles.metricRow}>
              <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Hydration score</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>
                  {analysis?.hydrationScore ?? '--'}
                </Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Firmness scale</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>
                  {analysis?.firmnessScale ?? '--'}
                </Text>
              </View>
            </View>

            {analysis?.summary ? (
              <View style={[styles.resultCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.resultTitle, { color: palette.text }]}
                >
                  What this could mean
                </Text>
                <Text style={[styles.resultBody, { color: palette.muted }]}>
                  {analysis.summary}
                </Text>
              </View>
            ) : null}

            {analysis?.whatThisCouldMean ? (
              <View style={[styles.resultCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.resultTitle, { color: palette.text }]}
                >
                  Watch for
                </Text>
                <Text style={[styles.resultBody, { color: palette.muted }]}>
                  {analysis.whatThisCouldMean}
                </Text>
              </View>
            ) : null}

            {analysis?.tipsTonight?.length ? (
              <View style={[styles.resultCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.resultTitle, { color: palette.text }]}
                >
                  What to do tonight
                </Text>
                {analysis.tipsTonight.map((tip, index) => (
                  <Text key={`${tip}-${index}`} style={[styles.resultBody, { color: palette.muted }]}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}

            {analysis?.redFlags?.length ? (
              <View style={[styles.resultCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.resultTitle, { color: palette.text }]}
                >
                  Red flags
                </Text>
                {analysis.redFlags.map((flag, index) => (
                  <Text key={`${flag}-${index}`} style={[styles.resultBody, { color: palette.muted }]}>
                    • {flag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {captures.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent scans</Text>
              <Pressable onPress={() => setRecentOpen((prev) => !prev)}>
                <Text style={[styles.helperLink, { color: palette.tint }]}>
                  {recentOpen ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
            {recentOpen ? (
              captures.slice(0, 5).map((capture) => (
                <View
                  key={capture.id}
                  style={[styles.captureRow, { borderColor: palette.border, backgroundColor: palette.card }]}
                >
                  <Pressable
                    style={styles.captureInfo}
                    onPress={() => setSelectedCaptureId(capture.id)}
                  >
                    <Text style={[styles.cardTitle, { color: palette.text }]}>
                      {new Date(capture.capturedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      {capture.dogId ? 'Dog-specific' : 'Household'}
                    </Text>
                  </Pressable>
                  <View style={styles.captureActions}>
                    <IndicatorPill indicator={(capture.analysisResult as any)?.indicator} size="sm" />
                    <Pressable
                      onPress={() => handleDeleteCapture(capture)}
                      disabled={deletingId === capture.id}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <FontAwesome
                        name="trash"
                        size={14}
                        color={deletingId === capture.id ? palette.muted : palette.danger}
                      />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                View previous results without cluttering the capture flow.
              </Text>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.disclaimerTitle, { color: palette.text }]}>
            Safety note
          </Text>
          <Text style={[styles.disclaimerText, { color: palette.muted }]}>
            This is not a diagnosis. Seek veterinary care if there is blood,
            black stool, repeated vomiting, severe diarrhea, or lethargy.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  section: {
    marginTop: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
  },
  helperLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  captureCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginBottom: 12,
  },
  previewPlaceholder: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  previewText: {
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
  },
  indicatorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  resultCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  resultBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  accessCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  accessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accessTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  accessValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  captureRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  captureInfo: {
    flex: 1,
    marginRight: 12,
  },
  captureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
