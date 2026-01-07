import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function CustomerWelcomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const openScooping = () => {
    Linking.openURL('https://www.getinsightscoop.com/quote?businessId=yardura').catch(() => null);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Welcome to wellness</Text>
          <Text style={[styles.title, { color: palette.text }]}>Choose your path</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Start free now, upgrade later, or add scooping for pro-level insights.
          </Text>
        </View>

        <View style={styles.cardStack}>
          <View style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planTitle, { color: palette.text }]}>Start Free</Text>
              <Text style={[styles.planMeta, { color: palette.muted }]}>Included for every owner</Text>
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              5 scans + 12 chats monthly, reminders, stool library, and food log.
            </Text>
            <Button title="Start Free" onPress={() => router.replace('/(app)/(customer)/wellness')} />
          </View>

          <View style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planTitle, { color: palette.text }]}>Premium Wellness</Text>
              <FontAwesome name="star" size={18} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              Unlimited scans + chat, multi-dog support, trend analytics, and risk score.
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as any)}
              variant="secondary"
            />
          </View>

          <View style={[styles.planCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planTitle, { color: palette.text }]}>Scooping + Pro Wellness</Text>
              <FontAwesome name="shield" size={18} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              Auto-capture, consistent angles, and pro-verified timeline for your vet.
            </Text>
            <Button title="See Scooping Plans" onPress={openScooping} variant="secondary" />
          </View>
        </View>

        <Button title="Go to dashboard" onPress={() => router.replace('/(app)/(customer)')} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  cardStack: {
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planMeta: {
    fontSize: 12,
  },
  planBody: {
    fontSize: 13,
  },
});
