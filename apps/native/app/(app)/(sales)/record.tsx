import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest, apiUpload } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSales, type AiVisitResult } from '@/lib/sales/SalesProvider';
import { dogPresenceOptions, encounterOptions, objectionOptions } from '@/lib/sales/utils';

const MAX_DURATION_MS = 3 * 60 * 1000;
const MIN_RECORDING_MS = 1200;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60;
const TRANSCRIPTION_TIMEOUT_CODE = 'transcription_timeout';

type RecorderState = 'idle' | 'recording' | 'processing' | 'complete';

type TranscribeQueued = {
  jobId: string;
  status: string;
};

type TranscribeResult = {
  transcript?: string;
  summary?: string;
  encounterTags?: string[];
  dogPresence?: AiVisitResult['dogPresence'];
  objectionTags?: string[];
  dogCount?: number | null;
  followUp?: string | null;
};

const ALL_PARTY_CONSENT_STATES = [
  'CA',
  'DE',
  'FL',
  'IL',
  'MA',
  'MD',
  'MT',
  'NH',
  'PA',
  'WA',
];

function formatTimer(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function pollTranscriptionJob(jobId: string): Promise<AiVisitResult> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const result = await apiRequest<{
      status: string;
      result?: AiVisitResult | null;
      error?: string | null;
    }>(`/api/outbound/transcribe?jobId=${encodeURIComponent(jobId)}`);
    if (result.status === 'completed') {
      if (result.result) {
        return result.result;
      }
      throw new Error('Transcription failed.');
    }
    if (result.status === 'failed') {
      throw new Error(result.error || 'Transcription failed.');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(TRANSCRIPTION_TIMEOUT_CODE);
}

export default function SalesRecorderScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { session } = useAuth();
  const { setPendingAiResult } = useSales();
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiVisitResult | null>(null);
  const [showConsentInfo, setShowConsentInfo] = useState(false);
  const resetState = useCallback(() => {
    setRecorderState('idle');
    setElapsedMs(0);
    setError(null);
    setResult(null);
  }, []);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
      recordingRef.current = null;
      recordingStartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recorderState !== 'recording') return undefined;
    const interval = setInterval(() => {
      if (recordingStartRef.current) {
        setElapsedMs(Date.now() - recordingStartRef.current);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [recorderState]);

  const waitForActive = useCallback((timeoutMs = 1500) => {
    if (AppState.currentState === 'active') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active' && !resolved) {
          resolved = true;
          subscription.remove();
          resolve(true);
        }
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          subscription.remove();
          resolve(AppState.currentState === 'active');
        }
      }, timeoutMs);
    });
  }, []);

  const setAudioModeSafely = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('background')) {
        const becameActive = await waitForActive(2000);
        if (!becameActive) {
          throw err;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        return;
      }
      throw err;
    }
  }, [waitForActive]);

  const handleStart = useCallback(async () => {
    if (recorderState === 'recording' || recorderState === 'processing') return;
    if (isPreparing) return;
    setIsPreparing(true);
    try {
      setError(null);
      setResult(null);
      setElapsedMs(0);
      const isActive = await waitForActive();
      if (!isActive) {
        setError('Return to the app to start recording.');
        return;
      }
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission denied.');
        return;
      }
      const stillActive = await waitForActive();
      if (!stillActive) {
        setError('Return to the app to start recording.');
        return;
      }
      await setAudioModeSafely();
      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingStartRef.current = Date.now();
      nextRecording.setProgressUpdateInterval(250);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        if (status.durationMillis != null) {
          setElapsedMs(status.durationMillis);
        } else if (recordingStartRef.current) {
          setElapsedMs(Date.now() - recordingStartRef.current);
        }
        if (status.durationMillis != null && status.durationMillis >= MAX_DURATION_MS) {
          void handleStop();
        }
      });
      await nextRecording.startAsync();
      recordingRef.current = nextRecording;
      setRecorderState('recording');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start recording.';
      if (message.toLowerCase().includes('background')) {
        setError('Open the app and try again. Recording requires the app to be active.');
      } else {
        setError(message);
      }
    } finally {
      setIsPreparing(false);
    }
  }, [isPreparing, recorderState, setAudioModeSafely, waitForActive]);

  const transcribeRecording = useCallback(
    async (uri: string, forceSync = false) => {
      const requestAnalysis = async (syncMode: boolean) => {
        const formData = new FormData();
        formData.append('audio', {
          uri,
          name: 'visit-recording.m4a',
          type: 'audio/m4a',
        } as any);
        if (session?.user?.orgId) {
          formData.append('businessId', session.user.orgId);
        }
        if (syncMode) {
          formData.append('forceSync', 'true');
        }

        return apiUpload<TranscribeQueued | TranscribeResult>(
          '/api/outbound/transcribe',
          {
            body: formData,
            token: session?.token ?? undefined,
          },
        );
      };

      const response = await requestAnalysis(forceSync);

      if ('jobId' in response && response.jobId) {
        try {
          return await pollTranscriptionJob(response.jobId);
        } catch (err) {
          const message = err instanceof Error ? err.message : '';
          const shouldFallback =
            message === TRANSCRIPTION_TIMEOUT_CODE || message.includes('job_not_found');
          if (!forceSync && shouldFallback) {
            const fallbackResponse = await requestAnalysis(true);
            if ('jobId' in fallbackResponse && fallbackResponse.jobId) {
              return await pollTranscriptionJob(fallbackResponse.jobId);
            }
            const fallbackResult = fallbackResponse as TranscribeResult;
            return {
              transcript: fallbackResult.transcript ?? '',
              summary: fallbackResult.summary ?? '',
              encounterTags: fallbackResult.encounterTags ?? [],
              dogPresence: fallbackResult.dogPresence ?? null,
              objectionTags: fallbackResult.objectionTags ?? [],
              dogCount: fallbackResult.dogCount ?? null,
              followUp: fallbackResult.followUp ?? null,
            } satisfies AiVisitResult;
          }
          throw err;
        }
      }

      const result = response as TranscribeResult;
      return {
        transcript: result.transcript ?? '',
        summary: result.summary ?? '',
        encounterTags: result.encounterTags ?? [],
        dogPresence: result.dogPresence ?? null,
        objectionTags: result.objectionTags ?? [],
        dogCount: result.dogCount ?? null,
        followUp: result.followUp ?? null,
      } satisfies AiVisitResult;
    },
    [session?.token, session?.user?.orgId],
  );

  const handleStop = useCallback(async () => {
    const current = recordingRef.current;
    if (!current) return;
    setRecorderState('processing');
    try {
      await current.stopAndUnloadAsync();
      const status = await current.getStatusAsync();
      const uri = current.getURI();
      recordingRef.current = null;
      const startedAt = recordingStartRef.current;
      recordingStartRef.current = null;
      if (!uri) {
        setRecorderState('idle');
        setError('Recording failed to save.');
        return;
      }
      const fallbackDuration = startedAt ? Date.now() - startedAt : elapsedMs;
      const duration =
        typeof status.durationMillis === 'number'
          ? status.durationMillis
          : fallbackDuration;
      if (duration < MIN_RECORDING_MS) {
        setRecorderState('idle');
        setError('Recording too short. Try speaking for a few seconds.');
        return;
      }
      const analysis = await transcribeRecording(uri);
      setResult(analysis);
      setPendingAiResult(analysis);
      setRecorderState('complete');
    } catch (err) {
      setRecorderState('idle');
      if (err instanceof Error && err.message === TRANSCRIPTION_TIMEOUT_CODE) {
        setError('Transcription is taking too long. Please try again.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to stop recording.');
    }
  }, [elapsedMs, transcribeRecording, setPendingAiResult]);

  const encounterLabel = (value: string) =>
    encounterOptions.find((option) => option.value === value)?.label ?? value;
  const objectionLabel = (value: string) =>
    objectionOptions.find((option) => option.value === value)?.label ?? value;
  const dogLabel = (value?: AiVisitResult['dogPresence']) =>
    dogPresenceOptions.find((option) => option.value === value)?.label ?? value;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>AI recorder</Text>
          <Text style={[styles.title, { color: palette.text }]}>Summarize a door knock</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Capture a quick recap and we will auto-tag the lead outcome.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.consentHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Recording consent
            </Text>
            <Pressable onPress={() => setShowConsentInfo((prev) => !prev)}>
              <Text style={[styles.consentToggle, { color: palette.tint }]}>
                {showConsentInfo ? 'Hide details' : 'View details'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.bodyText, { color: palette.muted }]}>
            Get permission before recording. Laws vary by state and may differ for in-person vs phone
            conversations. When unsure, ask for consent.
          </Text>
          {showConsentInfo ? (
            <View style={styles.consentDetails}>
              <Text style={[styles.bodyText, { color: palette.text }]}>
                All‑party consent states (verify before recording):
              </Text>
              <Text style={[styles.bodyText, { color: palette.muted }]}>
                {ALL_PARTY_CONSENT_STATES.join(', ')}.
              </Text>
              <Text style={[styles.bodyText, { color: palette.text }]}>One‑party consent:</Text>
              <Text style={[styles.bodyText, { color: palette.muted }]}>
                Most other states and D.C. This is not legal advice; confirm local requirements.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.recorderRow}>
            <View>
              <Text style={[styles.timer, { color: palette.text }]}>
                {formatTimer(elapsedMs)}
              </Text>
              <Text style={[styles.status, { color: palette.muted }]}>
                {recorderState === 'recording'
                  ? 'Recording...'
                  : recorderState === 'processing'
                    ? 'Processing...'
                    : recorderState === 'complete'
                      ? 'Complete'
                      : 'Ready to record'}
              </Text>
            </View>
            <Pressable
              onPress={recorderState === 'recording' ? handleStop : handleStart}
              style={[
                styles.recordButton,
                {
                  backgroundColor:
                    recorderState === 'recording' ? palette.danger : palette.tint,
                },
              ]}
              disabled={recorderState === 'processing' || isPreparing}
            >
              <FontAwesome
                name={recorderState === 'recording' ? 'stop' : 'microphone'}
                size={18}
                color="#fff"
              />
              <Text style={styles.recordButtonLabel}>
                {recorderState === 'recording' ? 'Stop' : 'Record'}
              </Text>
            </Pressable>
          </View>
          {recorderState === 'processing' ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.processingText, { color: palette.muted }]}>
                Transcribing and tagging...
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}
          {recorderState === 'complete' ? (
            <Button title="Record another" onPress={resetState} variant="ghost" />
          ) : null}
        </View>

        {result ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Summary</Text>
            <Text style={[styles.bodyText, { color: palette.text }]}>
              {result.summary || 'No summary provided.'}
            </Text>
            {result.transcript ? (
              <>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Transcript</Text>
                <Text style={[styles.bodyText, { color: palette.text }]}>
                  {result.transcript}
                </Text>
              </>
            ) : null}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Tags</Text>
            <View style={styles.tagRow}>
              {result.encounterTags.map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: palette.border }]}>
                  <Text style={[styles.tagText, { color: palette.text }]}>
                    {encounterLabel(tag)}
                  </Text>
                </View>
              ))}
              {result.dogPresence ? (
                <View style={[styles.tag, { borderColor: palette.border }]}>
                  <Text style={[styles.tagText, { color: palette.text }]}>
                    {dogLabel(result.dogPresence)}
                  </Text>
                </View>
              ) : null}
              {result.objectionTags.map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: palette.border }]}>
                  <Text style={[styles.tagText, { color: palette.text }]}>
                    {objectionLabel(tag)}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              title="Use in new lead"
              onPress={() => router.push('/(app)/(sales)/lead/new')}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  recorderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  consentToggle: {
    fontSize: 12,
    fontWeight: '600',
  },
  consentDetails: {
    gap: 6,
  },
  timer: {
    fontSize: 28,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  recordButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
  },
});
