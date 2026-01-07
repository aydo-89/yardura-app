import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function OnTheWayStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;
  const {
    steps,
    visitId,
    arrivalSent,
    arrivalSending,
    sendArrival,
    error,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();
  const [etaMinutes, setEtaMinutes] = useState('');

  useStepGuard('on_the_way');

  const stepIndex = useMemo(
    () => steps.findIndex((step) => step.id === 'on_the_way'),
    [steps],
  );
  const stepCount = steps.length || 1;

  const handleSend = async () => {
    if (arrivalSent || arrivalSending) return;
    const eta = Number.parseInt(etaMinutes, 10);
    await sendArrival(Number.isNaN(eta) ? undefined : eta, true);
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

  const canContinue = arrivalSent;

  return (
    <VisitStepShell
      title="On the way"
      subtitle="Send the ETA message before you arrive on site."
      stepIndex={Math.max(stepIndex, 0)}
      stepCount={stepCount}
      onBack={handleBack}
    >
      {!arrivalSent ? (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Arrival notice</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Share your ETA if you want to set expectations. This sends the on-the-way message.
          </Text>
          <TextInput
            value={etaMinutes}
            onChangeText={setEtaMinutes}
            placeholder="ETA in minutes (optional)"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}
          <Button
            title={arrivalSending ? 'Sending...' : 'Send arrival notice'}
            onPress={handleSend}
            variant="primary"
            disabled={arrivalSending || arrivalSent}
          />
        </View>
      ) : (
        <View
          style={[
            styles.card,
            styles.successCard,
            { backgroundColor: palette.card, borderColor: successTone },
          ]}
        >
          <Text style={[styles.successTitle, { color: successTone }]}>
            Arrival notice sent
          </Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Customer has been notified. Confirm you&apos;re on site in the next step.
          </Text>
        </View>
      )}

      <Button
        title="Continue"
        onPress={handleNext}
        variant="cta"
        disabled={!canContinue}
      />
      {!canContinue ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Send the on-the-way message before continuing.
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  successCard: {
    borderWidth: 1,
  },
});
