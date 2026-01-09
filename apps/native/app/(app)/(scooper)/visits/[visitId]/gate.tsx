import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

type ImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function resolveAsset(asset: ImageAsset) {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `gate-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  };
}

export default function GateStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;

  const { steps, visitId, gateMedia, uploadingType, uploadMedia, getNextStep, getPreviousStep } = useVisitFlow();
  const [previewSeed, setPreviewSeed] = useState(0);

  useStepGuard('gate');

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'gate'), 0),
    [steps],
  );

  const handleCapture = async () => {
    const assetResult = await captureWithFallback({ kind: 'photo', quality: 0.85 });
    if (!assetResult) return;
    const asset = resolveAsset(assetResult);
    await uploadMedia(asset, { assetType: 'GATE' });
    setPreviewSeed((prev) => prev + 1);
  };

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('gate'));
  const handleNext = () => goToStep(getNextStep('gate'));

  const latestMedia = useMemo(() => {
    if (gateMedia.length === 0) return null;
    const toTime = (value?: string | null) => (value ? new Date(value).getTime() : 0);
    return [...gateMedia].sort((a, b) => {
      const aTime =
        toTime(a.capturedAt) ||
        toTime(a.uploadedAt) ||
        toTime(a.updatedAt) ||
        toTime(a.createdAt);
      const bTime =
        toTime(b.capturedAt) ||
        toTime(b.uploadedAt) ||
        toTime(b.updatedAt) ||
        toTime(b.createdAt);
      return aTime - bTime;
    }).at(-1);
  }, [gateMedia]);

  const hasPhoto = Boolean(latestMedia);
  const cacheBuster = [
    latestMedia?.uploadedAt ?? latestMedia?.capturedAt ?? latestMedia?.updatedAt ?? latestMedia?.createdAt ?? latestMedia?.id,
    String(previewSeed),
  ]
    .filter(Boolean)
    .join('-');
  const previewUrl = latestMedia?.url
    ? `${latestMedia.url}${latestMedia.url.includes('?') ? '&' : '?'}v=${cacheBuster || '1'}`
    : null;
  const isUploading = uploadingType === 'GATE';

  return (
    <VisitStepShell
      title="Secure the gate"
      subtitle="Confirm gate is properly latched before leaving"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* Instruction Card */}
      <View style={[styles.instructionCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={[styles.iconCircle, { backgroundColor: `${palette.tint}15` }]}>
          <FontAwesome name="lock" size={20} color={palette.tint} />
        </View>
        <View style={styles.instructionContent}>
          <Text style={[styles.instructionTitle, { color: palette.text }]}>Gate verification</Text>
          <Text style={[styles.instructionBody, { color: palette.muted }]}>
            Photo should show latch and lock clearly
          </Text>
        </View>
      </View>

      {/* Photo Preview or Capture Area */}
      {hasPhoto ? (
        <View style={styles.previewSection}>
          {previewUrl ? (
            <Pressable onPress={handleCapture} disabled={isUploading}>
              <Image key={previewUrl} source={{ uri: previewUrl }} style={styles.previewImage} />
              <View style={styles.retakeBadge}>
                <FontAwesome name="refresh" size={10} color="#FFFFFF" />
                <Text style={styles.retakeText}>Tap to retake</Text>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.pendingPreview, { backgroundColor: palette.background }]}>
              <FontAwesome name="clock-o" size={20} color={palette.muted} />
              <Text style={[styles.pendingText, { color: palette.muted }]}>Preview syncing...</Text>
            </View>
          )}
          <View style={[styles.successBadge, { backgroundColor: `${successTone}15` }]}>
            <FontAwesome name="check-circle" size={14} color={successTone} />
            <Text style={[styles.successText, { color: successTone }]}>Gate photo captured</Text>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={handleCapture}
          disabled={isUploading}
          style={({ pressed }) => [
            styles.captureCard,
            { borderColor: palette.tint, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.captureIcon, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="camera" size={24} color={palette.tint} />
          </View>
          <Text style={[styles.captureTitle, { color: palette.text }]}>
            {isUploading ? 'Uploading...' : 'Take photo'}
          </Text>
          <Text style={[styles.captureBody, { color: palette.muted }]}>
            Show the secured latch in frame
          </Text>
        </Pressable>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={hasPhoto ? 'cta' : 'secondary'}
          disabled={!hasPhoto}
          style={styles.ctaButton}
        />
        {!hasPhoto ? (
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            Capture gate photo to continue
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
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContent: {
    flex: 1,
    gap: 4,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  instructionBody: {
    fontSize: 12,
  },
  previewSection: {
    gap: 10,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  retakeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  pendingPreview: {
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pendingText: {
    fontSize: 12,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
  },
  captureCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  captureIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  captureBody: {
    fontSize: 13,
    textAlign: 'center',
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
