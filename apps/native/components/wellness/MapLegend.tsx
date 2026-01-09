import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type MapViewMode = 'pins' | 'heat';

type MapLegendProps = {
  viewMode: MapViewMode;
  onChangeMode: (mode: MapViewMode) => void;
  showLegend?: boolean;
};

export default function MapLegend({
  viewMode,
  onChangeMode,
  showLegend = true,
}: MapLegendProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const ownerColor = Colors.brand.mint;
  const proColor = Colors.brand.coral;

  return (
    <View style={styles.container}>
      {/* View mode toggle */}
      <View style={styles.toggleRow}>
        {(['pins', 'heat'] as MapViewMode[]).map((mode) => {
          const isActive = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => onChangeMode(mode)}
              style={[
                styles.toggleChip,
                {
                  borderColor: isActive ? palette.tint : palette.border,
                  backgroundColor: isActive ? palette.tint : palette.card,
                },
              ]}
            >
              <Text style={[styles.toggleText, { color: isActive ? '#FFFFFF' : palette.text }]}>
                {mode === 'pins' ? 'Pins' : 'Heatmap'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      {showLegend && viewMode === 'pins' && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ownerColor }]} />
            <Text style={[styles.legendText, { color: palette.muted }]}>Owner</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: proColor }]} />
            <Text style={[styles.legendText, { color: palette.muted }]}>Scooper</Text>
          </View>
        </View>
      )}

      {/* Heat legend gradient */}
      {showLegend && viewMode === 'heat' && (
        <View style={styles.heatLegend}>
          <View style={styles.heatGradient}>
            <View style={[styles.heatBar, { backgroundColor: 'rgba(243, 100, 91, 0.2)' }]} />
            <View style={[styles.heatBar, { backgroundColor: 'rgba(243, 100, 91, 0.4)' }]} />
            <View style={[styles.heatBar, { backgroundColor: 'rgba(243, 100, 91, 0.6)' }]} />
            <View style={[styles.heatBar, { backgroundColor: 'rgba(243, 100, 91, 0.8)' }]} />
          </View>
          <View style={styles.heatLabels}>
            <Text style={[styles.heatLabelText, { color: palette.muted }]}>Low</Text>
            <Text style={[styles.heatLabelText, { color: palette.muted }]}>High</Text>
          </View>
        </View>
      )}

      {/* Hint text */}
      <Text style={[styles.hintText, { color: palette.muted }]}>
        {viewMode === 'pins'
          ? 'Rings show GPS accuracy. Larger rings = lower confidence.'
          : 'Intensity shows concentration of deposits over time.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
  },
  heatLegend: {
    gap: 4,
  },
  heatGradient: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    maxWidth: 120,
  },
  heatBar: {
    flex: 1,
  },
  heatLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 120,
  },
  heatLabelText: {
    fontSize: 10,
  },
  hintText: {
    fontSize: 11,
  },
});
