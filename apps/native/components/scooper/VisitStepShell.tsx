import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type VisitStepShellProps = {
  title: string;
  subtitle?: string;
  stepIndex: number;
  stepCount: number;
  onBack?: () => void;
  children: React.ReactNode;
};

export default function VisitStepShell({
  title,
  subtitle,
  stepIndex,
  stepCount,
  onBack,
  children,
}: VisitStepShellProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const progressPct = stepCount > 0 ? Math.round(((stepIndex + 1) / stepCount) * 100) : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.stepCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.headerRow}>
            {onBack ? (
              <Button
                title="Back"
                onPress={onBack}
                variant="ghost"
                style={styles.backButton}
                labelStyle={styles.backLabel}
              />
            ) : (
              <View />
            )}
            <Text style={[styles.stepLabel, { color: palette.muted }]}>
              Step {stepIndex + 1} of {stepCount}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%`, backgroundColor: palette.tint },
              ]}
            />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  stepCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  backLabel: {
    fontSize: 13,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  body: {
    gap: 16,
  },
});
