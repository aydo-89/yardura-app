import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function DeodorizeStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const {
    steps,
    visitId,
    deodorizeConfirmed,
    setDeodorizeConfirmed,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  useStepGuard('deodorize');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'deodorize'),
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
    const prev = getPreviousStep('deodorize');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('deodorize');
    goToStep(next);
  };

  return (
    <VisitStepShell
      title="Deodorizing add-on"
      subtitle="Apply the pet-safe deodorizer after clearing the yard."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Apply deodorizer</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Use the dedicated sprayer to cover turf and high-traffic areas evenly.
            </Text>
          </View>
          <Switch
            value={deodorizeConfirmed}
            onValueChange={setDeodorizeConfirmed}
          />
        </View>
        <Text style={[styles.cardBody, { color: palette.muted }]}>
          Avoid bowls and toys, and allow the spray to dry before leaving.
        </Text>
      </View>

      <Button
        title="Continue to next step"
        onPress={handleNext}
        disabled={!deodorizeConfirmed}
        variant="cta"
      />
      {!deodorizeConfirmed ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Confirm the deodorizer is applied before continuing.
        </Text>
      ) : null}
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  helperText: {
    fontSize: 12,
  },
});
