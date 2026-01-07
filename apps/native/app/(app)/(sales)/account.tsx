import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { AppUserRole } from '@/lib/auth/types';
import { useThemePreference } from '@/lib/theme/ThemePreferenceProvider';
import { ensurePushRegistration } from '@/lib/notifications/push';

const ROLE_LABELS: Record<AppUserRole, string> = {
  CUSTOMER: 'Pet Owner',
  TECH: 'Scooper',
  SALES_REP: 'Sales Rep',
  ADMIN: 'Admin',
  OWNER: 'Owner',
};

export default function SalesAccountScreen() {
  const { session, signOut, setActiveRole } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const roles = session?.roles ?? [];
  const emailLabel = session?.user?.email ?? '';
  const activeRoleLabel = session?.activeRole ? ROLE_LABELS[session.activeRole] : null;
  const themePreference = useThemePreference();
  const themeValue = themePreference?.preference ?? 'system';
  const themeLoading = themePreference?.loading ?? false;
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushUpdating, setPushUpdating] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const handleSwitch = async (role: AppUserRole) => {
    await setActiveRole(role);
    if (role === 'TECH') {
      router.replace('/(app)/(scooper)');
    } else if (role === 'SALES_REP') {
      router.replace('/(app)/(sales)');
    } else if (role === 'ADMIN' || role === 'OWNER') {
      router.replace('/(app)/(admin)');
    } else {
      router.replace('/(app)/(customer)');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    const loadPreference = async () => {
      setPushLoading(true);
      setPushError(null);
      try {
        const data = await apiRequest<{ pushEnabled: boolean }>(
          '/api/mobile/notifications/preferences',
          { token: session.token },
        );
        if (!mounted) return;
        setPushEnabled(Boolean(data.pushEnabled));
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load notifications.';
        setPushError(message);
      } finally {
        if (mounted) setPushLoading(false);
      }
    };
    loadPreference();
    return () => {
      mounted = false;
    };
  }, [session?.token]);

  const handlePushToggle = async (nextValue: boolean) => {
    if (!session?.token || pushUpdating) return;
    setPushError(null);
    setPushUpdating(true);
    try {
      const data = await apiRequest<{ pushEnabled: boolean }>(
        '/api/mobile/notifications/preferences',
        {
          method: 'PATCH',
          token: session.token,
          body: { pushEnabled: nextValue },
        },
      );
      setPushEnabled(Boolean(data.pushEnabled));
      if (nextValue) {
        await ensurePushRegistration(session.token);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update notifications.';
      setPushError(message);
    } finally {
      setPushUpdating(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageHeader}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/images/logo-horizontal.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.headerCopy}>
              <Text style={[styles.kicker, { color: palette.muted }]}>Account</Text>
              <Text style={[styles.title, { color: palette.text }]}>Sales access</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>{emailLabel}</Text>
            </View>
          </View>
          <View style={styles.headerControls}>
            <View style={styles.metaRow}>
              {activeRoleLabel ? (
                <View
                  style={[
                    styles.metaPill,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.metaText, { color: palette.text }]}>
                    Active role: {activeRoleLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.themeToggleContainer}>
              <View
                style={[
                  styles.themeToggle,
                  { borderColor: palette.border, backgroundColor: palette.card },
                ]}
              >
                <Pressable
                  onPress={() => themePreference?.setPreference('system')}
                  style={[
                    styles.themeToggleButton,
                    themeValue === 'system' && { backgroundColor: palette.tint },
                  ]}
                  disabled={themeLoading || !themePreference}
                >
                  <FontAwesome
                    name="adjust"
                    size={14}
                    color={themeValue === 'system' ? '#FFFFFF' : palette.text}
                  />
                </Pressable>
                <Pressable
                  onPress={() => themePreference?.setPreference('light')}
                  style={[
                    styles.themeToggleButton,
                    themeValue === 'light' && { backgroundColor: palette.tint },
                  ]}
                  disabled={themeLoading || !themePreference}
                >
                  <FontAwesome
                    name="sun-o"
                    size={14}
                    color={themeValue === 'light' ? '#FFFFFF' : palette.text}
                  />
                </Pressable>
                <Pressable
                  onPress={() => themePreference?.setPreference('dark')}
                  style={[
                    styles.themeToggleButton,
                    themeValue === 'dark' && { backgroundColor: palette.tint },
                  ]}
                  disabled={themeLoading || !themePreference}
                >
                  <FontAwesome
                    name="moon-o"
                    size={14}
                    color={themeValue === 'dark' ? '#FFFFFF' : palette.text}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Preferences</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Alerts and device settings.</Text>
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Notifications</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>Control push alerts for lead updates and reminders.</Text>
            {pushLoading ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading...</Text>
            ) : (
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>Push alerts</Text>
                  <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                    {pushEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
                <Switch
                  value={Boolean(pushEnabled)}
                  onValueChange={handlePushToggle}
                  disabled={pushUpdating}
                  trackColor={{ true: palette.tint, false: palette.border }}
                  thumbColor={palette.card}
                />
              </View>
            )}
            {pushUpdating ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>Saving...</Text>
            ) : null}
            {pushError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{pushError}</Text>
            ) : null}
            <Button
              title="Manage device settings"
              onPress={() => Linking.openSettings()}
              variant="ghost"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Account & access</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Manage roles and sign-in options.</Text>
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Role access</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>Switch roles if you manage multiple dashboards.</Text>
            <View style={styles.roleList}>
              {roles.length === 0 ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>No roles assigned.</Text>
              ) : (
                roles.map((role) => (
                  <Button
                    key={role}
                    title={ROLE_LABELS[role]}
                    onPress={() => handleSwitch(role)}
                    variant={role === session?.activeRole ? 'primary' : 'secondary'}
                    style={styles.roleButton}
                  />
                ))
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <Button title="Sign out" onPress={handleSignOut} variant="secondary" />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  pageHeader: {
    marginBottom: 22,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  themeToggleContainer: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 110,
    height: 32,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  themeToggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  section: {
    gap: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleMeta: {
    fontSize: 12,
  },
  roleList: {
    gap: 10,
  },
  roleButton: {
    width: '100%',
  },
  actions: {
    marginTop: 8,
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
