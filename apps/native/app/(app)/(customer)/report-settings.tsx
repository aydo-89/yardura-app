import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import type { CustomerEmailReportPreferences } from '@/lib/api/types';

const REPORT_WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const REPORT_SECTION_OPTIONS: Array<{
  key: keyof CustomerEmailReportPreferences;
  label: string;
  description: string;
}> = [
  { key: 'includeWellness', label: 'Wellness', description: 'Stool analysis and health trends' },
  { key: 'includeScooping', label: 'Scooping', description: 'Service visit summaries' },
  { key: 'includeFood', label: 'Food & meds', description: 'Diet and medication logs' },
  { key: 'includeWalks', label: 'Walks', description: 'Exercise and activity tracking' },
  { key: 'includeReminders', label: 'Reminders', description: 'Upcoming care tasks' },
  { key: 'includeChats', label: 'AI chat', description: 'Conversation summaries' },
  { key: 'includePhotos', label: 'Photos', description: 'Sample images in report' },
];

const REPORT_SEND_HOURS = [
  { label: '7:00 AM', value: 7 },
  { label: '9:00 AM', value: 9 },
  { label: '12:00 PM', value: 12 },
  { label: '6:00 PM', value: 18 },
];

export default function ReportSettingsScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [reportPrefs, setReportPrefs] = useState<CustomerEmailReportPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [dayOfMonthInput, setDayOfMonthInput] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const maybeRedirectToSetup = useCallback((err: unknown) => {
    if (isCustomerSetupRequired(err)) {
      router.replace('/(app)/(customer)/setup');
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    const loadPrefs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<CustomerEmailReportPreferences>(
          '/api/mobile/customer/report-preferences',
          { token: session.token },
        );
        if (!mounted) return;
        setReportPrefs(data);
        setDayOfMonthInput(String(data.dayOfMonth ?? 1));
      } catch (err) {
        if (!mounted || maybeRedirectToSetup(err)) return;
        setError(err instanceof Error ? err.message : 'Unable to load settings.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPrefs();
    return () => {
      mounted = false;
    };
  }, [maybeRedirectToSetup, session?.token]);

  const updatePrefs = useCallback(
    async (payload: Partial<CustomerEmailReportPreferences>) => {
      if (!session?.token || updating) return;
      setError(null);
      setUpdating(true);
      try {
        const data = await apiRequest<CustomerEmailReportPreferences>(
          '/api/mobile/customer/report-preferences',
          {
            method: 'PATCH',
            token: session.token,
            body: payload,
          },
        );
        setReportPrefs(data);
        if (payload.dayOfMonth !== undefined) {
          setDayOfMonthInput(String(data.dayOfMonth ?? payload.dayOfMonth));
        }
      } catch (err) {
        if (maybeRedirectToSetup(err)) return;
        setError(err instanceof Error ? err.message : 'Unable to update settings.');
      } finally {
        setUpdating(false);
      }
    },
    [maybeRedirectToSetup, session?.token, updating],
  );

  const handleToggle = (value: boolean) => updatePrefs({ enabled: value });
  const handleCadence = (value: 'WEEKLY' | 'MONTHLY') => updatePrefs({ cadence: value });
  const handleDayOfWeek = (value: number) => updatePrefs({ dayOfWeek: value });
  const handleSendHour = (value: number) => updatePrefs({ sendHour: value });

  const handleDayOfMonthBlur = () => {
    const parsed = parseInt(dayOfMonthInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 28) {
      setDayOfMonthInput(String(reportPrefs?.dayOfMonth ?? 1));
      return;
    }
    if (parsed !== reportPrefs?.dayOfMonth) {
      updatePrefs({ dayOfMonth: parsed });
    }
  };

  const handleSectionToggle = (key: keyof CustomerEmailReportPreferences) => {
    if (!reportPrefs) return;
    const current = Boolean(reportPrefs[key]);
    updatePrefs({ [key]: !current });
  };

  const handleRecipientAdd = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (reportPrefs?.recipients.includes(email)) return;
    const updated = [...(reportPrefs?.recipients ?? []), email];
    updatePrefs({ recipients: updated });
    setRecipientInput('');
  };

  const handleRecipientRemove = (email: string) => {
    const updated = (reportPrefs?.recipients ?? []).filter((r) => r !== email);
    updatePrefs({ recipients: updated });
  };

  const handleSendNow = async () => {
    if (!session?.token || sendingReport) return;
    setSendingReport(true);
    setSendSuccess(null);
    setSendError(null);
    try {
      await apiRequest('/api/mobile/customer/report-preferences/send-now', {
        method: 'POST',
        token: session.token,
      });
      setSendSuccess('Report sent! Check your inbox.');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to send report.');
    } finally {
      setSendingReport(false);
    }
  };

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : '#1E293B';

  const cadenceLabel = reportPrefs?.cadence === 'MONTHLY' ? 'Monthly' : 'Weekly';
  const dayLabel =
    reportPrefs?.cadence === 'MONTHLY'
      ? `day ${reportPrefs.dayOfMonth ?? 1}`
      : REPORT_WEEKDAYS.find((d) => d.value === reportPrefs?.dayOfWeek)?.label ?? 'Sun';
  const timeLabel =
    REPORT_SEND_HOURS.find((h) => h.value === reportPrefs?.sendHour)?.label ?? '9:00 AM';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={16} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Settings
          </Text>
          <Text style={styles.heroTitle}>Email Reports</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Configure your wellness and scooping email reports.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
          </View>
        ) : reportPrefs ? (
          <View style={styles.content}>
            {/* Enable toggle */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Enable reports</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {reportPrefs.enabled
                      ? `${cadenceLabel} on ${dayLabel} at ${timeLabel}`
                      : 'Reports are currently disabled'}
                  </Text>
                </View>
                <Switch
                  value={reportPrefs.enabled}
                  onValueChange={handleToggle}
                  disabled={updating}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
            </View>

            {reportPrefs.enabled ? (
              <>
                {/* Cadence */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Frequency</Text>
                  <View style={styles.chipRow}>
                    <ChoiceChip
                      label="Weekly"
                      selected={reportPrefs.cadence === 'WEEKLY'}
                      onPress={() => handleCadence('WEEKLY')}
                    />
                    <ChoiceChip
                      label="Monthly"
                      selected={reportPrefs.cadence === 'MONTHLY'}
                      onPress={() => handleCadence('MONTHLY')}
                    />
                  </View>
                </View>

                {/* Day selection */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {reportPrefs.cadence === 'WEEKLY' ? 'Send on' : 'Day of month'}
                  </Text>
                  {reportPrefs.cadence === 'WEEKLY' ? (
                    <View style={styles.chipRow}>
                      {REPORT_WEEKDAYS.map((day) => (
                        <ChoiceChip
                          key={day.value}
                          label={day.label}
                          selected={reportPrefs.dayOfWeek === day.value}
                          onPress={() => handleDayOfWeek(day.value)}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.inlineRow}>
                      <TextInput
                        style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                        value={dayOfMonthInput}
                        onChangeText={setDayOfMonthInput}
                        onBlur={handleDayOfMonthBlur}
                        keyboardType="number-pad"
                        placeholder="1-28"
                        placeholderTextColor={palette.muted}
                      />
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        of the month
                      </Text>
                    </View>
                  )}
                </View>

                {/* Time */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Send time</Text>
                  <View style={styles.chipRow}>
                    {REPORT_SEND_HOURS.map((slot) => (
                      <ChoiceChip
                        key={slot.value}
                        label={slot.label}
                        selected={reportPrefs.sendHour === slot.value}
                        onPress={() => handleSendHour(slot.value)}
                      />
                    ))}
                  </View>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Uses your device time zone.
                  </Text>
                </View>

                {/* Sections */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Include sections</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Choose what to include in your report.
                  </Text>
                  <View style={styles.sectionList}>
                    {REPORT_SECTION_OPTIONS.map((option) => {
                      const isEnabled = Boolean(
                        reportPrefs[option.key as keyof CustomerEmailReportPreferences],
                      );
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => handleSectionToggle(option.key)}
                          style={[
                            styles.sectionItem,
                            { borderColor: palette.border },
                            isEnabled && { borderColor: palette.tint, backgroundColor: `${palette.tint}10` },
                          ]}
                        >
                          <View style={styles.sectionInfo}>
                            <Text style={[styles.sectionLabel, { color: palette.text }]}>
                              {option.label}
                            </Text>
                            <Text style={[styles.sectionDesc, { color: palette.muted }]}>
                              {option.description}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.checkCircle,
                              { borderColor: isEnabled ? palette.tint : palette.border },
                              isEnabled && { backgroundColor: palette.tint },
                            ]}
                          >
                            {isEnabled ? (
                              <FontAwesome name="check" size={10} color="#FFFFFF" />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Recipients */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Recipients</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Your account email receives reports by default. Add others below.
                  </Text>
                  {reportPrefs.recipients.length > 0 ? (
                    <View style={styles.recipientList}>
                      {reportPrefs.recipients.map((email) => (
                        <View
                          key={email}
                          style={[styles.recipientPill, { backgroundColor: palette.background, borderColor: palette.border }]}
                        >
                          <Text style={[styles.recipientText, { color: palette.text }]}>
                            {email}
                          </Text>
                          <Pressable onPress={() => handleRecipientRemove(email)}>
                            <FontAwesome name="times" size={12} color={palette.muted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.addRecipientRow}>
                    <TextInput
                      style={[styles.input, styles.flexInput, { borderColor: palette.border, color: palette.text }]}
                      value={recipientInput}
                      onChangeText={setRecipientInput}
                      placeholder="Add email address"
                      placeholderTextColor={palette.muted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <Button title="Add" onPress={handleRecipientAdd} />
                  </View>
                </View>

                {/* Send now */}
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Send report now</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Get an immediate wellness report for the past week.
                  </Text>
                  <Button
                    title={sendingReport ? 'Sending...' : 'Send Report Now'}
                    onPress={handleSendNow}
                    disabled={sendingReport}
                  />
                  {sendSuccess ? (
                    <Text style={[styles.successText, { color: Colors.brand.mint }]}>
                      {sendSuccess}
                    </Text>
                  ) : null}
                  {sendError ? (
                    <Text style={[styles.errorText, { color: palette.danger }]}>{sendError}</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            {updating ? (
              <Text style={[styles.helperText, { color: palette.muted, textAlign: 'center' }]}>
                Saving...
              </Text>
            ) : null}
            {error ? (
              <Text style={[styles.errorText, { color: palette.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  backButton: {
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
  },
  content: {
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minWidth: 70,
  },
  flexInput: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
  },
  sectionList: {
    gap: 10,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  sectionInfo: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionDesc: {
    fontSize: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recipientText: {
    fontSize: 13,
  },
  addRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
  },
});
