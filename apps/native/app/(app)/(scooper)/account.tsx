import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest, apiUpload } from '@/lib/api/client';
import type { AppUserRole } from '@/lib/auth/types';
import type { ScooperRewardTier, ScooperRewardsPayload } from '@/lib/api/types';
import { useThemePreference } from '@/lib/theme/ThemePreferenceProvider';
import { ensurePushRegistration } from '@/lib/notifications/push';
import { captureWithFallback } from '@/lib/media/imagePicker';

const ROLE_LABELS: Record<AppUserRole, string> = {
  CUSTOMER: 'Pet Owner',
  TECH: 'Scooper',
  SALES_REP: 'Sales Rep',
  ADMIN: 'Admin',
  OWNER: 'Owner',
};

const GOOGLE_PLACES_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  || '';

type AddressSuggestion = {
  description: string;
  placeId: string;
};

type PlaceComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const parsePlaceComponents = (components: PlaceComponent[] = []) => {
  const byType = new Map<string, PlaceComponent>();
  components.forEach((component) => {
    component.types.forEach((type) => {
      byType.set(type, component);
    });
  });

  const city =
    byType.get('locality')?.long_name
    || byType.get('sublocality')?.long_name
    || byType.get('postal_town')?.long_name
    || '';
  const state =
    byType.get('administrative_area_level_1')?.short_name
    || byType.get('administrative_area_level_1')?.long_name
    || '';
  const zip = byType.get('postal_code')?.long_name || '';

  return { city, state, zip };
};

export default function ScooperAccount() {
  const { session, signOut, setActiveRole } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const successTint = Colors.brand.mint;
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const roles = session?.roles ?? [];
  const emailLabel = session?.user?.email ?? '';
  const scooperNameLabel = session?.user?.name ?? 'Scooper';
  const activeRoleLabel = session?.activeRole ? ROLE_LABELS[session.activeRole] : null;
  const themePreference = useThemePreference();
  const themeValue = themePreference?.preference ?? 'system';
  const themeLoading = themePreference?.loading ?? false;
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [anchorSaved, setAnchorSaved] = useState<string | null>(null);
  const [homeAnchorAddress, setHomeAnchorAddress] = useState<string | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [rewardsBalance, setRewardsBalance] = useState<number | null>(null);
  const [rewardsStreak, setRewardsStreak] = useState<number | null>(null);
  const [nextReward, setNextReward] = useState<ScooperRewardsPayload['nextReward'] | null>(null);
  const [rewardTier, setRewardTier] = useState<ScooperRewardTier | null>(null);
  const [strikeSummary, setStrikeSummary] = useState<{
    count: number;
    limit: number;
    windowStart: string | null;
    lastAt: string | null;
    lastReason: string | null;
    lateReleaseCount: number;
    lateReleaseLimit: number;
    earlyReleaseCount: number;
    earlyReleaseLimit: number;
    jobReleaseCount: number;
    jobReleaseLimit: number;
  } | null>(null);
  const [strikeLoading, setStrikeLoading] = useState(false);
  const [strikeError, setStrikeError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zip, setZip] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const addressLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedAddress = useRef<string | null>(null);
  const [hasLoadedRewards, setHasLoadedRewards] = useState(false);
  const [hasLoadedAnchor, setHasLoadedAnchor] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushUpdating, setPushUpdating] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [standingExpanded, setStandingExpanded] = useState(false);
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
        `scooper-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
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

  const loadAnchor = useCallback(async () => {
    if (!session?.token) return;
    setAnchorLoading(true);
    setAnchorError(null);
    setAnchorSaved(null);
    try {
      const data = await apiRequest<{
        homeAnchor: { address?: string | null } | null;
        homeAddressInput?: {
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
        } | null;
      }>('/api/field-tech/home-anchor', { token: session.token });
      const input = data?.homeAddressInput ?? {};
      setHomeAnchorAddress(data?.homeAnchor?.address ?? null);
      setAddress(input.address ?? '');
      lastSelectedAddress.current = input.address ?? null;
      setCity(input.city ?? '');
      setStateCode(input.state ?? '');
      setZip(input.zip ?? '');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setAnchorError('Home base unlocks after your scooper profile is approved.');
      } else {
        const message =
          err instanceof Error ? err.message : 'Unable to load home base.';
        setAnchorError(message);
      }
    } finally {
      setAnchorLoading(false);
      setHasLoadedAnchor(true);
    }
  }, [session?.token]);

  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    if (!GOOGLE_PLACES_KEY) return;
    setAddressLookupLoading(true);
    setAddressLookupError(null);
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        suggestion.placeId,
      )}&fields=formatted_address,address_component&key=${GOOGLE_PLACES_KEY}`;
      const response = await fetch(detailsUrl);
      const data = await response.json();
      if (!data || data.status !== 'OK' || !data.result) {
        throw new Error('Unable to load address details.');
      }
      const formatted = data.result.formatted_address || suggestion.description;
      const components = parsePlaceComponents(data.result.address_components || []);
      setAddress(formatted);
      if (components.city) setCity(components.city);
      if (components.state) setStateCode(components.state);
      if (components.zip) setZip(components.zip);
      lastSelectedAddress.current = formatted;
      setAddressSuggestions([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load that address.';
      setAddressLookupError(message);
    } finally {
      setAddressLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_PLACES_KEY) return undefined;
    const query = address.trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      setAddressLookupError(null);
      setAddressLookupLoading(false);
      return undefined;
    }
    if (lastSelectedAddress.current === query) {
      setAddressSuggestions([]);
      setAddressLookupLoading(false);
      return undefined;
    }

    if (addressLookupTimeout.current) {
      clearTimeout(addressLookupTimeout.current);
    }

    setAddressLookupLoading(true);
    addressLookupTimeout.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query,
        )}&types=address&components=country:us&key=${GOOGLE_PLACES_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data || data.status === 'ZERO_RESULTS') {
          setAddressSuggestions([]);
          setAddressLookupError(null);
          return;
        }
        if (data.status !== 'OK') {
          throw new Error('Unable to load address suggestions.');
        }
        const nextSuggestions = (data.predictions || [])
          .slice(0, 5)
          .map((prediction: { description: string; place_id: string }) => ({
            description: prediction.description,
            placeId: prediction.place_id,
          }));
        setAddressSuggestions(nextSuggestions);
        setAddressLookupError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load address suggestions.';
        setAddressLookupError(message);
        setAddressSuggestions([]);
      } finally {
        setAddressLookupLoading(false);
      }
    }, 350);

    return () => {
      if (addressLookupTimeout.current) {
        clearTimeout(addressLookupTimeout.current);
      }
    };
  }, [address]);

  const loadRewards = useCallback(async () => {
    if (!session?.token) return;
    setRewardsLoading(true);
    setRewardsError(null);
    try {
      const data = await apiRequest<ScooperRewardsPayload>('/api/field-tech/rewards', {
        token: session.token,
      });
      const normalizedBalance =
        typeof data.balance === 'number'
          ? data.balance
          : typeof data.earnedPoints === 'number'
            ? Math.max(0, data.earnedPoints - (data.spentPoints ?? 0))
            : null;
      setRewardsBalance(normalizedBalance);
      setRewardsStreak(data.dailyCheck?.streakCount ?? null);
      setNextReward(data.nextReward ?? null);
      setRewardTier(data.tier ?? null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setRewardsError('Rewards unlock after your scooper profile is approved.');
      } else {
        const message =
          err instanceof Error ? err.message : 'Unable to load rewards.';
        setRewardsError(message);
      }
    } finally {
      setRewardsLoading(false);
      setHasLoadedRewards(true);
    }
  }, [session?.token]);

  const loadDiscipline = useCallback(async () => {
    if (!session?.token) return;
    setStrikeLoading(true);
    setStrikeError(null);
    try {
      const data = await apiRequest<{
        strikeCount: number;
        limit: number;
        windowStart: string | null;
        lastAt: string | null;
        lastReason: string | null;
        lateRelease: { count: number; limit: number; windowStart: string };
        earlyRelease: { count: number; limit: number; windowStart: string };
        jobRelease: { count: number; limit: number; windowStart: string };
      }>('/api/field-tech/discipline', { token: session.token });
      setStrikeSummary({
        count: data.strikeCount,
        limit: data.limit,
        windowStart: data.windowStart,
        lastAt: data.lastAt,
        lastReason: data.lastReason,
        lateReleaseCount: data.lateRelease?.count ?? 0,
        lateReleaseLimit: data.lateRelease?.limit ?? 0,
        earlyReleaseCount: data.earlyRelease?.count ?? 0,
        earlyReleaseLimit: data.earlyRelease?.limit ?? 0,
        jobReleaseCount: data.jobRelease?.count ?? 0,
        jobReleaseLimit: data.jobRelease?.limit ?? 0,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load account standing.';
      setStrikeError(message);
    } finally {
      setStrikeLoading(false);
    }
  }, [session?.token]);

  const loadPushPreference = useCallback(async () => {
    if (!session?.token) return;
    setPushLoading(true);
    setPushError(null);
    try {
      const data = await apiRequest<{ pushEnabled: boolean }>(
        '/api/mobile/notifications/preferences',
        { token: session.token },
      );
      setPushEnabled(Boolean(data.pushEnabled));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load notifications.';
      setPushError(message);
    } finally {
      setPushLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadAnchor();
      loadRewards();
      loadDiscipline();
      loadPushPreference();
    }, [loadAnchor, loadRewards, loadDiscipline, loadPushPreference]),
  );

  useEffect(() => {
    if (session?.token && !hasLoadedAnchor && !anchorLoading) {
      loadAnchor();
    }
    if (session?.token && !hasLoadedRewards && !rewardsLoading) {
      loadRewards();
    }
    if (session?.token && !strikeLoading && !strikeSummary) {
      loadDiscipline();
    }
  }, [
    session?.token,
    hasLoadedAnchor,
    hasLoadedRewards,
    anchorLoading,
    rewardsLoading,
    strikeLoading,
    strikeSummary,
    loadAnchor,
    loadRewards,
    loadDiscipline,
  ]);

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

  const handleSaveAnchor = async () => {
    if (!session?.token || anchorLoading) return;
    setAnchorError(null);
    setAnchorSaved(null);
    setAnchorLoading(true);
    try {
      const response = await apiRequest<{
        homeAnchor?: { address?: string | null } | null;
      }>('/api/field-tech/home-anchor', {
        method: 'POST',
        token: session.token,
        body: {
          address,
          city,
          state: stateCode,
          zip,
        },
      });
      setHomeAnchorAddress(response?.homeAnchor?.address ?? homeAnchorAddress);
      setAnchorSaved('Home base updated.');
    } catch (err) {
      let message =
        err instanceof Error ? err.message : 'Unable to update home base.';
      if (err instanceof ApiError) {
        const details = err.details as { error?: string; message?: string } | undefined;
        if (details?.error === 'validation_error') {
          message = 'Please fill in street, city, state, and ZIP.';
        } else if (details?.error === 'geocode_failed') {
          message =
            details.message ?? 'We could not locate that address. Double-check and try again.';
        }
      }
      setAnchorError(message);
    } finally {
      setAnchorLoading(false);
    }
  };

  const rewardsProgressPct = useMemo(() => {
    if (rewardsBalance === null || !nextReward?.pointsCost) return 0;
    return Math.min(100, Math.round((rewardsBalance / nextReward.pointsCost) * 100));
  }, [rewardsBalance, nextReward]);

  const rewardsValueLabel = rewardsBalance === null ? '—' : `${rewardsBalance}`;
  const streakLabel = rewardsStreak !== null ? `${rewardsStreak} day streak` : null;
  const tierLabel = rewardTier?.name ?? null;
  const strikeLabel = strikeSummary
    ? `${strikeSummary.count} / ${strikeSummary.limit} missed visits`
    : 'Account standing unavailable';
  const strikeWindowLabel = strikeSummary?.windowStart
    ? `Current window starts ${new Date(strikeSummary.windowStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    : null;
  const strikeLastUpdate = strikeSummary?.lastAt
    ? `Last update ${new Date(strikeSummary.lastAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    : null;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageHeader}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/images/logo-horizontal.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.headerCopy}>
              <Text style={[styles.kicker, { color: palette.muted }]}>Scooper account</Text>
              <Text style={[styles.title, { color: palette.text }]}>Account</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                {emailLabel}
              </Text>
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
              <View style={[styles.themeToggle, { borderColor: palette.border, backgroundColor: palette.card }]}>
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
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Profile</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Keep your scooper details up to date.
            </Text>
          </View>
          <View
            style={[
              styles.profileCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={styles.profileRow}>
              <View style={styles.profileIdentity}>
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
                        {scooperNameLabel
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
                    {scooperNameLabel}
                  </Text>
                  <Text style={[styles.profileSubtitle, { color: palette.muted }]}>
                    {emailLabel}
                  </Text>
                  {profilePhotoLoading ? (
                    <Text style={[styles.profileSubtitle, { color: palette.muted }]}>
                      Updating photo...
                    </Text>
                  ) : null}
                  {profilePhotoError ? (
                    <Text style={[styles.cardBody, { color: palette.danger }]}>
                      {profilePhotoError}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Performance</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Rewards momentum and streaks.
            </Text>
          </View>

          <View
            style={[
              styles.heroCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={[styles.heroGlow, { backgroundColor: palette.tint }]} />
            <Text style={[styles.heroKicker, { color: palette.muted }]}>Rewards balance</Text>
            {rewardsLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>Loading rewards...</Text>
              </View>
            ) : rewardsError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{rewardsError}</Text>
            ) : (
              <>
                <Text style={[styles.heroValue, { color: palette.text }]}>
                  {rewardsValueLabel} pts
                </Text>
                <View style={styles.pillRow}>
                  {tierLabel ? (
                    <View style={[styles.pill, { borderColor: palette.border }]}>
                      <Text style={[styles.pillText, { color: palette.text }]}>{tierLabel} tier</Text>
                    </View>
                  ) : null}
                  {streakLabel ? (
                    <View style={[styles.pill, { borderColor: palette.border }]}>
                      <Text style={[styles.pillText, { color: palette.text }]}>{streakLabel}</Text>
                    </View>
                  ) : null}
                </View>
                {nextReward ? (
                  <View style={styles.progressBlock}>
                    <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${rewardsProgressPct}%`, backgroundColor: palette.tint },
                        ]}
                      />
                    </View>
                    <Text style={[styles.cardMeta, { color: palette.muted }]}>
                      Next reward: {nextReward.name} • {nextReward.remainingPoints} pts to unlock
                    </Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.actionRow}>
              <Button
                title="Redeem rewards"
                onPress={() => router.push('/(app)/(scooper)/rewards')}
                variant="primary"
              />
              <Button
                title="Daily check-in"
                onPress={() => router.push('/(app)/(scooper)/daily-check')}
                variant="secondary"
              />
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Pressable
              onPress={() => setStandingExpanded((prev) => !prev)}
              style={styles.collapseHeader}
            >
              <View style={styles.collapseCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Reliability limits</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Tap to review missed-visit limits and release caps.
                </Text>
              </View>
              <View style={styles.collapseMeta}>
                <Text style={[styles.collapseMetaText, { color: palette.muted }]}>
                  {standingExpanded ? 'Hide' : 'View'}
                </Text>
                <FontAwesome
                  name={standingExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={palette.muted}
                />
              </View>
            </Pressable>
            {standingExpanded ? (
              <>
                {strikeLoading ? (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color={palette.tint} />
                    <Text style={[styles.cardBody, { color: palette.muted }]}>Loading standing...</Text>
                  </View>
                ) : strikeError ? (
                  <Text style={[styles.cardBody, { color: palette.danger }]}>{strikeError}</Text>
                ) : (
                  <>
                    <Text style={[styles.cardValue, { color: palette.text }]}>{strikeLabel}</Text>
                    <View style={styles.inlineRow}>
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        Late releases: {strikeSummary?.lateReleaseCount ?? 0} / {strikeSummary?.lateReleaseLimit ?? 0}
                      </Text>
                    </View>
                    <View style={styles.inlineRow}>
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        Early releases: {strikeSummary?.earlyReleaseCount ?? 0} / {strikeSummary?.earlyReleaseLimit ?? 0}
                      </Text>
                    </View>
                    <View style={styles.inlineRow}>
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        Recurring job releases: {strikeSummary?.jobReleaseCount ?? 0} / {strikeSummary?.jobReleaseLimit ?? 0}
                      </Text>
                    </View>
                    {strikeSummary?.lastReason ? (
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        Last reason: {strikeSummary.lastReason}
                      </Text>
                    ) : null}
                    {strikeLastUpdate ? (
                      <Text style={[styles.cardBody, { color: palette.muted }]}>{strikeLastUpdate}</Text>
                    ) : null}
                    {strikeWindowLabel ? (
                      <Text style={[styles.cardBody, { color: palette.muted }]}>{strikeWindowLabel}</Text>
                    ) : null}
                  </>
                )}
                <Button
                  title="Request a standing review"
                  variant="secondary"
                  onPress={() =>
                    Linking.openURL('mailto:support@yardura.com?subject=Account%20standing%20review')
                  }
                />
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Work setup</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Route details that affect offers and drive time.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Home base</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Routes start from your home base. Keep it updated for accurate drive times.
            </Text>
            {anchorLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>Loading home base...</Text>
              </View>
            ) : null}
            {homeAnchorAddress ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Current: {homeAnchorAddress}
              </Text>
            ) : (
              <Text style={[styles.helperText, { color: palette.muted }]}>Home base not set yet.</Text>
            )}
            <View
              style={[
                styles.formCard,
                { backgroundColor: palette.background, borderColor: palette.border },
              ]}
            >
              <View style={styles.formGrid}>
                <View style={styles.inputBlock}>
                  <Text style={[styles.label, { color: palette.text }]}>Street address</Text>
                  <TextInput
                    placeholder="123 Main St"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      { color: palette.text, borderColor: palette.border, backgroundColor: palette.card },
                    ]}
                    value={address}
                    onChangeText={(value) => {
                      setAddress(value);
                      setAddressLookupError(null);
                      lastSelectedAddress.current = null;
                    }}
                  />
                  {addressLookupLoading ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Searching addresses...
                    </Text>
                  ) : null}
                  {addressLookupError ? (
                    <Text style={[styles.helperText, { color: palette.danger }]}>
                      {addressLookupError}
                    </Text>
                  ) : null}
                  {addressSuggestions.length ? (
                    <View
                      style={[
                        styles.suggestionList,
                        { backgroundColor: palette.card, borderColor: palette.border },
                      ]}
                    >
                      {addressSuggestions.map((suggestion) => (
                        <Pressable
                          key={suggestion.placeId}
                          onPress={() => handleSelectSuggestion(suggestion)}
                          style={({ pressed }) => [
                            styles.suggestionRow,
                            {
                              backgroundColor: pressed ? palette.background : palette.card,
                              borderColor: palette.border,
                            },
                          ]}
                        >
                          <Text style={[styles.suggestionText, { color: palette.text }]}>
                            {suggestion.description}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.rowWrap}>
                  <View style={styles.inputColumn}>
                    <Text style={[styles.label, { color: palette.text }]}>City</Text>
                    <TextInput
                      placeholder="City"
                      placeholderTextColor={palette.muted}
                      style={[
                        styles.input,
                        { color: palette.text, borderColor: palette.border, backgroundColor: palette.card },
                      ]}
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <Text style={[styles.label, { color: palette.text }]}>State</Text>
                    <TextInput
                      placeholder="ST"
                      placeholderTextColor={palette.muted}
                      autoCapitalize="characters"
                      style={[
                        styles.input,
                        { color: palette.text, borderColor: palette.border, backgroundColor: palette.card },
                      ]}
                      value={stateCode}
                      onChangeText={setStateCode}
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <Text style={[styles.label, { color: palette.text }]}>ZIP</Text>
                    <TextInput
                      placeholder="ZIP"
                      placeholderTextColor={palette.muted}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        { color: palette.text, borderColor: palette.border, backgroundColor: palette.card },
                      ]}
                      value={zip}
                      onChangeText={setZip}
                    />
                  </View>
                </View>
              </View>
            </View>
            {anchorError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{anchorError}</Text>
            ) : null}
            {anchorSaved ? (
              <Text style={[styles.cardBody, { color: successTint }]}>{anchorSaved}</Text>
            ) : null}
            <Button
              title={anchorLoading ? 'Saving...' : 'Save home base'}
              onPress={handleSaveAnchor}
              disabled={anchorLoading}
            />
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Service areas</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Choose the tiles you want to serve and set the days and windows you are available.
            </Text>
            <Button
              title="Manage service areas"
              onPress={() => router.push('/(app)/(scooper)/availability')}
              variant="secondary"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Preferences</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Control alerts and device settings.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Notifications</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Control push alerts for offers, route updates, and daily check-ins.
            </Text>
            {pushLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Loading notification settings...
                </Text>
              </View>
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
                  disabled={pushUpdating || pushEnabled === null}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
            )}
            {pushUpdating ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Saving notification preference...
              </Text>
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
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Account & access
            </Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Manage roles and sign-in options.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Role access</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Switch roles if you manage multiple dashboards.
            </Text>
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
    fontSize: 26,
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
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
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  profileIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarButton: {
    position: 'relative',
  },
  profileAvatarBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileSubtitle: {
    fontSize: 12,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 140,
    opacity: 0.16,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    gap: 10,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 12,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collapseCopy: {
    flex: 1,
    gap: 4,
  },
  collapseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapseMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    borderRadius: 14,
    paddingVertical: 12,
    flexGrow: 1,
    minWidth: 140,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formGrid: {
    gap: 10,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputColumn: {
    flex: 1,
    minWidth: 90,
    gap: 6,
  },
  inputBlock: {
    gap: 6,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 6,
  },
});
