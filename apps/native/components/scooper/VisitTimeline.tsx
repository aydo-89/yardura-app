import { useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type VisitStatus = 'completed' | 'current' | 'upcoming' | 'locked';

type TimelineVisit = {
  id: string;
  status: VisitStatus;
  customerName?: string;
  sequence?: number;
  estimatedMinutes?: number;
};

type VisitTimelineProps = {
  visits: TimelineVisit[];
  currentVisitId?: string | null;
  onVisitPress?: (visitId: string) => void;
  showLabels?: boolean;
};

function getStatusColor(status: VisitStatus, palette: typeof Colors.light): string {
  switch (status) {
    case 'completed':
      return Colors.brand.mint;
    case 'current':
      return palette.tint;
    case 'upcoming':
      return palette.muted;
    case 'locked':
      return palette.border;
    default:
      return palette.border;
  }
}

function getStatusLabel(status: VisitStatus): string {
  switch (status) {
    case 'completed':
      return 'Done';
    case 'current':
      return 'Next';
    case 'upcoming':
      return 'Later';
    case 'locked':
      return 'Locked';
    default:
      return '';
  }
}

export default function VisitTimeline({
  visits,
  currentVisitId,
  onVisitPress,
  showLabels = true,
}: VisitTimelineProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const scrollRef = useRef<ScrollView>(null);
  const completedCount = visits.filter((v) => v.status === 'completed').length;
  const hasStarted = completedCount > 0 || visits.some((v) => v.status === 'current');

  // Auto-scroll to current visit on mount
  useEffect(() => {
    if (!currentVisitId || !scrollRef.current) return;
    const currentIndex = visits.findIndex((v) => v.id === currentVisitId);
    if (currentIndex > 0) {
      // Scroll to center the current visit
      const scrollTo = Math.max(0, currentIndex * 56 - 100);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: scrollTo, animated: true });
      }, 100);
    }
  }, [currentVisitId, visits]);

  if (!visits.length) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
          <FontAwesome name="map-marker" size={16} color={palette.muted} />
        </View>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          No stops scheduled today
        </Text>
      </View>
    );
  }

  // For single stop, show a more descriptive view
  if (visits.length === 1) {
    const visit = visits[0];
    const isCurrent = visit.id === currentVisitId;
    const statusColor = getStatusColor(visit.status, palette);
    const statusLabel = getStatusLabel(visit.status);

    return (
      <View style={[styles.singleStopContainer, { borderColor: palette.border }]}>
        {/* Route visualization: Home → Stop → Home */}
        <View style={styles.singleStopRoute}>
          {/* Start: Home */}
          <View style={styles.routeNode}>
            <View style={[styles.homeNode, { backgroundColor: `${palette.muted}20`, borderColor: palette.border }]}>
              <FontAwesome name="home" size={12} color={palette.muted} />
            </View>
            <Text style={[styles.routeNodeLabel, { color: palette.muted }]}>Start</Text>
          </View>

          {/* Connector */}
          <View style={[styles.singleConnector, { backgroundColor: hasStarted ? Colors.brand.mint : palette.border }]}>
            <FontAwesome name="chevron-right" size={8} color={hasStarted ? Colors.brand.mint : palette.muted} style={styles.connectorArrow} />
          </View>

          {/* Stop */}
          <Pressable
            onPress={() => onVisitPress?.(visit.id)}
            style={styles.routeNode}
          >
            <View
              style={[
                styles.mainStopNode,
                {
                  backgroundColor: statusColor,
                  borderColor: isCurrent ? palette.text : statusColor,
                },
                isCurrent && styles.mainStopNodeCurrent,
              ]}
            >
              {visit.status === 'completed' ? (
                <FontAwesome name="check" size={14} color="#FFFFFF" />
              ) : (
                <FontAwesome name="map-marker" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.routeNodeLabel, { color: isCurrent ? palette.text : palette.muted }]} numberOfLines={1}>
              {visit.customerName ? visit.customerName.split(' ')[0] : 'Stop 1'}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </Pressable>

          {/* Connector */}
          <View style={[styles.singleConnector, { backgroundColor: visit.status === 'completed' ? Colors.brand.mint : palette.border }]}>
            <FontAwesome name="chevron-right" size={8} color={visit.status === 'completed' ? Colors.brand.mint : palette.muted} style={styles.connectorArrow} />
          </View>

          {/* End: Home */}
          <View style={styles.routeNode}>
            <View style={[styles.homeNode, { backgroundColor: visit.status === 'completed' ? `${Colors.brand.mint}20` : `${palette.muted}20`, borderColor: visit.status === 'completed' ? Colors.brand.mint : palette.border }]}>
              <FontAwesome name="home" size={12} color={visit.status === 'completed' ? Colors.brand.mint : palette.muted} />
            </View>
            <Text style={[styles.routeNodeLabel, { color: palette.muted }]}>End</Text>
          </View>
        </View>

        {/* Progress indicator */}
        <View style={[styles.singleStopProgress, { backgroundColor: palette.background }]}>
          <View style={[styles.progressDot, { backgroundColor: hasStarted ? Colors.brand.mint : palette.border }]} />
          <View style={[styles.progressLine, { backgroundColor: palette.border }]}>
            <View style={[styles.progressFill, { width: visit.status === 'completed' ? '100%' : hasStarted ? '50%' : '0%', backgroundColor: Colors.brand.mint }]} />
          </View>
          <View style={[styles.progressDot, { backgroundColor: visit.status === 'completed' ? Colors.brand.mint : palette.border }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.timelineHeader}>
        <Text style={[styles.timelineTitle, { color: palette.text }]}>Today's route</Text>
        <View style={[styles.summaryBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
          <Text style={[styles.summaryText, { color: Colors.brand.mint }]}>
            {completedCount}/{visits.length} done
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Home start node */}
        <View style={styles.stopContainer}>
          <View style={styles.stopRow}>
            <View style={[styles.homeNode, { backgroundColor: `${Colors.brand.mint}20`, borderColor: Colors.brand.mint }]}>
              <FontAwesome name="home" size={10} color={Colors.brand.mint} />
            </View>
            <View style={styles.connectorContainer}>
              <View style={[styles.connector, { backgroundColor: hasStarted ? Colors.brand.mint : palette.border }]} />
            </View>
          </View>
          {showLabels ? (
            <Text style={[styles.label, { color: palette.muted }]}>Start</Text>
          ) : null}
        </View>

        {visits.map((visit, index) => {
          const isCurrent = visit.id === currentVisitId;
          const statusColor = getStatusColor(visit.status, palette);
          const isLast = index === visits.length - 1;
          const showConnector = true; // Always show connector to home at end
          const travelMinutes = visit.estimatedMinutes;

          return (
            <View key={visit.id} style={styles.stopContainer}>
              <View style={styles.stopRow}>
                {/* Stop dot */}
                <Pressable
                  onPress={() => onVisitPress?.(visit.id)}
                  style={({ pressed }) => [
                    styles.dot,
                    {
                      backgroundColor: statusColor,
                      borderColor: isCurrent ? palette.text : statusColor,
                    },
                    isCurrent && styles.dotCurrent,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {visit.status === 'completed' ? (
                    <FontAwesome name="check" size={10} color="#FFFFFF" />
                  ) : isCurrent ? (
                    <View style={[styles.dotInner, { backgroundColor: '#FFFFFF' }]} />
                  ) : visit.status === 'locked' ? (
                    <FontAwesome name="lock" size={8} color={palette.muted} />
                  ) : (
                    <Text style={[styles.dotNumber, { color: '#FFFFFF' }]}>
                      {visit.sequence ?? index + 1}
                    </Text>
                  )}
                </Pressable>

                {/* Connector line */}
                {showConnector ? (
                  <View style={styles.connectorContainer}>
                    <View
                      style={[
                        styles.connector,
                        {
                          backgroundColor:
                            visit.status === 'completed' ? Colors.brand.mint : palette.border,
                        },
                      ]}
                    />
                    {travelMinutes && travelMinutes > 0 ? (
                      <View style={[styles.travelBadge, { backgroundColor: palette.background }]}>
                        <Text style={[styles.travelText, { color: palette.muted }]}>
                          {travelMinutes}m
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Label */}
              {showLabels ? (
                <Text
                  style={[
                    styles.label,
                    { color: isCurrent ? palette.text : palette.muted },
                    isCurrent && styles.labelCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {visit.customerName
                    ? visit.customerName.split(' ')[0]
                    : `Stop ${visit.sequence ?? index + 1}`}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* Home end node */}
        <View style={styles.stopContainer}>
          <View style={styles.stopRow}>
            <View style={[styles.homeNode, { backgroundColor: completedCount === visits.length ? `${Colors.brand.mint}20` : `${palette.muted}20`, borderColor: completedCount === visits.length ? Colors.brand.mint : palette.border }]}>
              <FontAwesome name="home" size={10} color={completedCount === visits.length ? Colors.brand.mint : palette.muted} />
            </View>
          </View>
          {showLabels ? (
            <Text style={[styles.label, { color: palette.muted }]}>End</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 0,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  // Single stop view styles
  singleStopContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  singleStopRoute: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  routeNode: {
    alignItems: 'center',
    gap: 6,
    minWidth: 52,
  },
  homeNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainStopNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainStopNodeCurrent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  singleConnector: {
    flex: 1,
    height: 2,
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorArrow: {
    marginHorizontal: 4,
  },
  routeNodeLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 2,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  singleStopProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Multi-stop header
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stopContainer: {
    alignItems: 'center',
    gap: 8,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  connectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  connector: {
    width: 28,
    height: 2,
  },
  travelBadge: {
    position: 'absolute',
    left: 4,
    top: -10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  travelText: {
    fontSize: 9,
    fontWeight: '600',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 48,
    textAlign: 'center',
  },
  labelCurrent: {
    fontWeight: '700',
  },
  summaryBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
