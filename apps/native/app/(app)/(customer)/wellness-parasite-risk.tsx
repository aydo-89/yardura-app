import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';

type ParasiteRiskMonth = {
  month: number;
  fleasTicks: 'LOW' | 'MODERATE' | 'HIGH';
  heartworm: 'LOW' | 'MODERATE' | 'HIGH';
};

type ParasiteRiskPayload = {
  state: string | null;
  regionLabel: string;
  calendar: ParasiteRiskMonth[];
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RISK_LABELS: Record<ParasiteRiskMonth['fleasTicks'], string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
};

const riskColor = (risk: ParasiteRiskMonth['fleasTicks']) => {
  if (risk === 'HIGH') return Colors.brand.coral;
  if (risk === 'MODERATE') return Colors.brand.gold;
  return Colors.brand.mint;
};

const formatMonthList = (months: number[]) => {
  if (months.length === 0) return 'None';
  return months
    .slice()
    .sort((a, b) => a - b)
    .map((month) => MONTH_LABELS[month])
    .join(', ');
};

const findNextMonth = (months: number[], fromMonth: number) => {
  if (months.length === 0) return null;
  const sorted = months.slice().sort((a, b) => a - b);
  const upcoming = sorted.find((month) => month >= fromMonth);
  return upcoming ?? sorted[0];
};

export default function WellnessParasiteRiskScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [data, setData] = useState<ParasiteRiskPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<ParasiteRiskPayload>(
        '/api/mobile/customer/parasite-risk',
        { token: session.token },
      );
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load parasite risk.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!data?.calendar?.length) return;
    setSelectedMonth((prev) =>
      data.calendar.some((entry) => entry.month === prev)
        ? prev
        : data.calendar[0].month,
    );
  }, [data]);

  const riskBuckets = useMemo(() => {
    if (!data) {
      return {
        fleasTicks: { high: [] as number[], moderate: [] as number[], low: [] as number[] },
        heartworm: { high: [] as number[], moderate: [] as number[], low: [] as number[] },
      };
    }
    const fleasTicks = { high: [] as number[], moderate: [] as number[], low: [] as number[] };
    const heartworm = { high: [] as number[], moderate: [] as number[], low: [] as number[] };
    data.calendar.forEach((entry) => {
      if (entry.fleasTicks === 'HIGH') fleasTicks.high.push(entry.month);
      else if (entry.fleasTicks === 'MODERATE') fleasTicks.moderate.push(entry.month);
      else fleasTicks.low.push(entry.month);

      if (entry.heartworm === 'HIGH') heartworm.high.push(entry.month);
      else if (entry.heartworm === 'MODERATE') heartworm.moderate.push(entry.month);
      else heartworm.low.push(entry.month);
    });
    return { fleasTicks, heartworm };
  }, [data]);

  const selectedEntry = useMemo(
    () => data?.calendar.find((entry) => entry.month === selectedMonth) ?? null,
    [data, selectedMonth],
  );

  const selectedMonthLabel = selectedEntry ? MONTH_LABELS[selectedEntry.month] : '';
  const selectedFleasTicksLabel = selectedEntry ? RISK_LABELS[selectedEntry.fleasTicks] : 'Low';
  const selectedHeartwormLabel = selectedEntry ? RISK_LABELS[selectedEntry.heartworm] : 'Low';

  const resolveNextDueDate = (months: number[]) => {
    const nextMonth = findNextMonth(months, currentMonth);
    if (nextMonth == null) return null;
    const now = new Date();
    const year = nextMonth < currentMonth ? now.getFullYear() + 1 : now.getFullYear();
    const dueDate = new Date(year, nextMonth, 1, 9, 0, 0, 0);
    return dueDate.toISOString();
  };

  const handleAddReminder = (kind: 'FLEA_TICK' | 'HEARTWORM') => {
    const months =
      kind === 'FLEA_TICK' ? riskBuckets.fleasTicks.high : riskBuckets.heartworm.high;
    const monthLabel = formatMonthList(months);
    const dueDate = resolveNextDueDate(months);
    const title =
      kind === 'FLEA_TICK' ? 'Flea & tick prevention' : 'Heartworm prevention';
    const category = kind === 'FLEA_TICK' ? 'FLEA_TICK' : 'MEDS';
    const notes =
      months.length > 0
        ? `High-risk months: ${monthLabel}.`
        : 'Low risk in your region, but prevention can still be helpful.';
    router.push({
      pathname: '/(app)/(customer)/reminders' as any,
      params: {
        prefillTitle: title,
        prefillCategory: category,
        prefillNotes: notes,
        prefillFrequencyDays: '30',
        ...(dueDate ? { prefillDueDate: dueDate } : {}),
      },
    });
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Parasite risk calendar</Text>
          <Text style={[styles.title, { color: palette.text }]}>Seasonal guidance</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Monthly flea, tick, and heartworm risk based on your region.
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading calendar...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {data ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.inlineRow}>
              <FontAwesome name="bug" size={14} color={palette.tint} />
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {data.state ? `${data.state} · ${data.regionLabel}` : data.regionLabel}
              </Text>
            </View>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Seasonal guidance based on your region. Tap a month to explore the risk.
            </Text>
          </View>
        ) : null}

        {data && selectedEntry ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  {selectedMonthLabel} risk
                </Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  {currentMonth === selectedEntry.month ? 'Current month' : 'Selected month'}
                </Text>
              </View>
              <View style={styles.inlineRow}>
                <View
                  style={[
                    styles.riskPill,
                    { backgroundColor: `${riskColor(selectedEntry.fleasTicks)}22`, borderColor: riskColor(selectedEntry.fleasTicks) },
                  ]}
                >
                  <Text style={[styles.riskPillText, { color: riskColor(selectedEntry.fleasTicks) }]}>
                    F/T {selectedFleasTicksLabel}
                  </Text>
                </View>
                <View
                  style={[
                    styles.riskPill,
                    { backgroundColor: `${riskColor(selectedEntry.heartworm)}22`, borderColor: riskColor(selectedEntry.heartworm) },
                  ]}
                >
                  <Text style={[styles.riskPillText, { color: riskColor(selectedEntry.heartworm) }]}>
                    HW {selectedHeartwormLabel}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              {selectedEntry.fleasTicks === 'HIGH' || selectedEntry.heartworm === 'HIGH'
                ? 'High activity this month. Stay on prevention and keep reminders active.'
                : selectedEntry.fleasTicks === 'MODERATE' || selectedEntry.heartworm === 'MODERATE'
                  ? 'Moderate activity. Keep preventatives on schedule.'
                  : 'Low activity. Reminders help maintain consistency year-round.'}
            </Text>
          </View>
        ) : null}

        {data ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>High-risk months</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Tap a month to preview the risk or add a seasonal reminder.
            </Text>

            <Text style={[styles.riskLabel, { color: palette.muted }]}>Fleas & ticks</Text>
            <View style={styles.monthChipRow}>
              {riskBuckets.fleasTicks.high.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>Low risk all year.</Text>
              ) : (
                riskBuckets.fleasTicks.high.map((month) => (
                  <Pressable
                    key={`ft-${month}`}
                    onPress={() => handleSelectMonth(month)}
                    style={[
                      styles.monthChip,
                      {
                        borderColor: riskColor('HIGH'),
                        backgroundColor:
                          selectedMonth === month ? `${riskColor('HIGH')}33` : `${riskColor('HIGH')}1F`,
                      },
                    ]}
                  >
                    <Text style={[styles.monthChipText, { color: riskColor('HIGH') }]}>
                      {MONTH_LABELS[month]}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            <Text style={[styles.riskLabel, { color: palette.muted }]}>Heartworm</Text>
            <View style={styles.monthChipRow}>
              {riskBuckets.heartworm.high.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>Low risk all year.</Text>
              ) : (
                riskBuckets.heartworm.high.map((month) => (
                  <Pressable
                    key={`hw-${month}`}
                    onPress={() => handleSelectMonth(month)}
                    style={[
                      styles.monthChip,
                      {
                        borderColor: riskColor('HIGH'),
                        backgroundColor:
                          selectedMonth === month ? `${riskColor('HIGH')}33` : `${riskColor('HIGH')}1F`,
                      },
                    ]}
                  >
                    <Text style={[styles.monthChipText, { color: riskColor('HIGH') }]}>
                      {MONTH_LABELS[month]}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.actionRow}>
              <Button title="Add flea & tick reminder" onPress={() => handleAddReminder('FLEA_TICK')} />
              <Button
                title="Add heartworm reminder"
                onPress={() => handleAddReminder('HEARTWORM')}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {data ? (
          <View style={[styles.legendCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.helperText, { color: palette.muted }]}>Risk legend</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: riskColor('LOW') }]} />
              <Text style={[styles.legendText, { color: palette.text }]}>Low</Text>
              <View style={[styles.legendSwatch, { backgroundColor: riskColor('MODERATE') }]} />
              <Text style={[styles.legendText, { color: palette.text }]}>Moderate</Text>
              <View style={[styles.legendSwatch, { backgroundColor: riskColor('HIGH') }]} />
              <Text style={[styles.legendText, { color: palette.text }]}>High</Text>
            </View>
            <Text style={[styles.legendNote, { color: palette.muted }]}>
              F/T = Fleas & ticks · HW = Heartworm.
            </Text>
          </View>
        ) : null}

        {data ? (
          <>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Tap a month to compare risk levels.
            </Text>
            <View style={styles.calendarGrid}>
              {data.calendar.map((entry) => {
                const isSelected = entry.month === selectedMonth;
                const isCurrent = entry.month === currentMonth;
                return (
                  <Pressable
                    key={entry.month}
                    onPress={() => handleSelectMonth(entry.month)}
                    style={[
                      styles.monthCell,
                      {
                        backgroundColor: isSelected ? `${palette.tint}12` : palette.card,
                        borderColor: isSelected ? palette.tint : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.monthHeader}>
                      <Text style={[styles.monthLabel, { color: palette.text }]}>
                        {MONTH_LABELS[entry.month]}
                      </Text>
                      {isCurrent ? (
                        <View style={[styles.currentDot, { backgroundColor: palette.tint }]} />
                      ) : null}
                    </View>
                    <View style={styles.riskStack}>
                      <View style={styles.riskLine}>
                        <Text style={[styles.riskTag, { color: palette.muted }]}>F/T</Text>
                        <View style={[styles.riskBar, { backgroundColor: riskColor(entry.fleasTicks) }]} />
                      </View>
                      <View style={styles.riskLine}>
                        <Text style={[styles.riskTag, { color: palette.muted }]}>HW</Text>
                        <View style={[styles.riskBar, { backgroundColor: riskColor(entry.heartworm) }]} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
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
  helperText: {
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  riskPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  riskLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  monthChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    gap: 10,
    marginTop: 8,
  },
  legendCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    marginRight: 10,
  },
  legendNote: {
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthCell: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  riskStack: {
    gap: 6,
  },
  riskLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskTag: {
    fontSize: 10,
    width: 28,
  },
  riskBar: {
    flex: 1,
    height: 8,
    borderRadius: 6,
  },
});
