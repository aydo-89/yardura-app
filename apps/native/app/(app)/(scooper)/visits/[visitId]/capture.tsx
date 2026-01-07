import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import * as Device from 'expo-device';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import Screen from '@/components/ui/Screen';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { useRemoteShutter } from '@/lib/media/remoteShutter';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

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
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<'SURFACE' | 'CROSS_SECTION'>('SURFACE');
  const [frameSize, setFrameSize] = useState<number | null>(null);
  const [guideVisible, setGuideVisible] = useState(true);
  const [pendingSampleId, setPendingSampleId] = useState<string | null>(null);

  const {
    steps,
    visitId,
    cameraZoom,
    insightMedia,
    analyzedCount,
    analysisGoal,
    uploadingType,
    uploadMedia,
    error,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

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
        await uploadMedia(asset, {
          assetType: 'INSIGHTSCOOP',
          analysisMode: 'analyze',
          stoolSampleView,
          stoolSampleId: sampleId,
        });
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
    if (showGuide) {
      setGuideVisible(false);
      return;
    }
    handleSinglePress();
  }, [showGuide, handleSinglePress]);

  const handleRemoteDoublePress = useCallback(() => {
    if (showGuide) {
      setGuideVisible(false);
      return;
    }
    handleDoublePress();
  }, [showGuide, handleDoublePress]);

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
              View poop map (optional)
            </Text>
          </Pressable>

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
        </View>

        {showGuide ? (
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
});
