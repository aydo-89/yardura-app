import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ChatBubble from '@/components/wellness/ChatBubble';
import ChoiceChip from '@/components/ui/ChoiceChip';
import QuickReplies from '@/components/wellness/QuickReplies';
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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fullContent?: string;
  meta?: WellnessChatResponse | null;
};

type AISuggestionCategory = {
  category: string;
  icon: string;
  questions: string[];
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
    <View style={styles.typingRow}>
      <View style={[styles.typingDot, { backgroundColor: color }]} />
      <View style={[styles.typingDot, { backgroundColor: color, opacity: dots >= 2 ? 1 : 0.3 }]} />
      <View style={[styles.typingDot, { backgroundColor: color, opacity: dots >= 3 ? 1 : 0.3 }]} />
      <Text style={[styles.typingText, { color }]}>{label}</Text>
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
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestionCategory[] | null>(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef(true);
  const suggestionsFetchedRef = useRef(false);

  const access = summary?.wellnessAccess ?? null;
  const multiDogLocked = access?.maxDogs === 1 && dogs.length > 1;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;
  const isPremium =
    access?.tier === 'PREMIUM' || access?.hasActiveService;

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

  const loadAiSuggestions = useCallback(async () => {
    if (!session?.token || suggestionsFetchedRef.current) return;
    suggestionsFetchedRef.current = true;
    setAiSuggestionsLoading(true);
    try {
      const data = await apiRequest<{
        isPremium: boolean;
        categories: AISuggestionCategory[] | null;
      }>('/api/mobile/customer/wellness-chat/suggestions', {
        token: session.token,
      });
      if (data.isPremium && data.categories) {
        setAiSuggestions(data.categories);
      }
    } catch (err) {
      console.warn('load-ai-suggestions.failed', err);
    } finally {
      setAiSuggestionsLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadDogs();
    loadSummary();
    // Start loading AI suggestions immediately - API will check premium status
    loadAiSuggestions();
  }, [loadDogs, loadSummary, loadAiSuggestions]);

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

  const handleUpgrade = useCallback(() => {
    router.push('/(app)/(customer)/wellness-upgrade' as Href);
  }, []);

  const selectedDogName = dogId ? dogs.find((d) => d.id === dogId)?.name : null;

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
          {/* Hero Card */}
          <View style={[styles.heroCard, { backgroundColor: palette.tint }]}>
            <View style={styles.heroIcon}>
              <FontAwesome name="comment" size={28} color="#fff" />
            </View>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>AI Wellness Chat</Text>
              <Text style={styles.heroSubtitle}>
                Ask about diet, health, visits, or your account
              </Text>
            </View>
          </View>

          {/* Access & Dog Selector Card */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                <View style={[styles.statIcon, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="comments" size={14} color={palette.tint} />
                </View>
                <Text style={[styles.statValue, { color: palette.text }]}>
                  {isPremium ? '∞' : chatsRemaining ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: palette.muted }]}>
                  {isPremium ? 'Unlimited' : 'Chats left'}
                </Text>
              </View>
              {access?.planEndsAt && (
                <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                  <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
                    <FontAwesome name="calendar" size={14} color={Colors.brand.gold} />
                  </View>
                  <Text style={[styles.statValue, { color: palette.text }]} numberOfLines={1}>
                    {new Date(access.planEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>
                    Access until
                  </Text>
                </View>
              )}
              {dogs.length > 0 && (
                <View style={[styles.statBox, { backgroundColor: palette.background }]}>
                  <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                    <FontAwesome name="paw" size={14} color={Colors.brand.mint} />
                  </View>
                  <Text style={[styles.statValue, { color: palette.text }]}>{dogs.length}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>
                    {dogs.length === 1 ? 'Dog' : 'Dogs'}
                  </Text>
                </View>
              )}
            </View>

            {/* Dog Selector */}
            {dogs.length > 0 && (
              <View style={styles.dogSelector}>
                <Text style={[styles.selectorLabel, { color: palette.muted }]}>
                  Context: {selectedDogName ?? 'Household'}
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
                {multiDogLocked && (
                  <View style={[styles.lockBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
                    <FontAwesome name="star" size={10} color={Colors.brand.gold} />
                    <Text style={[styles.lockText, { color: Colors.brand.gold }]}>
                      Premium unlocks per-dog context
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Quick Replies - only show when no messages */}
          {messages.length === 0 && !sending && (
            <QuickReplies
              aiSuggestions={aiSuggestions}
              aiLoading={aiSuggestionsLoading}
              isPremium={isPremium}
              dogs={dogs}
              summary={summary}
              selectedDogId={dogId}
              onSelect={(text) => setInput(text)}
              onUpgrade={handleUpgrade}
              disabled={sending}
            />
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <View style={styles.messagesContainer}>
              {/* Chat Header with Clear Chat button */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <FontAwesome name="comments" size={14} color={palette.muted} />
                  <Text style={[styles.chatHeaderTitle, { color: palette.text }]}>
                    Conversation
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setMessages([]);
                    setInput('');
                    setError(null);
                    setAnalysisPendingId(null);
                  }}
                  style={({ pressed }) => [
                    styles.clearChatButton,
                    { backgroundColor: palette.card, borderColor: palette.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <FontAwesome name="refresh" size={12} color={palette.tint} />
                  <Text style={[styles.clearChatText, { color: palette.tint }]}>Clear & start over</Text>
                </Pressable>
              </View>

              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  meta={message.meta}
                  isAnalyzing={analysisPendingId === message.id}
                  onFollowUpPress={(question) => setInput(question)}
                />
              ))}

              {sending && (
                <View style={[styles.assistantBubble, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <TypingIndicator label="Thinking" color={palette.muted} />
                </View>
              )}
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: `${palette.danger}30` }]}>
              <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          )}

          {/* Safety Notice */}
          <View style={[styles.safetyCard, { backgroundColor: `${Colors.brand.coral}08`, borderColor: `${Colors.brand.coral}25` }]}>
            <FontAwesome name="info-circle" size={12} color={Colors.brand.coral} />
            <Text style={[styles.safetyText, { color: palette.muted }]}>
              Not a diagnosis. Seek veterinary care for emergencies, blood in stool, or severe symptoms.
            </Text>
          </View>
        </ScrollView>

        {/* Input Bar */}
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
          <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <TextInput
              style={[styles.inputField, { color: palette.text }]}
              placeholder={selectedDogName ? `Ask about ${selectedDogName}...` : 'Ask about your dog or account...'}
              placeholderTextColor={palette.muted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
            />
            {input.length > 0 && (
              <Text style={[styles.charCount, { color: palette.muted }]}>
                {input.length}/1000
              </Text>
            )}
          </View>
          <Pressable
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: input.trim() ? palette.tint : palette.border,
                opacity: pressed ? 0.8 : 1,
              },
              (sending || !input.trim()) && styles.sendButtonDisabled,
            ]}
          >
            <FontAwesome
              name={sending ? 'spinner' : 'paper-plane'}
              size={18}
              color={input.trim() ? '#FFFFFF' : palette.muted}
            />
          </Pressable>
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
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  dogSelector: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lockText: {
    fontSize: 11,
    fontWeight: '500',
  },
  messagesContainer: {
    gap: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 12,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearChatText: {
    fontSize: 13,
    fontWeight: '600',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    maxWidth: '85%',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typingText: {
    fontSize: 12,
    marginLeft: 6,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  safetyText: {
    flex: 1,
    fontSize: 11,
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
  inputWrapper: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputField: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 24,
    maxHeight: 100,
  },
  charCount: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
