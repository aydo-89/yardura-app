import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
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

type ReportSection = {
  key: keyof typeof DEFAULT_PDF_INCLUDES;
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  description: string;
};

const REPORT_WINDOW_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
] as const;

const DEFAULT_DATASET_LIMIT = 200;

const DEFAULT_PDF_INCLUDES = {
  weekly: true,
  food: true,
  images: true,
  chats: true,
  walks: true,
};

const REPORT_SECTIONS: ReportSection[] = [
  { key: 'weekly', icon: 'calendar-check-o', label: 'Check-ins', description: 'Symptoms & stool summaries' },
  { key: 'food', icon: 'cutlery', label: 'Food & meds', description: 'Diet and medication logs' },
  { key: 'images', icon: 'camera', label: 'Photos', description: 'Owner + pro captures' },
  { key: 'chats', icon: 'comment', label: 'AI chat', description: 'Guidance & insights' },
  { key: 'walks', icon: 'road', label: 'Walks', description: 'Activity summaries' },
];

type DataSummaryItem = {
  key: string;
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  count: number;
  color: string;
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
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  const [dogId, setDogId] = useState<string | null>(null);
  const [pdfDays, setPdfDays] = useState(14);
  const [pdfIncludes, setPdfIncludes] = useState(DEFAULT_PDF_INCLUDES);

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

  const dataSummaryItems: DataSummaryItem[] = useMemo(() => {
    if (!dataset) return [];
    return [
      { key: 'captures', icon: 'camera', label: 'Stool scans', count: dataset.captures?.length ?? 0, color: Colors.brand.coral },
      { key: 'proMedia', icon: 'paw', label: 'Pro photos', count: dataset.proMedia?.length ?? 0, color: Colors.brand.mint },
      { key: 'weeklyReports', icon: 'calendar-check-o', label: 'Check-ins', count: dataset.weeklyReports?.length ?? 0, color: Colors.brand.gold },
      { key: 'foodLogs', icon: 'cutlery', label: 'Food logs', count: dataset.foodLogs?.length ?? 0, color: '#9B59B6' },
      { key: 'chatLogs', icon: 'comment', label: 'AI chats', count: dataset.chatLogs?.length ?? 0, color: palette.tint },
      { key: 'walks', icon: 'road', label: 'Walks', count: dataset.walks?.length ?? 0, color: '#3498DB' },
    ];
  }, [dataset, palette.tint]);

  const totalDataPoints = useMemo(() => {
    return dataSummaryItems.reduce((sum, item) => sum + item.count, 0);
  }, [dataSummaryItems]);

  const selectedSectionCount = useMemo(() => {
    return Object.values(pdfIncludes).filter(Boolean).length;
  }, [pdfIncludes]);

  const hasPdfSelection = selectedSectionCount > 0;

  const downloadReportPdf = async () => {
    if (!session?.token) return;
    setExporting(true);
    setError(null);
    try {
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
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
      const documentDir = FileSystem.documentDirectory ?? null;
      const cacheDir = FileSystem.cacheDirectory ?? null;
      const baseDir = documentDir || cacheDir;
      if (!baseDir) {
        const shareUrl = await apiRequest<{ url: string }>(
          `/api/mobile/customer/wellness-report/pdf?${query.toString()}&share=1`,
          { token: session.token },
        );
        const message = `Wellness report (link expires soon): ${shareUrl.url}`;
        try {
          await Share.share({ message, url: shareUrl.url, title: 'Wellness report' });
        } catch {
          await Linking.openURL(shareUrl.url);
        }
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
      if (canShare) {
        await Sharing.shareAsync(result.uri);
      } else {
        await Share.share({ url: result.uri, title: 'Wellness report' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to export PDF.';
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  const toggleSection = (key: keyof typeof DEFAULT_PDF_INCLUDES) => {
    setPdfIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedDogName = dogId ? dogs.find((d) => d.id === dogId)?.name : 'All dogs';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.tint }]}>
          <View style={styles.heroIcon}>
            <FontAwesome name="file-text-o" size={32} color="#fff" />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Vet Reports</Text>
            <Text style={styles.heroSubtitle}>
              Generate professional wellness reports to share with your veterinarian
            </Text>
          </View>
        </View>

        {/* Report Builder Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="sliders" size={16} color={palette.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Build Your Report</Text>
          </View>

          {/* Dog Selector */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>SELECT DOG</Text>
            <View style={styles.chipRow}>
              <ChoiceChip label="All dogs" selected={!dogId} onPress={() => setDogId(null)} />
              {dogs.map((dog) => (
                <ChoiceChip
                  key={dog.id}
                  label={dog.name}
                  selected={dogId === dog.id}
                  onPress={() => setDogId(dog.id)}
                />
              ))}
            </View>
          </View>

          {/* Time Period */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>TIME PERIOD</Text>
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
          </View>

          {/* Section Toggles */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>INCLUDE SECTIONS</Text>
            <View style={styles.sectionGrid}>
              {REPORT_SECTIONS.map((section) => {
                const isSelected = pdfIncludes[section.key];
                return (
                  <Pressable
                    key={section.key}
                    onPress={() => toggleSection(section.key)}
                    style={[
                      styles.sectionToggle,
                      {
                        backgroundColor: isSelected ? `${palette.tint}15` : palette.background,
                        borderColor: isSelected ? palette.tint : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.sectionToggleHeader}>
                      <FontAwesome
                        name={section.icon}
                        size={16}
                        color={isSelected ? palette.tint : palette.muted}
                      />
                      {isSelected && (
                        <FontAwesome name="check-circle" size={14} color={palette.tint} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.sectionToggleLabel,
                        { color: isSelected ? palette.text : palette.muted },
                      ]}
                    >
                      {section.label}
                    </Text>
                    <Text style={[styles.sectionToggleDesc, { color: palette.muted }]} numberOfLines={1}>
                      {section.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Data Summary Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="database" size={16} color={Colors.brand.mint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Available Data</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                {pdfDays} days • {selectedDogName}
              </Text>
            </View>
            <Pressable onPress={loadDataset} style={styles.refreshButton}>
              <FontAwesome name="refresh" size={14} color={palette.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Gathering data...</Text>
            </View>
          ) : error ? (
            <View style={[styles.errorContainer, { backgroundColor: `${palette.danger}10` }]}>
              <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          ) : (
            <>
              {/* Total Badge */}
              <View style={[styles.totalBadge, { backgroundColor: `${palette.tint}10` }]}>
                <Text style={[styles.totalValue, { color: palette.tint }]}>{totalDataPoints}</Text>
                <Text style={[styles.totalLabel, { color: palette.muted }]}>data points available</Text>
              </View>

              {/* Data Items Grid */}
              <View style={styles.dataGrid}>
                {dataSummaryItems.map((item) => (
                  <View
                    key={item.key}
                    style={[styles.dataItem, { borderColor: palette.border }]}
                  >
                    <View style={[styles.dataItemIcon, { backgroundColor: `${item.color}15` }]}>
                      <FontAwesome name={item.icon} size={14} color={item.color} />
                    </View>
                    <Text style={[styles.dataItemCount, { color: palette.text }]}>{item.count}</Text>
                    <Text style={[styles.dataItemLabel, { color: palette.muted }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Privacy Controls - Collapsible */}
        <Pressable
          onPress={() => setPrivacyExpanded(!privacyExpanded)}
          style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="shield" size={16} color={Colors.brand.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Privacy Controls</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                Manage data sharing preferences
              </Text>
            </View>
            <FontAwesome
              name={privacyExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={palette.muted}
            />
          </View>

          {privacyExpanded && (
            <View style={styles.privacyContent}>
              {prefsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={palette.tint} />
                  <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
                </View>
              ) : prefs ? (
                <View style={styles.toggleStack}>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <Text style={[styles.toggleLabel, { color: palette.text }]}>Share notes</Text>
                      <Text style={[styles.toggleDesc, { color: palette.muted }]}>
                        Anonymized check-in notes for research
                      </Text>
                    </View>
                    <Switch
                      value={prefs.shareWellnessNotes}
                      onValueChange={(value) => updatePrefs({ shareWellnessNotes: value })}
                      trackColor={{ false: palette.border, true: palette.tint }}
                      thumbColor={palette.card}
                    />
                  </View>
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <Text style={[styles.toggleLabel, { color: palette.text }]}>Share captures</Text>
                      <Text style={[styles.toggleDesc, { color: palette.muted }]}>
                        Anonymized stool photos for AI training
                      </Text>
                    </View>
                    <Switch
                      value={prefs.shareWellnessCaptures}
                      onValueChange={(value) => updatePrefs({ shareWellnessCaptures: value })}
                      trackColor={{ false: palette.border, true: palette.tint }}
                      thumbColor={palette.card}
                    />
                  </View>
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <Text style={[styles.toggleLabel, { color: palette.text }]}>Auto-blur photos</Text>
                      <Text style={[styles.toggleDesc, { color: palette.muted }]}>
                        Hide backgrounds by default in app
                      </Text>
                    </View>
                    <Switch
                      value={prefs.autoBlurWellnessPhotos}
                      onValueChange={(value) => updatePrefs({ autoBlurWellnessPhotos: value })}
                      trackColor={{ false: palette.border, true: palette.tint }}
                      thumbColor={palette.card}
                    />
                  </View>
                </View>
              ) : null}
              {prefsError && (
                <Text style={[styles.errorText, { color: palette.danger }]}>{prefsError}</Text>
              )}
            </View>
          )}
        </Pressable>

        {/* Export Section */}
        <View style={[styles.exportCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.exportPreview}>
            <View style={[styles.exportPreviewIcon, { backgroundColor: `${palette.tint}10` }]}>
              <FontAwesome name="file-pdf-o" size={24} color={palette.tint} />
            </View>
            <View style={styles.exportPreviewInfo}>
              <Text style={[styles.exportPreviewTitle, { color: palette.text }]}>
                {selectedDogName} Report
              </Text>
              <Text style={[styles.exportPreviewMeta, { color: palette.muted }]}>
                Last {pdfDays} days • {selectedSectionCount} sections
              </Text>
            </View>
          </View>

          <Button
            title={exporting ? 'Preparing PDF...' : 'Generate & Share Report'}
            onPress={downloadReportPdf}
            disabled={exporting || !hasPdfSelection}
          />

          {!hasPdfSelection && (
            <View style={[styles.warningBanner, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="info-circle" size={14} color={Colors.brand.gold} />
              <Text style={[styles.warningText, { color: Colors.brand.gold }]}>
                Select at least one section to include
              </Text>
            </View>
          )}
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <FontAwesome name="lock" size={12} color={palette.muted} />
          <Text style={[styles.footerText, { color: palette.muted }]}>
            Reports are generated securely and not stored on our servers
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
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldSection: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionToggle: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  sectionToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionToggleDesc: {
    fontSize: 11,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 13,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dataItem: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  dataItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataItemCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  dataItemLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyContent: {
    paddingTop: 4,
  },
  toggleStack: {
    gap: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleDesc: {
    fontSize: 11,
  },
  divider: {
    height: 1,
  },
  exportCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  exportPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  exportPreviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportPreviewInfo: {
    flex: 1,
  },
  exportPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  exportPreviewMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
