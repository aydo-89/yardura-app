import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type ScanProgressProps = {
  used: number;
  limit: number;
  isPremium: boolean;
};

export default function ScanProgress({ used, limit, isPremium }: ScanProgressProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const remaining = Math.max(0, limit - used);
  const isLow = !isPremium && remaining <= 2;
  const isEmpty = !isPremium && remaining === 0;

  const progressColor = useMemo(() => {
    if (isPremium) return Colors.brand.mint;
    if (isEmpty) return palette.danger;
    if (isLow) return Colors.brand.gold;
    return palette.tint;
  }, [isPremium, isEmpty, isLow, palette]);

  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={[styles.iconWrapper, { backgroundColor: `${progressColor}15` }]}>
        {isPremium ? (
          <FontAwesome name="check" size={20} color={progressColor} />
        ) : (
          <Text style={[styles.countValue, { color: progressColor }]}>{remaining}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: palette.text }]}>
          {isPremium ? 'Unlimited scans' : `${remaining} scans left`}
        </Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {isPremium
            ? 'Included with your plan'
            : isEmpty
              ? 'Upgrade for unlimited scans'
              : `${used} of ${limit} used this month`}
        </Text>
      </View>

      {isEmpty && (
        <View style={[styles.upgradeBadge, { backgroundColor: `${palette.danger}15` }]}>
          <FontAwesome name="arrow-up" size={12} color={palette.danger} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
  },
  upgradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
