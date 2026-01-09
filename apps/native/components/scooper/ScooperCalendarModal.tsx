import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { ScooperRouteVisit } from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';

type CalendarMetric = 'visits' | 'payout' | 'drive';

/**
 * Calendar display mode:
 * - 'view_schedule': Default calendar view (jobs screen) - no comparison overlay
 * - 'compare_offer': Shows "+X" badges for potential offer being considered
 * - 'view_customer': Highlights customer's visits without +X badges (already added)
 */
export type CalendarMode = 'view_schedule' | 'compare_offer' | 'view_customer';

type CalendarDaySummary = {
  date: Date;
  dateKey: string;
  visitCount: number;
  payoutCents: number;
  driveMeters: number;
  driveSeconds: number;
  visits: ScooperRouteVisit[];
};

type ScooperCalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  visits: ScooperRouteVisit[];
  compareVisits?: ScooperRouteVisit[];
  compareLabel?: string;
  compareColor?: string;
  /**
   * Controls how the calendar displays comparison data:
   * - 'view_schedule': No comparison overlay (default for jobs screen)
   * - 'compare_offer': Shows "+X" badges for the potential offer
   * - 'view_customer': Highlights customer's visits without +X (already added)
   */
  mode?: CalendarMode;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_METRICS: Array<{ key: CalendarMetric; label: string }> = [
  { key: 'visits', label: 'Most visits' },
  { key: 'payout', label: 'Highest payout' },
  { key: 'drive', label: 'Most driving' },
];

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(value);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(base: Date, delta: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + delta);
  return startOfMonth(next);
}

function buildMonthGrid(month: Date): Date[] {
  const start = startOfMonth(month);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12, 0, 0, 0);
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDayLabel(value: string) {
  if (!value) return 'Scheduled';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return 'Scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatVisitWindow(
  visit: Pick<ScooperRouteVisit, 'preferredTimeWindowLabel' | 'preferredTimeWindowSlug'>,
): string | null {
  const slug = visit.preferredTimeWindowSlug?.toLowerCase() ?? '';
  if (visit.preferredTimeWindowLabel) {
    return visit.preferredTimeWindowLabel;
  }
  if (slug.includes('morning')) return 'Morning';
  if (slug.includes('afternoon')) return 'Afternoon';
  if (slug.includes('evening')) return 'Evening';
  if (slug.includes('flex')) return 'Flexible';
  return null;
}

function formatCurrencyFromCents(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function resolveVisitPayoutCents(visit: ScooperRouteVisit): number {
  if (typeof visit.payoutCents === 'number') return visit.payoutCents;
  if (typeof visit.projectedPayoutCents === 'number') return visit.projectedPayoutCents;
  return 0;
}

function resolveCalendarMetricValue(
  summary: CalendarDaySummary | undefined,
  metric: CalendarMetric,
): number {
  if (!summary) return 0;
  if (metric === 'payout') return summary.payoutCents;
  if (metric === 'drive') return summary.driveMeters;
  return summary.visitCount;
}

function formatDriveSummary(meters: number, seconds: number): string | null {
  if (!meters || !seconds) return null;
  const miles = (meters / 1609.34).toFixed(1);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${miles} mi - ${minutes} min`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return { r, g, b };
}

function toRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export default function ScooperCalendarModal({
  visible,
  onClose,
  visits,
  compareVisits = [],
  compareLabel = 'Proposed',
  compareColor = Colors.brand.coral,
  mode = 'view_schedule',
  title,
  subtitle,
  loading = false,
  error = null,
}: ScooperCalendarModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mintTone = Colors.brand.mint;
  const compareTone = compareColor;
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const todayKey = localDayKey(new Date());

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [calendarMetric, setCalendarMetric] = useState<CalendarMetric>('visits');
  const [calendarDayKey, setCalendarDayKey] = useState(() => localDayKey(new Date()));

  useEffect(() => {
    if (!visible) return;
    const today = new Date();
    setCalendarMonth(startOfMonth(today));
    setCalendarDayKey(localDayKey(today));
  }, [visible]);

  const calendarSummaries = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    visits.forEach((visit) => {
      const date = parseDateInput(visit.scheduledDate);
      if (Number.isNaN(date.getTime())) return;
      const key = localDayKey(date);
      const existing = map.get(key);
      const summary: CalendarDaySummary =
        existing ??
        ({
          date,
          dateKey: key,
          visitCount: 0,
          payoutCents: 0,
          driveMeters: 0,
          driveSeconds: 0,
          visits: [],
        } as CalendarDaySummary);
      summary.visitCount += 1;
      summary.payoutCents += resolveVisitPayoutCents(visit);
      if (visit.travelFromPrevious) {
        summary.driveMeters += visit.travelFromPrevious.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelFromPrevious.durationSeconds ?? 0;
      }
      if (visit.travelFromHome) {
        summary.driveMeters += visit.travelFromHome.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelFromHome.durationSeconds ?? 0;
      }
      if (visit.travelToHome) {
        summary.driveMeters += visit.travelToHome.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelToHome.durationSeconds ?? 0;
      }
      summary.visits.push(visit);
      map.set(key, summary);
    });
    return map;
  }, [visits]);

  const compareSummaries = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    compareVisits.forEach((visit) => {
      const date = parseDateInput(visit.scheduledDate);
      if (Number.isNaN(date.getTime())) return;
      const key = localDayKey(date);
      const existing = map.get(key);
      const summary: CalendarDaySummary =
        existing ??
        ({
          date,
          dateKey: key,
          visitCount: 0,
          payoutCents: 0,
          driveMeters: 0,
          driveSeconds: 0,
          visits: [],
        } as CalendarDaySummary);
      summary.visitCount += 1;
      summary.payoutCents += resolveVisitPayoutCents(visit);
      if (visit.travelFromPrevious) {
        summary.driveMeters += visit.travelFromPrevious.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelFromPrevious.durationSeconds ?? 0;
      }
      if (visit.travelFromHome) {
        summary.driveMeters += visit.travelFromHome.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelFromHome.durationSeconds ?? 0;
      }
      if (visit.travelToHome) {
        summary.driveMeters += visit.travelToHome.distanceMeters ?? 0;
        summary.driveSeconds += visit.travelToHome.durationSeconds ?? 0;
      }
      summary.visits.push(visit);
      map.set(key, summary);
    });
    return map;
  }, [compareVisits]);

  const calendarDays = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const calendarMonthLabel = useMemo(() => formatMonthLabel(calendarMonth), [calendarMonth]);
  const calendarMaxMetric = useMemo(() => {
    let maxValue = 0;
    const monthIndex = calendarMonth.getMonth();
    calendarDays.forEach((day) => {
      if (day.getMonth() !== monthIndex) return;
      const summary = calendarSummaries.get(localDayKey(day));
      const value = resolveCalendarMetricValue(summary, calendarMetric);
      if (value > maxValue) maxValue = value;
    });
    return maxValue;
  }, [calendarDays, calendarMonth, calendarSummaries, calendarMetric]);

  const selectedSummary = calendarDayKey ? calendarSummaries.get(calendarDayKey) ?? null : null;
  const compareSelectedSummary = calendarDayKey
    ? compareSummaries.get(calendarDayKey) ?? null
    : null;
  const summaryForMetrics = selectedSummary ?? compareSelectedSummary;
  const totalSelectedCount =
    (selectedSummary?.visitCount ?? 0) + (compareSelectedSummary?.visitCount ?? 0);
  const selectedDate = calendarDayKey ? parseDateKey(calendarDayKey) : null;
  const selectedLabel = selectedDate ? formatShortDateLabel(selectedDate) : null;
  const selectedVisits = useMemo(() => {
    if (!selectedSummary?.visits?.length) return [];
    return [...selectedSummary.visits].sort((a, b) => {
      const seqA = a.routeSequence ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.routeSequence ?? Number.MAX_SAFE_INTEGER;
      if (seqA !== seqB) return seqA - seqB;
      return (
        parseDateInput(a.scheduledDate).getTime() -
        parseDateInput(b.scheduledDate).getTime()
      );
    });
  }, [selectedSummary]);
  const compareSelectedVisits = useMemo(() => {
    if (!compareSelectedSummary?.visits?.length) return [];
    return [...compareSelectedSummary.visits].sort((a, b) => {
      const seqA = a.routeSequence ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.routeSequence ?? Number.MAX_SAFE_INTEGER;
      if (seqA !== seqB) return seqA - seqB;
      return (
        parseDateInput(a.scheduledDate).getTime() -
        parseDateInput(b.scheduledDate).getTime()
      );
    });
  }, [compareSelectedSummary]);

  const calendarLegend =
    calendarMetric === 'payout'
      ? 'Darker = higher payout'
      : calendarMetric === 'drive'
        ? 'Darker = more total driving'
        : 'Darker = more visits';

  const handleMonthChange = (delta: number) => {
    const next = addMonths(calendarMonth, delta);
    setCalendarMonth(next);
    setCalendarDayKey(localDayKey(next));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.calendarOverlay}>
        <Pressable style={styles.calendarBackdrop} onPress={onClose} />
        <View
          style={[
            styles.calendarSheet,
            { backgroundColor: palette.card, borderColor: cardBorder },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.calendarContent}
          >
            <View style={styles.calendarHeaderRow}>
              <View>
                <Text style={[styles.calendarTitle, { color: palette.text }]}>
                  {title ?? 'Monthly calendar'}
                </Text>
                <Text style={[styles.calendarSubtitle, { color: palette.muted }]}>
                  {subtitle ?? 'Heatmap view of your upcoming workload.'}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.calendarClose, { color: palette.muted }]}>
                  Close
                </Text>
              </Pressable>
            </View>

            <View style={styles.calendarMonthRow}>
              <Pressable
                onPress={() => handleMonthChange(-1)}
                style={({ pressed }) => [
                  styles.calendarMonthButton,
                  { borderColor: cardBorder, backgroundColor: palette.background },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <FontAwesome name="chevron-left" size={12} color={palette.text} />
              </Pressable>
              <Text style={[styles.calendarMonthLabel, { color: palette.text }]}>
                {calendarMonthLabel}
              </Text>
              <Pressable
                onPress={() => handleMonthChange(1)}
                style={({ pressed }) => [
                  styles.calendarMonthButton,
                  { borderColor: cardBorder, backgroundColor: palette.background },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <FontAwesome name="chevron-right" size={12} color={palette.text} />
              </Pressable>
            </View>

            <View style={styles.calendarMetricRow}>
              {CALENDAR_METRICS.map((metric) => (
                <ChoiceChip
                  key={metric.key}
                  label={metric.label}
                  selected={calendarMetric === metric.key}
                  onPress={() => setCalendarMetric(metric.key)}
                />
              ))}
            </View>
            <Text style={[styles.calendarLegend, { color: palette.muted }]}>
              {calendarLegend}
            </Text>
            {compareVisits.length > 0 && mode !== 'view_schedule' ? (
              <View style={styles.compareLegendRow}>
                <View
                  style={[
                    styles.compareLegendDot,
                    { backgroundColor: compareTone },
                  ]}
                />
                <Text style={[styles.calendarLegend, { color: palette.muted }]}>
                  {mode === 'compare_offer'
                    ? `${compareLabel} stops highlighted (+X if added)`
                    : `${compareLabel}'s visits highlighted`}
                </Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.calendarStatusRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.calendarStatusText, { color: palette.muted }]}>
                  Loading calendar...
                </Text>
              </View>
            ) : null}
            {error ? (
              <Text style={[styles.calendarStatusText, { color: palette.danger }]}>
                {error}
              </Text>
            ) : null}

            {!loading && !error ? (
              <>
                <View style={styles.calendarHeader}>
                  {DAY_LABELS.map((label) => (
                    <Text key={label} style={[styles.calendarLabel, { color: palette.muted }]}>
                      {label}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date) => {
                    const key = localDayKey(date);
                    const summary = calendarSummaries.get(key);
                    const compareSummary = compareSummaries.get(key);
                    const isOutsideMonth = date.getMonth() !== calendarMonth.getMonth();
                    const metricValue = resolveCalendarMetricValue(summary, calendarMetric);
                    const intensity = calendarMaxMetric > 0 ? metricValue / calendarMaxMetric : 0;
                    const fillAlpha = intensity > 0 ? 0.08 + intensity * 0.5 : 0;
                    const baseFill =
                      intensity > 0 ? toRgba(Colors.brand.mint, fillAlpha) : palette.background;
                    const compareCount = compareSummary?.visitCount ?? 0;
                    const hasCompareData = compareCount > 0;
                    // Show +X badge only in compare_offer mode
                    const showCompareBadge = hasCompareData && mode === 'compare_offer';
                    // Show highlight color for both compare_offer and view_customer modes
                    const showCompareHighlight = hasCompareData && mode !== 'view_schedule';
                    // Blend colors: if both regular visits and compare data, show compare accent
                    const fillColor = showCompareHighlight
                      ? intensity > 0
                        ? toRgba(compareTone, 0.25 + intensity * 0.3) // Blend compare tone with intensity
                        : toRgba(compareTone, 0.18)
                      : baseFill;
                    const isSelected = calendarDayKey === key;
                    const isToday = key === todayKey;
                    // Use compare tone for text when highlighted
                    const textColor = showCompareHighlight
                      ? compareTone
                      : intensity > 0.6
                        ? '#FFFFFF'
                        : palette.text;
                    const countColor = intensity > 0.6 ? '#FFFFFF' : palette.muted;
                    // Show compare border when highlighted
                    const cellBorderColor = showCompareHighlight
                      ? compareTone
                      : isSelected
                        ? palette.tint
                        : isToday
                          ? palette.accent
                          : palette.border;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setCalendarDayKey(key)}
                        style={({ pressed }) => [
                          styles.calendarCell,
                          {
                            borderColor: cellBorderColor,
                            borderWidth: showCompareHighlight ? 2 : 1,
                            backgroundColor: isOutsideMonth ? palette.card : fillColor,
                            opacity: isOutsideMonth ? 0.45 : 1,
                          },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text style={[styles.calendarDate, { color: textColor }]}>
                          {date.getDate()}
                        </Text>
                        {isToday ? (
                          <View style={[styles.todayDot, { backgroundColor: palette.accent }]} />
                        ) : null}
                        {summary?.visitCount ? (
                          <Text style={[styles.calendarCount, { color: countColor }]}>
                            {summary.visitCount} stop{summary.visitCount === 1 ? '' : 's'}
                          </Text>
                        ) : null}
                        {showCompareBadge ? (
                          <View
                            style={[
                              styles.compareBadge,
                              { borderColor: compareTone, backgroundColor: `${compareTone}22` },
                            ]}
                          >
                            <Text style={[styles.compareBadgeText, { color: compareTone }]}>
                              +{compareCount}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={[
                    styles.calendarDetailCard,
                    { borderColor: palette.border, backgroundColor: palette.background },
                  ]}
                >
                  <View style={styles.calendarDetailHeader}>
                    <Text style={[styles.calendarDetailTitle, { color: palette.text }]}>
                      {selectedLabel ?? 'Select a day'}
                    </Text>
                    {summaryForMetrics ? (
                      <View
                        style={[
                          styles.calendarDetailBadge,
                          { borderColor: palette.border, backgroundColor: palette.card },
                        ]}
                      >
                        <Text style={[styles.calendarDetailBadgeText, { color: palette.muted }]}>
                          {totalSelectedCount} stop{totalSelectedCount === 1 ? '' : 's'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {summaryForMetrics ? (
                    <>
                      <View style={styles.calendarDetailMetaRow}>
                        <View
                          style={[
                            styles.calendarDetailChip,
                            { borderColor: palette.border, backgroundColor: palette.card },
                          ]}
                        >
                          <Text style={[styles.calendarDetailChipText, { color: palette.muted }]}>
                            Est payout
                          </Text>
                          <Text style={[styles.calendarDetailChipValue, { color: mintTone }]}>
                            {summaryForMetrics.payoutCents > 0
                              ? formatCurrencyFromCents(summaryForMetrics.payoutCents)
                              : 'N/A'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.calendarDetailChip,
                            { borderColor: palette.border, backgroundColor: palette.card },
                          ]}
                        >
                          <Text style={[styles.calendarDetailChipText, { color: palette.muted }]}>
                            Drive est
                          </Text>
                          <Text style={[styles.calendarDetailChipValue, { color: palette.text }]}>
                            {formatDriveSummary(
                              summaryForMetrics.driveMeters,
                              summaryForMetrics.driveSeconds,
                            ) ?? 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.calendarDetailNote, { color: palette.muted }]}>
                        Estimates include mileage + PPE and total drive time (home → stops → home).
                      </Text>
                      {selectedVisits.length ? (
                        <>
                          <Text style={[styles.calendarSectionLabel, { color: palette.text }]}>
                            Scheduled stops
                          </Text>
                          <View style={styles.calendarDetailList}>
                            {selectedVisits.map((visit) => {
                              const customerName = visit.customer?.name ?? 'Customer';
                              const windowLabel = formatVisitWindow(visit);
                              const scheduleLine = windowLabel
                                ? windowLabel
                                : formatDayLabel(visit.scheduledDate);
                              const payoutCents = resolveVisitPayoutCents(visit);
                              const payoutLabel =
                                payoutCents > 0 ? formatCurrencyFromCents(payoutCents) : 'N/A';
                              // In view_customer mode, highlight if this visit is in the compare set
                              const isHighlightedVisit =
                                mode === 'view_customer' &&
                                compareSelectedVisits.some((cv) => cv.id === visit.id);
                              return (
                                <View
                                  key={visit.id}
                                  style={[
                                    styles.calendarVisitRow,
                                    isHighlightedVisit && {
                                      backgroundColor: `${compareTone}15`,
                                      borderRadius: 10,
                                      marginHorizontal: -8,
                                      paddingHorizontal: 8,
                                      borderLeftWidth: 3,
                                      borderLeftColor: compareTone,
                                    },
                                  ]}
                                >
                                  <View style={styles.calendarVisitInfo}>
                                    <Text
                                      style={[
                                        styles.calendarVisitName,
                                        { color: isHighlightedVisit ? compareTone : palette.text },
                                      ]}
                                    >
                                      {customerName}
                                    </Text>
                                    <Text style={[styles.calendarVisitMeta, { color: palette.muted }]}>
                                      {scheduleLine}
                                    </Text>
                                  </View>
                                  <Text
                                    style={[
                                      styles.calendarVisitPayout,
                                      { color: isHighlightedVisit ? compareTone : mintTone },
                                    ]}
                                  >
                                    {payoutLabel}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </>
                      ) : null}
                      {/* Only show separate compare section in compare_offer mode (for NEW visits being added) */}
                      {compareSelectedVisits.length > 0 && mode === 'compare_offer' ? (
                        <>
                          <Text style={[styles.calendarSectionLabel, { color: palette.text }]}>
                            {compareLabel} stops
                          </Text>
                          <View style={styles.calendarDetailList}>
                            {compareSelectedVisits.map((visit) => {
                              const customerName = visit.customer?.name ?? 'Customer';
                              const windowLabel = formatVisitWindow(visit);
                              const scheduleLine = windowLabel
                                ? windowLabel
                                : formatDayLabel(visit.scheduledDate);
                              return (
                                <View key={visit.id} style={styles.calendarVisitRow}>
                                  <View style={styles.calendarVisitInfo}>
                                    <Text style={[styles.calendarVisitName, { color: palette.text }]}>
                                      {customerName}
                                    </Text>
                                    <Text style={[styles.calendarVisitMeta, { color: palette.muted }]}>
                                      {scheduleLine}
                                    </Text>
                                  </View>
                                  <Text style={[styles.calendarVisitPayout, { color: compareTone }]}>
                                    {compareLabel}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </>
                      ) : null}
                      {!selectedVisits.length && !compareSelectedVisits.length ? (
                        <Text style={[styles.calendarEmptyState, { color: palette.muted }]}>
                          No visits scheduled for this day.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={[styles.calendarEmptyState, { color: palette.muted }]}>
                      Pick a day to view details.
                    </Text>
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  calendarOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  calendarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  calendarSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  calendarContent: {
    gap: 12,
    paddingBottom: 16,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  calendarClose: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarMonthButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarLegend: {
    fontSize: 11,
  },
  compareLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compareLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calendarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarStatusText: {
    fontSize: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  calendarLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
    gap: 2,
    position: 'relative',
    marginBottom: 8,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
  calendarDate: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarCount: {
    fontSize: 9,
    fontWeight: '600',
  },
  compareBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  compareBadgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  calendarDetailCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  calendarDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  calendarDetailTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  calendarDetailBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  calendarDetailBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calendarDetailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarDetailChip: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  calendarDetailChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calendarDetailChipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  calendarDetailNote: {
    fontSize: 11,
  },
  calendarSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarDetailList: {
    gap: 10,
    marginTop: 2,
  },
  calendarVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  calendarVisitInfo: {
    flex: 1,
    gap: 2,
  },
  calendarVisitName: {
    fontSize: 13,
    fontWeight: '600',
  },
  calendarVisitMeta: {
    fontSize: 12,
  },
  calendarVisitPayout: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarEmptyState: {
    fontSize: 12,
  },
});
