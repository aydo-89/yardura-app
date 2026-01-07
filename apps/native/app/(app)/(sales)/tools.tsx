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
  route: Href;
}> = [
  {
    key: 'new-lead',
    title: 'New lead',
    description: 'Capture a new prospect with notes, tags, and follow-ups.',
    icon: 'plus-circle',
    route: '/(app)/(sales)/lead/new' as Href,
  },
  {
    key: 'ai-record',
    title: 'AI visit recorder',
    description: 'Record a door knock recap and auto-tag the outcome.',
    icon: 'microphone',
    route: '/(app)/(sales)/record' as Href,
  },
  {
    key: 'map-view',
    title: 'Map view',
    description: 'Navigate turf, drop pins, and see team radar.',
    icon: 'map',
    route: '/(app)/(sales)/map' as Href,
  },
];

export default function SalesToolsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Sales tools</Text>
          <Text style={[styles.title, { color: palette.text }]}>Field toolkit</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Everything you need to capture leads, summarize visits, and keep follow ups moving.
          </Text>
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
              <View style={styles.cardIcon}>
                <FontAwesome name={tool.icon as any} size={20} color={palette.tint} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {tool.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                  {tool.description}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color={palette.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 20,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,100,91,0.1)',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
