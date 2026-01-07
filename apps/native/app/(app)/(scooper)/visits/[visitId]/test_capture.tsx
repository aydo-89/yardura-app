import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import * as Device from 'expo-device';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import Screen from '@/components/ui/Screen';
import { useRemoteShutter } from '@/lib/media/remoteShutter';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

const ZOOM_THUMB_SIZE = 20;

export default function TestCaptureStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTone = Colors.brand.mint;
  const isFocused = useIsFocused();
  const cameraRef = useRef<any>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [triggerSource, setTriggerSource] = useState<'remote' | 'button' | null>(null);
  const [frameSize, setFrameSize] = useState<number | null>(null);
  const [sliderWidth, setSliderWidth] = useState(0);

  const {
    steps,
    visitId,
    cameraZoom,
    setCameraZoom,
    testCaptureConfirmed,
    setTestCaptureConfirmed,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  useStepGuard('test_capture');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'test_capture'),
    0,
  );
  const stepCount = steps.length || 1;
  const cameraBlocked = Device.isDevice !== true;
  const allowPreview = !cameraBlocked && cameraAvailable !== false;
  const canCapture = Boolean(permission?.granted && cameraReady && allowPreview && !capturing);
  const overlayText = colorScheme === 'dark' ? '#F8FAFC' : '#0F172A';
  const overlayMuted = colorScheme === 'dark' ? '#CBD5E1' : '#475569';
  const panelBackground = colorScheme === 'dark'
    ? 'rgba(15, 23, 42, 0.92)'
    : 'rgba(248, 250, 252, 0.96)';
  const panelBorder = colorScheme === 'dark'
    ? 'rgba(148, 163, 184, 0.2)'
    : 'rgba(15, 23, 42, 0.08)';
  const zoomLabel = `${Math.round(cameraZoom * 100)}%`;
  const showFrameOverlay = Boolean(permission?.granted && isFocused && allowPreview);

  useEffect(() => {
    if (cameraBlocked) {
      setCameraAvailable(false);
      return;
    }
    setCameraAvailable(true);
  }, [cameraBlocked]);

  useEffect(() => {
    if (!successVisible) return undefined;
    const next = getNextStep('test_capture');
    if (!next) return undefined;
    successTimer.current = setTimeout(() => {
      router.push(`/(app)/(scooper)/visits/${visitId}/${next}`);
    }, 900);
    return () => {
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
    };
  }, [successVisible, getNextStep, visitId]);

  const handleCameraLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!width || !height) return;
    const size = Math.min(width, height) * 0.7;
    setFrameSize(size);
  }, []);

  const updateZoomFromX = useCallback(
    (x: number) => {
      if (!sliderWidth) return;
      const clamped = Math.min(Math.max(x, 0), sliderWidth);
      const nextZoom = clamped / sliderWidth;
      setCameraZoom(nextZoom);
    },
    [sliderWidth, setCameraZoom],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateZoomFromX(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateZoomFromX(event.nativeEvent.locationX),
      }),
    [updateZoomFromX],
  );

  const handleSliderLayout = useCallback((event: LayoutChangeEvent) => {
    setSliderWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTestCapture = useCallback(
    async (source: 'remote' | 'button') => {
      if (!permission?.granted || !cameraReady || !cameraRef.current || capturing) {
        return;
      }
      setCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.65 });
        if (photo?.uri) {
          setTriggerSource(source);
          setTestCaptureConfirmed(true);
          setSuccessVisible(true);
        }
      } catch (error) {
        console.warn('camera.test.failed', error);
      } finally {
        setCapturing(false);
      }
    },
    [permission?.granted, cameraReady, capturing, setTestCaptureConfirmed],
  );

  useRemoteShutter({
    onSinglePress: () => handleTestCapture('remote'),
    onDoublePress: () => handleTestCapture('remote'),
    enabled: isFocused,
  });

  const handleBack = () => {
    const prev = getPreviousStep('test_capture');
    if (!prev) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${prev}`);
  };

  const handleNext = () => {
    const next = getNextStep('test_capture');
    if (!next) return;
    router.push(`/(app)/(scooper)/visits/${visitId}/${next}`);
  };

  const handleSkip = () => {
    setTestCaptureConfirmed(true);
    handleNext();
  };

  const thumbSize = ZOOM_THUMB_SIZE;
  const thumbOffset = sliderWidth ? sliderWidth * cameraZoom : 0;
  const thumbLeft = Math.min(
    Math.max(thumbOffset - thumbSize / 2, 0),
    Math.max(sliderWidth - thumbSize, 0),
  );

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.cameraWrap} onLayout={handleCameraLayout}>
        {permission?.granted && isFocused && allowPreview ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            zoom={cameraZoom}
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={[styles.cameraPlaceholder, { borderColor: palette.border }]}> 
            <Text style={[styles.placeholderText, { color: palette.muted }]}>
              {cameraBlocked
                ? 'Camera preview is not available on simulators.'
                : 'Camera access is required to test the shutter.'}
            </Text>
            {!cameraBlocked ? (
              <Button
                title="Enable camera"
                onPress={() => requestPermission()}
                variant="secondary"
              />
            ) : null}
            {cameraBlocked ? (
              <Button
                title="Continue without test"
                onPress={handleSkip}
                variant="ghost"
              />
            ) : null}
          </View>
        )}

        {showFrameOverlay ? (
          <View pointerEvents="none" style={styles.frameOverlay}>
            <View style={styles.frameStack}>
              <View
                style={[
                  styles.frame,
                  {
                    borderColor: Colors.brand.mint,
                    width: frameSize ?? undefined,
                    height: frameSize ?? undefined,
                  },
                ]}
              />
              <Text style={[styles.frameHint, { color: overlayMuted }]}>Keep the bucket centered</Text>
            </View>
            <View style={[styles.testStamp, { borderColor: Colors.brand.coralInk }]}>
              <Text style={[styles.testStampText, { color: Colors.brand.coralInk }]}>TEST</Text>
            </View>
            <View
              style={[
                styles.testGuideCard,
                { backgroundColor: panelBackground, borderColor: panelBorder },
              ]}
            >
              <Text style={[styles.testGuideTitle, { color: overlayText }]}>Test capture checklist</Text>
              <View style={styles.testGuideRow}>
                <View style={[styles.testGuideBadge, { borderColor: panelBorder }]}>
                  <Text style={[styles.testGuideBadgeText, { color: overlayText }]}>1</Text>
                </View>
                <Text style={[styles.testGuideText, { color: overlayText }]}>
                  Calibrate zoom so stool fills most of the frame.
                </Text>
              </View>
              <View style={styles.testGuideRow}>
                <View style={[styles.testGuideBadge, { borderColor: panelBorder }]}>
                  <Text style={[styles.testGuideBadgeText, { color: overlayText }]}>2</Text>
                </View>
                <Text style={[styles.testGuideText, { color: overlayText }]}>
                  Use the Bluetooth remote to test capture.
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.topBar, { backgroundColor: panelBackground, borderBottomColor: panelBorder }]}> 
          <Button title="Back" onPress={handleBack} variant="ghost" />
          <Text style={[styles.stepLabel, { color: overlayText }]}>Step {stepIndex + 1} of {stepCount}</Text>
        </View>

        <View style={[styles.bottomPanel, { backgroundColor: panelBackground, borderTopColor: panelBorder }]}> 
          <View
            style={styles.zoomSlider}
            onLayout={handleSliderLayout}
            {...panResponder.panHandlers}
          >
            <View style={[styles.zoomTrack, { backgroundColor: panelBorder }]} />
            <View style={[styles.zoomFill, { width: thumbOffset, backgroundColor: successTone }]} />
            <View
              style={[
                styles.zoomThumb,
                {
                  left: thumbLeft,
                  borderColor: panelBorder,
                  backgroundColor: panelBackground,
                },
              ]}
            />
            <Text style={[styles.zoomValue, { color: overlayText }]}>Zoom {zoomLabel}</Text>
          </View>
          <View style={styles.actionRow}>
            <Button
              title={capturing ? 'Testing...' : 'Test capture'}
              onPress={() => handleTestCapture('button')}
              disabled={!canCapture || capturing}
              style={styles.actionButton}
              labelStyle={styles.actionLabel}
            />
            <Button
              title="Continue"
              onPress={handleNext}
              disabled={!testCaptureConfirmed}
              variant="cta"
              style={styles.actionButton}
              labelStyle={styles.actionLabel}
            />
          </View>
        </View>

        {capturing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={palette.tint} />
            <Text style={styles.processingText}>Capturing test...</Text>
          </View>
        ) : null}

        {successVisible ? (
          <View style={styles.successOverlay}>
            <View style={[styles.successCard, { borderColor: successTone, backgroundColor: panelBackground }]}> 
              <FontAwesome name="check-circle" size={56} color={successTone} />
              <Text style={[styles.successTitle, { color: successTone }]}> 
                {triggerSource === 'remote' ? 'Bluetooth verified' : 'Test capture complete'}
              </Text>
              <Text style={[styles.successBody, { color: overlayText }]}>Moving to sample capture...</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  cameraWrap: {
    flex: 1,
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 14,
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  frameStack: {
    alignItems: 'center',
    gap: 10,
    transform: [{ translateY: -30 }],
  },
  testStamp: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    paddingHorizontal: 28,
    paddingVertical: 6,
    borderWidth: 3,
    borderRadius: 8,
    opacity: 0.35,
    transform: [{ translateX: -120 }, { translateY: -118 }, { rotate: '-12deg' }],
  },
  testStampText: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 8,
  },
  frame: {
    width: '70%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 18,
  },
  frameHint: {
    fontSize: 15,
    fontWeight: '600',
  },
  testGuideCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 130,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  testGuideTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  testGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testGuideBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testGuideBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testGuideText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  zoomSlider: {
    height: 32,
    justifyContent: 'center',
  },
  zoomTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 999,
  },
  zoomFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 999,
  },
  zoomThumb: {
    position: 'absolute',
    width: ZOOM_THUMB_SIZE,
    height: ZOOM_THUMB_SIZE,
    borderRadius: ZOOM_THUMB_SIZE / 2,
    borderWidth: 2,
  },
  zoomValue: {
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionLabel: {
    fontSize: 14,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  successCard: {
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  successBody: {
    fontSize: 14,
    fontWeight: '600',
  },
});
