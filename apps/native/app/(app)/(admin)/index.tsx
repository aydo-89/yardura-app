import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { API_BASE_URL } from '@/lib/config';

type AdminAction = {
  title: string;
  description: string;
  path: string;
};

export default function AdminOverviewScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;

  const actions = useMemo<AdminAction[]>(
    () => [
      {
        title: 'Dispatch board',
        description: 'Review routes, stops, and assignments.',
        path: '/admin/dispatch/routes',
      },
      {
        title: 'Field ops',
        description: 'Check-ins, visit reviews, and media QA.',
        path: '/admin/field-ops',
      },
      {
        title: 'Customers',
        description: 'Accounts, jobs, and billing plans.',
        path: '/admin/customers',
      },
      {
        title: 'Marketplace',
        description: 'Tiles, availability, and handoffs.',
        path: '/admin/marketplace/tiles',
      },
      {
        title: 'Leads',
        description: 'Outbound and inbound pipeline.',
        path: '/admin/leads',
      },
      {
        title: 'Billing',
        description: 'Ledger health and QuickBooks sync.',
        path: '/admin/billing',
      },
    ],
    [],
  );

  const baseUrl = API_BASE_URL.replace(/\/$/, '');

  const openPath = async (path: string) => {
    const url = `${baseUrl}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      // Intentional no-op; opening the browser is optional.
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Admin</Text>
          <Text style={[styles.title, { color: palette.text }]}>Operations hub</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Jump into the admin portal for fast actions.</Text>
        </View>

        <View
          style={[
            styles.portalCard,
            cardShadowStyle,
            { backgroundColor: palette.card, borderColor: cardBorder },
          ]}
        >
          <Text style={[styles.portalTitle, { color: palette.text }]}>Admin portal</Text>
          <Text style={[styles.portalBody, { color: palette.muted }]}>Open the full web dashboard for deep edits.</Text>
          <Button title="Open admin portal" onPress={() => openPath('/admin')} variant="primary" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick actions</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Common workstreams optimized for mobile.</Text>
        </View>

        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <View
              key={action.title}
              style={[
                styles.actionCard,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              <Text style={[styles.actionTitle, { color: palette.text }]}>{action.title}</Text>
              <Text style={[styles.actionBody, { color: palette.muted }]}>{action.description}</Text>
              <Button
                title="Open"
                onPress={() => openPath(action.path)}
                variant="secondary"
                style={styles.actionButton}
              />
            </View>
          ))}
        </View>
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
    marginBottom: 18,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  portalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  portalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  portalBody: {
    fontSize: 13,
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
