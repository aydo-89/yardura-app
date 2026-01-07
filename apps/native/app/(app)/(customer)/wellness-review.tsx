import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { DogSummary, WellnessPreferences } from '@/lib/api/types';
import { API_BASE_URL } from '@/lib/config';

type DatasetPayload = {
  dogs: DogSummary[];
  captures: unknown[];
  proMedia: unknown[];
  weeklyReports: unknown[];
  reminders: unknown[];
  foodLogs: unknown[];
  chatLogs: unknown[];
  weightEntries?: unknown[];
  walks?: unknown[];
};

const REPORT_WINDOW_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
] as const;

const DEFAULT_DATASET_LIMIT = 200;
const SUMMARY_LABELS: Record<string, string> = {
  captures: 'Stool photos',
  proMedia: 'Scooper photos',
  weeklyReports: 'Weekly check-ins',
  foodLogs: 'Food & meds logs',
  reminders: 'Reminders',
  chatLogs: 'AI chats',
  weightEntries: 'Weight entries',
  walks: 'Walks',
};

export default function WellnessReviewScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [prefs, setPrefs] = useState<WellnessPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [dogId, setDogId] = useState<string | null>(null);
  const [pdfDays, setPdfDays] = useState(14);
  const [pdfIncludes, setPdfIncludes] = useState({
    weekly: true,
    food: true,
    images: true,
    chats: true,
    walks: true,
  });

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (dogId) params.set('dogId', dogId);
    const from = new Date();
    from.setDate(from.getDate() - pdfDays);
    params.set('from', from.toISOString());
    params.set('to', new Date().toISOString());
    params.set('limit', String(DEFAULT_DATASET_LIMIT));
    return params.toString();
  };

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    try {
      const dogPayload = await apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
        token: session.token,
      });
      setDogs(dogPayload.dogs ?? []);
    } catch {
      setDogs([]);
    }
  }, [session?.token]);

  const loadDataset = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DatasetPayload>(
        `/api/mobile/customer/wellness-dataset?${buildQuery()}`,
        { token: session.token },
      );
      setDataset(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load dataset.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, dogId, pdfDays]);

  const loadPrefs = useCallback(async () => {
    if (!session?.token) return;
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const data = await apiRequest<WellnessPreferences>('/api/mobile/customer/preferences', {
        token: session.token,
      });
      setPrefs(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load preferences.';
      setPrefsError(message);
    } finally {
      setPrefsLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadDogs();
    loadDataset();
    loadPrefs();
  }, [loadDogs, loadDataset, loadPrefs]);

  const updatePrefs = async (next: Partial<WellnessPreferences>) => {
    if (!session?.token || !prefs) return;
    const optimistic = { ...prefs, ...next };
    setPrefs(optimistic);
    setPrefsError(null);
    try {
      const data = await apiRequest<WellnessPreferences>('/api/mobile/customer/preferences', {
        method: 'PATCH',
        token: session.token,
        body: next,
      });
      setPrefs(data);
    } catch (err) {
      setPrefs(prefs);
      const message = err instanceof Error ? err.message : 'Unable to update preferences.';
      setPrefsError(message);
    }
  };

  const datasetCounts = useMemo(() => {
    if (!dataset) {
      return {
        captures: 0,
        proMedia: 0,
        weeklyReports: 0,
        foodLogs: 0,
        reminders: 0,
        chatLogs: 0,
        weightEntries: 0,
        walks: 0,
      };
    }
    return {
      captures: dataset.captures?.length ?? 0,
      proMedia: dataset.proMedia?.length ?? 0,
      weeklyReports: dataset.weeklyReports?.length ?? 0,
      foodLogs: dataset.foodLogs?.length ?? 0,
      reminders: dataset.reminders?.length ?? 0,
      chatLogs: dataset.chatLogs?.length ?? 0,
      weightEntries: dataset.weightEntries?.length ?? 0,
      walks: dataset.walks?.length ?? 0,
    };
  }, [dataset]);
  const summaryColumns = useMemo(() => {
    const leftKeys = ['captures', 'weeklyReports', 'foodLogs', 'reminders'];
    const rightKeys = ['proMedia', 'chatLogs', 'walks', 'weightEntries'];
    const buildEntry = (key: string) => ({
      key,
      label: SUMMARY_LABELS[key] ?? key,
      value: Number.isFinite(datasetCounts[key as keyof typeof datasetCounts])
        ? Number(datasetCounts[key as keyof typeof datasetCounts])
        : 0,
    });
    return {
      left: leftKeys.map(buildEntry),
      right: rightKeys.map(buildEntry),
    };
  }, [datasetCounts]);
  const hasPdfSelection = useMemo(
    () => Object.values(pdfIncludes).some(Boolean),
    [pdfIncludes],
  );

  const downloadReportPdf = async () => {
    if (!session?.token) return;
    setExporting(true);
    setError(null);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setError('Sharing is not available on this device.');
        setExporting(false);
        return;
      }
      const daysValue = Math.min(Math.max(pdfDays, 3), 30);
      const query = new URLSearchParams();
      if (dogId) query.set('dogId', dogId);
      query.set('days', String(daysValue));
      query.set('includeWeekly', String(pdfIncludes.weekly));
      query.set('includeFood', String(pdfIncludes.food));
      query.set('includeImages', String(pdfIncludes.images));
      query.set('includeChats', String(pdfIncludes.chats));
      query.set('includeWalks', String(pdfIncludes.walks));
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/mobile/customer/wellness-report/pdf?${query.toString()}`;
      const baseDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
      if (!baseDir) {
        setError('Unable to access local storage on this device.');
        setExporting(false);
        return;
      }
      const normalizedDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const reportDir = `${normalizedDir}wellness-reports/`;
      const dirInfo = await FileSystem.getInfoAsync(reportDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(reportDir, { intermediates: true });
      }
      const fileUri = `${reportDir}wellness-report-${Date.now()}.pdf`;
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      await Sharing.shareAsync(result.uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to export PDF.';
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Review & export</Text>
          <Text style={[styles.title, { color: palette.text }]}>Share with your vet</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Review your data and export a shareable report.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Vet report</Text>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Choose a scope and time window to share a 1-page summary with your vet.
          </Text>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog scope</Text>
          <View style={styles.chipRow}>
            <ChoiceChip label="Household" selected={!dogId} onPress={() => setDogId(null)} />
            {dogs.map((dog) => (
              <ChoiceChip
                key={dog.id}
                label={dog.name}
                selected={dogId === dog.id}
                onPress={() => setDogId(dog.id)}
              />
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Report period</Text>
          <View style={styles.chipRow}>
            {REPORT_WINDOW_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={pdfDays === option.value}
                onPress={() => setPdfDays(option.value)}
              />
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Include in report</Text>
          <View style={styles.toggleStack}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.helperText, { color: palette.text }]}>Weekly check-ins</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Symptoms and stool summaries
                </Text>
              </View>
              <Switch
                value={pdfIncludes.weekly}
                onValueChange={(value) => setPdfIncludes((prev) => ({ ...prev, weekly: value }))}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.helperText, { color: palette.text }]}>Food & meds logs</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Recent diet notes
                </Text>
              </View>
              <Switch
                value={pdfIncludes.food}
                onValueChange={(value) => setPdfIncludes((prev) => ({ ...prev, food: value }))}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.helperText, { color: palette.text }]}>Stool images</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Owner + pro captures
                </Text>
              </View>
              <Switch
                value={pdfIncludes.images}
                onValueChange={(value) => setPdfIncludes((prev) => ({ ...prev, images: value }))}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.helperText, { color: palette.text }]}>AI chat notes</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Recent guidance + red flags
                </Text>
              </View>
              <Switch
                value={pdfIncludes.chats}
                onValueChange={(value) => setPdfIncludes((prev) => ({ ...prev, chats: value }))}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.helperText, { color: palette.text }]}>Walks</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Distance + time summaries
                </Text>
              </View>
              <Switch
                value={pdfIncludes.walks}
                onValueChange={(value) => setPdfIncludes((prev) => ({ ...prev, walks: value }))}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
          </View>
          <Button
            title={exporting ? 'Preparing...' : 'Share vet report'}
            onPress={downloadReportPdf}
            disabled={exporting || !hasPdfSelection}
          />
          <Text style={[styles.helperText, { color: palette.muted }]}>
            {hasPdfSelection
              ? 'Uses the selections above for what gets shared.'
              : 'Select at least one section to include.'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>What's included</Text>
          {loading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.helperText, { color: palette.muted }]}>Gathering data...</Text>
            </View>
          ) : error ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryColumn}>
                {summaryColumns.left.map((entry) => (
                  <View key={entry.key} style={[styles.summaryTile, { borderColor: palette.border }]}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.summaryValue, { color: palette.text }]}>{entry.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.summaryColumn}>
                {summaryColumns.right.map((entry) => (
                  <View key={entry.key} style={[styles.summaryTile, { borderColor: palette.border }]}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.summaryValue, { color: palette.text }]}>{entry.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Privacy controls</Text>
          {prefsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.helperText, { color: palette.muted }]}>Loading preferences...</Text>
            </View>
          ) : prefs ? (
            <>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={[styles.helperText, { color: palette.text }]}>Share notes</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>Anonymized check-in notes</Text>
                </View>
                <Switch
                  value={prefs.shareWellnessNotes}
                  onValueChange={(value) => updatePrefs({ shareWellnessNotes: value })}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={[styles.helperText, { color: palette.text }]}>Share captures</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>Anonymized stool photos</Text>
                </View>
                <Switch
                  value={prefs.shareWellnessCaptures}
                  onValueChange={(value) => updatePrefs({ shareWellnessCaptures: value })}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={[styles.helperText, { color: palette.text }]}>Auto-blur photos</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>Hide backgrounds by default</Text>
                </View>
                <Switch
                  value={prefs.autoBlurWellnessPhotos}
                  onValueChange={(value) => updatePrefs({ autoBlurWellnessPhotos: value })}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
            </>
          ) : null}
          {prefsError ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>{prefsError}</Text>
          ) : null}
        </View>

        <Pressable onPress={loadDataset}>
          <Text style={[styles.refreshText, { color: palette.muted }]}>Refresh summary</Text>
        </Pressable>
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
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryColumn: {
    flex: 1,
    gap: 10,
  },
  summaryTile: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  toggleStack: {
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  refreshText: {
    textAlign: 'center',
    fontSize: 12,
  },
});
