import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';
import type {
  CustomerSummary,
  DogSummary,
  WellnessChatReply,
  WellnessChatResponse,
} from '@/lib/api/types';
import IndicatorPill from '@/components/wellness/IndicatorPill';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fullContent?: string;
  meta?: WellnessChatResponse | null;
};

function TypingIndicator({ label, color }: { label: string; color: string }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.inlineRow}>
      <FontAwesome name="comment" size={12} color={color} />
      <Text style={[styles.helperText, { color }]}>
        {label}
        {'.'.repeat(dots)}
      </Text>
    </View>
  );
}

export default function WellnessChatScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [dogId, setDogId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisPendingId, setAnalysisPendingId] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef(true);

  const access = summary?.wellnessAccess ?? null;
  const multiDogLocked = access?.maxDogs === 1 && dogs.length > 1;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || access?.hasActiveService;

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
        token: session.token,
      });
      setDogs(data.dogs ?? []);
    } catch {
      setDogs([]);
    }
  }, [session?.token]);

  const loadSummary = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
        token: session.token,
      });
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [session?.token]);

  useEffect(() => {
    loadDogs();
    loadSummary();
  }, [loadDogs, loadSummary]);

  useEffect(() => {
    if (!multiDogLocked) return;
    setDogId(null);
  }, [multiDogLocked]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom(false);
    }
  }, [keyboardOffset, scrollToBottom]);

  const startStreaming = (id: string, fullText: string) => {
    let index = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      index += 2;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id
            ? { ...message, content: fullText.slice(0, index) }
            : message,
        ),
      );
      if (index >= fullText.length && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 16);
  };

  const handleSend = async () => {
    if (!input.trim() || !session?.token || sending) return;
    setError(null);
    const content = input.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    autoScrollRef.current = true;
    setSending(true);

    try {
      const payload: Record<string, unknown> = { message: content, mode: 'reply' };
      if (dogId) payload.dogId = dogId;

      const replyData = await apiRequest<WellnessChatReply>(
        '/api/mobile/customer/wellness-chat',
        {
          token: session.token,
          method: 'POST',
          body: payload,
        },
      );
      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        fullContent: replyData.reply,
        meta: null,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      autoScrollRef.current = true;
      startStreaming(assistantId, replyData.reply);
      setAnalysisPendingId(assistantId);

      const analysisPayload: Record<string, unknown> = {
        message: content,
        reply: replyData.reply,
        mode: 'analysis',
      };
      if (dogId) analysisPayload.dogId = dogId;

      try {
        const analysisData = await apiRequest<WellnessChatResponse>(
          '/api/mobile/customer/wellness-chat',
          {
            token: session.token,
            method: 'POST',
            body: analysisPayload,
          },
        );
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, meta: analysisData } : message,
          ),
        );
      } catch (analysisError) {
        const message =
          analysisError instanceof Error
            ? analysisError.message
            : 'Unable to load guidance details.';
        setError(message);
      } finally {
        setAnalysisPendingId((current) => (current === assistantId ? null : current));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { error?: string } | null;
        if (details?.error === 'limit_reached') {
          setError('Free chats are used up for this month. Upgrade for unlimited support.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to send message.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, { paddingBottom: keyboardOffset + 160 }]}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
            autoScrollRef.current = distanceFromBottom < 80;
          }}
          onContentSizeChange={() => {
            if (autoScrollRef.current) {
              scrollToBottom(false);
            }
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: palette.muted }]}>AI wellness chat</Text>
            <Text style={[styles.title, { color: palette.text }]}>Ask about symptoms</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}
            >
              Not a diagnosis. We highlight red flags and what to do tonight.
            </Text>
          </View>

          {access ? (
            <View style={[styles.accessCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.accessRow}>
                <Text style={[styles.helperText, { color: palette.muted }]}>Chats left</Text>
                <Text style={[styles.accessValue, { color: palette.text }]}>
                  {isPremium ? 'Unlimited' : `${chatsRemaining ?? 0}`}
                </Text>
              </View>
              {access.planEndsAt ? (
                <Text style={[styles.helperText, { color: palette.muted }]}
                >
                  Access through{' '}
                  {new Date(access.planEndsAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              About which dog? (optional)
            </Text>
            <View style={styles.chipRow}>
              <ChoiceChip
                label="Household"
                selected={!dogId}
                onPress={() => setDogId(null)}
                disabled={multiDogLocked}
              />
              {dogs.map((dog) => (
                <ChoiceChip
                  key={dog.id}
                  label={dog.name}
                  selected={dogId === dog.id}
                  onPress={() => setDogId(dog.id)}
                  disabled={multiDogLocked}
                />
              ))}
            </View>
            {multiDogLocked ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Premium unlocks per-dog chat context.
              </Text>
            ) : null}
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.bubbleText, { color: palette.text }]}>
                {message.content}
              </Text>
              {message.role === 'assistant' && analysisPendingId === message.id && !message.meta ? (
                <View style={styles.metaBlock}>
                  <TypingIndicator label="Analyzing" color={palette.muted} />
                </View>
              ) : null}
              {message.role === 'assistant' && message.meta ? (
                <View style={styles.metaBlock}>
                  <IndicatorPill indicator={message.meta.risk_level} size="sm" />
                  <Text style={[styles.metaText, { color: palette.muted }]}>
                    {message.meta.disclaimer}
                  </Text>
                  {message.meta.red_flags.length > 0 ? (
                    <View style={styles.metaSection}>
                      <Text style={[styles.metaTitle, { color: palette.text }]}>Red flags</Text>
                      {message.meta.red_flags.map((flag, index) => (
                        <Text key={`${flag}-${index}`} style={[styles.metaText, { color: palette.muted }]}>
                          • {flag}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {message.meta.suggested_actions.length > 0 ? (
                    <View style={styles.metaSection}>
                      <Text style={[styles.metaTitle, { color: palette.text }]}>What to do tonight</Text>
                      {message.meta.suggested_actions.map((action, index) => (
                        <Text key={`${action}-${index}`} style={[styles.metaText, { color: palette.muted }]}>
                          • {action}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {message.meta.follow_up_questions.length > 0 ? (
                    <View style={styles.metaSection}>
                      <Text style={[styles.metaTitle, { color: palette.text }]}>Follow-up questions</Text>
                      {message.meta.follow_up_questions.map((question, index) => (
                        <Text key={`${question}-${index}`} style={[styles.metaText, { color: palette.muted }]}>
                          • {question}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}

          {sending ? (
            <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <TypingIndicator label="Thinking" color={palette.muted} />
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.inputBar,
            {
              borderColor: palette.border,
              backgroundColor: palette.card,
              paddingBottom: Math.max(12, insets.bottom + 6),
              bottom: Math.max(0, keyboardOffset - insets.bottom),
            },
          ]}
        >
          <TextInput
            style={[styles.inputField, { color: palette.text }]}
            placeholder="Describe what you’re seeing..."
            placeholderTextColor={palette.muted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Button title={sending ? 'Sending...' : 'Send'} onPress={handleSend} disabled={sending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
  },
  accessCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  accessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accessValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: 10,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaBlock: {
    marginTop: 10,
    gap: 8,
  },
  metaSection: {
    gap: 4,
  },
  metaTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  inputField: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
