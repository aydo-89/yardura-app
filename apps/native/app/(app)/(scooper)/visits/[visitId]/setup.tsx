import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

type CheckItem = {
  id: string;
  icon: 'mobile' | 'bluetooth' | 'camera';
  label: string;
};

const CHECKLIST: CheckItem[] = [
  { id: 'mount', icon: 'mobile', label: 'Phone mounted securely' },
  { id: 'bluetooth', icon: 'bluetooth', label: 'Bluetooth shutter paired' },
  { id: 'camera', icon: 'camera', label: 'Camera lens clean' },
];

function AnimatedCheckItem({
  item,
  checked,
  onToggle,
  palette,
  colorScheme,
}: {
  item: CheckItem;
  checked: boolean;
  onToggle: () => void;
  palette: typeof Colors.light;
  colorScheme: 'light' | 'dark';
}) {
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(checked ? 1 : 0);

  const handlePress = useCallback(() => {
    if (!checked) {
      scale.value = withSequence(
        withSpring(0.95, { damping: 15 }),
        withSpring(1, { damping: 10 }),
      );
      checkScale.value = withSequence(
        withTiming(0, { duration: 50 }),
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12 }),
      );
    } else {
      checkScale.value = withTiming(0, { duration: 150 });
    }
    onToggle();
  }, [checked, onToggle, scale, checkScale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.checkItem,
          cardStyle,
          {
            backgroundColor: checked ? `${successTone}12` : palette.card,
            borderColor: checked ? successTone : cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: checked ? `${successTone}20` : `${palette.tint}15`,
            },
          ]}
        >
          <FontAwesome
            name={item.icon}
            size={18}
            color={checked ? successTone : palette.tint}
          />
        </View>
        <Text
          style={[
            styles.checkLabel,
            { color: checked ? successTone : palette.text },
          ]}
        >
          {item.label}
        </Text>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: checked ? successTone : cardBorder,
              backgroundColor: checked ? successTone : 'transparent',
            },
          ]}
        >
          <Animated.View style={checkStyle}>
            <FontAwesome name="check" size={12} color="#FFFFFF" />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function SetupStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  const {
    steps,
    visitId,
    setupConfirmed,
    setSetupConfirmed,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    if (setupConfirmed) {
      return new Set(CHECKLIST.map((item) => item.id));
    }
    return new Set();
  });

  useStepGuard('setup');

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'setup'), 0),
    [steps],
  );

  const toggleItem = useCallback((id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allChecked = checkedItems.size === CHECKLIST.length;
  const progressPct = Math.round((checkedItems.size / CHECKLIST.length) * 100);

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('setup'));

  const handleNext = () => {
    setSetupConfirmed(true);
    goToStep(getNextStep('setup'));
  };

  return (
    <VisitStepShell
      title="Get ready"
      subtitle="Complete setup before capturing samples"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* Progress Indicator */}
      <View style={[styles.progressCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: palette.muted }]}>Setup progress</Text>
          <Text style={[styles.progressValue, { color: palette.text }]}>
            {checkedItems.size} / {CHECKLIST.length}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: allChecked ? Colors.brand.mint : palette.tint,
              },
            ]}
          />
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.checklist}>
        {CHECKLIST.map((item) => (
          <AnimatedCheckItem
            key={item.id}
            item={item}
            checked={checkedItems.has(item.id)}
            onToggle={() => toggleItem(item.id)}
            palette={palette}
            colorScheme={colorScheme}
          />
        ))}
      </View>

      {/* Helper Text */}
      {!allChecked ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Tap each item to confirm
        </Text>
      ) : null}

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          title="Ready to scoop"
          onPress={handleNext}
          variant={allChecked ? 'cta' : 'secondary'}
          disabled={!allChecked}
          style={styles.ctaButton}
        />
        {!allChecked ? (
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            Complete all items to continue
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklist: {
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    gap: 8,
  },
  ctaButton: {
    width: '100%',
  },
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
  },
});
