import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type {
  CustomerSummary,
  DogSummary,
} from '@/lib/api/types';

type QuickReplyCategory = {
  category: string;
  icon: keyof typeof FontAwesome.glyphMap;
  questions: string[];
};

type AISuggestionCategory = {
  category: string;
  icon: string;
  questions: string[];
};

type QuickRepliesProps = {
  aiSuggestions?: AISuggestionCategory[] | null;
  aiLoading?: boolean;
  isPremium?: boolean;
  dogs?: DogSummary[];
  summary?: CustomerSummary | null;
  selectedDogId?: string | null;
  onSelect: (text: string) => void;
  onUpgrade?: () => void;
  disabled?: boolean;
};

const ICON_COLORS: Record<string, string> = {
  heartbeat: Colors.brand.coral,
  cutlery: Colors.brand.mint,
  medkit: Colors.brand.gold,
  calendar: '#6B7280',
  paw: Colors.brand.mint,
  bug: Colors.brand.coral,
};

/**
 * Generate fallback template questions based on account data.
 * Used for free users or when AI suggestions fail.
 */
function generateFallbackSuggestions(
  dogs: DogSummary[],
  summary: CustomerSummary | null,
  selectedDogId: string | null,
): QuickReplyCategory[] {
  const categories: QuickReplyCategory[] = [];
  const selectedDog = selectedDogId ? dogs.find((d) => d.id === selectedDogId) : null;
  const dogName = selectedDog?.name ?? (dogs.length === 1 ? dogs[0]?.name : null);
  const anyDog = dogs[0];

  // Wellness & Health questions
  const wellnessQuestions: string[] = [];
  if (dogName) {
    wellnessQuestions.push(`Why might ${dogName}'s stool be soft?`);
    wellnessQuestions.push(`What's a healthy poop schedule for ${dogName}?`);
  } else {
    wellnessQuestions.push("Why might my dog's stool be soft?");
    wellnessQuestions.push("What's a healthy poop schedule for dogs?");
  }

  const breedDog = selectedDog ?? anyDog;
  if (breedDog?.breed) {
    wellnessQuestions.push(`What health issues are common in ${breedDog.breed}s?`);
  }

  if (wellnessQuestions.length > 0) {
    categories.push({
      category: 'Health',
      icon: 'heartbeat',
      questions: wellnessQuestions.slice(0, 3),
    });
  }

  // Diet & Nutrition questions
  const dietQuestions: string[] = [];
  if (dogName) {
    dietQuestions.push(`What should I feed ${dogName}?`);
  } else {
    dietQuestions.push('What should I feed my dog?');
  }

  if (breedDog?.allergies) {
    const allergySnippet = breedDog.allergies.split(',')[0]?.trim() ?? 'allergies';
    dietQuestions.push(`Foods to avoid with ${allergySnippet}?`);
  }

  dietQuestions.push(
    dogName
      ? `How much water should ${dogName} drink?`
      : 'How much water should my dog drink?'
  );

  if (dietQuestions.length > 0) {
    categories.push({
      category: 'Diet',
      icon: 'cutlery',
      questions: dietQuestions.slice(0, 3),
    });
  }

  // Care questions
  const careQuestions: string[] = [];
  careQuestions.push(
    dogName
      ? `How much exercise does ${dogName} need?`
      : 'How much exercise does my dog need?'
  );
  careQuestions.push('What are signs of dehydration?');

  if (careQuestions.length > 0) {
    categories.push({
      category: 'Care',
      icon: 'medkit',
      questions: careQuestions.slice(0, 3),
    });
  }

  // Service questions
  const serviceQuestions: string[] = [];
  if (summary?.nextVisit) {
    serviceQuestions.push('When is my next scooping visit?');
  }
  serviceQuestions.push('How do I update my service plan?');
  serviceQuestions.push('Share reports with my vet?');

  if (serviceQuestions.length > 0) {
    categories.push({
      category: 'Service',
      icon: 'calendar',
      questions: serviceQuestions.slice(0, 3),
    });
  }

  return categories;
}

export default function QuickReplies({
  aiSuggestions,
  aiLoading = false,
  isPremium = false,
  dogs = [],
  summary = null,
  selectedDogId = null,
  onSelect,
  onUpgrade,
  disabled = false,
}: QuickRepliesProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const categories = useMemo(() => {
    // Use AI suggestions if available (API already validated premium status)
    if (aiSuggestions && aiSuggestions.length > 0) {
      return aiSuggestions.map((cat) => ({
        category: cat.category,
        icon: (cat.icon as keyof typeof FontAwesome.glyphMap) || 'lightbulb-o',
        questions: cat.questions,
      }));
    }
    // Fall back to template-based suggestions
    return generateFallbackSuggestions(dogs, summary, selectedDogId);
  }, [aiSuggestions, dogs, summary, selectedDogId]);

  const isAiPowered = aiSuggestions && aiSuggestions.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${palette.tint}15` }]}>
          <FontAwesome name="comments" size={14} color={palette.tint} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Quick Questions</Text>
            {isAiPowered && (
              <View style={[styles.aiBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="magic" size={10} color={Colors.brand.gold} />
                <Text style={[styles.aiBadgeText, { color: Colors.brand.gold }]}>AI</Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>
            {isAiPowered
              ? 'Personalized by AI based on your data'
              : 'Tap to ask • upgrade for AI suggestions'}
          </Text>
        </View>
      </View>

      {/* Loading State */}
      {aiLoading && (
        <View style={[styles.loadingCard, { backgroundColor: `${Colors.brand.gold}08`, borderColor: `${Colors.brand.gold}30` }]}>
          <View style={[styles.loadingIconContainer, { backgroundColor: `${Colors.brand.gold}15` }]}>
            <ActivityIndicator size="small" color={Colors.brand.gold} />
          </View>
          <View style={styles.loadingContent}>
            <Text style={[styles.loadingTitle, { color: palette.text }]}>
              Generating personalized questions
            </Text>
            <Text style={[styles.loadingSubtitle, { color: palette.muted }]}>
              Analyzing your dog's health data...
            </Text>
          </View>
        </View>
      )}

      {/* Premium Upsell for non-premium users (hide if AI suggestions loaded) */}
      {!isPremium && !isAiPowered && !aiLoading && onUpgrade && (
        <Pressable
          onPress={onUpgrade}
          style={({ pressed }) => [
            styles.premiumCard,
            {
              backgroundColor: `${Colors.brand.gold}08`,
              borderColor: `${Colors.brand.gold}30`,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.premiumIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
            <FontAwesome name="magic" size={16} color={Colors.brand.gold} />
          </View>
          <View style={styles.premiumContent}>
            <Text style={[styles.premiumTitle, { color: palette.text }]}>
              Get AI-Powered Questions
            </Text>
            <Text style={[styles.premiumSubtitle, { color: palette.muted }]}>
              Premium generates personalized questions from your dog's health data
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={Colors.brand.gold} />
        </Pressable>
      )}

      {/* Categories */}
      {!aiLoading && categories.map((category, catIndex) => {
        const iconColor = ICON_COLORS[category.icon] ?? palette.tint;
        return (
          <View key={catIndex} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <FontAwesome name={category.icon} size={12} color={iconColor} />
              <Text style={[styles.categoryLabel, { color: iconColor }]}>
                {category.category}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {category.questions.map((question, qIndex) => (
                <Pressable
                  key={qIndex}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: pressed ? `${iconColor}15` : palette.card,
                      borderColor: pressed ? iconColor : palette.border,
                    },
                    disabled && styles.chipDisabled,
                  ]}
                  onPress={() => onSelect(question)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: disabled ? palette.muted : palette.text },
                    ]}
                    numberOfLines={2}
                  >
                    {question}
                  </Text>
                  <View style={[styles.chipArrow, { backgroundColor: `${iconColor}15` }]}>
                    <FontAwesome name="arrow-right" size={10} color={iconColor} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  loadingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    flex: 1,
    gap: 2,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingSubtitle: {
    fontSize: 12,
  },
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  premiumIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumContent: {
    flex: 1,
    gap: 2,
  },
  premiumTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  premiumSubtitle: {
    fontSize: 11,
  },
  categorySection: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  categoryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  scrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 240,
  },
  chipDisabled: {
    opacity: 0.6,
  },
  chipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  chipArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
