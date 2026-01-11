import { StyleSheet, Text, View, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function RoleChoiceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { setActiveRole } = useAuth();

  const handlePetOwner = async () => {
    // Set active role to CUSTOMER and go to pet owner setup
    await setActiveRole('CUSTOMER');
    router.replace('/(app)/(customer)');
  };

  const handleScooper = async () => {
    // Go directly to scooper application
    router.push('/(auth)/scooper-apply' as any);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>
            Welcome to InsightScoop
          </Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            How would you like to use the app?
          </Text>
        </View>

        <View style={styles.options}>
          <Pressable
            style={[styles.optionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={handlePetOwner}
          >
            <View style={[styles.iconWrap, { backgroundColor: Colors.brand.mint + '20' }]}>
              <FontAwesome name="paw" size={28} color={Colors.brand.mint} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: palette.text }]}>
                I'm a pet owner
              </Text>
              <Text style={[styles.optionDesc, { color: palette.muted }]}>
                Track your pet's wellness with free stool scans, AI chat, health reminders, and more.
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={palette.muted} />
          </Pressable>

          <Pressable
            style={[styles.optionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={handleScooper}
          >
            <View style={[styles.iconWrap, { backgroundColor: Colors.brand.coral + '20' }]}>
              <FontAwesome name="truck" size={28} color={Colors.brand.coral} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: palette.text }]}>
                I want to become a scooper
              </Text>
              <Text style={[styles.optionDesc, { color: palette.muted }]}>
                Earn money by providing poop scooping services in your area. Flexible schedule, weekly pay.
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={palette.muted} />
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: palette.muted }]}>
          You can always access scooper features later from account settings.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  options: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 32,
  },
});
