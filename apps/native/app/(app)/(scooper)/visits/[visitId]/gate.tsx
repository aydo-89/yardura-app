import { Image, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';

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
  const { steps, visitId, gateMedia, uploadingType, uploadMedia, getNextStep, getPreviousStep } = useVisitFlow();
  const [previewSeed, setPreviewSeed] = useState(0);

  useStepGuard('gate');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'gate'),
    0,
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

  const handleBack = () => {
    const prev = getPreviousStep('gate');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('gate');
    goToStep(next);
  };

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

  return (
    <VisitStepShell
      title="Secure the gate"
      subtitle="Capture the closed latch before you exit."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <Text style={[styles.cardTitle, { color: palette.text }]}>Gate photo</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>Make sure the latch and lock are visible.</Text>
        {hasPhoto ? (
          <Text style={[styles.status, { color: palette.tint }]}>Gate photo captured.</Text>
        ) : null}
        {previewUrl ? (
          <Image key={previewUrl} source={{ uri: previewUrl }} style={styles.previewImage} />
        ) : hasPhoto ? (
          <Text style={[styles.previewHint, { color: palette.muted }]}>Preview will appear once synced.</Text>
        ) : null}
        <Button
          title={uploadingType === 'GATE' ? 'Uploading...' : 'Capture photo'}
          onPress={handleCapture}
          disabled={uploadingType === 'GATE'}
        />
      </View>

      <Button
        title="Continue to next step"
        onPress={handleNext}
        disabled={!hasPhoto}
        variant="cta"
      />
      {!hasPhoto ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>Capture a gate photo before continuing.</Text>
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
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  previewHint: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
  },
});
