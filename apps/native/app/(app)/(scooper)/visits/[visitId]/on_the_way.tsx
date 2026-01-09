import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

const ETA_PRESETS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
];

export default function OnTheWayStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  const {
    steps,
    visitId,
    visit,
    arrivalSent,
    arrivalSending,
    sendArrival,
    error,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customEta, setCustomEta] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Animation values
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  useStepGuard('on_the_way');

  const stepIndex = useMemo(
    () => steps.findIndex((step) => step.id === 'on_the_way'),
    [steps],
  );
  const stepCount = steps.length || 1;

  // Customer info
  const customerName = visit?.customer?.name ?? 'Customer';
  const addressLine = visit?.customer?.addressLine1 ?? '';
  const cityZip = [visit?.customer?.city, visit?.customer?.zip].filter(Boolean).join(' ');

  // Animate success checkmark
  useEffect(() => {
    if (arrivalSent) {
      checkScale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 200 }),
        withSpring(1, { damping: 15 }),
      );
      checkOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [arrivalSent, checkScale, checkOpacity]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const handleSend = async () => {
    if (arrivalSent || arrivalSending) return;
    let eta: number | undefined;
    if (selectedPreset !== null) {
      eta = selectedPreset;
    } else if (showCustom && customEta) {
      const parsed = Number.parseInt(customEta, 10);
      if (!Number.isNaN(parsed)) eta = parsed;
    }
    await sendArrival(eta, true);
  };

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => {
    const prev = getPreviousStep('on_the_way');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('on_the_way');
    goToStep(next);
  };

  const selectPreset = (value: number) => {
    setSelectedPreset(value);
    setShowCustom(false);
    setCustomEta('');
  };

  const selectCustom = () => {
    setSelectedPreset(null);
    setShowCustom(true);
  };

  const canContinue = arrivalSent;
  const hasEta = selectedPreset !== null || (showCustom && customEta.length > 0);

  return (
    <VisitStepShell
      title="On the way"
      subtitle="Let the customer know you're coming"
      stepIndex={Math.max(stepIndex, 0)}
      stepCount={stepCount}
      onBack={handleBack}
    >
      {/* Customer Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={[styles.heroIcon, { backgroundColor: `${palette.tint}15` }]}>
          <FontAwesome name="map-marker" size={20} color={palette.tint} />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.heroName, { color: palette.text }]}>{customerName}</Text>
          {addressLine ? (
            <Text style={[styles.heroAddress, { color: palette.muted }]}>{addressLine}</Text>
          ) : null}
          {cityZip ? (
            <Text style={[styles.heroAddress, { color: palette.muted }]}>{cityZip}</Text>
          ) : null}
        </View>
      </View>

      {!arrivalSent ? (
        <>
          {/* ETA Selection */}
          <View style={styles.etaSection}>
            <Text style={[styles.sectionLabel, { color: palette.muted }]}>
              Share your ETA (optional)
            </Text>
            <View style={styles.etaChips}>
              {ETA_PRESETS.map((preset) => {
                const isActive = selectedPreset === preset.value;
                return (
                  <Pressable
                    key={preset.value}
                    onPress={() => selectPreset(preset.value)}
                    style={[
                      styles.etaChip,
                      {
                        borderColor: isActive ? palette.tint : cardBorder,
                        backgroundColor: isActive ? `${palette.tint}15` : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.etaChipText,
                        { color: isActive ? palette.tint : palette.text },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={selectCustom}
                style={[
                  styles.etaChip,
                  {
                    borderColor: showCustom ? palette.tint : cardBorder,
                    backgroundColor: showCustom ? `${palette.tint}15` : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.etaChipText,
                    { color: showCustom ? palette.tint : palette.text },
                  ]}
                >
                  Custom
                </Text>
              </Pressable>
            </View>

            {showCustom ? (
              <View style={styles.customRow}>
                <TextInput
                  value={customEta}
                  onChangeText={setCustomEta}
                  placeholder="Minutes"
                  placeholderTextColor={palette.muted}
                  keyboardType="number-pad"
                  style={[
                    styles.customInput,
                    { color: palette.text, borderColor: cardBorder, backgroundColor: palette.card },
                  ]}
                  maxLength={3}
                />
                <Text style={[styles.customLabel, { color: palette.muted }]}>minutes away</Text>
              </View>
            ) : null}
          </View>

          {error ? (
            <View style={[styles.errorCard, { borderColor: palette.danger }]}>
              <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Send Button */}
          <Button
            title={arrivalSending ? 'Sending...' : hasEta ? `Send ETA` : 'Notify customer'}
            onPress={handleSend}
            variant="cta"
            disabled={arrivalSending}
            style={styles.sendButton}
          />
        </>
      ) : (
        /* Success State */
        <View style={[styles.successCard, { backgroundColor: `${successTone}15`, borderColor: successTone }]}>
          <Animated.View style={[styles.successCheck, checkAnimatedStyle]}>
            <View style={[styles.checkCircle, { backgroundColor: successTone }]}>
              <FontAwesome name="check" size={24} color="#FFFFFF" />
            </View>
          </Animated.View>
          <Text style={[styles.successTitle, { color: successTone }]}>Customer notified</Text>
          <Text style={[styles.successBody, { color: palette.muted }]}>
            They know you're on your way
          </Text>
        </View>
      )}

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={canContinue ? 'primary' : 'secondary'}
          disabled={!canContinue}
          style={styles.continueButton}
        />
        {!canContinue ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Send notice to continue
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
  },
  heroAddress: {
    fontSize: 13,
  },
  etaSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  etaChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  etaChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  customLabel: {
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sendButton: {
    marginTop: 8,
  },
  successCard: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
  },
  successCheck: {
    marginBottom: 4,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  successBody: {
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    gap: 8,
  },
  continueButton: {
    width: '100%',
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
