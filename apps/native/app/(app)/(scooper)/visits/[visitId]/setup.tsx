import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function SetupStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;

  const {
    steps,
    visitId,
    setupConfirmed,
    setSetupConfirmed,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  useStepGuard('setup');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'setup'),
    0,
  );

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => {
    const prev = getPreviousStep('setup');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('setup');
    goToStep(next);
  };

  return (
    <VisitStepShell
      title="Mount phone"
      subtitle="Lock the phone in the mount so it stays stable for captures."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Mount checklist</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>• Clamp the mount tightly so the phone will not drift.</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>• Bluetooth shutter ready for the next step.</Text>
        {setupConfirmed ? (
          <Text style={[styles.successText, { color: successTone }]}>
            Mount confirmed.
          </Text>
        ) : null}
      </View>

      <Button
        title={setupConfirmed ? 'Continue to next step' : 'Mount secured - continue'}
        onPress={() => {
          setSetupConfirmed(true);
          handleNext();
        }}
        variant="cta"
      />
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  successText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
