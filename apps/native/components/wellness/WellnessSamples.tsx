import { useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ChoiceChip from '@/components/ui/ChoiceChip';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { parseDateInput } from '@/lib/dates';
import type { WellnessReading } from '@/lib/api/types';

type FilterType = 'all' | 'flagged';

type WellnessSamplesProps = {
  readings: WellnessReading[];
  loading: boolean;
  error: string | null;
  hasService: boolean;
  onRefresh?: () => void;
  onSamplePress?: (reading: WellnessReading) => void;
};

const formatDate = (value: string) => {
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (value: string) => {
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function WellnessSamples({
  readings,
  loading,
  error,
  hasService,
  onRefresh,
  onSamplePress,
}: WellnessSamplesProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredReadings = useMemo(() => {
    if (filter === 'all') return readings;
    return readings.filter((r) => r.issues.length > 0);
  }, [readings, filter]);

  const flaggedCount = useMemo(
    () => readings.filter((r) => r.issues.length > 0).length,
    [readings],
  );

  const renderSample = ({ item }: { item: WellnessReading }) => {
    const hasFlaggedIssues = item.issues.length > 0;
    const statusColor = hasFlaggedIssues ? Colors.brand.gold : Colors.brand.mint;
    const statusLabel = hasFlaggedIssues ? 'Monitor' : 'Healthy';
    const statusIcon = hasFlaggedIssues ? 'exclamation-triangle' : 'check';
    const primaryIssue = item.issues[0];
    const hasColor = item.color && typeof item.color === 'string';
    const hasConsistency = item.consistencyLabel && typeof item.consistencyLabel === 'string';

    return (
      <Pressable
        onPress={() => onSamplePress?.(item)}
        style={({ pressed }) => [
          styles.sampleCard,
          { backgroundColor: palette.card, borderColor: cardBorder },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.sampleHeader}>
          {/* Status indicator with icon */}
          <View style={[styles.statusIndicator, { backgroundColor: `${statusColor}15` }]}>
            <FontAwesome name={statusIcon} size={16} color={statusColor} />
          </View>

          {/* Main content */}
          <View style={styles.sampleContent}>
            <View style={styles.sampleTopRow}>
              <Text style={[styles.sampleDate, { color: palette.text }]}>
                {formatDate(item.timestamp)}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.sampleMetaRow}>
              <Text style={[styles.sampleTime, { color: palette.muted }]}>
                {formatTime(item.timestamp)}
              </Text>
              {item.dogName ? (
                <>
                  <Text style={[styles.dotSeparator, { color: palette.muted }]}>·</Text>
                  <View style={styles.dogBadge}>
                    <FontAwesome name="paw" size={10} color={palette.muted} />
                    <Text style={[styles.dogName, { color: palette.muted }]}>{item.dogName}</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Metrics badges */}
            {(hasColor || hasConsistency) ? (
              <View style={styles.metricBadges}>
                {hasColor ? (
                  <View style={[styles.metricBadge, { backgroundColor: palette.background }]}>
                    <Text style={[styles.metricLabel, { color: palette.muted }]}>Color</Text>
                    <Text style={[styles.metricValue, { color: palette.text }]}>{item.color}</Text>
                  </View>
                ) : null}
                {hasConsistency ? (
                  <View style={[styles.metricBadge, { backgroundColor: palette.background }]}>
                    <Text style={[styles.metricLabel, { color: palette.muted }]}>Consistency</Text>
                    <Text style={[styles.metricValue, { color: palette.text }]}>{item.consistencyLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Issue or summary */}
            {primaryIssue ? (
              <View style={[styles.issueRow, { backgroundColor: `${Colors.brand.gold}08` }]}>
                <FontAwesome name="info-circle" size={11} color={Colors.brand.gold} />
                <Text style={[styles.issueText, { color: palette.text }]} numberOfLines={1}>
                  {typeof primaryIssue === 'string' ? primaryIssue : String(primaryIssue)}
                </Text>
              </View>
            ) : item.summary ? (
              <Text style={[styles.sampleSummary, { color: palette.muted }]} numberOfLines={1}>
                {item.summary}
              </Text>
            ) : null}
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <FontAwesome name="chevron-right" size={12} color={palette.muted} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: palette.background }]}>
          <FontAwesome name="search" size={28} color={palette.muted} />
        </View>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          {filter === 'flagged' ? 'No flagged samples' : 'No samples yet'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
          {filter === 'flagged'
            ? 'All your samples look healthy! Great work.'
            : hasService
              ? 'Wellness samples appear after your next service visit.'
              : 'Capture a stool photo to start wellness tracking.'}
        </Text>
        {filter === 'all' && !hasService ? (
          <Button
            title="Capture stool sample"
            onPress={() => router.push('/(app)/(customer)/capture' as Href)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        <ChoiceChip
          label={`All (${readings.length})`}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <ChoiceChip
          label={`Flagged (${flaggedCount})`}
          selected={filter === 'flagged'}
          onPress={() => setFilter('flagged')}
        />
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.muted }]}>
            Loading samples...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          {onRefresh ? (
            <Button title="Try again" onPress={onRefresh} variant="secondary" />
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filteredReadings}
          renderItem={renderSample}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={filteredReadings.length === 0 ? styles.listEmpty : styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  list: {
    paddingBottom: 20,
  },
  listEmpty: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  sampleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  sampleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleContent: {
    flex: 1,
    gap: 6,
  },
  sampleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sampleDate: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sampleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleTime: {
    fontSize: 12,
  },
  dotSeparator: {
    fontSize: 12,
  },
  dogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dogName: {
    fontSize: 12,
  },
  metricBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metricBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  issueText: {
    fontSize: 12,
    flex: 1,
  },
  sampleSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  chevronContainer: {
    paddingTop: 4,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
  },
  errorState: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
