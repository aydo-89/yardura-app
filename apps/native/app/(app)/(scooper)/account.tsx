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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
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

        {/* Stats Row: Credits | Streak | Standing */}
        <View style={styles.statsRow}>
          <Pressable
            onPress={() => router.push('/(app)/(scooper)/rewards')}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: palette.card, borderColor: cardBorder },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="star" size={14} color={Colors.brand.gold} />
            </View>
            {rewardsLoading ? (
              <ActivityIndicator size="small" color={palette.tint} />
            ) : (
              <Text style={[styles.statValue, { color: palette.text }]}>{rewardsValueLabel}</Text>
            )}
            <Text style={[styles.statLabel, { color: palette.muted }]}>Credits</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/(scooper)/daily-check')}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: palette.card, borderColor: cardBorder },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="fire" size={14} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {rewardsStreak ?? '—'}
            </Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Streak</Text>
          </Pressable>
          <Pressable
            onPress={() => setStandingExpanded((prev) => !prev)}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: palette.card, borderColor: cardBorder },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: strikeSummary && strikeSummary.count > 0 ? `${Colors.brand.gold}15` : `${successTint}15` }]}>
              <FontAwesome name="shield" size={14} color={strikeSummary && strikeSummary.count > 0 ? Colors.brand.gold : successTint} />
            </View>
            {strikeLoading ? (
              <ActivityIndicator size="small" color={palette.tint} />
            ) : (
              <Text style={[styles.statValue, { color: strikeSummary && strikeSummary.count > 0 ? Colors.brand.gold : successTint }]}>
                {strikeSummary ? `${strikeSummary.count}/${strikeSummary.limit}` : '—'}
              </Text>
            )}
            <Text style={[styles.statLabel, { color: palette.muted }]}>Standing</Text>
          </Pressable>
        </View>

        {/* Standing Details (expandable) */}
        {standingExpanded ? (
          <View style={[styles.standingCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={styles.standingHeader}>
              <View style={styles.standingTitleRow}>
                <View style={[styles.standingIcon, { backgroundColor: `${successTint}15` }]}>
                  <FontAwesome name="shield" size={16} color={successTint} />
                </View>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Account Standing</Text>
              </View>
              <Pressable onPress={() => setStandingExpanded(false)} style={styles.closeButton}>
                <FontAwesome name="times" size={16} color={palette.muted} />
              </Pressable>
            </View>
            {strikeError ? (
              <Text style={[styles.helperText, { color: palette.danger }]}>{strikeError}</Text>
            ) : (
              <>
                <Text style={[styles.standingMainStat, { color: palette.text }]}>{strikeLabel}</Text>
                <Text style={[styles.helperText, { color: palette.muted, marginBottom: 8 }]}>
                  Release limits (used / allowed per period)
                </Text>
                <View style={styles.standingLimits}>
                  <View style={[styles.limitItem, { backgroundColor: palette.background }]}>
                    <FontAwesome name="clock-o" size={14} color={palette.muted} />
                    <Text style={[styles.limitValue, { color: palette.text }]}>
                      {strikeSummary?.lateReleaseCount ?? 0}/{strikeSummary?.lateReleaseLimit ?? 0}
                    </Text>
                    <Text style={[styles.limitLabel, { color: palette.muted }]}>Late release</Text>
                  </View>
                  <View style={[styles.limitItem, { backgroundColor: palette.background }]}>
                    <FontAwesome name="forward" size={14} color={palette.muted} />
                    <Text style={[styles.limitValue, { color: palette.text }]}>
                      {strikeSummary?.earlyReleaseCount ?? 0}/{strikeSummary?.earlyReleaseLimit ?? 0}
                    </Text>
                    <Text style={[styles.limitLabel, { color: palette.muted }]}>Early release</Text>
                  </View>
                  <View style={[styles.limitItem, { backgroundColor: palette.background }]}>
                    <FontAwesome name="briefcase" size={14} color={palette.muted} />
                    <Text style={[styles.limitValue, { color: palette.text }]}>
                      {strikeSummary?.jobReleaseCount ?? 0}/{strikeSummary?.jobReleaseLimit ?? 0}
                    </Text>
                    <Text style={[styles.limitLabel, { color: palette.muted }]}>Job release</Text>
                  </View>
                </View>
                {strikeWindowLabel ? (
                  <Text style={[styles.helperText, { color: palette.muted }]}>{strikeWindowLabel}</Text>
                ) : null}
              </>
            )}
            <Pressable
              onPress={() => Linking.openURL('mailto:support@yardura.com?subject=Account%20standing%20review')}
              style={[styles.standingAction, { borderColor: palette.border }]}
            >
              <FontAwesome name="envelope-o" size={12} color={palette.tint} />
              <Text style={[styles.standingActionText, { color: palette.tint }]}>Request review</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Collapsible Settings Sections */}
        <View style={styles.settingsContainer}>
          {/* Work Setup */}
          <CollapsibleSection title="Work setup" subtitle="Home base and service areas">
            {anchorLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.helperText, { color: palette.muted }]}>Loading...</Text>
              </View>
            ) : (
              <>
                {/* Home Base Setting */}
                <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
                  <View style={[styles.settingItemIcon, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome name="home" size={14} color={palette.tint} />
                  </View>
                  <View style={styles.settingItemCopy}>
                    <Text style={[styles.settingLabel, { color: palette.text }]}>Home base</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]} numberOfLines={1}>
                      {homeAnchorAddress ?? 'Not set — routes start here'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.formCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <View style={styles.inputBlock}>
                    <TextInput
                      placeholder="Street address"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
                      value={address}
                      onChangeText={(value) => {
                        setAddress(value);
                        setAddressLookupError(null);
                        lastSelectedAddress.current = null;
                      }}
                    />
                    {addressSuggestions.length ? (
                      <View style={[styles.suggestionList, { backgroundColor: palette.card, borderColor: palette.border }]}>
                        {addressSuggestions.map((suggestion) => (
                          <Pressable
                            key={suggestion.placeId}
                            onPress={() => handleSelectSuggestion(suggestion)}
                            style={[styles.suggestionRow, { borderColor: palette.border }]}
                          >
                            <Text style={[styles.suggestionText, { color: palette.text }]}>{suggestion.description}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.rowWrap}>
                    <TextInput
                      placeholder="City"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, styles.inputSmall, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
                      value={city}
                      onChangeText={setCity}
                    />
                    <TextInput
                      placeholder="ST"
                      placeholderTextColor={palette.muted}
                      autoCapitalize="characters"
                      style={[styles.input, styles.inputTiny, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
                      value={stateCode}
                      onChangeText={setStateCode}
                    />
                    <TextInput
                      placeholder="ZIP"
                      placeholderTextColor={palette.muted}
                      keyboardType="number-pad"
                      style={[styles.input, styles.inputTiny, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
                      value={zip}
                      onChangeText={setZip}
                    />
                  </View>
                  {anchorError ? <Text style={[styles.helperText, { color: palette.danger }]}>{anchorError}</Text> : null}
                  {anchorSaved ? <Text style={[styles.helperText, { color: successTint }]}>{anchorSaved}</Text> : null}
                </View>
                <Button title={anchorLoading ? 'Saving...' : 'Save home base'} onPress={handleSaveAnchor} disabled={anchorLoading} />

                <View style={[styles.divider, { backgroundColor: palette.border }]} />

                {/* Service Areas Setting */}
                <Pressable
                  onPress={() => router.push('/(app)/(scooper)/availability')}
                  style={({ pressed }) => [
                    styles.settingItem,
                    { backgroundColor: palette.background },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.settingItemIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                    <FontAwesome name="map" size={14} color={Colors.brand.mint} />
                  </View>
                  <View style={styles.settingItemCopy}>
                    <Text style={[styles.settingLabel, { color: palette.text }]}>Service areas</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>Tiles and availability windows</Text>
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={palette.muted} />
                </Pressable>
              </>
            )}
          </CollapsibleSection>

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
                    Offers, route updates, and check-ins
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
                  const roleIcon = role === 'TECH' ? 'truck' : role === 'CUSTOMER' ? 'paw' : role === 'SALES_REP' ? 'handshake-o' : 'user-circle';
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
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  standingCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  standingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsContainer: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
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
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
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
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
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
  standingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  standingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standingMainStat: {
    fontSize: 15,
    fontWeight: '500',
  },
  standingLimits: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  limitItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  limitLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  limitValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  standingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  standingActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
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
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  inputSmall: {
    flex: 2,
  },
  inputTiny: {
    flex: 1,
    minWidth: 50,
  },
  inputBlock: {
    gap: 6,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
  },
  signOutContainer: {
    marginTop: 8,
  },
});
