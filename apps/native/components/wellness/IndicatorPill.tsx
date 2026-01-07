import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export type WellnessIndicator = 'watch' | 'monitor' | 'vet_now' | null | undefined;

type IndicatorPillProps = {
  indicator: WellnessIndicator;
  size?: 'sm' | 'md';
};

const resolveIndicator = (indicator: WellnessIndicator) => {
  if (indicator === 'vet_now') return { label: 'Vet now', color: Colors.brand.coral };
  if (indicator === 'monitor') return { label: 'Monitor', color: Colors.brand.gold };
  if (indicator === 'watch') return { label: 'Watch', color: Colors.brand.mint };
  return { label: 'Pending', color: null };
};

export default function IndicatorPill({ indicator, size = 'md' }: IndicatorPillProps) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const resolved = resolveIndicator(indicator);
  const backgroundColor = resolved.color ?? palette.border;
  const textColor = resolved.color ? Colors.brand.graphite : palette.text;

  return (
    <View
      style={[
        styles.pill,
        size === 'sm' && styles.pillSm,
        { backgroundColor },
      ]}
    >
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: textColor }]}>
        {resolved.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelSm: {
    fontSize: 10,
  },
});
