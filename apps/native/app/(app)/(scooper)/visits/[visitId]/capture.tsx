import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import * as Device from 'expo-device';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import Screen from '@/components/ui/Screen';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { useRemoteShutter } from '@/lib/media/remoteShutter';
import { useStepGuard } from '@/lib/scooper/useStepGuard';
import { apiRequest } from '@/lib/api/client';
import PoopMapPlacementModal from '@/components/maps/PoopMapPlacementModal';
import { LOW_CONFIDENCE_THRESHOLD_METERS } from '@/lib/maps/poopMap';
import { useAuth } from '@/lib/auth/AuthProvider';

const ZOOM_THUMB_SIZE = 20;

type ImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function generateSampleId() {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toEpoch(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function resolveAsset(asset: ImageAsset) {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `insightscoop-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  };
}

export default function CaptureStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<'SURFACE' | 'CROSS_SECTION'>('SURFACE');
  const [frameSize, setFrameSize] = useState<number | null>(null);
  const [guideVisible, setGuideVisible] = useState(true);
  const [pendingSampleId, setPendingSampleId] = useState<string | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementTarget, setPlacementTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
  } | null>(null);
  // Calibration/test capture state
  const [calibrationVisible, setCalibrationVisible] = useState(true);
  const [testCapturing, setTestCapturing] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const testSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    steps,
    visitId,
    cameraZoom,
    setCameraZoom,
    testCaptureConfirmed,
    setTestCaptureConfirmed,
    insightMedia,
    analyzedCount,
    analysisGoal,
    uploadingType,
    lastLocationSnap,
    uploadMedia,
    error,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  // Track location snap feedback display
  const [snapFeedback, setSnapFeedback] = useState<{
    snapped: boolean;
    correctionMeters: number | null;
  } | null>(null);
  const snapFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show feedback when location is snapped
  useEffect(() => {
    if (lastLocationSnap?.snapped && lastLocationSnap.correctionMeters) {
      setSnapFeedback({
        snapped: true,
        correctionMeters: lastLocationSnap.correctionMeters,
      });
      // Clear feedback after 3 seconds
      if (snapFeedbackTimer.current) {
        clearTimeout(snapFeedbackTimer.current);
      }
      snapFeedbackTimer.current = setTimeout(() => {
        setSnapFeedback(null);
      }, 3000);
    }
    return () => {
      if (snapFeedbackTimer.current) {
        clearTimeout(snapFeedbackTimer.current);
      }
    };
  }, [lastLocationSnap]);

  useStepGuard('capture');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'capture'),
    0,
  );

  const uploading = uploadingType === 'INSIGHTSCOOP' || capturing;
  const cameraBlocked = Device.isDevice !== true;
  const allowPreview = !cameraBlocked && cameraAvailable !== false;
  const captureLabel = captureMode === 'CROSS_SECTION' ? 'Cross-section' : 'Surface';
  const frameColor = captureMode === 'CROSS_SECTION' ? Colors.brand.gold : Colors.brand.mint;
  const showGuide = guideVisible && Boolean(permission?.granted) && allowPreview;

  const surfaceCount = useMemo(
    () => insightMedia.filter((media) => media.stoolSampleView !== 'CROSS_SECTION').length,
    [insightMedia],
  );
  const latestInsight = useMemo(() => {
    if (!insightMedia.length) return null;
    return insightMedia.reduce((latest, item) => {
      const latestTime = toEpoch(latest.capturedAt ?? latest.createdAt ?? latest.updatedAt);
      const itemTime = toEpoch(item.capturedAt ?? item.createdAt ?? item.updatedAt);
      return itemTime > latestTime ? item : latest;
    }, insightMedia[0]);
  }, [insightMedia]);
  const analysisPending =
    latestInsight?.analysisStatus === 'PENDING' ||
    latestInsight?.analysisStatus === 'IN_PROGRESS';
  const isProcessing = uploading;
  const processingLabel = uploading ? 'Uploading...' : '';
  const sampleNumber = captureMode === 'CROSS_SECTION'
    ? Math.max(surfaceCount, 1)
    : surfaceCount + 1;
  const overlayText = colorScheme === 'dark' ? '#F8FAFC' : '#0F172A';
  const overlayMuted = colorScheme === 'dark' ? '#CBD5E1' : '#475569';
  const panelBackground = colorScheme === 'dark'
    ? 'rgba(15, 23, 42, 0.92)'
    : 'rgba(248, 250, 252, 0.95)';
  const panelBorder = colorScheme === 'dark'
    ? 'rgba(148, 163, 184, 0.2)'
    : 'rgba(15, 23, 42, 0.08)';
  const guideBackdrop = colorScheme === 'dark'
    ? 'rgba(15, 23, 42, 0.84)'
    : 'rgba(15, 23, 42, 0.6)';
  const controlHint =
    captureMode === 'CROSS_SECTION'
      ? 'Bluetooth: click once to capture. Double click skips cross section.'
      : 'Bluetooth: click once to capture.';

  // Show calibration overlay if test capture not yet confirmed and user hasn't dismissed it
  const showCalibration = calibrationVisible && !testCaptureConfirmed && Boolean(permission?.granted) && allowPreview;
  const zoomLabel = `${Math.round(cameraZoom * 100)}%`;

  // Zoom slider interaction
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

  // Test capture handler
  const handleTestCapture = useCallback(
    async (source: 'remote' | 'button') => {
      if (!permission?.granted || !cameraReady || !cameraRef.current || testCapturing) {
        return;
      }
      setTestCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.65 });
        if (photo?.uri) {
          setTestCaptureConfirmed(true);
          setTestSuccess(true);
          // Auto-dismiss after showing success
          testSuccessTimer.current = setTimeout(() => {
            setTestSuccess(false);
            setCalibrationVisible(false);
          }, 900);
        }
      } catch (err) {
        console.warn('camera.test.failed', err);
      } finally {
        setTestCapturing(false);
      }
    },
    [permission?.granted, cameraReady, testCapturing, setTestCaptureConfirmed],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (testSuccessTimer.current) {
        clearTimeout(testSuccessTimer.current);
      }
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (analysisGoal === 0) return 'No analysis goal set for this visit.';
    return `${analyzedCount} analyzed of ${analysisGoal} goal`;
  }, [analysisGoal, analyzedCount]);

  useEffect(() => {
    if (cameraBlocked) {
      setCameraAvailable(false);
      return;
    }
    setCameraAvailable(true);
  }, [cameraBlocked]);

  useEffect(() => {
    if (!isFocused) return;
    activateKeepAwake();
    return () => {
      deactivateKeepAwake();
    };
  }, [isFocused]);

  const captureCameraPhoto = useCallback(async () => {
    if (!permission?.granted || !cameraReady || !cameraRef.current) {
      return null;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return null;
      return {
        uri: photo.uri,
        fileName: `insightscoop-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      };
    } catch (error) {
      console.warn('camera.capture.failed', error);
      return null;
    }
  }, [permission?.granted, cameraReady]);

  const captureSample = useCallback(
    async (
      stoolSampleView: 'SURFACE' | 'CROSS_SECTION',
      source: 'camera' | 'library' = 'camera',
    ) => {
      if (isProcessing) return;
      setCapturing(true);
      try {
        const assetResult =
          source === 'library'
            ? await captureWithFallback({ kind: 'photo', quality: 0.85, source: 'library' })
            : await captureCameraPhoto();
        if (!assetResult) return;
        const asset = resolveAsset(assetResult);
        const sampleId =
          stoolSampleView === 'SURFACE'
            ? generateSampleId()
            : pendingSampleId ?? generateSampleId();
        const created = await uploadMedia(asset, {
          assetType: 'INSIGHTSCOOP',
          analysisMode: 'analyze',
          stoolSampleView,
          stoolSampleId: sampleId,
        });
        if (
          created &&
          typeof created.gpsLat === 'number' &&
          typeof created.gpsLng === 'number'
        ) {
          const accuracy = created.gpsAccuracy ?? null;
          if (typeof accuracy === 'number' && accuracy > LOW_CONFIDENCE_THRESHOLD_METERS) {
            setPlacementTarget({
              id: created.id,
              lat: created.gpsLat,
              lng: created.gpsLng,
              accuracy,
            });
            setPlacementOpen(true);
          }
        }
        if (stoolSampleView === 'SURFACE') {
          setPendingSampleId(sampleId);
          setCaptureMode('CROSS_SECTION');
        } else {
          setPendingSampleId(null);
          setCaptureMode('SURFACE');
        }
      } finally {
        setCapturing(false);
      }
    },
    [isProcessing, uploadMedia, captureCameraPhoto, pendingSampleId],
  );

  const handleSinglePress = useCallback(() => {
    if (isProcessing) return;
    const source = cameraBlocked ? 'library' : 'camera';
    captureSample(captureMode, source);
  }, [isProcessing, captureMode, cameraBlocked, captureSample]);

  const handleDoublePress = useCallback(() => {
    if (isProcessing) return;
    if (captureMode === 'CROSS_SECTION') {
      setPendingSampleId(null);
      setCaptureMode('SURFACE');
    }
  }, [isProcessing, captureMode]);

  const handleRemoteSinglePress = useCallback(() => {
    // Handle calibration mode
    if (showCalibration) {
      handleTestCapture('remote');
      return;
    }
    if (showGuide) {
      setGuideVisible(false);
      return;
    }
    handleSinglePress();
  }, [showCalibration, showGuide, handleTestCapture, handleSinglePress]);

  const handleRemoteDoublePress = useCallback(() => {
    // Handle calibration mode - double click skips calibration
    if (showCalibration) {
      setTestCaptureConfirmed(true);
      setCalibrationVisible(false);
      return;
    }
    if (showGuide) {
      setGuideVisible(false);
      return;
    }
    handleDoublePress();
  }, [showCalibration, showGuide, setTestCaptureConfirmed, handleDoublePress]);

  useRemoteShutter({
    onSinglePress: handleRemoteSinglePress,
    onDoublePress: handleRemoteDoublePress,
    enabled: isFocused,
  });

  const handleBack = () => {
    const prev = getPreviousStep('capture');
    if (!prev) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${prev}`);
  };

  const handleNext = () => {
    const next = getNextStep('capture');
    if (!next) return;
    router.push(`/(app)/(scooper)/visits/${visitId}/${next}`);
  };

  const handlePlacementSave = useCallback(
    async (nextLocation: { lat: number; lng: number; accuracy?: number | null }) => {
      if (!visitId || !session?.token || !placementTarget) return;
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/media/${placementTarget.id}`, {
          method: 'PATCH',
          token: session.token,
          body: {
            lat: nextLocation.lat,
            lng: nextLocation.lng,
            accuracy: 3,
            rawLat: placementTarget.lat,
            rawLng: placementTarget.lng,
            rawAccuracy: placementTarget.accuracy ?? null,
          },
        });
      } catch (err) {
        console.warn('visit.media.location.update.failed', err);
      } finally {
        setPlacementOpen(false);
        setPlacementTarget(null);
      }
    },
    [placementTarget, session?.token, visitId],
  );

  const handleCameraLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!width || !height) return;
    const size = Math.min(width, height) * 0.72;
    setFrameSize(size);
  }, []);

  const capturedCount = surfaceCount;
  const canContinue = capturedCount > 0;

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
                : 'Camera access is required to capture samples.'}
            </Text>
            {!cameraBlocked ? (
              <Button
                title="Enable camera"
                onPress={() => requestPermission()}
                variant="secondary"
              />
            ) : null}
            <Button
              title="Use photo library"
              onPress={() => captureSample('SURFACE', 'library')}
              variant="ghost"
            />
          </View>
        )}

        <View pointerEvents="none" style={styles.frameOverlay}>
          <View style={styles.frameStack}>
            <View style={styles.frameHeader}>
              <View
                style={[
                  styles.sampleBadge,
                  { backgroundColor: panelBackground, borderColor: frameColor },
                ]}
              >
                <Text style={[styles.sampleBadgeText, { color: frameColor }]}>
                  Sample {sampleNumber}
                </Text>
              </View>
              <View
                style={[
                  styles.captureLabel,
                  { backgroundColor: panelBackground, borderColor: frameColor },
                ]}
              >
                <Text style={[styles.captureLabelText, { color: frameColor }]}>
                  {captureLabel}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.frame,
                {
                  borderColor: frameColor,
                  width: frameSize ?? undefined,
                  height: frameSize ?? undefined,
                },
              ]}
            />
            <Text style={[styles.frameHint, { color: overlayMuted }]}>
              Center stool inside the frame
            </Text>
          </View>
        </View>

        <View style={[styles.topBar, { backgroundColor: panelBackground, borderBottomColor: panelBorder }]}>
          <Button title="Back" onPress={handleBack} variant="ghost" />
          <Text style={[styles.stepLabel, { color: overlayText }]}>
            Step {stepIndex + 1} of {steps.length || 1}
          </Text>
        </View>

        <View style={[styles.bottomPanel, { backgroundColor: panelBackground, borderTopColor: panelBorder }]}>
          <View style={styles.panelHeaderRow}>
            <Text style={[styles.panelTitle, { color: overlayText }]}>Capture</Text>
            <Text style={[styles.panelMeta, { color: overlayMuted }]}>
              Sample {sampleNumber} • {captureLabel}
            </Text>
          </View>
          <Text style={[styles.panelHint, { color: overlayMuted }]}>{controlHint}</Text>
          {analysisPending ? (
            <Text style={[styles.panelHint, { color: overlayMuted }]}>
              Analysis running in the background.
            </Text>
          ) : null}
          <Pressable
            onPress={() => router.push(`/(app)/(scooper)/visits/${visitId}/poop-map`)}
            style={styles.mapLinkRow}
          >
            <Text style={[styles.mapLinkText, { color: overlayText }]}>
              View yard map (optional)
            </Text>
          </Pressable>
          {placementTarget ? (
            <Pressable
              onPress={() => setPlacementOpen(true)}
              style={styles.mapLinkRow}
            >
              <Text style={[styles.mapLinkText, { color: overlayText }]}>
                Adjust last capture location
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actionRow}>
            <Button
              title={
                isProcessing
                  ? uploading
                    ? 'Capturing...'
                    : 'Analyzing...'
                  : captureMode === 'CROSS_SECTION'
                    ? 'Capture cross-section'
                    : 'Capture sample'
              }
              onPress={handleSinglePress}
              disabled={isProcessing}
              style={styles.actionButton}
              labelStyle={styles.actionLabel}
            />
            {captureMode === 'CROSS_SECTION' ? (
              <Button
                title="Skip"
                onPress={() => setCaptureMode('SURFACE')}
                disabled={isProcessing}
                variant="secondary"
                style={styles.actionButton}
                labelStyle={styles.actionLabel}
              />
            ) : null}
          </View>
          <View style={styles.panelFooterRow}>
            <View style={styles.panelStats}>
              <Text style={[styles.progressText, { color: overlayMuted }]} numberOfLines={1}>
                Captured: {capturedCount}
              </Text>
              <Text style={[styles.progressText, { color: overlayMuted }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            <Button
              title="Continue"
              onPress={handleNext}
              disabled={!canContinue}
              variant="cta"
              style={styles.continueButton}
              labelStyle={styles.continueLabel}
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}
          {!canContinue ? (
            <Text style={[styles.helperText, { color: overlayMuted }]}>
              Capture at least one deposit before continuing.
            </Text>
          ) : null}

          {/* Location snap feedback */}
          {snapFeedback ? (
            <View style={[styles.snapFeedback, { backgroundColor: `${Colors.brand.mint}15`, borderColor: Colors.brand.mint }]}>
              <FontAwesome name="map-pin" size={12} color={Colors.brand.mint} />
              <Text style={[styles.snapFeedbackText, { color: Colors.brand.mint }]}>
                Location adjusted {snapFeedback.correctionMeters?.toFixed(1)}m to yard boundary
              </Text>
            </View>
          ) : null}
        </View>

        {/* Calibration overlay - shows before first capture */}
        {showCalibration ? (
          <View style={[styles.guideOverlay, { backgroundColor: guideBackdrop }]}>
            <View style={styles.calibrationFrameOverlay}>
              <View style={styles.calibrationFrameStack}>
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
            </View>
            <View style={[styles.calibrationCard, { backgroundColor: panelBackground, borderColor: panelBorder }]}>
              <Text style={[styles.guideTitle, { color: overlayText }]}>Calibrate zoom</Text>
              <Text style={[styles.calibrationHint, { color: overlayMuted }]}>
                Adjust so stool fills the frame, then test capture
              </Text>
              <View
                style={styles.zoomSlider}
                onLayout={handleSliderLayout}
                {...panResponder.panHandlers}
              >
                <View style={[styles.zoomTrack, { backgroundColor: panelBorder }]} />
                <View style={[styles.zoomFill, { width: sliderWidth * cameraZoom, backgroundColor: Colors.brand.mint }]} />
                <View
                  style={[
                    styles.zoomThumb,
                    {
                      left: Math.min(
                        Math.max(sliderWidth * cameraZoom - ZOOM_THUMB_SIZE / 2, 0),
                        Math.max(sliderWidth - ZOOM_THUMB_SIZE, 0),
                      ),
                      borderColor: panelBorder,
                      backgroundColor: panelBackground,
                    },
                  ]}
                />
                <Text style={[styles.zoomValue, { color: overlayText }]}>Zoom {zoomLabel}</Text>
              </View>
              <View style={styles.calibrationActions}>
                <Button
                  title={testCapturing ? 'Testing...' : 'Test capture'}
                  onPress={() => handleTestCapture('button')}
                  disabled={testCapturing || !cameraReady}
                  style={styles.calibrationButton}
                />
                <Button
                  title="Skip"
                  onPress={() => {
                    setTestCaptureConfirmed(true);
                    setCalibrationVisible(false);
                  }}
                  variant="ghost"
                  style={styles.calibrationButton}
                />
              </View>
              <Text style={[styles.calibrationFootnote, { color: overlayMuted }]}>
                Bluetooth: click to test, double-click to skip
              </Text>
            </View>

            {/* Test success overlay */}
            {testSuccess ? (
              <View style={styles.testSuccessOverlay}>
                <View style={[styles.testSuccessCard, { borderColor: Colors.brand.mint, backgroundColor: panelBackground }]}>
                  <FontAwesome name="check-circle" size={56} color={Colors.brand.mint} />
                  <Text style={[styles.testSuccessTitle, { color: Colors.brand.mint }]}>Bluetooth verified</Text>
                  <Text style={[styles.testSuccessBody, { color: overlayText }]}>Starting sample capture...</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {showGuide && !showCalibration ? (
          <View style={[styles.guideOverlay, { backgroundColor: guideBackdrop }]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setGuideVisible(false)} />
            <View style={[styles.guideCard, { backgroundColor: panelBackground, borderColor: panelBorder }]}>
              <Text style={[styles.guideTitle, { color: overlayText }]}>Capture controls</Text>
              <Text style={[styles.guideBody, { color: overlayText }]}>
                Keep the stool centered inside the frame. Keep your hands free with the Bluetooth remote.
              </Text>
              <View style={styles.controlList}>
                <View style={styles.controlRow}>
                  <View style={[styles.controlBadge, { borderColor: panelBorder, backgroundColor: panelBackground }]}>
                    <Text style={[styles.controlBadgeText, { color: overlayText }]}>Bluetooth</Text>
                  </View>
                  <Text style={[styles.controlText, { color: overlayText }]} numberOfLines={1}>
                    Click once: Capture
                  </Text>
                </View>
                <View style={styles.controlRow}>
                  <View style={[styles.controlBadge, { borderColor: panelBorder, backgroundColor: panelBackground }]}>
                    <Text style={[styles.controlBadgeText, { color: overlayText }]}>Bluetooth</Text>
                  </View>
                  <Text style={[styles.controlText, { color: overlayText }]} numberOfLines={1}>
                    Double click: Skip cross section
                  </Text>
                </View>
              </View>
              <Text style={[styles.guideFootnote, { color: overlayMuted }]}>
                Tap anywhere to close this guide.
              </Text>
              <Button
                title="Got it"
                onPress={() => setGuideVisible(false)}
                variant="secondary"
                style={styles.guideButton}
                labelStyle={styles.guideButtonLabel}
              />
            </View>
          </View>
        ) : null}

        {uploading ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={palette.tint} />
            <Text style={[styles.processingText, { color: '#F8FAFC' }]}>{processingLabel}</Text>
          </View>
        ) : null}
        {placementTarget && session?.token ? (
          <PoopMapPlacementModal
            visible={placementOpen}
            token={session.token}
            mapEndpoint={`/api/field-tech/visits/${visitId}/poop-map`}
            initialLocation={{
              lat: placementTarget.lat,
              lng: placementTarget.lng,
              accuracy: placementTarget.accuracy ?? null,
            }}
            title="Adjust pin placement"
            subtitle="Drag the pin to the exact spot. Accurate placement builds the hot-spot map so future visits here are faster."
            onClose={() => setPlacementOpen(false)}
            onSave={handlePlacementSave}
          />
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
    fontSize: 13,
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameStack: {
    alignItems: 'center',
    gap: 10,
    transform: [{ translateY: -50 }],
  },
  frameHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  sampleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  sampleBadgeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  captureLabel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  captureLabelText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  frame: {
    width: '72%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameHint: {
    fontSize: 15,
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
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
    borderTopWidth: 1,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  panelMeta: {
    fontSize: 12,
  },
  panelHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  mapLinkRow: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  mapLinkText: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionLabel: {
    fontSize: 14,
  },
  progressText: {
    fontSize: 12,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
    marginTop: 2,
  },
  snapFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  snapFeedbackText: {
    fontSize: 11,
    fontWeight: '600',
  },
  panelFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelStats: {
    flex: 1,
    gap: 2,
  },
  continueButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  continueLabel: {
    fontSize: 13,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guideCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  guideBody: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
  },
  controlList: {
    gap: 10,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  controlBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  controlBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  controlText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  guideFootnote: {
    fontSize: 15,
    fontWeight: '600',
  },
  guideButton: {
    marginTop: 4,
  },
  guideButtonLabel: {
    fontSize: 15,
  },
  // Calibration overlay styles
  calibrationFrameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calibrationFrameStack: {
    alignItems: 'center',
    gap: 10,
    transform: [{ translateY: -80 }],
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
  calibrationCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  calibrationHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  zoomSlider: {
    height: 36,
    justifyContent: 'center',
    marginVertical: 4,
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
  calibrationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  calibrationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  calibrationFootnote: {
    fontSize: 12,
    textAlign: 'center',
  },
  testSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  testSuccessCard: {
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  testSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  testSuccessBody: {
    fontSize: 14,
    fontWeight: '600',
  },
});
