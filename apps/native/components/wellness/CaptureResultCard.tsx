import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import IndicatorPill from '@/components/wellness/IndicatorPill';

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

type CaptureResultCardProps = {
  analysis: ParsedAnalysis | null;
  dogName?: string | null;
  capturedAt: string;
  hasLocation: boolean;
  onAdjustLocation?: () => void;
};

export default function CaptureResultCard({
  analysis,
  dogName,
  capturedAt,
  hasLocation,
  onAdjustLocation,
}: CaptureResultCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [expanded, setExpanded] = useState(true);

  const captureDate = new Date(capturedAt);
  const dateLabel = captureDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = captureDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const indicatorColor = analysis?.indicator === 'vet_now'
    ? palette.danger
    : analysis?.indicator === 'monitor'
      ? Colors.brand.gold
      : Colors.brand.mint;

  const hasDetails = analysis?.summary || analysis?.whatThisCouldMean || analysis?.tipsTonight?.length || analysis?.redFlags?.length;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* Header */}
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <IndicatorPill indicator={analysis?.indicator ?? null} />
          <View style={styles.headerMeta}>
            <Text style={[styles.dateText, { color: palette.text }]}>{dateLabel}</Text>
            <Text style={[styles.timeText, { color: palette.muted }]}>
              {timeLabel} · {dogName ?? 'Household'}
            </Text>
          </View>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={palette.muted}
        />
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.content, { borderTopColor: palette.border }]}>
          {/* Metrics row */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: `${indicatorColor}10` }]}>
              <Text style={[styles.metricLabel, { color: palette.muted }]}>Hydration</Text>
              <Text style={[styles.metricValue, { color: indicatorColor }]}>
                {analysis?.hydrationScore ?? '--'}
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: `${indicatorColor}10` }]}>
              <Text style={[styles.metricLabel, { color: palette.muted }]}>Firmness</Text>
              <Text style={[styles.metricValue, { color: indicatorColor }]}>
                {analysis?.firmnessScale ?? '--'}
              </Text>
            </View>
          </View>

          {/* Summary */}
          {analysis?.summary && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="lightbulb-o" size={12} color={palette.tint} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Summary</Text>
              </View>
              <Text style={[styles.sectionBody, { color: palette.muted }]}>
                {analysis.summary}
              </Text>
            </View>
          )}

          {/* What this could mean */}
          {analysis?.whatThisCouldMean && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="info-circle" size={12} color={Colors.brand.gold} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>What to watch</Text>
              </View>
              <Text style={[styles.sectionBody, { color: palette.muted }]}>
                {analysis.whatThisCouldMean}
              </Text>
            </View>
          )}

          {/* Tips */}
          {analysis?.tipsTonight && analysis.tipsTonight.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Tonight's tips</Text>
              </View>
              {analysis.tipsTonight.map((tip, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: Colors.brand.mint }]} />
                  <Text style={[styles.sectionBody, { color: palette.muted }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Red flags */}
          {analysis?.redFlags && analysis.redFlags.length > 0 && (
            <View style={[styles.redFlagCard, { backgroundColor: `${palette.danger}10` }]}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="exclamation-triangle" size={12} color={palette.danger} />
                <Text style={[styles.sectionTitle, { color: palette.danger }]}>Red flags</Text>
              </View>
              {analysis.redFlags.map((flag, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: palette.danger }]} />
                  <Text style={[styles.sectionBody, { color: palette.danger }]}>{flag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Location adjustment */}
          {hasLocation && onAdjustLocation && (
            <Pressable
              style={[styles.locationRow, { borderTopColor: palette.border }]}
              onPress={onAdjustLocation}
            >
              <View style={styles.locationInfo}>
                <FontAwesome name="map-marker" size={14} color={palette.muted} />
                <Text style={[styles.locationText, { color: palette.muted }]}>
                  Location saved to poop map
                </Text>
              </View>
              <Text style={[styles.locationAction, { color: palette.tint }]}>Adjust</Text>
            </Pressable>
          )}

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: palette.muted }]}>
            This is guidance only, not a diagnosis.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMeta: {
    gap: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
  },
  content: {
    borderTopWidth: 1,
    padding: 14,
    gap: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 18,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
  },
  redFlagCard: {
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 2,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 13,
  },
  locationAction: {
    fontSize: 13,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
