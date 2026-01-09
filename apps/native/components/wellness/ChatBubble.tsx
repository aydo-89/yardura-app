import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import IndicatorPill from '@/components/wellness/IndicatorPill';
import type { WellnessChatResponse } from '@/lib/api/types';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  meta?: WellnessChatResponse | null;
  isAnalyzing?: boolean;
  onFollowUpPress?: (question: string) => void;
};

/**
 * Parse and render content with proper markdown-style formatting.
 * Handles bulleted lists and paragraph breaks.
 */
function FormattedContent({
  text,
  textColor,
}: {
  text: string;
  textColor: string;
}) {
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n{2,}/);

  return (
    <View style={styles.formattedContent}>
      {paragraphs.map((paragraph, pIndex) => {
        // Check if this paragraph contains bullet points
        const lines = paragraph.split('\n');
        const hasBullets = lines.some((line) =>
          /^[\s]*[-•*]\s/.test(line) || /^[\s]*\d+\.\s/.test(line)
        );

        if (hasBullets) {
          return (
            <View key={pIndex} style={styles.bulletList}>
              {lines.map((line, lIndex) => {
                const bulletMatch = line.match(/^[\s]*[-•*]\s+(.*)$/);
                const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.*)$/);

                if (bulletMatch) {
                  return (
                    <View key={lIndex} style={styles.bulletItem}>
                      <Text style={[styles.bulletPoint, { color: textColor }]}>•</Text>
                      <Text style={[styles.bulletText, { color: textColor }]}>
                        {bulletMatch[1].trim()}
                      </Text>
                    </View>
                  );
                } else if (numberedMatch) {
                  return (
                    <View key={lIndex} style={styles.bulletItem}>
                      <Text style={[styles.bulletPoint, { color: textColor }]}>
                        {numberedMatch[1]}.
                      </Text>
                      <Text style={[styles.bulletText, { color: textColor }]}>
                        {numberedMatch[2].trim()}
                      </Text>
                    </View>
                  );
                } else if (line.trim()) {
                  return (
                    <Text key={lIndex} style={[styles.paragraphText, { color: textColor }]}>
                      {line.trim()}
                    </Text>
                  );
                }
                return null;
              })}
            </View>
          );
        }

        // Regular paragraph
        return (
          <Text key={pIndex} style={[styles.paragraphText, { color: textColor }]}>
            {paragraph.trim()}
          </Text>
        );
      })}
    </View>
  );
}

export default function ChatBubble({
  role,
  content,
  meta,
  isAnalyzing = false,
  onFollowUpPress,
}: ChatBubbleProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [metaExpanded, setMetaExpanded] = useState(true);

  const isUser = role === 'user';
  const hasMeta = meta != null;
  const hasDetails = hasMeta && (
    (meta.red_flags?.length ?? 0) > 0 ||
    (meta.suggested_actions?.length ?? 0) > 0 ||
    (meta.follow_up_questions?.length ?? 0) > 0
  );

  const contextUsed = meta?.context_used ?? [];
  const contextCount = contextUsed.length;
  const riskLevel = meta?.risk_level ?? null;
  const redFlags = meta?.red_flags ?? [];
  const suggestedActions = meta?.suggested_actions ?? [];
  const followUpQuestions = meta?.follow_up_questions ?? [];
  const disclaimer = meta?.disclaimer ?? null;

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        {
          backgroundColor: isUser ? `${palette.tint}10` : palette.card,
          borderColor: isUser ? palette.tint : palette.border,
        },
      ]}
    >
      {/* Message content with proper formatting */}
      <FormattedContent text={content} textColor={palette.text} />

      {/* Analyzing indicator */}
      {!isUser && isAnalyzing && !meta && (
        <View style={styles.analyzingRow}>
          <FontAwesome name="spinner" size={12} color={palette.muted} />
          <Text style={[styles.analyzingText, { color: palette.muted }]}>
            Analyzing context...
          </Text>
        </View>
      )}

      {/* Meta section */}
      {!isUser && hasMeta && (
        <View style={[styles.metaContainer, { borderTopColor: palette.border }]}>
          {/* Header row */}
          <Pressable
            style={styles.metaHeader}
            onPress={() => setMetaExpanded(!metaExpanded)}
          >
            <View style={styles.metaHeaderLeft}>
              <IndicatorPill indicator={riskLevel} size="sm" />
              <Text style={[styles.contextSummary, { color: palette.muted }]}>
                {contextCount > 0
                  ? `Used ${contextCount} data source${contextCount > 1 ? 's' : ''}`
                  : 'General guidance'}
              </Text>
            </View>
            {hasDetails && (
              <FontAwesome
                name={metaExpanded ? 'chevron-up' : 'chevron-down'}
                size={10}
                color={palette.muted}
              />
            )}
          </Pressable>

          {/* Expanded details */}
          {metaExpanded && hasDetails && (
            <View style={styles.metaDetails}>
              {/* Context pills */}
              {contextCount > 0 && (
                <View style={styles.contextPills}>
                  {contextUsed.map((item, index) => (
                    <View
                      key={`${item}-${index}`}
                      style={[styles.contextPill, { backgroundColor: `${palette.tint}15` }]}
                    >
                      <Text style={[styles.contextPillText, { color: palette.tint }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Red flags */}
              {redFlags.length > 0 && (
                <View style={[styles.flagCard, { backgroundColor: `${palette.danger}10` }]}>
                  <View style={styles.flagHeader}>
                    <FontAwesome name="exclamation-triangle" size={12} color={palette.danger} />
                    <Text style={[styles.flagTitle, { color: palette.danger }]}>Red flags</Text>
                  </View>
                  {redFlags.map((flag, index) => (
                    <View key={index} style={styles.bulletItem}>
                      <Text style={[styles.bulletPoint, { color: palette.danger }]}>•</Text>
                      <Text style={[styles.flagText, { color: palette.danger }]}>{flag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Suggested actions */}
              {suggestedActions.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>Suggested</Text>
                  </View>
                  {suggestedActions.map((action, index) => (
                    <View key={index} style={styles.bulletItem}>
                      <Text style={[styles.bulletPoint, { color: palette.muted }]}>•</Text>
                      <Text style={[styles.sectionItemText, { color: palette.muted }]}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Follow-up questions */}
              {followUpQuestions.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <FontAwesome name="question-circle" size={12} color={palette.tint} />
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>Ask next</Text>
                  </View>
                  <View style={styles.followUpList}>
                    {followUpQuestions.map((question, index) => (
                      <Pressable
                        key={index}
                        onPress={() => onFollowUpPress?.(question)}
                        style={({ pressed }) => [
                          styles.followUpChip,
                          {
                            backgroundColor: pressed ? `${palette.tint}15` : `${palette.tint}08`,
                            borderColor: palette.tint,
                          },
                        ]}
                      >
                        <Text style={[styles.followUpText, { color: palette.tint }]} numberOfLines={2}>
                          {question}
                        </Text>
                        <FontAwesome name="arrow-right" size={10} color={palette.tint} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Disclaimer */}
          {disclaimer && (
            <Text style={[styles.disclaimer, { color: palette.muted }]}>
              {disclaimer}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
  },
  formattedContent: {
    gap: 8,
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 21,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 21,
    width: 12,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  analyzingText: {
    fontSize: 12,
  },
  metaContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextSummary: {
    fontSize: 11,
  },
  metaDetails: {
    gap: 10,
    marginTop: 4,
  },
  contextPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  contextPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  contextPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  flagCard: {
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  flagTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  flagText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionItemText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  followUpList: {
    gap: 6,
    marginTop: 4,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  followUpText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
