import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { API_BASE_URL } from '@/lib/config';

type ToolLink = {
  label: string;
  description: string;
  path: string;
};

type ToolSection = {
  title: string;
  subtitle: string;
  links: ToolLink[];
};

export default function AdminToolsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const baseUrl = API_BASE_URL.replace(/\/$/, '');

  const sections: ToolSection[] = [
    {
      title: 'Marketplace',
      subtitle: 'Tiles, availability, and offers.',
      links: [
        { label: 'Service tiles', description: 'Publish or pause tiles.', path: '/admin/marketplace/tiles' },
        { label: 'Availability', description: 'Scooper availability overview.', path: '/admin/marketplace/availability' },
        { label: 'Handoffs', description: 'Release activity and reassignments.', path: '/admin/marketplace/handoffs' },
      ],
    },
    {
      title: 'Field ops',
      subtitle: 'Operational support and QA.',
      links: [
        { label: 'Visits', description: 'Review visit status and QA media.', path: '/admin/field-ops/visits' },
        { label: 'Check-ins', description: 'Daily check-in oversight.', path: '/admin/field-ops/checkins' },
        { label: 'Skip reasons', description: 'Manage skip reason catalog.', path: '/admin/dispatch/skip-reasons' },
        { label: 'Wellness dataset', description: 'Export cross-customer wellness data.', path: '/admin/wellness-dataset' },
      ],
    },
    {
      title: 'Billing',
      subtitle: 'Ledger health and payments.',
      links: [
        { label: 'Billing dashboard', description: 'Ledger entries and balances.', path: '/admin/billing' },
        { label: 'QuickBooks sync', description: 'Sync status and errors.', path: '/admin/integrations' },
      ],
    },
    {
      title: 'People',
      subtitle: 'Users, leads, and territories.',
      links: [
        { label: 'Users', description: 'Invite and manage staff.', path: '/admin/users' },
        { label: 'Leads', description: 'Sales pipeline overview.', path: '/admin/leads' },
        { label: 'Territories', description: 'Service area assignments.', path: '/admin/territories' },
      ],
    },
  ];

  const openPath = async (path: string) => {
    const url = `${baseUrl}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      // Ignore open errors for optional links.
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Admin tools</Text>
          <Text style={[styles.title, { color: palette.text }]}>Quick access</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Open focused admin modules in the web portal.</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{section.title}</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>{section.subtitle}</Text>
            </View>
            <View
              style={[
                styles.sectionCard,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              {section.links.map((link) => (
                <View key={link.label} style={styles.linkRow}>
                  <View style={styles.linkCopy}>
                    <Text style={[styles.linkLabel, { color: palette.text }]}>{link.label}</Text>
                    <Text style={[styles.linkDescription, { color: palette.muted }]}>{link.description}</Text>
                  </View>
                  <Button title="Open" onPress={() => openPath(link.path)} variant="secondary" />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    gap: 6,
    marginBottom: 20,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 10,
    marginBottom: 18,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linkCopy: {
    flex: 1,
    gap: 4,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  linkDescription: {
    fontSize: 12,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
