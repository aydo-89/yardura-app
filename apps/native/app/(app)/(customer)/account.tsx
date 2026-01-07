import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import type {
  CustomerSummary,
  WellnessCheckInContext,
  DogSummary,
  WellnessPreferences,
  CustomerEmailReportPreferences,
} from '@/lib/api/types';
import type { AppUserRole } from '@/lib/auth/types';
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

const REPORT_WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const REPORT_SECTION_OPTIONS: Array<{
  key: keyof CustomerEmailReportPreferences;
  label: string;
}> = [
  { key: 'includeWellness', label: 'Wellness' },
  { key: 'includeScooping', label: 'Scooping' },
  { key: 'includeFood', label: 'Food + meds' },
  { key: 'includeWalks', label: 'Walks' },
  { key: 'includeReminders', label: 'Reminders' },
  { key: 'includeChats', label: 'AI chat' },
  { key: 'includePhotos', label: 'Photos' },
];

const REPORT_SEND_HOURS = [
  { label: '7a', value: 7 },
  { label: '9a', value: 9 },
  { label: '12p', value: 12 },
  { label: '6p', value: 18 },
];

type DogPhotoDraft = {
  uri: string;
  name: string;
  type: string;
};

export default function CustomerAccount() {
  const { session, signOut, setActiveRole } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const roles = session?.roles ?? [];
  const themePreference = useThemePreference();
  const themeValue = themePreference?.preference ?? 'system';
  const themeLoading = themePreference?.loading ?? false;
  const summaryBg =
    colorScheme === 'light' ? Colors.brand.slate100 : Colors.brand.slate950;
  const [pointsContext, setPointsContext] = useState<WellnessCheckInContext | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [shareWellnessNotes, setShareWellnessNotes] = useState<boolean | null>(null);
  const [shareWellnessCaptures, setShareWellnessCaptures] = useState<boolean | null>(null);
  const [autoBlurWellnessPhotos, setAutoBlurWellnessPhotos] = useState<boolean | null>(null);
  const [parasiteRiskNotificationsEnabled, setParasiteRiskNotificationsEnabled] = useState<boolean | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsUpdating, setPrefsUpdating] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushUpdating, setPushUpdating] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [reportPrefs, setReportPrefs] = useState<CustomerEmailReportPreferences | null>(null);
  const [reportPrefsLoading, setReportPrefsLoading] = useState(false);
  const [reportPrefsUpdating, setReportPrefsUpdating] = useState(false);
  const [reportPrefsError, setReportPrefsError] = useState<string | null>(null);
  const [reportRecipientInput, setReportRecipientInput] = useState('');
  const [reportDayOfMonthInput, setReportDayOfMonthInput] = useState('');

  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [dogsLoading, setDogsLoading] = useState(false);
  const [dogsError, setDogsError] = useState<string | null>(null);
  const [dogModalOpen, setDogModalOpen] = useState(false);
  const [editingDog, setEditingDog] = useState<DogSummary | null>(null);
  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogAge, setDogAge] = useState('');
  const [dogWeight, setDogWeight] = useState('');
  const [dogAllergies, setDogAllergies] = useState('');
  const [dogMedications, setDogMedications] = useState('');
  const [dogDietNotes, setDogDietNotes] = useState('');
  const [dogVetName, setDogVetName] = useState('');
  const [dogVetPhone, setDogVetPhone] = useState('');
  const [dogVetClinic, setDogVetClinic] = useState('');
  const [dogPhoto, setDogPhoto] = useState<DogPhotoDraft | null>(null);
  const [dogSaving, setDogSaving] = useState(false);
  const [dogError, setDogError] = useState<string | null>(null);
  const [showAdvancedDogFields, setShowAdvancedDogFields] = useState(false);

  const pointsThisWeek = useMemo(() => {
    if (!pointsContext) return 0;
    if (typeof pointsContext.pointsThisWeek === 'number') {
      return pointsContext.pointsThisWeek;
    }
    const reportPoints = pointsContext.dogs.reduce(
      (sum, dog) => sum + (dog.currentWeekReport?.pointsAwarded ?? 0),
      0,
    );
    const ratingPoints = pointsContext.ratingCreditsThisWeek ?? 0;
    return reportPoints + ratingPoints;
  }, [pointsContext]);

  const ratingCreditsTotal = pointsContext?.ratingCreditsTotal ?? 0;
  const hasActiveService = summary?.wellnessAccess?.hasActiveService ?? false;
  const showScooperApply = !roles.includes('TECH') && !hasActiveService;
  const handleSwitch = async (role: AppUserRole) => {
    await setActiveRole(role);
    if (role === 'TECH') {
      router.replace('/(app)/(scooper)' as Href);
    } else if (role === 'SALES_REP') {
      router.replace('/(app)/(sales)' as Href);
    } else if (role === 'ADMIN' || role === 'OWNER') {
      router.replace('/(app)/(admin)' as Href);
    } else {
      router.replace('/(app)/(customer)' as Href);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in' as Href);
  };

  const maybeRedirectToSetup = useCallback((err: unknown) => {
    if (isCustomerSetupRequired(err)) {
      router.replace('/(app)/(customer)/setup' as Href);
      return true;
    }
    return false;
  }, []);

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    setDogsLoading(true);
    setDogsError(null);
    try {
      const data = await apiRequest<{ dogs: DogSummary[] }>(
        '/api/mobile/customer/dogs',
        { token: session.token },
      );
      setDogs(data.dogs ?? []);
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to load pets.';
      setDogsError(message);
    } finally {
      setDogsLoading(false);
    }
  }, [maybeRedirectToSetup, session?.token]);

  const loadSummary = useCallback(async () => {
    if (!session?.token) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await apiRequest<CustomerSummary>(
        '/api/mobile/customer/summary',
        { token: session.token },
      );
      setSummary(data);
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to load account summary.';
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [maybeRedirectToSetup, session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    const loadPoints = async () => {
      setPointsLoading(true);
      setPointsError(null);
      try {
        const data = await apiRequest<WellnessCheckInContext>(
          '/api/mobile/customer/wellness-check-in',
          { token: session.token },
        );
        if (!mounted) return;
        setPointsContext(data);
        setPointsBalance(data.pointsBalance ?? 0);
      } catch (err) {
        if (!mounted || maybeRedirectToSetup(err)) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load Care Credits.';
        setPointsError(message);
      } finally {
        if (mounted) setPointsLoading(false);
      }
    };
    loadPoints();
    return () => {
      mounted = false;
    };
  }, [maybeRedirectToSetup, session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    const loadReportPrefs = async () => {
      setReportPrefsLoading(true);
      setReportPrefsError(null);
      try {
        const data = await apiRequest<CustomerEmailReportPreferences>(
          '/api/mobile/customer/report-preferences',
          { token: session.token },
        );
        if (!mounted) return;
        setReportPrefs(data);
        setReportDayOfMonthInput(String(data.dayOfMonth ?? 1));
      } catch (err) {
        if (!mounted || maybeRedirectToSetup(err)) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load report settings.';
        setReportPrefsError(message);
      } finally {
        if (mounted) setReportPrefsLoading(false);
      }
    };
    loadReportPrefs();
    return () => {
      mounted = false;
    };
  }, [maybeRedirectToSetup, session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    const loadPrefs = async () => {
      setPrefsLoading(true);
      setPrefsError(null);
      try {
        const data = await apiRequest<WellnessPreferences>(
          '/api/mobile/customer/preferences',
          { token: session.token },
        );
        if (!mounted) return;
        setShareWellnessNotes(data.shareWellnessNotes ?? true);
        setShareWellnessCaptures(data.shareWellnessCaptures ?? true);
        setAutoBlurWellnessPhotos(data.autoBlurWellnessPhotos ?? true);
        setParasiteRiskNotificationsEnabled(data.parasiteRiskNotificationsEnabled ?? true);
      } catch (err) {
        if (!mounted || maybeRedirectToSetup(err)) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load privacy preferences.';
        setPrefsError(message);
      } finally {
        if (mounted) setPrefsLoading(false);
      }
    };
    loadPrefs();
    return () => {
      mounted = false;
    };
  }, [maybeRedirectToSetup, session?.token]);

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
        if (!mounted || maybeRedirectToSetup(err)) return;
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
  }, [maybeRedirectToSetup, session?.token]);

  useEffect(() => {
    loadDogs();
  }, [loadDogs]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to update notifications.';
      setPushError(message);
    } finally {
      setPushUpdating(false);
    }
  };

  const updateReportPrefs = useCallback(
    async (payload: Partial<CustomerEmailReportPreferences>) => {
      if (!session?.token || reportPrefsUpdating) return;
      setReportPrefsError(null);
      setReportPrefsUpdating(true);
      try {
        const data = await apiRequest<CustomerEmailReportPreferences>(
          '/api/mobile/customer/report-preferences',
          {
            method: 'PATCH',
            token: session.token,
            body: payload,
          },
        );
        setReportPrefs(data);
        if (payload.dayOfMonth !== undefined) {
          setReportDayOfMonthInput(String(data.dayOfMonth ?? payload.dayOfMonth));
        }
      } catch (err) {
        if (maybeRedirectToSetup(err)) return;
        const message =
          err instanceof Error ? err.message : 'Unable to update report settings.';
        setReportPrefsError(message);
      } finally {
        setReportPrefsUpdating(false);
      }
    },
    [maybeRedirectToSetup, reportPrefsUpdating, session?.token],
  );

  const handleReportToggle = (nextValue: boolean) => {
    if (!reportPrefs) return;
    updateReportPrefs({ enabled: nextValue });
  };

  const handleReportCadence = (cadence: CustomerEmailReportPreferences['cadence']) => {
    if (!reportPrefs) return;
    updateReportPrefs({ cadence });
  };

  const handleReportDayOfWeek = (dayOfWeek: number) => {
    if (!reportPrefs) return;
    updateReportPrefs({ dayOfWeek });
  };

  const handleReportDayOfMonthBlur = () => {
    if (!reportPrefs) return;
    const parsed = Number.parseInt(reportDayOfMonthInput.trim(), 10);
    if (!Number.isFinite(parsed)) {
      setReportDayOfMonthInput(String(reportPrefs.dayOfMonth));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), 28);
    setReportDayOfMonthInput(String(clamped));
    updateReportPrefs({ dayOfMonth: clamped });
  };

  const handleReportSendHour = (sendHour: number) => {
    if (!reportPrefs) return;
    updateReportPrefs({ sendHour });
  };

  const handleReportRecipientAdd = () => {
    if (!reportPrefs) return;
    const trimmed = reportRecipientInput.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...(reportPrefs.recipients ?? []), trimmed]));
    setReportRecipientInput('');
    updateReportPrefs({ recipients: next });
  };

  const handleReportRecipientRemove = (email: string) => {
    if (!reportPrefs) return;
    const next = reportPrefs.recipients.filter((item) => item !== email);
    updateReportPrefs({ recipients: next });
  };

  const handleReportSectionToggle = (
    key: keyof Pick<
      CustomerEmailReportPreferences,
      | 'includeWellness'
      | 'includeScooping'
      | 'includeFood'
      | 'includeWalks'
      | 'includeReminders'
      | 'includeChats'
      | 'includePhotos'
    >,
  ) => {
    if (!reportPrefs) return;
    updateReportPrefs({ [key]: !reportPrefs[key] } as Partial<CustomerEmailReportPreferences>);
  };

  const handleShareToggle = async (nextValue: boolean) => {
    if (!session?.token || prefsUpdating) return;
    setPrefsError(null);
    setPrefsUpdating(true);
    try {
      const data = await apiRequest<WellnessPreferences>(
        '/api/mobile/customer/preferences',
        {
          method: 'PATCH',
          body: { shareWellnessNotes: nextValue },
          token: session.token,
        },
      );
      setShareWellnessNotes(data.shareWellnessNotes ?? nextValue);
      setShareWellnessCaptures(data.shareWellnessCaptures ?? shareWellnessCaptures ?? true);
      setAutoBlurWellnessPhotos(data.autoBlurWellnessPhotos ?? autoBlurWellnessPhotos ?? true);
      setParasiteRiskNotificationsEnabled(
        data.parasiteRiskNotificationsEnabled ?? parasiteRiskNotificationsEnabled ?? true,
      );
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to update sharing preference.';
      setPrefsError(message);
    } finally {
      setPrefsUpdating(false);
    }
  };

  const handleCaptureShareToggle = async (nextValue: boolean) => {
    if (!session?.token || prefsUpdating) return;
    setPrefsError(null);
    setPrefsUpdating(true);
    try {
      const data = await apiRequest<WellnessPreferences>(
        '/api/mobile/customer/preferences',
        {
          method: 'PATCH',
          body: { shareWellnessCaptures: nextValue },
          token: session.token,
        },
      );
      setShareWellnessNotes(data.shareWellnessNotes ?? shareWellnessNotes ?? true);
      setShareWellnessCaptures(data.shareWellnessCaptures ?? nextValue);
      setAutoBlurWellnessPhotos(data.autoBlurWellnessPhotos ?? autoBlurWellnessPhotos ?? true);
      setParasiteRiskNotificationsEnabled(
        data.parasiteRiskNotificationsEnabled ?? parasiteRiskNotificationsEnabled ?? true,
      );
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to update capture sharing.';
      setPrefsError(message);
    } finally {
      setPrefsUpdating(false);
    }
  };

  const handleAutoBlurToggle = async (nextValue: boolean) => {
    if (!session?.token || prefsUpdating) return;
    setPrefsError(null);
    setPrefsUpdating(true);
    try {
      const data = await apiRequest<WellnessPreferences>(
        '/api/mobile/customer/preferences',
        {
          method: 'PATCH',
          body: { autoBlurWellnessPhotos: nextValue },
          token: session.token,
        },
      );
      setShareWellnessNotes(data.shareWellnessNotes ?? shareWellnessNotes ?? true);
      setShareWellnessCaptures(data.shareWellnessCaptures ?? shareWellnessCaptures ?? true);
      setAutoBlurWellnessPhotos(data.autoBlurWellnessPhotos ?? nextValue);
      setParasiteRiskNotificationsEnabled(
        data.parasiteRiskNotificationsEnabled ?? parasiteRiskNotificationsEnabled ?? true,
      );
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to update photo privacy.';
      setPrefsError(message);
    } finally {
      setPrefsUpdating(false);
    }
  };

  const handleParasiteRiskToggle = async (nextValue: boolean) => {
    if (!session?.token || prefsUpdating) return;
    setPrefsError(null);
    setPrefsUpdating(true);
    try {
      const data = await apiRequest<WellnessPreferences>(
        '/api/mobile/customer/preferences',
        {
          method: 'PATCH',
          body: { parasiteRiskNotificationsEnabled: nextValue },
          token: session.token,
        },
      );
      setShareWellnessNotes(data.shareWellnessNotes ?? shareWellnessNotes ?? true);
      setShareWellnessCaptures(data.shareWellnessCaptures ?? shareWellnessCaptures ?? true);
      setAutoBlurWellnessPhotos(data.autoBlurWellnessPhotos ?? autoBlurWellnessPhotos ?? true);
      setParasiteRiskNotificationsEnabled(
        data.parasiteRiskNotificationsEnabled ?? nextValue,
      );
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message =
        err instanceof Error ? err.message : 'Unable to update parasite reminders.';
      setPrefsError(message);
    } finally {
      setPrefsUpdating(false);
    }
  };

  const openAddDog = () => {
    setEditingDog(null);
    setDogName('');
    setDogBreed('');
    setDogAge('');
    setDogWeight('');
    setDogAllergies('');
    setDogMedications('');
    setDogDietNotes('');
    setDogVetName('');
    setDogVetPhone('');
    setDogVetClinic('');
    setDogPhoto(null);
    setDogError(null);
    setShowAdvancedDogFields(false);
    setDogModalOpen(true);
  };

  const openEditDog = (dog: DogSummary) => {
    setEditingDog(dog);
    setDogName(dog.name ?? '');
    setDogBreed(dog.breed ?? '');
    setDogAge(dog.age ? String(dog.age) : '');
    setDogWeight(typeof dog.weight === 'number' ? String(dog.weight) : '');
    setDogAllergies(dog.allergies ?? '');
    setDogMedications(dog.medications ?? '');
    setDogDietNotes(dog.dietNotes ?? '');
    setDogVetName(dog.vetName ?? '');
    setDogVetPhone(dog.vetPhone ?? '');
    setDogVetClinic(dog.vetClinic ?? '');
    setDogPhoto(null);
    setDogError(null);
    const hasAdvanced =
      Boolean(dog.allergies) ||
      Boolean(dog.medications) ||
      Boolean(dog.dietNotes) ||
      Boolean(dog.vetName) ||
      Boolean(dog.vetPhone) ||
      Boolean(dog.vetClinic);
    setShowAdvancedDogFields(hasAdvanced);
    setDogModalOpen(true);
  };

  const handlePickDogPhoto = async () => {
    const asset = await captureWithFallback({ kind: 'photo', source: 'auto' });
    if (!asset?.uri) return;
    const name =
      asset.fileName ||
      `dog-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
    const type = asset.mimeType || 'image/jpeg';
    setDogPhoto({ uri: asset.uri, name, type });
  };

  const handleSaveDog = async () => {
    if (!session?.token) return;
    if (!dogName.trim()) {
      setDogError('Dog name is required.');
      return;
    }
    setDogSaving(true);
    setDogError(null);
    try {
      const ageValue = dogAge.trim() ? Number(dogAge) : null;
      const weightValue = dogWeight.trim() ? Number(dogWeight) : null;
      const payload = {
        name: dogName.trim(),
        breed: dogBreed.trim() ? dogBreed.trim() : null,
        age: Number.isFinite(ageValue) ? ageValue : null,
        weight: Number.isFinite(weightValue) ? weightValue : null,
        allergies: dogAllergies.trim() ? dogAllergies.trim() : null,
        medications: dogMedications.trim() ? dogMedications.trim() : null,
        dietNotes: dogDietNotes.trim() ? dogDietNotes.trim() : null,
        vetName: dogVetName.trim() ? dogVetName.trim() : null,
        vetPhone: dogVetPhone.trim() ? dogVetPhone.trim() : null,
        vetClinic: dogVetClinic.trim() ? dogVetClinic.trim() : null,
      };

      let savedDog: DogSummary;

      if (editingDog) {
        const data = await apiRequest<{ dog: DogSummary }>(
          '/api/mobile/customer/dogs',
          {
            method: 'PATCH',
            token: session.token,
            body: { id: editingDog.id, ...payload },
          },
        );
        savedDog = data.dog;
      } else {
        const data = await apiRequest<{ dog: DogSummary }>(
          '/api/mobile/customer/dogs',
          {
            method: 'POST',
            token: session.token,
            body: payload,
          },
        );
        savedDog = data.dog;
      }

      if (dogPhoto) {
        const formData = new FormData();
        formData.append('dogId', savedDog.id);
        formData.append('file', {
          uri: dogPhoto.uri,
          name: dogPhoto.name,
          type: dogPhoto.type,
        } as any);

        const upload = await apiUpload<{ photoUrl: string | null }>(
          '/api/mobile/customer/dogs/avatar',
          {
            method: 'POST',
            token: session.token,
            body: formData,
          },
        );

        savedDog = { ...savedDog, photoUrl: upload.photoUrl ?? savedDog.photoUrl };
      }

      setDogs((prev) => {
        const existingIndex = prev.findIndex((dog) => dog.id === savedDog.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = savedDog;
          return next;
        }
        return [savedDog, ...prev];
      });

      setDogModalOpen(false);
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to save dog profile.';
      setDogError(message);
    } finally {
      setDogSaving(false);
    }
  };

  const handleDeleteDog = async () => {
    if (!session?.token || !editingDog) return;
    setDogSaving(true);
    setDogError(null);
    try {
      await apiRequest('/api/mobile/customer/dogs?id=' + editingDog.id, {
        method: 'DELETE',
        token: session.token,
      });
      setDogs((prev) => prev.filter((dog) => dog.id !== editingDog.id));
      setDogModalOpen(false);
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Unable to remove dog.';
      setDogError(message);
    } finally {
      setDogSaving(false);
    }
  };

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.hero, { backgroundColor: heroBackground }]}
        >
          <View
            style={[
              styles.heroGlow,
              { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.25 : 0.4 },
            ]}
          />
          <View
            style={[
              styles.heroGlowSecondary,
              { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.2 : 0.3 },
            ]}
          />
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}
          >
            Account
          </Text>
          <Text style={styles.heroTitle}>Your profile</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}
          >
            {session?.user?.email ?? ''}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Pet profiles</Text>
            <Button title="Add dog" onPress={openAddDog} />
          </View>
          {dogsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading pets...</Text>
            </View>
          ) : dogsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}
            >
              {dogsError}
            </Text>
          ) : (
            <View style={styles.dogGrid}>
              {dogs.map((dog) => (
                <Pressable
                  key={dog.id}
                  style={[styles.dogCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                  onPress={() => openEditDog(dog)}
                >
                  {dog.photoUrl ? (
                    <Image source={{ uri: dog.photoUrl }} style={styles.dogPhoto} />
                  ) : (
                    <View style={[styles.dogPhotoFallback, { backgroundColor: palette.background }]}
                    >
                      <Text style={[styles.dogInitial, { color: palette.text }]}
                      >
                        {dog.name?.slice(0, 1)?.toUpperCase() ?? 'D'}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.dogName, { color: palette.text }]}>{dog.name}</Text>
                  <Text style={[styles.dogMeta, { color: palette.muted }]}
                  >
                    {[
                      dog.breed ?? 'Tap to edit',
                      typeof dog.weight === 'number' ? `${dog.weight} lb` : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.dogCard, styles.addDogCard, { borderColor: palette.border }]}
                onPress={openAddDog}
              >
                <FontAwesome name="plus" size={16} color={palette.text} />
                <Text style={[styles.dogMeta, { color: palette.muted }]}
                >
                  Add dog
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>Roles</Text>
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
                />
              ))
            )}
          </View>
          {summaryLoading ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>Checking account status...</Text>
          ) : summaryError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{summaryError}</Text>
          ) : showScooperApply ? (
            <View style={[styles.rolePrompt, { borderColor: palette.border, backgroundColor: palette.background }]}>
              <View style={styles.rolePromptHeader}>
                <FontAwesome name="paw" size={14} color={palette.tint} />
                <Text style={[styles.rolePromptTitle, { color: palette.text }]}>Become a scooper</Text>
              </View>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Earn extra cash with flexible routes near home. We provide the starter kit and match
                you with open tiles that fit your schedule.
              </Text>
              <Button
                title="Apply to scoop"
                onPress={() => router.push('/(app)/(customer)/scooper-apply' as Href)}
                variant="cta"
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>Appearance</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}
          >
            Choose light or dark mode, or follow your device.
          </Text>
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

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>Notifications</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}
          >
            Control push alerts for service updates and wellness reminders.
          </Text>
          {pushLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}
              >
                Loading notification settings...
              </Text>
            </View>
          ) : (
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.cardBody, { color: palette.text }]}>Push alerts</Text>
                <Text style={[styles.toggleMeta, { color: palette.muted }]}
                >
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
            <Text style={[styles.cardBody, { color: palette.muted }]}
            >
              Saving notification preference...
            </Text>
          ) : null}
          {pushError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}
            >
              {pushError}
            </Text>
          ) : null}
          {parasiteRiskNotificationsEnabled === null ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Loading wellness nudges...
              </Text>
            </View>
          ) : (
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.cardBody, { color: palette.text }]}>
                  Parasite risk nudges
                </Text>
                <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                  Monthly alerts during high-risk months.
                </Text>
              </View>
              <Switch
                value={Boolean(parasiteRiskNotificationsEnabled)}
                onValueChange={handleParasiteRiskToggle}
                disabled={prefsUpdating || parasiteRiskNotificationsEnabled === null}
                trackColor={{ false: palette.border, true: palette.tint }}
                thumbColor={palette.card}
              />
            </View>
          )}
          <Button
            title="Manage device settings"
            onPress={() => Linking.openSettings()}
            variant="ghost"
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>Email wellness reports</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Get a weekly or monthly report that blends wellness + scooping insights.
          </Text>
          {reportPrefsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading report settings...</Text>
            </View>
          ) : reportPrefs ? (
            <>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>Enable reports</Text>
                  <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                    {reportPrefs.enabled ? 'On' : 'Off'}
                  </Text>
                </View>
                <Switch
                  value={reportPrefs.enabled}
                  onValueChange={handleReportToggle}
                  disabled={reportPrefsUpdating}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>

              <Text style={[styles.cardBody, { color: palette.muted }]}>Cadence</Text>
              <View style={styles.rowWrap}>
                <ChoiceChip
                  label="Weekly"
                  selected={reportPrefs.cadence === 'WEEKLY'}
                  onPress={() => handleReportCadence('WEEKLY')}
                />
                <ChoiceChip
                  label="Monthly"
                  selected={reportPrefs.cadence === 'MONTHLY'}
                  onPress={() => handleReportCadence('MONTHLY')}
                />
              </View>

              {reportPrefs.cadence === 'WEEKLY' ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>Send on</Text>
                  <View style={styles.rowWrap}>
                    {REPORT_WEEKDAYS.map((day) => (
                      <ChoiceChip
                        key={day.value}
                        label={day.label}
                        selected={reportPrefs.dayOfWeek === day.value}
                        onPress={() => handleReportDayOfWeek(day.value)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>Send on day</Text>
                  <View style={styles.inlineRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inlineInput,
                        { borderColor: palette.border, color: palette.text },
                      ]}
                      value={reportDayOfMonthInput}
                      onChangeText={setReportDayOfMonthInput}
                      onBlur={handleReportDayOfMonthBlur}
                      keyboardType="number-pad"
                      placeholder="1-28"
                      placeholderTextColor={palette.muted}
                    />
                    <Text style={[styles.cardBody, { color: palette.muted }]}>of the month</Text>
                  </View>
                </>
              )}

              <Text style={[styles.cardBody, { color: palette.muted }]}>Send time</Text>
              <View style={styles.rowWrap}>
                {REPORT_SEND_HOURS.map((slot) => (
                  <ChoiceChip
                    key={slot.value}
                    label={slot.label}
                    selected={reportPrefs.sendHour === slot.value}
                    onPress={() => handleReportSendHour(slot.value)}
                  />
                ))}
              </View>

              <Text style={[styles.cardBody, { color: palette.muted }]}>Include sections</Text>
              <View style={styles.rowWrap}>
                {REPORT_SECTION_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.key}
                    label={option.label}
                    selected={Boolean(reportPrefs[option.key as keyof typeof reportPrefs])}
                    onPress={() => handleReportSectionToggle(option.key as any)}
                  />
                ))}
              </View>

              <Text style={[styles.cardBody, { color: palette.muted }]}>Additional recipients</Text>
              {reportPrefs.recipients.length ? (
                <View style={styles.recipientList}>
                  {reportPrefs.recipients.map((email) => (
                    <Pressable
                      key={email}
                      style={[styles.recipientPill, { borderColor: palette.border }]}
                      onPress={() => handleReportRecipientRemove(email)}
                    >
                      <Text style={[styles.recipientText, { color: palette.text }]}>
                        {email}
                      </Text>
                      <FontAwesome name="times" size={12} color={palette.muted} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                  Uses your account email by default.
                </Text>
              )}
              <View style={styles.inlineRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inlineInput,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                  value={reportRecipientInput}
                  onChangeText={setReportRecipientInput}
                  placeholder="Add another email"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Button title="Add" onPress={handleReportRecipientAdd} />
              </View>
              <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                Timing uses your device time zone.
              </Text>
            </>
          ) : null}
          {reportPrefsUpdating ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Saving report settings...
            </Text>
          ) : null}
          {reportPrefsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{reportPrefsError}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            styles.careCreditsCard,
            { backgroundColor: summaryBg, borderColor: palette.tint },
          ]}
        >
          <View style={[styles.careCreditsAccent, { backgroundColor: palette.tint }]} />
          <Text style={[styles.cardTitle, { color: palette.text }]}>Care Credits</Text>
          {pointsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}
              >
                Loading Care Credits...
              </Text>
            </View>
          ) : pointsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}
            >
              {pointsError}
            </Text>
          ) : (
            <>
              <Text style={[styles.careCreditsHeadline, { color: palette.text }]}
              >
                {pointsBalance ?? 0} Care Credits
              </Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}
              >
                Earn credits for weekly check-ins, visit feedback, and vet notes.
              </Text>
              <View style={styles.rewardMetrics}>
                <View
                  style={[
                    styles.rewardMetricCard,
                    { backgroundColor: palette.background, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.rewardMetricLabel, { color: palette.muted }]}
                  >
                    This week
                  </Text>
                  <Text style={[styles.rewardMetricValue, { color: palette.text }]}
                  >
                    {pointsThisWeek}
                  </Text>
                </View>
                <View
                  style={[
                    styles.rewardMetricCard,
                    { backgroundColor: palette.background, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.rewardMetricLabel, { color: palette.muted }]}
                  >
                    Total earned
                  </Text>
                  <Text style={[styles.rewardMetricValue, { color: palette.text }]}
                  >
                    {pointsBalance ?? 0}
                  </Text>
                </View>
              </View>
              {ratingCreditsTotal > 0 ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Includes {ratingCreditsTotal} credits from visit feedback.
                </Text>
              ) : (
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >
                  Rate completed visits to earn extra credits.
                </Text>
              )}
              <Button
                title="Redeem care credits"
                variant="secondary"
                onPress={() => router.push('/(app)/(customer)/rewards' as Href)}
              />
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>Privacy & sharing</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Control how wellness notes and photos are stored or shared.
          </Text>
          {prefsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Loading preferences...
              </Text>
            </View>
          ) : (
            <>
              {shareWellnessNotes !== null ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Check-in notes
                  </Text>
                  <View style={styles.rowWrap}>
                    <ChoiceChip
                      label="Share notes"
                      selected={shareWellnessNotes}
                      onPress={() => handleShareToggle(true)}
                    />
                    <ChoiceChip
                      label="Keep private"
                      selected={!shareWellnessNotes}
                      onPress={() => handleShareToggle(false)}
                    />
                  </View>
                </>
              ) : null}
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>
                    Share stool photos
                  </Text>
                  <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                    Helps improve wellness AI.
                  </Text>
                </View>
                <Switch
                  value={Boolean(shareWellnessCaptures)}
                  onValueChange={handleCaptureShareToggle}
                  disabled={prefsUpdating || shareWellnessCaptures === null}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>Auto-blur photos</Text>
                  <Text style={[styles.toggleMeta, { color: palette.muted }]}>
                    Adds privacy by default.
                  </Text>
                </View>
                <Switch
                  value={Boolean(autoBlurWellnessPhotos)}
                  onValueChange={handleAutoBlurToggle}
                  disabled={prefsUpdating || autoBlurWellnessPhotos === null}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              </View>
            </>
          )}
          {prefsUpdating ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Saving preferences...
            </Text>
          ) : null}
          {prefsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>
              {prefsError}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button title="Sign out" onPress={handleSignOut} variant="secondary" />
        </View>
      </ScrollView>

      <Modal
        visible={dogModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDogModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}
              >
                {editingDog ? 'Edit dog profile' : 'Add a dog'}
              </Text>
              <Pressable onPress={() => setDogModalOpen(false)}>
                <Text style={[styles.modalClose, { color: palette.muted }]}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[styles.photoPicker, { borderColor: palette.border }]}
                onPress={handlePickDogPhoto}
              >
                {dogPhoto?.uri ? (
                  <Image source={{ uri: dogPhoto.uri }} style={styles.photoPreview} />
                ) : editingDog?.photoUrl ? (
                  <Image source={{ uri: editingDog.photoUrl }} style={styles.photoPreview} />
                ) : (
                  <View style={[styles.photoFallback, { backgroundColor: palette.background }]}
                  >
                    <FontAwesome name="camera" size={20} color={palette.muted} />
                  </View>
                )}
                <View style={styles.photoCopy}>
                  <Text style={[styles.photoTitle, { color: palette.text }]}>
                    Upload a pet photo
                  </Text>
                  <Text style={[styles.photoMeta, { color: palette.muted }]}>
                    Tap to choose from camera or library.
                  </Text>
                </View>
              </Pressable>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Name</Text>
                <TextInput
                  value={dogName}
                  onChangeText={setDogName}
                  placeholder="Dog name"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Breed</Text>
                <TextInput
                  value={dogBreed}
                  onChangeText={setDogBreed}
                  placeholder="Breed (optional)"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Age</Text>
                <TextInput
                  value={dogAge}
                  onChangeText={setDogAge}
                  placeholder="Age (optional)"
                  placeholderTextColor={palette.muted}
                  keyboardType="number-pad"
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Weight (lbs)</Text>
                <TextInput
                  value={dogWeight}
                  onChangeText={setDogWeight}
                  placeholder="Weight (optional)"
                  placeholderTextColor={palette.muted}
                  keyboardType="decimal-pad"
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <Pressable
                style={styles.advancedToggle}
                onPress={() => setShowAdvancedDogFields((prev) => !prev)}
              >
                <Text style={[styles.advancedToggleText, { color: palette.tint }]}>
                  {showAdvancedDogFields ? 'Hide advanced details' : 'Add advanced details'}
                </Text>
              </Pressable>

              {showAdvancedDogFields ? (
                <View style={styles.advancedSection}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Allergies</Text>
                    <TextInput
                      value={dogAllergies}
                      onChangeText={setDogAllergies}
                      placeholder="Known allergens"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Medications</Text>
                    <TextInput
                      value={dogMedications}
                      onChangeText={setDogMedications}
                      placeholder="Current medications"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Diet notes</Text>
                    <TextInput
                      value={dogDietNotes}
                      onChangeText={setDogDietNotes}
                      placeholder="Diet or feeding notes"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                      multiline
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Vet contact</Text>
                    <TextInput
                      value={dogVetName}
                      onChangeText={setDogVetName}
                      placeholder="Vet name"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                    <TextInput
                      value={dogVetClinic}
                      onChangeText={setDogVetClinic}
                      placeholder="Clinic (optional)"
                      placeholderTextColor={palette.muted}
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                    <TextInput
                      value={dogVetPhone}
                      onChangeText={setDogVetPhone}
                      placeholder="Vet phone"
                      placeholderTextColor={palette.muted}
                      keyboardType="phone-pad"
                      style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    />
                  </View>
                </View>
              ) : null}

              {dogError ? (
                <Text style={[styles.cardBody, { color: palette.danger }]}>
                  {dogError}
                </Text>
              ) : null}

              <View style={styles.modalActions}>
                <Button
                  title={dogSaving ? 'Saving...' : 'Save profile'}
                  onPress={handleSaveDog}
                  disabled={dogSaving}
                />
                {editingDog ? (
                  <Button
                    title="Remove dog"
                    onPress={handleDeleteDog}
                    variant="secondary"
                    disabled={dogSaving}
                  />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -80,
    left: -40,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dogCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  addDogCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderStyle: 'dashed',
  },
  dogPhoto: {
    width: '100%',
    height: 110,
    borderRadius: 12,
  },
  dogPhotoFallback: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogInitial: {
    fontSize: 22,
    fontWeight: '700',
  },
  dogName: {
    fontSize: 15,
    fontWeight: '600',
  },
  dogMeta: {
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
  },
  careCreditsCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  careCreditsAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  careCreditsHeadline: {
    fontSize: 22,
    fontWeight: '700',
  },
  rewardMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  rewardMetricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  rewardMetricLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  rewardMetricValue: {
    fontSize: 18,
    fontWeight: '700',
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
  rolePrompt: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  rolePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rolePromptTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  recipientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recipientText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: 24,
  },
  themeToggleContainer: {
    marginTop: 6,
  },
  themeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    alignSelf: 'flex-start',
  },
  themeToggleButton: {
    width: 36,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalContent: {
    gap: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 14,
  },
  photoPicker: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  photoFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCopy: {
    flex: 1,
    gap: 4,
  },
  advancedToggle: {
    alignSelf: 'flex-start',
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  advancedSection: {
    gap: 12,
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoMeta: {
    fontSize: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    gap: 10,
  },
});
