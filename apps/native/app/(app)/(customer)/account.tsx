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
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
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
  const [sendingReport, setSendingReport] = useState(false);
  const [sendReportSuccess, setSendReportSuccess] = useState<string | null>(null);
  const [sendReportError, setSendReportError] = useState<string | null>(null);

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

  const handleSendReportNow = async () => {
    if (!session?.token || sendingReport) return;
    setSendReportError(null);
    setSendReportSuccess(null);
    setSendingReport(true);
    try {
      const res = await apiRequest<{ ok: boolean; message?: string; periodLabel?: string; error?: string }>(
        '/api/mobile/customer/report-preferences/send-now',
        {
          method: 'POST',
          token: session.token,
        },
      );
      if (res.message) {
        setSendReportSuccess(res.message);
        // Clear success message after 5 seconds
        setTimeout(() => setSendReportSuccess(null), 5000);
      }
    } catch (err) {
      if (maybeRedirectToSetup(err)) return;
      const message = err instanceof Error ? err.message : 'Failed to send report';
      setSendReportError(message);
    } finally {
      setSendingReport(false);
    }
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

  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const userName = session?.user?.name ?? 'Pet Owner';
  const activeRoleLabel = session?.activeRole ? ROLE_LABELS[session.activeRole] : null;

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
            <View style={styles.profileAvatarButton}>
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
            </View>
            <View style={styles.profileMeta}>
              <Text style={[styles.profileName, { color: palette.text }]}>
                {userName}
              </Text>
              <Text style={[styles.profileSubtitle, { color: palette.muted }]}>
                {session?.user?.email ?? ''}
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
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Pets</Text>
          {dogsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>Loading pets...</Text>
            </View>
          ) : dogsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{dogsError}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsRow}
            >
              {dogs.map((dog) => (
                <Pressable key={dog.id} style={styles.petAvatar} onPress={() => openEditDog(dog)}>
                  {dog.photoUrl ? (
                    <Image source={{ uri: dog.photoUrl }} style={styles.petAvatarImage} />
                  ) : (
                    <View style={[styles.petAvatarFallback, { backgroundColor: palette.background, borderColor: palette.border }]}>
                      <Text style={[styles.petAvatarInitial, { color: palette.text }]}>
                        {dog.name?.slice(0, 1)?.toUpperCase() ?? 'D'}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.petAvatarName, { color: palette.text }]} numberOfLines={1}>
                    {dog.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable style={styles.petAvatar} onPress={openAddDog}>
                <View style={[styles.petAvatarAdd, { borderColor: palette.border }]}>
                  <FontAwesome name="plus" size={18} color={palette.tint} />
                </View>
                <Text style={[styles.petAvatarName, { color: palette.muted }]}>Add</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>

        <CollapsibleSection
          title="Service address"
          subtitle={summary?.customer?.city
            ? `${summary.customer.city}, ${summary.customer.state}`
            : 'Not set'}
        >
          <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
            <View style={[styles.settingItemIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="map-marker" size={14} color={palette.tint} />
            </View>
            <View style={styles.settingItemCopy}>
              <Text style={[styles.settingLabel, { color: palette.text }]}>
                {summary?.customer?.city
                  ? `${summary.customer.city}, ${summary.customer.state} ${summary.customer.zip}`
                  : 'No address on file'}
              </Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Enables poop map, weather alerts, and scheduling
              </Text>
            </View>
          </View>
          <Button
            title={summary?.customer?.city ? 'Update address' : 'Add address'}
            variant="secondary"
            onPress={() => router.push('/(app)/(customer)/address' as Href)}
          />
        </CollapsibleSection>

        {/* Role switching with chips */}
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

        {/* Scooper Apply Prompt */}
        {summaryLoading ? (
          <Text style={[styles.cardBody, { color: palette.muted }]}>Checking account status...</Text>
        ) : summaryError ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{summaryError}</Text>
        ) : showScooperApply ? (
          <View style={[styles.rolePrompt, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <View style={styles.rolePromptHeader}>
              <View style={[styles.settingItemIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name="truck" size={14} color={palette.tint} />
              </View>
              <View style={styles.settingItemCopy}>
                <Text style={[styles.rolePromptTitle, { color: palette.text }]}>Become a scooper</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Earn extra cash with flexible routes near home
                </Text>
              </View>
            </View>
            <Button
              title="Apply to scoop"
              onPress={() => router.push('/(app)/(customer)/scooper-apply' as Href)}
              variant="cta"
            />
          </View>
        ) : null}

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
                  Service updates and wellness reminders
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

          {parasiteRiskNotificationsEnabled !== null ? (
            <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
              <View style={[styles.settingItemIcon, { backgroundColor: parasiteRiskNotificationsEnabled ? `${Colors.brand.gold}15` : `${palette.muted}15` }]}>
                <FontAwesome name="bug" size={14} color={parasiteRiskNotificationsEnabled ? Colors.brand.gold : palette.muted} />
              </View>
              <View style={styles.settingItemCopy}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>Parasite risk nudges</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Monthly alerts during high-risk months
                </Text>
              </View>
              <Switch
                value={Boolean(parasiteRiskNotificationsEnabled)}
                onValueChange={handleParasiteRiskToggle}
                disabled={prefsUpdating || parasiteRiskNotificationsEnabled === null}
                trackColor={{ false: palette.border, true: Colors.brand.gold }}
                thumbColor="#FFFFFF"
              />
            </View>
          ) : null}

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

        <Pressable
          onPress={() => router.push('/(app)/(customer)/report-settings' as Href)}
          style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <View style={styles.settingsRow}>
            <View style={styles.settingsRowContent}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Email wellness reports</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {reportPrefsLoading
                  ? 'Loading...'
                  : reportPrefs?.enabled
                    ? `${reportPrefs.cadence === 'MONTHLY' ? 'Monthly' : 'Weekly'} reports enabled`
                    : 'Reports disabled'}
              </Text>
            </View>
            <View style={styles.settingsRowRight}>
              {reportPrefs ? (
                <Switch
                  value={reportPrefs.enabled}
                  onValueChange={handleReportToggle}
                  disabled={reportPrefsUpdating}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor={palette.card}
                />
              ) : null}
              <FontAwesome name="chevron-right" size={14} color={palette.muted} />
            </View>
          </View>
          {reportPrefsError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{reportPrefsError}</Text>
          ) : null}
        </Pressable>

        <Pressable
          style={[styles.creditsCard, { backgroundColor: summaryBg, borderColor: palette.tint }]}
          onPress={() => router.push('/(app)/(customer)/rewards' as Href)}
        >
          <View style={[styles.creditsAccent, { backgroundColor: palette.tint }]} />
          <View style={styles.creditsContent}>
            <View style={styles.creditsMain}>
              <FontAwesome name="star" size={16} color={palette.tint} />
              <Text style={[styles.creditsValue, { color: palette.text }]}>
                {pointsLoading ? '...' : pointsBalance ?? 0}
              </Text>
              <Text style={[styles.creditsLabel, { color: palette.muted }]}>Care Credits</Text>
            </View>
            <View style={styles.creditsAction}>
              <Text style={[styles.creditsLink, { color: palette.tint }]}>Redeem</Text>
              <FontAwesome name="chevron-right" size={12} color={palette.tint} />
            </View>
          </View>
          {pointsThisWeek > 0 && (
            <Text style={[styles.creditsNote, { color: palette.muted }]}>
              +{pointsThisWeek} this week
            </Text>
          )}
        </Pressable>

        {/* Privacy & Sharing */}
        <CollapsibleSection title="Privacy & sharing" subtitle={shareWellnessCaptures ? 'Sharing enabled' : 'Private mode'}>
          {prefsLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.helperText, { color: palette.muted }]}>Loading...</Text>
            </View>
          ) : (
            <>
              {shareWellnessNotes !== null ? (
                <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
                  <View style={[styles.settingItemIcon, { backgroundColor: shareWellnessNotes ? `${Colors.brand.mint}15` : `${palette.muted}15` }]}>
                    <FontAwesome name="file-text-o" size={14} color={shareWellnessNotes ? Colors.brand.mint : palette.muted} />
                  </View>
                  <View style={styles.settingItemCopy}>
                    <Text style={[styles.settingLabel, { color: palette.text }]}>Check-in notes</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      {shareWellnessNotes ? 'Shared with care team' : 'Kept private'}
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(shareWellnessNotes)}
                    onValueChange={handleShareToggle}
                    disabled={prefsUpdating || shareWellnessNotes === null}
                    trackColor={{ false: palette.border, true: Colors.brand.mint }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ) : null}

              <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
                <View style={[styles.settingItemIcon, { backgroundColor: shareWellnessCaptures ? `${Colors.brand.mint}15` : `${palette.muted}15` }]}>
                  <FontAwesome name="camera" size={14} color={shareWellnessCaptures ? Colors.brand.mint : palette.muted} />
                </View>
                <View style={styles.settingItemCopy}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>Share stool photos</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Helps improve wellness AI
                  </Text>
                </View>
                <Switch
                  value={Boolean(shareWellnessCaptures)}
                  onValueChange={handleCaptureShareToggle}
                  disabled={prefsUpdating || shareWellnessCaptures === null}
                  trackColor={{ false: palette.border, true: Colors.brand.mint }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.settingItem, { backgroundColor: palette.background }]}>
                <View style={[styles.settingItemIcon, { backgroundColor: autoBlurWellnessPhotos ? `${palette.tint}15` : `${palette.muted}15` }]}>
                  <FontAwesome name="eye-slash" size={14} color={autoBlurWellnessPhotos ? palette.tint : palette.muted} />
                </View>
                <View style={styles.settingItemCopy}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>Auto-blur photos</Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Adds privacy by default
                  </Text>
                </View>
                <Switch
                  value={Boolean(autoBlurWellnessPhotos)}
                  onValueChange={handleAutoBlurToggle}
                  disabled={prefsUpdating || autoBlurWellnessPhotos === null}
                  trackColor={{ false: palette.border, true: palette.tint }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </>
          )}
          {prefsError ? <Text style={[styles.helperText, { color: palette.danger }]}>{prefsError}</Text> : null}
        </CollapsibleSection>

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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsRowContent: {
    flex: 1,
    gap: 4,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  sendReportSection: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 16,
  },
  actions: {
    marginTop: 24,
  },
  petsRow: {
    gap: 16,
    paddingVertical: 4,
  },
  petAvatar: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  petAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  petAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petAvatarInitial: {
    fontSize: 20,
    fontWeight: '700',
  },
  petAvatarName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  petAvatarAdd: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    paddingLeft: 18,
    overflow: 'hidden',
    gap: 4,
  },
  creditsAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  creditsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditsMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditsValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  creditsLabel: {
    fontSize: 14,
  },
  creditsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditsLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  creditsNote: {
    fontSize: 11,
    marginLeft: 24,
  },
  themeToggleContainer: {
    marginTop: 6,
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
