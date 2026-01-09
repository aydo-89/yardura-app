import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

const THRESHOLD_METERS = 150; // ~500 feet

export default function ArrivalStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  const {
    steps,
    visitId,
    visit,
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

  // Animation values
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);
  const checkScale = useSharedValue(0);

  useStepGuard('arrival');

  const stepIndex = useMemo(
    () => steps.findIndex((step) => step.id === 'arrival'),
    [steps],
  );
  const stepCount = steps.length || 1;

  const customerName = visit?.customer?.name ?? 'Customer';

  // Pulse animation when verifying
  useEffect(() => {
    if (arrivalVerifying) {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 800 }),
          withTiming(0.5, { duration: 800 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      ringScale.value = withTiming(1, { duration: 200 });
      ringOpacity.value = withTiming(0.5, { duration: 200 });
    }
  }, [arrivalVerifying, ringScale, ringOpacity]);

  // Success animation
  useEffect(() => {
    if (arrivalVerified) {
      checkScale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 200 }),
        withSpring(1, { damping: 15 }),
      );
    }
  }, [arrivalVerified, checkScale]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const formatDistance = (meters?: number | null) => {
    if (!meters && meters !== 0) return null;
    const feet = meters * 3.28084;
    const miles = meters / 1609.34;
    if (miles < 0.1) return `${Math.round(feet)} ft`;
    return `${miles.toFixed(2)} mi`;
  };

  const getProximityMessage = (meters?: number | null) => {
    if (!meters && meters !== 0) return null;
    if (meters <= 30) return "You're here!";
    if (meters <= THRESHOLD_METERS) return 'Almost there!';
    return 'Getting closer...';
  };

  const handleVerifyLocation = async () => {
    setLocationMessage(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationMessage('Location permission required');
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
      setLocationMessage(null);
    } else if (Device.isDevice !== true) {
      setLocationMessage('Set simulated location in simulator');
    }
  };

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('arrival'));
  const handleNext = () => goToStep(getNextStep('arrival'));

  const canContinue = !arrivalRequired || arrivalVerified;
  const canVerify = arrivalSent;
  const distanceLabel = formatDistance(arrivalVerification?.distanceMeters);
  const proximityMessage = getProximityMessage(arrivalVerification?.distanceMeters);
  const isTooFar = arrivalVerification?.distanceMeters && arrivalVerification.distanceMeters > THRESHOLD_METERS;

  return (
    <VisitStepShell
      title="Confirm arrival"
      subtitle={`Verify you're at ${customerName}'s location`}
      stepIndex={Math.max(stepIndex, 0)}
      stepCount={stepCount}
      onBack={handleBack}
    >
      {/* Proximity Indicator */}
      <View style={styles.proximityContainer}>
        {arrivalVerified ? (
          <Animated.View style={[styles.successCircle, { backgroundColor: successTone }, checkAnimatedStyle]}>
            <FontAwesome name="check" size={40} color="#FFFFFF" />
          </Animated.View>
        ) : (
          <View style={styles.ringContainer}>
            <Animated.View
              style={[
                styles.outerRing,
                { borderColor: arrivalVerifying ? palette.tint : palette.border },
                ringAnimatedStyle,
              ]}
            />
            <View style={[styles.innerCircle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <FontAwesome
                name="map-marker"
                size={32}
                color={arrivalVerifying ? palette.tint : palette.muted}
              />
            </View>
          </View>
        )}
      </View>

      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        {arrivalVerified ? (
          <>
            <Text style={[styles.statusTitle, { color: successTone }]}>Arrived safely</Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              {distanceLabel ? `${distanceLabel} from address` : 'Location verified'}
            </Text>
          </>
        ) : arrivalVerifying ? (
          <>
            <Text style={[styles.statusTitle, { color: palette.tint }]}>Checking location...</Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              Please wait while we verify your position
            </Text>
          </>
        ) : distanceLabel ? (
          <>
            <Text style={[styles.statusTitle, { color: isTooFar ? Colors.brand.coral : palette.text }]}>
              {proximityMessage}
            </Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              {distanceLabel} from {customerName}'s address
            </Text>
            {isTooFar ? (
              <Text style={[styles.statusHint, { color: Colors.brand.coral }]}>
                Move closer and try again
              </Text>
            ) : null}
          </>
        ) : !arrivalSent ? (
          <>
            <Text style={[styles.statusTitle, { color: palette.text }]}>Send notice first</Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              Go back to send the on-the-way message
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.statusTitle, { color: palette.text }]}>Ready to verify</Text>
            <Text style={[styles.statusBody, { color: palette.muted }]}>
              Tap the button below when you arrive on site
            </Text>
          </>
        )}
      </View>

      {/* Error Messages */}
      {arrivalVerifyError ? (
        <View style={[styles.errorCard, { borderColor: palette.danger }]}>
          <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{arrivalVerifyError}</Text>
        </View>
      ) : null}
      {locationMessage ? (
        <View style={[styles.errorCard, { borderColor: Colors.brand.gold }]}>
          <FontAwesome name="info-circle" size={14} color={Colors.brand.evergreen} />
          <Text style={[styles.errorText, { color: Colors.brand.evergreen }]}>{locationMessage}</Text>
        </View>
      ) : null}

      {/* Verify Button */}
      {!arrivalVerified ? (
        <Button
          title={arrivalVerifying ? 'Verifying...' : 'Verify location'}
          onPress={handleVerifyLocation}
          variant="primary"
          disabled={!canVerify || arrivalVerifying}
          style={styles.verifyButton}
        />
      ) : null}

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={canContinue ? 'cta' : 'secondary'}
          disabled={!canContinue}
          style={styles.continueButton}
        />
        {!canContinue ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Verify your location to continue
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  proximityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  innerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusBody: {
    fontSize: 14,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
  verifyButton: {
    marginTop: 8,
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
