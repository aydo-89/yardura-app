import { useCallback, useMemo } from 'react';
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

export default function DeodorizeStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;

  const {
    steps,
    visitId,
    deodorizeConfirmed,
    setDeodorizeConfirmed,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  const scale = useSharedValue(1);
  const checkScale = useSharedValue(deodorizeConfirmed ? 1 : 0);

  useStepGuard('deodorize');

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'deodorize'), 0),
    [steps],
  );

  const handleToggle = useCallback(() => {
    const newValue = !deodorizeConfirmed;
    if (newValue) {
      scale.value = withSequence(
        withSpring(0.97, { damping: 15 }),
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
    setDeodorizeConfirmed(newValue);
  }, [deodorizeConfirmed, setDeodorizeConfirmed, scale, checkScale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('deodorize'));
  const handleNext = () => goToStep(getNextStep('deodorize'));

  return (
    <VisitStepShell
      title="Deodorize yard"
      subtitle="Apply pet-safe deodorizer to the cleared area"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* Instruction Card */}
      <View style={[styles.instructionCard, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
        <View style={[styles.instructionIcon, { backgroundColor: `${Colors.brand.mint}20` }]}>
          <FontAwesome name="leaf" size={20} color={Colors.brand.mint} />
        </View>
        <View style={styles.instructionContent}>
          <Text style={[styles.instructionTitle, { color: Colors.brand.evergreen }]}>Pet-safe formula</Text>
          <Text style={[styles.instructionBody, { color: palette.muted }]}>
            Safe for pets immediately after application
          </Text>
        </View>
      </View>

      {/* Deodorize Confirmation Card */}
      <Pressable onPress={handleToggle}>
        <Animated.View
          style={[
            styles.confirmCard,
            cardStyle,
            {
              backgroundColor: deodorizeConfirmed ? `${successTone}10` : palette.card,
              borderColor: deodorizeConfirmed ? successTone : cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: deodorizeConfirmed ? `${successTone}20` : `${palette.tint}15` },
            ]}
          >
            <FontAwesome
              name="tint"
              size={20}
              color={deodorizeConfirmed ? successTone : palette.tint}
            />
          </View>
          <View style={styles.confirmContent}>
            <Text style={[styles.confirmTitle, { color: deodorizeConfirmed ? successTone : palette.text }]}>
              Apply deodorizer
            </Text>
            <Text style={[styles.confirmBody, { color: palette.muted }]}>
              Cover turf and high-traffic areas evenly
            </Text>
          </View>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: deodorizeConfirmed ? successTone : cardBorder,
                backgroundColor: deodorizeConfirmed ? successTone : 'transparent',
              },
            ]}
          >
            <Animated.View style={checkStyle}>
              <FontAwesome name="check" size={12} color="#FFFFFF" />
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>

      {/* Tips Card */}
      <View style={[styles.tipsCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <Text style={[styles.tipsTitle, { color: palette.text }]}>Quick tips</Text>
        <View style={styles.tipRow}>
          <FontAwesome name="times-circle" size={12} color={palette.muted} />
          <Text style={[styles.tipText, { color: palette.muted }]}>Avoid bowls and toys</Text>
        </View>
        <View style={styles.tipRow}>
          <FontAwesome name="clock-o" size={12} color={palette.muted} />
          <Text style={[styles.tipText, { color: palette.muted }]}>Let spray dry before leaving</Text>
        </View>
        <View style={styles.tipRow}>
          <FontAwesome name="paw" size={12} color={palette.muted} />
          <Text style={[styles.tipText, { color: palette.muted }]}>Focus on high-traffic areas</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={deodorizeConfirmed ? 'cta' : 'secondary'}
          disabled={!deodorizeConfirmed}
          style={styles.ctaButton}
        />
        {!deodorizeConfirmed ? (
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            Confirm deodorizer applied to continue
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  instructionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContent: {
    flex: 1,
    gap: 2,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  instructionBody: {
    fontSize: 12,
  },
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmContent: {
    flex: 1,
    gap: 4,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBody: {
    fontSize: 13,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 12,
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
