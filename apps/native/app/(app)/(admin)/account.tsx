import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { AppUserRole } from '@/lib/auth/types';
import { useThemePreference } from '@/lib/theme/ThemePreferenceProvider';
import { ensurePushRegistration } from '@/lib/notifications/push';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { apiUpload } from '@/lib/api/client';

const ROLE_LABELS: Record<AppUserRole, string> = {
  CUSTOMER: 'Pet Owner',
  TECH: 'Scooper',
  SALES_REP: 'Sales Rep',
  ADMIN: 'Admin',
  OWNER: 'Owner',
};

export default function AdminAccountScreen() {
  const { session, signOut, setActiveRole } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const roles = session?.roles ?? [];
  const emailLabel = session?.user?.email ?? '';
  const userName = session?.user?.name ?? 'Admin';
  const activeRoleLabel = session?.activeRole ? ROLE_LABELS[session.activeRole] : null;
  const themePreference = useThemePreference();
  const themeValue = themePreference?.preference ?? 'system';
  const themeLoading = themePreference?.loading ?? false;
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushUpdating, setPushUpdating] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    session?.user?.imageUrl ?? null,
  );
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);

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
    setProfilePhotoUrl(session?.user?.imageUrl ?? null);
  }, [session?.user?.imageUrl]);

  const handleProfilePhoto = useCallback(async () => {
    if (!session?.token) return;
    setProfilePhotoLoading(true);
    setProfilePhotoError(null);
    try {
      const asset = await captureWithFallback({ kind: 'photo', source: 'auto' });
      if (!asset?.uri) return;
      const name =
        asset.fileName ||
        `admin-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
      const type = asset.mimeType || 'image/jpeg';
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name, type } as any);
      const upload = await apiUpload<{ photoUrl: string | null }>(
        '/api/mobile/users/avatar',
        {
          method: 'POST',
          token: session.token,
          body: formData,
        },
      );
      setProfilePhotoUrl(upload.photoUrl ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update profile photo.';
      setProfilePhotoError(message);
    } finally {
      setProfilePhotoLoading(false);
    }
  }, [session?.token]);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card with Avatar */}
        <View
          style={[
            styles.profileCard,
            cardShadowStyle,
            { backgroundColor: palette.card, borderColor: cardBorder },
          ]}
        >
          <View style={styles.profileRow}>
            <Pressable
              onPress={handleProfilePhoto}
              disabled={profilePhotoLoading}
              style={styles.profileAvatarButton}
            >
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.profileAvatar} />
              ) : (
                <View style={[styles.profileAvatar, { backgroundColor: palette.border }]}>
                  <Text style={[styles.profileInitials, { color: palette.text }]}>
                    {userName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.profileAvatarBadge, { backgroundColor: palette.tint }]}>
                <FontAwesome name="camera" size={12} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={styles.profileMeta}>
              <Text style={[styles.profileName, { color: palette.text }]}>
                {userName}
              </Text>
              <Text style={[styles.profileSubtitle, { color: palette.muted }]}>
                {emailLabel}
              </Text>
              {activeRoleLabel ? (
                <View style={[styles.roleBadge, { backgroundColor: `${palette.tint}15` }]}>
                  <Text style={[styles.roleBadgeText, { color: palette.tint }]}>
                    {activeRoleLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            {/* Theme toggle */}
            <View style={[styles.themeToggle, { borderColor: palette.border, backgroundColor: palette.background }]}>
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
                  size={12}
                  color={themeValue === 'system' ? '#FFFFFF' : palette.muted}
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
                  size={12}
                  color={themeValue === 'light' ? '#FFFFFF' : palette.muted}
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
                  size={12}
                  color={themeValue === 'dark' ? '#FFFFFF' : palette.muted}
                />
              </Pressable>
            </View>
          </View>
          {profilePhotoLoading ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>Updating photo...</Text>
          ) : null}
          {profilePhotoError ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>{profilePhotoError}</Text>
          ) : null}
        </View>

        {/* Collapsible Settings Sections */}
        <View style={styles.settingsContainer}>
          {/* Notifications */}
          <CollapsibleSection title="Notifications" subtitle={pushEnabled ? 'Enabled' : 'Disabled'}>
            {pushLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.helperText, { color: palette.muted }]}>Loading...</Text>
              </View>
            ) : (
              <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
                <View style={[styles.settingItemIcon, { backgroundColor: pushEnabled ? `${Colors.brand.mint}15` : `${palette.muted}15` }]}>
                  <FontAwesome name="bell" size={14} color={pushEnabled ? Colors.brand.mint : palette.muted} />
                </View>
                <View style={styles.settingItemCopy}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>Push alerts</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Admin activity and system alerts
                  </Text>
                </View>
                <Switch
                  value={Boolean(pushEnabled)}
                  onValueChange={handlePushToggle}
                  disabled={pushUpdating || pushEnabled === null}
                  trackColor={{ false: palette.border, true: Colors.brand.mint }}
                  thumbColor="#FFFFFF"
                />
              </View>
            )}
            {pushError ? <Text style={[styles.helperText, { color: palette.danger }]}>{pushError}</Text> : null}
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [
                styles.settingItem,
                { backgroundColor: palette.background },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.settingItemIcon, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="cog" size={14} color={palette.muted} />
              </View>
              <View style={styles.settingItemCopy}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>Device settings</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>Open system preferences</Text>
              </View>
              <FontAwesome name="external-link" size={12} color={palette.muted} />
            </Pressable>
          </CollapsibleSection>

          {/* Role Access */}
          {roles.length > 1 ? (
            <CollapsibleSection title="Switch role" subtitle={activeRoleLabel ?? 'Select role'}>
              <View style={styles.roleList}>
                {roles.map((role) => {
                  const isActive = role === session?.activeRole;
                  const roleIcon = role === 'TECH' ? 'truck' : role === 'CUSTOMER' ? 'paw' : role === 'SALES_REP' ? 'handshake-o' : role === 'ADMIN' ? 'shield' : 'user-circle';
                  return (
                    <Pressable
                      key={role}
                      onPress={() => handleSwitch(role)}
                      style={({ pressed }) => [
                        styles.roleChip,
                        { borderColor: isActive ? palette.tint : palette.border },
                        isActive && { backgroundColor: `${palette.tint}15` },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <FontAwesome name={roleIcon} size={14} color={isActive ? palette.tint : palette.muted} />
                      <Text style={[styles.roleChipText, { color: isActive ? palette.tint : palette.text }]}>
                        {ROLE_LABELS[role]}
                      </Text>
                      {isActive ? (
                        <FontAwesome name="check" size={12} color={palette.tint} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </CollapsibleSection>
          ) : null}
        </View>

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <Button title="Sign out" onPress={handleSignOut} variant="secondary" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
    gap: 16,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarButton: {
    position: 'relative',
  },
  profileAvatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileSubtitle: {
    fontSize: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  themeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  themeToggleButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  settingsContainer: {
    gap: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  settingItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingItemCopy: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutContainer: {
    marginTop: 8,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
