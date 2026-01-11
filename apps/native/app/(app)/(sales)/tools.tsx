import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, type Href } from 'expo-router';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const tools: Array<{
  key: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  route: Href;
}> = [
  {
    key: 'new-lead',
    title: 'New lead',
    description: 'Capture a new prospect with notes, tags, and follow-ups.',
    icon: 'plus-circle',
    iconColor: Colors.brand.mint,
    route: '/(app)/(sales)/lead/new' as Href,
  },
  {
    key: 'ai-record',
    title: 'AI visit recorder',
    description: 'Record a door knock recap and auto-tag the outcome.',
    icon: 'microphone',
    iconColor: '#8B5CF6',
    route: '/(app)/(sales)/record' as Href,
  },
  {
    key: 'map-view',
    title: 'Map view',
    description: 'Navigate turf, drop pins, and see team radar.',
    icon: 'map',
    iconColor: Colors.brand.gold,
    route: '/(app)/(sales)/map' as Href,
  },
];

const quickActions: Array<{
  key: string;
  label: string;
  icon: string;
  route: Href;
}> = [
  {
    key: 'leads',
    label: 'View leads',
    icon: 'list',
    route: '/(app)/(sales)' as Href,
  },
  {
    key: 'account',
    label: 'Account',
    icon: 'user-circle',
    route: '/(app)/(sales)/account' as Href,
  },
];

export default function SalesToolsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>SALES TOOLS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Field Toolkit</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Everything you need to capture leads, summarize visits, and keep follow-ups moving.
          </Text>
        </View>

        {/* Main Tools */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="wrench" size={14} color={palette.tint} />
          </View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Main Tools</Text>
        </View>

        <View style={styles.cardStack}>
          {tools.map((tool) => (
            <Pressable
              key={tool.key}
              onPress={() => router.push(tool.route)}
              style={[
                styles.card,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={[styles.cardIconWrap, { backgroundColor: `${tool.iconColor}15` }]}>
                <FontAwesome name={tool.icon as any} size={22} color={tool.iconColor} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {tool.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                  {tool.description}
                </Text>
              </View>
              <View style={[styles.chevronWrap, { backgroundColor: `${palette.muted}10` }]}>
                <FontAwesome name="chevron-right" size={12} color={palette.muted} />
              </View>
            </Pressable>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${palette.muted}15` }]}>
            <FontAwesome name="bolt" size={14} color={palette.muted} />
          </View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => router.push(action.route)}
              style={[
                styles.quickAction,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name={action.icon as any} size={18} color={palette.tint} />
              </View>
              <Text style={[styles.quickActionLabel, { color: palette.text }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Pro tip */}
        <View style={[styles.tipCard, { backgroundColor: `${Colors.brand.gold}10`, borderColor: `${Colors.brand.gold}30` }]}>
          <View style={styles.tipHeader}>
            <FontAwesome name="lightbulb-o" size={16} color={Colors.brand.gold} />
            <Text style={[styles.tipTitle, { color: palette.text }]}>Pro tip</Text>
          </View>
          <Text style={[styles.tipText, { color: palette.muted }]}>
            Use the AI recorder after each door knock to automatically tag outcomes and capture notes hands-free.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    gap: 6,
    marginBottom: 24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardStack: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipCard: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
