import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { WellnessReading } from '@/lib/api/types';
import type { WellnessAccess, WellnessWeatherAlert } from './useWellnessData';

type WellnessOverviewProps = {
  wellnessSummary: {
    title: string;
    subtitle: string;
    status: 'pending' | 'alert' | 'good';
    totalSamples: number;
    flaggedSamples: number;
  };
  checkInMeta: {
    hasDogs: boolean;
    allSubmitted: boolean;
    label: string;
    helper: string;
    pending: number;
    totalDogs: number;
    weekStart: string | null;
  };
  checkInLoading: boolean;
  checkInError: string | null;
  flaggedReadings: WellnessReading[];
  weatherAlert: WellnessWeatherAlert | null;
  access: WellnessAccess;
  isPremium: boolean;
  hasService: boolean;
  reportsCount: number;
  onFlagPress?: (reading: WellnessReading) => void;
};

export default function WellnessOverview({
  wellnessSummary,
  checkInMeta,
  checkInLoading,
  checkInError,
  flaggedReadings,
  weatherAlert,
  access,
  isPremium,
  hasService,
  reportsCount,
  onFlagPress,
}: WellnessOverviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const statusStyle =
    wellnessSummary.status === 'good'
      ? { backgroundColor: Colors.brand.mint, color: Colors.brand.graphite }
      : wellnessSummary.status === 'alert'
        ? { backgroundColor: Colors.brand.gold, color: Colors.brand.graphite }
        : { backgroundColor: palette.border, color: palette.text };

  const statusLabel =
    wellnessSummary.status === 'good'
      ? 'Stable'
      : wellnessSummary.status === 'alert'
        ? 'Monitor'
        : 'Pending';

  const handleCheckInPress = () => {
    if (!checkInMeta.hasDogs) {
      router.push('/(app)/(customer)/account');
      return;
    }
    if (checkInMeta.weekStart) {
      router.push({
        pathname: '/(app)/(customer)/check-in',
        params: { weekStart: checkInMeta.weekStart },
      });
      return;
    }
    router.push('/(app)/(customer)/check-in');
  };

  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const planLabel = isPremium ? 'Premium' : 'Free';
  const scansLabel = isPremium ? 'Unlimited' : `${scansRemaining ?? 0} left`;

  return (
    <View style={styles.container}>
      {/* Wellness Score Hero */}
      <View style={[styles.scoreCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.scoreHeader}>
          <View style={styles.scoreRing}>
            <View
              style={[
                styles.scoreRingOuter,
                { borderColor: statusStyle.backgroundColor },
              ]}
            />
            <Text style={[styles.scoreValue, { color: palette.text }]}>
              {wellnessSummary.totalSamples > 0 ? wellnessSummary.totalSamples : '--'}
            </Text>
            <Text style={[styles.scoreLabel, { color: palette.muted }]}>samples</Text>
          </View>
          <View style={styles.scoreContent}>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreTitle, { color: palette.text }]}>
                {wellnessSummary.title}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}>
                <Text style={[styles.statusPillText, { color: statusStyle.color }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.scoreSubtitle, { color: palette.muted }]}>
              {wellnessSummary.subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricItem, { borderColor: palette.border }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>
              {wellnessSummary.flaggedSamples}
            </Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>Flags</Text>
          </View>
          <View style={[styles.metricItem, { borderColor: palette.border }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{reportsCount}</Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>Reports</Text>
          </View>
          <View style={[styles.metricItem, { borderColor: palette.border }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{scansLabel}</Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>Scans</Text>
          </View>
        </View>
      </View>

      {/* Flags Alert Banner */}
      {flaggedReadings.length > 0 ? (
        <Pressable
          onPress={() => onFlagPress?.(flaggedReadings[0])}
          style={[
            styles.alertBanner,
            { backgroundColor: `${Colors.brand.gold}15`, borderColor: Colors.brand.gold },
          ]}
        >
          <View style={styles.alertContent}>
            <FontAwesome name="exclamation-circle" size={16} color={Colors.brand.gold} />
            <View style={styles.alertText}>
              <Text style={[styles.alertTitle, { color: palette.text }]}>
                {flaggedReadings.length} flag{flaggedReadings.length > 1 ? 's' : ''} to review
              </Text>
              <Text style={[styles.alertSubtitle, { color: palette.muted }]}>
                Tap to see flagged samples
              </Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={14} color={palette.muted} />
        </Pressable>
      ) : null}

      {/* Weather Alert */}
      {weatherAlert ? (
        <Pressable
          onPress={() => router.push('/(app)/(customer)/wellness-weather' as Href)}
          style={[
            styles.alertBanner,
            {
              backgroundColor:
                weatherAlert.level === 'danger'
                  ? `${palette.danger}15`
                  : weatherAlert.type === 'heat'
                    ? `${Colors.brand.gold}15`
                    : `${Colors.brand.mint}15`,
              borderColor:
                weatherAlert.level === 'danger'
                  ? palette.danger
                  : weatherAlert.type === 'heat'
                    ? Colors.brand.gold
                    : Colors.brand.mint,
            },
          ]}
        >
          <View style={styles.alertContent}>
            <FontAwesome
              name={weatherAlert.type === 'heat' ? 'sun-o' : 'snowflake-o'}
              size={16}
              color={
                weatherAlert.level === 'danger'
                  ? palette.danger
                  : weatherAlert.type === 'heat'
                    ? Colors.brand.gold
                    : Colors.brand.mint
              }
            />
            <View style={styles.alertText}>
              <Text style={[styles.alertTitle, { color: palette.text }]}>
                {weatherAlert.headline}
              </Text>
              <Text style={[styles.alertSubtitle, { color: palette.muted }]}>
                {typeof weatherAlert.currentTemp === 'number'
                  ? `${Math.round(weatherAlert.currentTemp)}°F · `
                  : ''}
                {weatherAlert.label}
              </Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={14} color={palette.muted} />
        </Pressable>
      ) : null}

      {/* Check-in Status */}
      <View style={[styles.checkInCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.checkInHeader}>
          <View style={styles.checkInInfo}>
            <Text style={[styles.checkInTitle, { color: palette.text }]}>Weekly check-in</Text>
            <Text style={[styles.checkInHelper, { color: palette.muted }]}>
              {checkInMeta.helper} · {checkInMeta.allSubmitted ? 'Complete' : 'Pending'}
            </Text>
          </View>
          <View
            style={[
              styles.checkInDot,
              {
                backgroundColor: checkInMeta.allSubmitted
                  ? Colors.brand.mint
                  : Colors.brand.gold,
              },
            ]}
          />
        </View>
        {checkInLoading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading...</Text>
          </View>
        ) : checkInError ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{checkInError}</Text>
        ) : (
          <Button
            title={checkInMeta.label}
            onPress={handleCheckInPress}
            variant={checkInMeta.allSubmitted || !checkInMeta.hasDogs ? 'secondary' : 'primary'}
          />
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable
          onPress={() => router.push('/(app)/(customer)/capture' as Href)}
          style={[styles.quickAction, { backgroundColor: palette.tint }]}
        >
          <FontAwesome name="camera" size={18} color="#FFFFFF" />
          <Text style={styles.quickActionLabel}>Scan stool</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/(customer)/chat' as Href)}
          style={[styles.quickAction, { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1 }]}
        >
          <FontAwesome name="comment" size={18} color={palette.tint} />
          <Text style={[styles.quickActionLabel, { color: palette.text }]}>Ask AI</Text>
        </Pressable>
      </View>

      {/* Upgrade prompt for free users */}
      {!isPremium && !hasService ? (
        <Pressable
          onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as Href)}
          style={[styles.upgradePrompt, { borderColor: palette.tint }]}
        >
          <View style={styles.upgradeContent}>
            <FontAwesome name="star" size={14} color={palette.tint} />
            <Text style={[styles.upgradeText, { color: palette.text }]}>
              Upgrade to Premium for unlimited scans + AI chat
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={palette.tint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  scoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingOuter: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreContent: {
    flex: 1,
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  scoreSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertSubtitle: {
    fontSize: 12,
  },
  checkInCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInInfo: {
    gap: 4,
  },
  checkInTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  checkInHelper: {
    fontSize: 12,
  },
  checkInDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 13,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 12,
  },
  upgradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
