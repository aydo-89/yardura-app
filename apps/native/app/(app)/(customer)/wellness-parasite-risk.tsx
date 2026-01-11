import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

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
const FULL_MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const RISK_LABELS: Record<ParasiteRiskMonth['fleasTicks'], string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
};

const riskColor = (risk: ParasiteRiskMonth['fleasTicks'], palette: typeof Colors.light) => {
  if (risk === 'HIGH') return Colors.brand.coral;
  if (risk === 'MODERATE') return Colors.brand.gold;
  return Colors.brand.mint;
};

const riskIcon = (risk: ParasiteRiskMonth['fleasTicks']) => {
  if (risk === 'HIGH') return 'exclamation-triangle';
  if (risk === 'MODERATE') return 'minus-circle';
  return 'check-circle';
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
    // Use timestamp to force reminders screen to re-read params
    const timestamp = Date.now().toString();
    router.push({
      pathname: '/(app)/(customer)/reminders' as any,
      params: {
        prefillTitle: title,
        prefillCategory: category,
        prefillNotes: notes,
        prefillFrequencyDays: '30',
        prefillTimestamp: timestamp,
        ...(dueDate ? { prefillDueDate: dueDate } : {}),
      },
    });
  };

  const handleLogMed = (kind: 'FLEA_TICK' | 'HEARTWORM') => {
    const medName = kind === 'FLEA_TICK' ? 'Flea & tick prevention' : 'Heartworm prevention';
    router.push({
      pathname: '/(app)/(customer)/food-log' as any,
      params: {
        quickAdd: 'true',
        quickAddType: 'MEDICATION',
        quickAddName: medName,
      },
    });
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
  };

  // Determine current month's risk status for hero display
  const currentEntry = useMemo(
    () => data?.calendar.find((entry) => entry.month === currentMonth) ?? null,
    [data, currentMonth],
  );
  const overallRisk = useMemo(() => {
    if (!currentEntry) return 'LOW' as const;
    if (currentEntry.fleasTicks === 'HIGH' || currentEntry.heartworm === 'HIGH') return 'HIGH' as const;
    if (currentEntry.fleasTicks === 'MODERATE' || currentEntry.heartworm === 'MODERATE') return 'MODERATE' as const;
    return 'LOW' as const;
  }, [currentEntry]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>SEASONAL GUIDANCE</Text>
          <Text style={[styles.title, { color: palette.text }]}>Parasite Risk</Text>
          {data && (
            <View style={styles.regionBadge}>
              <FontAwesome name="map-marker" size={12} color={palette.tint} />
              <Text style={[styles.regionText, { color: palette.muted }]}>
                {data.state ? `${data.state} · ${data.regionLabel}` : data.regionLabel}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={[styles.loadingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading risk data...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Current Month Hero Card */}
        {data && currentEntry ? (
          <View style={[styles.heroCard, { backgroundColor: `${riskColor(overallRisk, palette)}15`, borderColor: riskColor(overallRisk, palette) }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${riskColor(overallRisk, palette)}25` }]}>
                <FontAwesome name={riskIcon(overallRisk) as any} size={20} color={riskColor(overallRisk, palette)} />
              </View>
              <View style={styles.heroTitleWrap}>
                <Text style={[styles.heroTitle, { color: palette.text }]}>{FULL_MONTH_LABELS[currentMonth]}</Text>
                <Text style={[styles.heroSubtitle, { color: riskColor(overallRisk, palette) }]}>
                  {overallRisk === 'HIGH' ? 'High Risk Period' : overallRisk === 'MODERATE' ? 'Moderate Risk' : 'Low Risk Period'}
                </Text>
              </View>
            </View>
            <View style={styles.heroRiskRow}>
              <View style={styles.heroRiskItem}>
                <View style={[styles.heroRiskDot, { backgroundColor: riskColor(currentEntry.fleasTicks, palette) }]} />
                <Text style={[styles.heroRiskLabel, { color: palette.muted }]}>Fleas & Ticks</Text>
                <Text style={[styles.heroRiskValue, { color: riskColor(currentEntry.fleasTicks, palette) }]}>
                  {RISK_LABELS[currentEntry.fleasTicks]}
                </Text>
              </View>
              <View style={[styles.heroRiskDivider, { backgroundColor: palette.border }]} />
              <View style={styles.heroRiskItem}>
                <View style={[styles.heroRiskDot, { backgroundColor: riskColor(currentEntry.heartworm, palette) }]} />
                <Text style={[styles.heroRiskLabel, { color: palette.muted }]}>Heartworm</Text>
                <Text style={[styles.heroRiskValue, { color: riskColor(currentEntry.heartworm, palette) }]}>
                  {RISK_LABELS[currentEntry.heartworm]}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroHint, { color: palette.muted }]}>
              {overallRisk === 'HIGH'
                ? 'Stay current on preventatives. This is peak parasite season in your area.'
                : overallRisk === 'MODERATE'
                  ? 'Keep preventatives on schedule to stay protected.'
                  : 'Lower activity, but year-round prevention is recommended.'}
            </Text>
          </View>
        ) : null}

        {/* Prevention Reminders Card */}
        {data ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name="bell" size={16} color={palette.tint} />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Set Prevention Reminders</Text>
                <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                  Get notified when high-risk months approach
                </Text>
              </View>
            </View>

            {/* Flea & Tick Section */}
            <View style={styles.reminderSection}>
              <View style={styles.reminderHeader}>
                <FontAwesome name="bug" size={14} color={Colors.brand.coral} />
                <Text style={[styles.reminderTitle, { color: palette.text }]}>Flea & Tick Prevention</Text>
              </View>
              <Text style={[styles.reminderMonths, { color: palette.muted }]}>
                {riskBuckets.fleasTicks.high.length > 0
                  ? `High risk: ${formatMonthList(riskBuckets.fleasTicks.high)}`
                  : 'Low risk year-round in your area'}
              </Text>
              <View style={styles.actionButtonRow}>
                <Pressable
                  onPress={() => handleLogMed('FLEA_TICK')}
                  style={({ pressed }) => [
                    styles.logMedButton,
                    { borderColor: Colors.brand.coral, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <FontAwesome name="medkit" size={12} color={Colors.brand.coral} />
                  <Text style={[styles.logMedButtonText, { color: Colors.brand.coral }]}>Log Med</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddReminder('FLEA_TICK')}
                  style={({ pressed }) => [
                    styles.reminderButton,
                    { backgroundColor: Colors.brand.coral, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <FontAwesome name="bell" size={12} color="#FFFFFF" />
                  <Text style={styles.reminderButtonText}>Set Reminder</Text>
                </Pressable>
              </View>
            </View>

            {/* Heartworm Section */}
            <View style={[styles.reminderSection, { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 16 }]}>
              <View style={styles.reminderHeader}>
                <FontAwesome name="heart" size={14} color={Colors.brand.gold} />
                <Text style={[styles.reminderTitle, { color: palette.text }]}>Heartworm Prevention</Text>
              </View>
              <Text style={[styles.reminderMonths, { color: palette.muted }]}>
                {riskBuckets.heartworm.high.length > 0
                  ? `High risk: ${formatMonthList(riskBuckets.heartworm.high)}`
                  : 'Low risk year-round in your area'}
              </Text>
              <View style={styles.actionButtonRow}>
                <Pressable
                  onPress={() => handleLogMed('HEARTWORM')}
                  style={({ pressed }) => [
                    styles.logMedButton,
                    { borderColor: Colors.brand.gold, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <FontAwesome name="medkit" size={12} color={Colors.brand.gold} />
                  <Text style={[styles.logMedButtonText, { color: Colors.brand.gold }]}>Log Med</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddReminder('HEARTWORM')}
                  style={({ pressed }) => [
                    styles.reminderButton,
                    { backgroundColor: Colors.brand.gold, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <FontAwesome name="bell" size={12} color="#FFFFFF" />
                  <Text style={styles.reminderButtonText}>Set Reminder</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Year Calendar Grid */}
        {data ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Year-Round Risk Calendar</Text>
            <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
              Tap any month to see detailed risk levels
            </Text>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: riskColor('LOW', palette) }]} />
                <Text style={[styles.legendText, { color: palette.muted }]}>Low</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: riskColor('MODERATE', palette) }]} />
                <Text style={[styles.legendText, { color: palette.muted }]}>Moderate</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: riskColor('HIGH', palette) }]} />
                <Text style={[styles.legendText, { color: palette.muted }]}>High</Text>
              </View>
            </View>

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
                        backgroundColor: isSelected ? `${palette.tint}12` : 'transparent',
                        borderColor: isSelected ? palette.tint : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.monthHeader}>
                      <Text style={[styles.monthLabel, { color: isCurrent ? palette.tint : palette.text, fontWeight: isCurrent ? '700' : '600' }]}>
                        {MONTH_LABELS[entry.month]}
                      </Text>
                      {isCurrent ? (
                        <View style={[styles.currentDot, { backgroundColor: palette.tint }]} />
                      ) : null}
                    </View>
                    <View style={styles.riskBarsWrap}>
                      <View style={[styles.riskBarSmall, { backgroundColor: riskColor(entry.fleasTicks, palette) }]} />
                      <View style={[styles.riskBarSmall, { backgroundColor: riskColor(entry.heartworm, palette) }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Selected Month Detail */}
        {data && selectedEntry && selectedMonth !== currentMonth ? (
          <View style={[styles.detailCard, { backgroundColor: `${palette.tint}08`, borderColor: palette.border }]}>
            <Text style={[styles.detailTitle, { color: palette.text }]}>{FULL_MONTH_LABELS[selectedMonth]} Risk</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: palette.muted }]}>Fleas & Ticks</Text>
                <View style={[styles.detailBadge, { backgroundColor: `${riskColor(selectedEntry.fleasTicks, palette)}20` }]}>
                  <Text style={[styles.detailBadgeText, { color: riskColor(selectedEntry.fleasTicks, palette) }]}>
                    {RISK_LABELS[selectedEntry.fleasTicks]}
                  </Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: palette.muted }]}>Heartworm</Text>
                <View style={[styles.detailBadge, { backgroundColor: `${riskColor(selectedEntry.heartworm, palette)}20` }]}>
                  <Text style={[styles.detailBadgeText, { color: riskColor(selectedEntry.heartworm, palette) }]}>
                    {RISK_LABELS[selectedEntry.heartworm]}
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  regionText: {
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
  heroCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  heroRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRiskItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  heroRiskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroRiskLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  heroRiskValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroRiskDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  heroHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  reminderSection: {
    gap: 8,
    marginTop: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  reminderMonths: {
    fontSize: 12,
    marginLeft: 22,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  logMedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  logMedButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reminderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  reminderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  monthCell: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: {
    fontSize: 13,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskBarsWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  riskBarSmall: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flex: 1,
    gap: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
