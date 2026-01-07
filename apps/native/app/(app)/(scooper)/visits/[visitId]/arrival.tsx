import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Device from 'expo-device';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function ArrivalStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;
  const {
    steps,
    visitId,
    arrivalRequired,
    arrivalSent,
    arrivalVerified,
    arrivalVerification,
    arrivalVerifying,
    arrivalVerifyError,
    verifyArrival,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useStepGuard('arrival');

  const stepIndex = useMemo(
    () => steps.findIndex((step) => step.id === 'arrival'),
    [steps],
  );
  const stepCount = steps.length || 1;

  const formatDistance = (meters?: number | null) => {
    if (!meters && meters !== 0) return null;
    const feet = meters * 3.28084;
    const miles = meters / 1609.34;
    if (miles < 0.1) {
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  };

  const handleVerifyLocation = async () => {
    setLocationMessage(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationMessage('Location permission denied. Enable it to continue.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    const verified = await verifyArrival({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
    });
    if (verified) {
      setLocationMessage('Location verified. You can continue.');
    } else {
      setLocationMessage(
        Device.isDevice !== true
          ? 'Set a simulated location in the simulator to verify.'
          : null,
      );
    }
  };

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => {
    const prev = getPreviousStep('arrival');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('arrival');
    goToStep(next);
  };

  const canContinue = !arrivalRequired || arrivalVerified;
  const canVerify = arrivalSent;
  const distanceLabel = formatDistance(arrivalVerification?.distanceMeters);
  const distanceMessage =
    !arrivalVerified && distanceLabel
      ? `You are ${distanceLabel} from the address. Move closer to verify.`
      : null;

  return (
    <VisitStepShell
      title="Confirm arrival"
      subtitle="Verify you are on site to unlock sample capture."
      stepIndex={Math.max(stepIndex, 0)}
      stepCount={stepCount}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>On-site verification</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>
          Confirm you&apos;re on site once you arrive. This unlocks the next step.
        </Text>
        {arrivalVerified ? (
          <Text style={[styles.successText, { color: successTone }]}>
            On-site verified {arrivalVerification?.distanceMeters !== undefined
              ? `• ${formatDistance(arrivalVerification.distanceMeters)} from address`
              : ''}
          </Text>
        ) : null}
        {!arrivalSent ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>
            Send the on-the-way message before verifying arrival.
          </Text>
        ) : arrivalVerifyError ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{arrivalVerifyError}</Text>
        ) : distanceMessage ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{distanceMessage}</Text>
        ) : null}
        {locationMessage ? (
          <Text style={[styles.cardBody, { color: palette.muted }]}>{locationMessage}</Text>
        ) : null}
        <Button
          title={arrivalVerifying ? 'Checking location...' : 'Verify I am on site'}
          onPress={handleVerifyLocation}
          disabled={!canVerify || arrivalVerifying || arrivalVerified}
        />
      </View>

      <Button
        title="Continue to next step"
        onPress={handleNext}
        variant="cta"
        disabled={!canContinue}
      />
      {!canContinue ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Verify your on-site location before continuing.
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
  helperText: {
    fontSize: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
  },
});
