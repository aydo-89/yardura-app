import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import type {
  CustomerSummary,
  DogSummary,
  WellnessFoodLog,
  WellnessFoodProduct,
  WellnessFoodSchedule,
} from '@/lib/api/types';
import { analyzeIngredients } from '@/lib/wellness/ingredientInsights';
import { captureWithFallback } from '@/lib/media/imagePicker';

const TYPE_OPTIONS = [
  { label: 'Food', value: 'FOOD' },
  { label: 'Treat', value: 'TREAT' },
  { label: 'Supplement', value: 'SUPPLEMENT' },
  { label: 'Medication', value: 'MEDICATION' },
] as const;

const TYPE_LABELS: Record<(typeof TYPE_OPTIONS)[number]['value'], string> = {
  FOOD: 'Food',
  TREAT: 'Treat',
  SUPPLEMENT: 'Supplement',
  MEDICATION: 'Medication',
};

const MODE_OPTIONS = [
  {
    key: 'LOG',
    title: 'Log',
    caption: 'Record meals, treats, supplements, or meds.',
  },
  {
    key: 'INVENTORY',
    title: 'Inventory',
    caption: 'Scan items, save them, and set auto-log schedules.',
  },
] as const;

type FoodScanResult = {
  brand?: string | null;
  productName?: string | null;
  ingredients?: string | null;
  confidence?: number | null;
  type?: string | null;
};

type ScanAsset = {
  uri: string;
  name: string;
  type: string;
};

const QUICK_TIME_OPTIONS = [
  { label: '7:00 AM', value: '07:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '9:00 PM', value: '21:00' },
] as const;

const SCORE_RING_SIZE = 56;
const SCORE_RING_THICKNESS = 6;
const SCORE_INDICATOR_SIZE = 8;
const SCORE_METER_SIZE = SCORE_RING_SIZE + SCORE_INDICATOR_SIZE;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatTimeLabel = (value: string) => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

const parseTimeInput = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const twentyFour = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const twelveHour = trimmed.match(/^(\d{1,2})(?::([0-5]\d))?\s*([ap]m)$/);
  if (!twelveHour) return null;
  const hourRaw = Number(twelveHour[1]);
  const minute = twelveHour[2] ? Number(twelveHour[2]) : 0;
  if (hourRaw < 1 || hourRaw > 12 || minute < 0 || minute > 59) return null;
  const period = twelveHour[3];
  const hour =
    period === 'pm' ? (hourRaw === 12 ? 12 : hourRaw + 12) : hourRaw === 12 ? 0 : hourRaw;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const sortTimes = (values: string[]) => {
  return [...values].sort((a, b) => {
    const [aHour, aMin] = a.split(':').map(Number);
    const [bHour, bMin] = b.split(':').map(Number);
    return aHour * 60 + aMin - (bHour * 60 + bMin);
  });
};

const formatLogTimestamp = (value: string | Date, includeYear = false) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} · ${timeLabel}`;
};

const formatTypeLabel = (value: (typeof TYPE_OPTIONS)[number]['value']) =>
  TYPE_LABELS[value] ?? value.toLowerCase();

const normalizeScanType = (value?: string | null) => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (!upper || upper === 'UNKNOWN') return null;
  const match = TYPE_OPTIONS.find((option) => option.value === upper);
  return match?.value ?? null;
};

const resolvePlaceholders = (value: (typeof TYPE_OPTIONS)[number]['value']) => {
  if (value === 'MEDICATION') {
    return {
      brand: 'Clinic or manufacturer (optional)',
      productName: 'Medication name',
      ingredients: 'Active ingredients (optional)',
      portion: 'Qty (e.g., 1 tablet)',
      notes: 'Dose, timing, or instructions',
    };
  }
  return {
    brand: 'Brand (optional)',
    productName: 'Item name',
    ingredients: 'Ingredients',
    portion: 'Qty (e.g., 1 cup)',
    notes: 'Notes (optional)',
  };
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCalendarDays = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12, 0, 0, 0);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const last = new Date(end);
  last.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = [];
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

export default function WellnessFoodLogScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [logs, setLogs] = useState<WellnessFoodLog[]>([]);
  const [products, setProducts] = useState<WellnessFoodProduct[]>([]);
  const [schedules, setSchedules] = useState<WellnessFoodSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [quickLogId, setQuickLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState({ label: false, ingredients: false });
  const [scanError, setScanError] = useState<{ label?: string | null; ingredients?: string | null } | null>(null);
  const [labelAsset, setLabelAsset] = useState<ScanAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [inventoryEditorOpen, setInventoryEditorOpen] = useState(false);
  const [inventoryEditorMode, setInventoryEditorMode] = useState<'add' | 'edit' | null>(null);
  const [inventoryEditorOffset, setInventoryEditorOffset] = useState<number | null>(null);

  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('FOOD');
  const [typeTouched, setTypeTouched] = useState(false);
  const [dogId, setDogId] = useState<string | null>(null);
  const [filterDogId, setFilterDogId] = useState<string | null>(null);
  const [mode, setMode] = useState<(typeof MODE_OPTIONS)[number]['key']>('LOG');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | (typeof TYPE_OPTIONS)[number]['value']>(
    'ALL',
  );
  const [logFilterType, setLogFilterType] = useState<'ALL' | (typeof TYPE_OPTIONS)[number]['value']>(
    'ALL',
  );
  const [productId, setProductId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<WellnessFoodLog | null>(null);
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [portion, setPortion] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [scheduleInput, setScheduleInput] = useState('');
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [loggedAt, setLoggedAt] = useState(() => {
    const date = new Date();
    date.setSeconds(0, 0);
    return date;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const todayKey = toDateKey(new Date());

  const access = summary?.wellnessAccess ?? null;
  const multiDogLocked = access?.maxDogs === 1 && dogs.length > 1;
  const foodScansRemaining = access
    ? Math.max(0, access.limits.foodScansPerMonth - access.usage.foodScansCount)
    : null;
  const inventoryRemaining = access
    ? Math.max(0, access.limits.inventoryAddsPerMonth - access.usage.inventoryAddsCount)
    : null;
  const foodScanLocked = access?.tier === 'FREE' && foodScansRemaining === 0;
  const inventoryLocked = access?.tier === 'FREE' && inventoryRemaining === 0;

  const ingredientInsights = useMemo(() => analyzeIngredients(ingredients), [ingredients]);
  const placeholders = useMemo(() => resolvePlaceholders(type), [type]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const selectedKey = useMemo(() => toDateKey(loggedAt), [loggedAt]);
  const selectedProduct = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );
  const selectedProducts = useMemo(
    () => products.filter((item) => selectedProductIds.includes(item.id)),
    [products, selectedProductIds],
  );
  const isEditingProduct = Boolean(selectedProduct);
  const activeSchedule = useMemo(() => {
    if (!productId) return null;
    return (
      schedules.find(
        (schedule) =>
          schedule.productId === productId && (dogId ? schedule.dogId === dogId : !schedule.dogId),
      ) ?? null
    );
  }, [schedules, productId, dogId]);
  const scheduleIsActive = activeSchedule?.active ?? false;
  const dogNameMap = useMemo(
    () => new Map(dogs.map((dog) => [dog.id, dog.name])),
    [dogs],
  );
  const filteredProducts = useMemo(() => {
    if (inventoryFilter === 'ALL') return products;
    return products.filter((product) => product.type === inventoryFilter);
  }, [inventoryFilter, products]);
  const filteredLogs = useMemo(() => {
    if (logFilterType === 'ALL') return logs;
    return logs.filter((log) => log.type === logFilterType);
  }, [logFilterType, logs]);
  const selectedLogInsights = useMemo(
    () => analyzeIngredients(selectedLog?.ingredients ?? ''),
    [selectedLog?.ingredients],
  );
  const scanInProgress = scanLoading.label || scanLoading.ingredients;
  const inventorySaveDisabled = savingProduct || (!selectedProduct && inventoryLocked);
  const labelReady = Boolean(brand.trim() || productName.trim());
  const ingredientsReady = Boolean(ingredients.trim());
  const scoreValue = ingredientInsights.score ?? 0;
  const scoreTone =
    ingredientInsights.score == null
      ? palette.border
      : scoreValue >= 85
        ? Colors.brand.mint
        : scoreValue >= 70
          ? palette.tint
          : scoreValue >= 55
            ? Colors.brand.gold
            : palette.danger;
  const scoreDisplay = ingredientInsights.score == null ? '--' : String(scoreValue);
  const scoreRingColors =
    ingredientInsights.score == null
      ? { start: palette.border, mid: palette.border, end: palette.border }
      : scoreValue >= 85
        ? { start: Colors.brand.mint, mid: Colors.brand.gold, end: palette.tint }
        : scoreValue >= 70
          ? { start: palette.tint, mid: Colors.brand.gold, end: Colors.brand.mint }
          : scoreValue >= 55
            ? { start: Colors.brand.gold, mid: palette.tint, end: palette.danger }
            : { start: palette.danger, mid: palette.tint, end: Colors.brand.gold };
  const scoreTextTone = ingredientInsights.score == null ? palette.muted : scoreTone;
  const scoreIndicatorPosition = useMemo(() => {
    const clamped = Math.max(0, Math.min(100, scoreValue));
    const angle = (clamped / 100) * 360 - 90;
    const radians = (angle * Math.PI) / 180;
    const radius = SCORE_RING_SIZE / 2 - SCORE_RING_THICKNESS / 2;
    const center = SCORE_METER_SIZE / 2;
    return {
      left: center + radius * Math.cos(radians) - SCORE_INDICATOR_SIZE / 2,
      top: center + radius * Math.sin(radians) - SCORE_INDICATOR_SIZE / 2,
    };
  }, [scoreValue]);
  const showScoreIndicator = ingredientInsights.score != null;
  const scoreWidth = (
    ingredientInsights.score == null ? '0%' : `${Math.max(0, Math.min(100, scoreValue))}%`
  ) as `${number}%`;
  const pulseStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
    transform: [
      {
        scale: pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.1],
        }),
      },
    ],
  };
  const selectedProductLabel =
    selectedProduct?.productName || selectedProduct?.brand || 'Saved item';
  const canQuickLog = multiSelect
    ? selectedProductIds.length > 0
    : Boolean(productName.trim() || brand.trim());
  const scoreMeter = (
    <View style={styles.scoreMeter}>
      <View
        style={[
          styles.scoreRing,
          {
            borderTopColor: scoreRingColors.start,
            borderRightColor: scoreRingColors.mid,
            borderBottomColor: scoreRingColors.end,
            borderLeftColor: scoreRingColors.mid,
          },
        ]}
      >
        <View
          style={[
            styles.scoreRingInner,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.scoreValueText, { color: scoreTextTone }]}>
            {scoreDisplay}
          </Text>
        </View>
      </View>
      {showScoreIndicator ? (
        <View
          style={[
            styles.scoreIndicator,
            { backgroundColor: scoreTone, borderColor: palette.background },
            scoreIndicatorPosition,
          ]}
        />
      ) : null}
    </View>
  );
  const logScoreValue = selectedLogInsights.score ?? 0;
  const logScoreTone =
    selectedLogInsights.score == null
      ? palette.border
      : logScoreValue >= 85
        ? Colors.brand.mint
        : logScoreValue >= 70
          ? palette.tint
          : logScoreValue >= 55
            ? Colors.brand.gold
            : palette.danger;
  const logScoreDisplay = selectedLogInsights.score == null ? '--' : String(logScoreValue);
  const logScoreRingColors =
    selectedLogInsights.score == null
      ? { start: palette.border, mid: palette.border, end: palette.border }
      : logScoreValue >= 85
        ? { start: Colors.brand.mint, mid: Colors.brand.gold, end: palette.tint }
        : logScoreValue >= 70
          ? { start: palette.tint, mid: Colors.brand.gold, end: Colors.brand.mint }
          : logScoreValue >= 55
            ? { start: Colors.brand.gold, mid: palette.tint, end: palette.danger }
            : { start: palette.danger, mid: palette.tint, end: Colors.brand.gold };
  const logScoreTextTone = selectedLogInsights.score == null ? palette.muted : logScoreTone;
  const logScoreIndicatorPosition = useMemo(() => {
    const clamped = Math.max(0, Math.min(100, logScoreValue));
    const angle = (clamped / 100) * 360 - 90;
    const radians = (angle * Math.PI) / 180;
    const radius = SCORE_RING_SIZE / 2 - SCORE_RING_THICKNESS / 2;
    const center = SCORE_METER_SIZE / 2;
    return {
      left: center + radius * Math.cos(radians) - SCORE_INDICATOR_SIZE / 2,
      top: center + radius * Math.sin(radians) - SCORE_INDICATOR_SIZE / 2,
    };
  }, [logScoreValue]);
  const showLogScoreIndicator = selectedLogInsights.score != null;
  const logScoreWidth = (
    selectedLogInsights.score == null ? '0%' : `${Math.max(0, Math.min(100, logScoreValue))}%`
  ) as `${number}%`;
  const logScoreMeter = (
    <View style={styles.scoreMeter}>
      <View
        style={[
          styles.scoreRing,
          {
            borderTopColor: logScoreRingColors.start,
            borderRightColor: logScoreRingColors.mid,
            borderBottomColor: logScoreRingColors.end,
            borderLeftColor: logScoreRingColors.mid,
          },
        ]}
      >
        <View
          style={[
            styles.scoreRingInner,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.scoreValueText, { color: logScoreTextTone }]}>
            {logScoreDisplay}
          </Text>
        </View>
      </View>
      {showLogScoreIndicator ? (
        <View
          style={[
            styles.scoreIndicator,
            { backgroundColor: logScoreTone, borderColor: palette.background },
            logScoreIndicatorPosition,
          ]}
        />
      ) : null}
    </View>
  );
  const quickLogTitle = saving
    ? 'Logging...'
    : multiSelect
      ? selectedProductIds.length
        ? `Log ${selectedProductIds.length} item${selectedProductIds.length === 1 ? '' : 's'}`
        : 'Select items to log'
      : 'Log now';

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, dogPayload, logPayload, productPayload, schedulePayload] = await Promise.all([
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
          token: session.token,
        }),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
          token: session.token,
        }),
        apiRequest<{ logs: WellnessFoodLog[] }>(
          `/api/mobile/customer/food-log?limit=20${filterDogId ? `&dogId=${filterDogId}` : ''}`,
          { token: session.token },
        ),
        apiRequest<{ products: WellnessFoodProduct[] }>(
          '/api/mobile/customer/food-products?limit=40',
          { token: session.token },
        ),
        apiRequest<{ schedules: WellnessFoodSchedule[] }>(
          '/api/mobile/customer/food-schedules',
          { token: session.token },
        ),
      ]);
      setSummary(summaryData);
      setDogs(dogPayload.dogs ?? []);
      setLogs(logPayload.logs ?? []);
      setProducts(productPayload.products ?? []);
      setSchedules(schedulePayload.schedules ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load food logs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterDogId, session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (multiDogLocked) {
      setDogId(null);
      setFilterDogId(null);
    }
  }, [multiDogLocked]);

  useEffect(() => {
    if (!calendarOpen) return;
    setCalendarMonth(new Date(loggedAt.getFullYear(), loggedAt.getMonth(), 1));
  }, [calendarOpen, loggedAt]);

  useEffect(() => {
    if (mode === 'INVENTORY') {
      setManualEntryOpen(false);
      setMultiSelect(false);
      setSelectedProductIds([]);
      return;
    }
    setInventoryEditorOpen(false);
    setInventoryEditorMode(null);
  }, [mode]);

  useEffect(() => {
    if (multiSelect) {
      setProductId(null);
      setManualEntryOpen(false);
      return;
    }
    setSelectedProductIds([]);
  }, [multiSelect]);

  useEffect(() => {
    if (!activeSchedule) {
      setActiveScheduleId(null);
      setScheduleEnabled(false);
      setScheduleTimes([]);
      return;
    }
    setActiveScheduleId(activeSchedule.id);
    setScheduleEnabled(activeSchedule.active);
    setScheduleTimes(sortTimes(activeSchedule.timesOfDay));
  }, [activeSchedule]);

  useEffect(() => {
    if (!inventoryEditorOpen || inventoryEditorOffset == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, inventoryEditorOffset - 12),
        animated: true,
      });
    });
  }, [inventoryEditorOpen, inventoryEditorOffset]);

  type LogOverrides = {
    productId?: string | null;
    dogId?: string | null;
    type?: (typeof TYPE_OPTIONS)[number]['value'];
    brand?: string;
    productName?: string;
    ingredients?: string;
    portion?: string;
    notes?: string;
    loggedAt?: Date;
    keepSelection?: boolean;
  };

  const resetForm = (options?: { keepProduct?: boolean; keepDog?: boolean; keepType?: boolean }) => {
    const keepProduct = options?.keepProduct ?? false;
    const keepDog = options?.keepDog ?? false;
    const keepType = options?.keepType ?? false;

    if (!keepProduct) {
      setProductId(null);
      setBrand('');
      setProductName('');
      setIngredients('');
      setPortion('');
      setNotes('');
      setLabelAsset(null);
      setProductMessage(null);
    } else {
      setNotes('');
    }

    if (!keepDog) {
      setDogId(null);
    }

    if (!keepType) {
      setType('FOOD');
      setTypeTouched(false);
    }

    setCalendarOpen(false);
  };

  const handleSubmit = async (overrides?: LogOverrides) => {
    if (!session?.token || saving) return;
    const hasDogOverride = overrides ? 'dogId' in overrides : false;
    const hasProductOverride = overrides ? 'productId' in overrides : false;
    const resolvedBrand = overrides?.brand ?? (hasProductOverride ? '' : brand);
    const resolvedName = overrides?.productName ?? (hasProductOverride ? '' : productName);
    const resolvedIngredients =
      overrides?.ingredients ?? (hasProductOverride ? '' : ingredients);
    const resolvedPortion = overrides?.portion ?? (hasProductOverride ? '' : portion);
    const resolvedNotes = overrides?.notes ?? (hasProductOverride ? '' : notes);
    const resolvedType = overrides?.type ?? type;
    const resolvedDogId = hasDogOverride ? overrides?.dogId ?? null : dogId;
    const resolvedProductId = hasProductOverride ? overrides?.productId ?? null : productId;
    const resolvedLoggedAt = overrides?.loggedAt ?? loggedAt;
    if (!resolvedName.trim() && !resolvedBrand.trim() && !resolvedProductId) {
      setError('Add a name or brand.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        type: resolvedType,
        ...(resolvedDogId ? { dogId: resolvedDogId } : {}),
        ...(resolvedProductId ? { productId: resolvedProductId } : {}),
        ...(resolvedLoggedAt ? { loggedAt: resolvedLoggedAt.toISOString() } : {}),
        ...(resolvedBrand.trim() ? { brand: resolvedBrand.trim() } : {}),
        ...(resolvedName.trim() ? { productName: resolvedName.trim() } : {}),
        ...(resolvedIngredients.trim() ? { ingredients: resolvedIngredients.trim() } : {}),
        ...(resolvedPortion.trim() ? { portion: resolvedPortion.trim() } : {}),
        ...(resolvedNotes.trim() ? { notes: resolvedNotes.trim() } : {}),
      };
      const data = await apiRequest<{ log: WellnessFoodLog }>(
        '/api/mobile/customer/food-log',
        {
          method: 'POST',
          token: session.token,
          body: payload,
        },
      );
      if (data.log) {
        setLogs((prev) => [data.log, ...prev.filter((item) => item.id !== data.log.id)]);
        setSuccess(
          data.log.allergenMatches.length
            ? `Allergens flagged: ${data.log.allergenMatches.join(', ')}`
            : 'Log saved. No common allergens detected.',
        );
      }
      const keepSelection = overrides?.keepSelection ?? (mode === 'LOG' && Boolean(productId));
      resetForm({
        keepProduct: keepSelection,
        keepDog: keepSelection || mode === 'LOG',
        keepType: keepSelection || mode === 'LOG',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save log.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = (log: WellnessFoodLog) => {
    if (!session?.token || deletingId) return;
    Alert.alert('Delete food log?', 'This removes the log entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(log.id);
          setError(null);
          try {
            await apiRequest(`/api/mobile/customer/food-log/${log.id}`, {
              method: 'DELETE',
              token: session.token,
            });
            setLogs((prev) => prev.filter((item) => item.id !== log.id));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Unable to delete food log.';
            setError(message);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteProduct = (product: WellnessFoodProduct) => {
    if (!session?.token || deletingProductId) return;
    Alert.alert('Delete saved item?', 'This removes it from your inventory and schedules.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingProductId(product.id);
          setProductMessage(null);
          try {
            await apiRequest(`/api/mobile/customer/food-products/${product.id}`, {
              method: 'DELETE',
              token: session.token,
            });
            setProducts((prev) => prev.filter((item) => item.id !== product.id));
            setSchedules((prev) => prev.filter((schedule) => schedule.productId !== product.id));
            if (productId === product.id) {
              handleClearProduct();
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Unable to delete item.';
            setProductMessage(message);
          } finally {
            setDeletingProductId(null);
          }
        },
      },
    ]);
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleMultiLogNow = async () => {
    if (!session?.token || saving) return;
    if (selectedProducts.length === 0) {
      setError('Select at least one item to log.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const now = new Date();
    const createdLogs: WellnessFoodLog[] = [];
    try {
      for (const product of selectedProducts) {
        const resolvedDogId = dogId ?? product.dogId ?? null;
        const payload = {
          type: product.type,
          ...(resolvedDogId ? { dogId: resolvedDogId } : {}),
          productId: product.id,
          loggedAt: now.toISOString(),
        };
        const data = await apiRequest<{ log: WellnessFoodLog }>(
          '/api/mobile/customer/food-log',
          {
            method: 'POST',
            token: session.token,
            body: payload,
          },
        );
        if (data.log) {
          createdLogs.push(data.log);
        }
      }
      if (createdLogs.length) {
        const newIds = new Set(createdLogs.map((log) => log.id));
        setLogs((prev) => [...createdLogs, ...prev.filter((item) => !newIds.has(item.id))]);
        setSuccess(`${createdLogs.length} item${createdLogs.length === 1 ? '' : 's'} logged.`);
      }
      setSelectedProductIds([]);
      setMultiSelect(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to log selected items.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickLogProduct = async (product: WellnessFoodProduct) => {
    if (!session?.token || saving) return;
    setQuickLogId(product.id);
    await handleSubmit({
      productId: product.id,
      dogId: product.dogId ?? null,
      type: product.type,
      loggedAt: new Date(),
      keepSelection: false,
    });
    setQuickLogId(null);
  };

  const handleSelectProduct = (product: WellnessFoodProduct) => {
    if (multiSelect) {
      toggleProductSelection(product.id);
      return;
    }
    setProductId(product.id);
    setType(product.type);
    setTypeTouched(true);
    setBrand(product.brand ?? '');
    setProductName(product.productName ?? '');
    setIngredients(product.ingredients ?? '');
    setPortion(product.portion ?? '');
    setNotes('');
    setLabelAsset(null);
    setProductMessage(null);
    setManualEntryOpen(false);
  };

  const handleClearProduct = () => {
    setProductId(null);
    setBrand('');
    setProductName('');
    setIngredients('');
    setPortion('');
    setNotes('');
    setScheduleEnabled(false);
    setScheduleTimes([]);
    setLabelAsset(null);
    setProductMessage(null);
    setTypeTouched(false);
  };

  const handleStartAddItem = () => {
    handleClearProduct();
    setInventoryEditorMode('add');
    setInventoryEditorOpen(true);
    setScanError(null);
    setSuccess(null);
    setError(null);
  };

  const handleSelectInventoryItem = (product: WellnessFoodProduct) => {
    handleSelectProduct(product);
    setInventoryEditorMode('edit');
    setInventoryEditorOpen(true);
  };

  const closeInventoryEditor = () => {
    setInventoryEditorOpen(false);
    setInventoryEditorMode(null);
    setInventoryEditorOffset(null);
  };

  const updateScheduleTimes = (next: string[]) => {
    const unique = Array.from(new Set(next));
    setScheduleTimes(sortTimes(unique));
  };

  const handleAddQuickTime = (value: string) => {
    if (scheduleTimes.includes(value)) return;
    updateScheduleTimes([...scheduleTimes, value]);
  };

  const handleAddCustomTime = () => {
    if (!scheduleInput.trim()) return;
    const parsed = parseTimeInput(scheduleInput);
    if (!parsed) {
      setScheduleMessage('Enter a valid time like 7:00 AM.');
      return;
    }
    setScheduleMessage(null);
    setScheduleInput('');
    if (scheduleTimes.includes(parsed)) return;
    updateScheduleTimes([...scheduleTimes, parsed]);
  };

  const handleRemoveTime = (value: string) => {
    setScheduleTimes((prev) => prev.filter((time) => time !== value));
  };

  const createProduct = useCallback(
    async (announce: boolean) => {
      if (!session?.token) return null;
      if (!selectedProduct && inventoryLocked) {
        if (announce) {
          setProductMessage('Inventory limit reached. Upgrade to add more items.');
        }
        return null;
      }
      if (!productName.trim() && !brand.trim()) {
        if (announce) {
          setProductMessage('Add an item name or brand first.');
        }
        return null;
      }
      setSavingProduct(true);
      if (announce) {
        setProductMessage(null);
      }
      try {
        const formData = new FormData();
        formData.append('type', type);
        if (dogId) formData.append('dogId', dogId);
        if (brand.trim()) formData.append('brand', brand.trim());
        if (productName.trim()) formData.append('productName', productName.trim());
        if (ingredients.trim()) formData.append('ingredients', ingredients.trim());
        if (portion.trim()) formData.append('portion', portion.trim());
        if (notes.trim()) formData.append('notes', notes.trim());
        if (labelAsset) {
          formData.append('image', labelAsset as any);
        }
        const data = await apiUpload<{ product: WellnessFoodProduct }>(
          '/api/mobile/customer/food-products',
          {
            token: session.token,
            body: formData,
          },
        );
        if (data.product) {
          setProducts((prev) => [data.product, ...prev.filter((item) => item.id !== data.product.id)]);
          setProductId(data.product.id);
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  wellnessAccess: {
                    ...prev.wellnessAccess,
                    usage: {
                      ...prev.wellnessAccess.usage,
                      inventoryAddsCount: prev.wellnessAccess.usage.inventoryAddsCount + 1,
                    },
                  },
                }
              : prev,
          );
          if (announce) {
            setProductMessage('Saved to quick picks.');
          }
        }
        return data.product ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save item.';
        if (announce) {
          setProductMessage(message);
        }
        return null;
      } finally {
        setSavingProduct(false);
      }
    },
    [session?.token, productName, brand, ingredients, portion, notes, type, dogId, labelAsset],
  );

  const updateProduct = useCallback(
    async (announce: boolean) => {
      if (!session?.token || !selectedProduct) return null;
      if (!productName.trim() && !brand.trim()) {
        if (announce) {
          setProductMessage('Add an item name or brand first.');
        }
        return null;
      }
      setSavingProduct(true);
      if (announce) {
        setProductMessage(null);
      }
      try {
        let data: { product: WellnessFoodProduct } | null = null;
        const endpoint = `/api/mobile/customer/food-products/${selectedProduct.id}`;
        if (labelAsset) {
          const formData = new FormData();
          formData.append('type', type);
          formData.append('dogId', dogId ?? 'null');
          formData.append('brand', brand.trim());
          formData.append('productName', productName.trim());
          formData.append('ingredients', ingredients.trim());
          formData.append('portion', portion.trim());
          formData.append('notes', notes.trim());
          formData.append('image', labelAsset as any);
          data = await apiUpload<{ product: WellnessFoodProduct }>(endpoint, {
            method: 'PATCH',
            token: session.token,
            body: formData,
          });
        } else {
          const payload = {
            type,
            dogId: dogId ?? null,
            brand: brand.trim() ? brand.trim() : null,
            productName: productName.trim() ? productName.trim() : null,
            ingredients: ingredients.trim() ? ingredients.trim() : null,
            portion: portion.trim() ? portion.trim() : null,
            notes: notes.trim() ? notes.trim() : null,
          };
          data = await apiRequest<{ product: WellnessFoodProduct }>(endpoint, {
            method: 'PATCH',
            token: session.token,
            body: payload,
          });
        }
        if (data?.product) {
          setProducts((prev) =>
            prev.map((item) => (item.id === data!.product.id ? data!.product : item)),
          );
          setProductId(data.product.id);
          if (announce) {
            setProductMessage('Changes saved.');
          }
        }
        setLabelAsset(null);
        return data?.product ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update item.';
        if (announce) {
          setProductMessage(message);
        }
        return null;
      } finally {
        setSavingProduct(false);
      }
    },
    [
      session?.token,
      selectedProduct,
      productName,
      brand,
      ingredients,
      portion,
      notes,
      type,
      dogId,
      labelAsset,
    ],
  );

  const handleSaveProduct = async () => {
    setScheduleMessage(null);
    if (selectedProduct) {
      await updateProduct(true);
      return;
    }
    await createProduct(true);
  };

  const handleSaveSchedule = async () => {
    if (!session?.token || savingSchedule) return;
    setScheduleMessage(null);

    if (!scheduleEnabled) {
      if (activeScheduleId) {
        setSavingSchedule(true);
        try {
          const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
            `/api/mobile/customer/food-schedules/${activeScheduleId}`,
            {
              method: 'PATCH',
              token: session.token,
              body: { active: false },
            },
          );
          setSchedules((prev) =>
            prev.map((item) => (item.id === data.schedule.id ? data.schedule : item)),
          );
          setScheduleMessage('Daily auto-log paused.');
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unable to pause the schedule.';
          setScheduleMessage(message);
        } finally {
          setSavingSchedule(false);
        }
      }
      return;
    }

    if (scheduleTimes.length === 0) {
      setScheduleMessage('Add at least one daily time.');
      return;
    }

    let resolvedProductId = productId;
    if (!resolvedProductId) {
      const created = await createProduct(false);
      resolvedProductId = created?.id ?? null;
    }
    if (!resolvedProductId) {
      setScheduleMessage('Save the item before setting a schedule.');
      return;
    }

    setSavingSchedule(true);
    try {
      if (activeScheduleId) {
        const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
          `/api/mobile/customer/food-schedules/${activeScheduleId}`,
          {
            method: 'PATCH',
            token: session.token,
            body: {
              timesOfDay: scheduleTimes,
              active: true,
              dogId,
            },
          },
        );
        setSchedules((prev) =>
          prev.map((item) => (item.id === data.schedule.id ? data.schedule : item)),
        );
        setScheduleMessage('Daily auto-log updated.');
      } else {
        const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
          '/api/mobile/customer/food-schedules',
          {
            method: 'POST',
            token: session.token,
            body: {
              productId: resolvedProductId,
              dogId,
              timesOfDay: scheduleTimes,
              active: true,
            },
          },
        );
        setSchedules((prev) => [data.schedule, ...prev]);
        setActiveScheduleId(data.schedule.id);
        setScheduleMessage('Daily auto-log enabled.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save the schedule.';
      setScheduleMessage(message);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleScan = async (mode: 'LABEL' | 'INGREDIENTS') => {
    if (!session?.token) return;
    const modeKey = mode === 'LABEL' ? 'label' : 'ingredients';
    if (scanLoading[modeKey]) return;
    if (foodScanLocked) {
      setScanError((prev) => ({
        ...(prev ?? {}),
        [modeKey]: 'Monthly food scan limit reached. Upgrade to continue.',
      }));
      return;
    }
    setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: null }));
    setSuccess(null);
    setError(null);
    setScanLoading((prev) => ({ ...prev, [modeKey]: true }));
    try {
      const result = await captureWithFallback({ kind: 'photo', source: 'camera' });
      if (!result) {
        setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: 'Scan cancelled.' }));
        return;
      }
      const asset: ScanAsset = {
        uri: result.uri,
        name: result.fileName ?? `food-scan-${Date.now()}.jpg`,
        type: result.mimeType ?? 'image/jpeg',
      };
      if (mode === 'LABEL') {
        setLabelAsset(asset);
      }
      const formData = new FormData();
      formData.append('image', asset as any);
      formData.append('mode', mode);

      const data = await apiUpload<{ scan: FoodScanResult }>(
        '/api/mobile/customer/food-log/scan',
        {
          token: session.token,
          body: formData,
        },
      );
      const scan = data.scan ?? {};
      const resolvedScanType = normalizeScanType(scan.type);
      if (mode === 'INGREDIENTS') {
        if (scan.ingredients) {
          setIngredients((prev) => (prev.trim() ? prev : scan.ingredients ?? prev));
        }
      } else {
        if (scan.brand) {
          setBrand((prev) => (prev.trim() ? prev : scan.brand ?? prev));
        }
        if (scan.productName) {
          setProductName((prev) => (prev.trim() ? prev : scan.productName ?? prev));
        }
        if (scan.ingredients) {
          setIngredients((prev) => (prev.trim() ? prev : scan.ingredients ?? prev));
        }
        if (resolvedScanType && !typeTouched && !isEditingProduct) {
          setType(resolvedScanType);
        }
      }
      setSuccess('Scan complete. Review and save.');
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              wellnessAccess: {
                ...prev.wellnessAccess,
                usage: {
                  ...prev.wellnessAccess.usage,
                  foodScansCount: prev.wellnessAccess.usage.foodScansCount + 1,
                },
              },
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to scan food.';
      setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: message }));
    } finally {
      setScanLoading((prev) => ({ ...prev, [modeKey]: false }));
    }
  };

  const inventoryListCard = (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Your inventory</Text>
        <Pressable
          onPress={handleStartAddItem}
          style={[styles.actionChip, { borderColor: palette.border }]}
        >
          <Text style={[styles.actionText, { color: palette.text }]}>Add item</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        <ChoiceChip
          label="All"
          selected={inventoryFilter === 'ALL'}
          onPress={() => setInventoryFilter('ALL')}
        />
        {TYPE_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.value}
            label={option.label}
            selected={inventoryFilter === option.value}
            onPress={() => setInventoryFilter(option.value)}
          />
        ))}
      </View>
      {filteredProducts.length === 0 ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          No inventory items yet. Tap “Add item” to get started.
        </Text>
      ) : (
        filteredProducts.map((product) => {
          const label = product.productName || product.brand || 'Saved item';
          const dogLabel = product.dogId ? dogNameMap.get(product.dogId) ?? 'Dog' : 'Household';
          return (
            <View key={product.id} style={styles.inventoryItem}>
              <Pressable
                style={styles.inventoryRow}
                onPress={() => handleSelectInventoryItem(product)}
              >
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.inventoryImage} />
                ) : (
                  <View style={[styles.inventoryImageFallback, { backgroundColor: palette.card }]}>
                    <FontAwesome name="cutlery" size={16} color={palette.muted} />
                  </View>
                )}
                <View style={styles.inventoryMeta}>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    {formatTypeLabel(product.type)} · {dogLabel}
                  </Text>
                  {product.portion ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Qty: {product.portion}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.inventoryActions}>
                <Pressable
                  style={[styles.actionChip, { borderColor: palette.border }]}
                  onPress={() => handleQuickLogProduct(product)}
                >
                  <Text style={[styles.actionText, { color: palette.text }]}>
                    {quickLogId === product.id ? 'Logging...' : 'Log now'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => {
                  handleSelectProduct(product);
                  setMode('LOG');
                }}>
                  <Text style={[styles.helperText, { color: palette.tint }]}>Log details</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteProduct(product)}
                  disabled={deletingProductId === product.id}
                >
                  <Text
                    style={[
                      styles.helperText,
                      {
                        color:
                          deletingProductId === product.id ? palette.muted : palette.danger,
                      },
                    ]}
                  >
                    {deletingProductId === product.id ? 'Deleting...' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
  const inventoryDetailTitle = inventoryEditorMode === 'edit' ? 'Item details' : 'Review and save';
  const inventoryDetailSubtitle =
    inventoryEditorMode === 'edit'
      ? 'Update details and save changes to your inventory.'
      : 'Confirm the details, then save to your inventory.';

  const inventoryView = (
    <>
      {inventoryListCard}
      {inventoryEditorOpen ? (
        <View
          onLayout={(event) => setInventoryEditorOffset(event.nativeEvent.layout.y)}
        >
          {inventoryEditorMode === 'add' ? (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Add a new item</Text>
                <Pressable onPress={closeInventoryEditor}>
                  <Text style={[styles.helperText, { color: palette.tint }]}>Hide</Text>
                </Pressable>
              </View>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Scan an item once, save it to inventory, then log it in seconds.
              </Text>

              <View style={styles.stepBlock}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: palette.tint }]}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepTitle, { color: palette.text }]}>Scan the item</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Front of the bag, bottle, or box to capture the name.
                    </Text>
                  </View>
                </View>
                <Button
                  title={
                    foodScanLocked
                      ? 'Upgrade to scan'
                      : scanLoading.label
                        ? 'Scanning...'
                        : 'Scan item'
                  }
                  onPress={() => handleScan('LABEL')}
                  variant="secondary"
                  style={styles.stepButton}
                  disabled={scanLoading.label || foodScanLocked}
                />
                {access?.tier === 'FREE' ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: foodScanLocked ? palette.danger : palette.muted },
                    ]}
                  >
                    {foodScansRemaining ?? 0} food scans left this month.
                  </Text>
                ) : null}
                {scanLoading.label ? (
                  <View style={styles.processingRow}>
                    <Animated.View
                      style={[styles.processingDot, pulseStyle, { backgroundColor: palette.tint }]}
                    />
                    <View>
                      <Text style={[styles.processingLabel, { color: palette.text }]}>
                        Analyzing item photo
                      </Text>
                      <Text style={[styles.processingDetail, { color: palette.muted }]}>
                        We will fill in the label details.
                      </Text>
                    </View>
                  </View>
                ) : null}
                {scanError?.label ? (
                  <Text style={[styles.helperText, { color: palette.danger }]}>{scanError.label}</Text>
                ) : null}
                {labelReady ? (
                  <View style={styles.statusRow}>
                    <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
                    <Text style={[styles.statusText, { color: palette.muted }]}>
                      Item details captured.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.stepBlock}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: palette.tint }]}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepTitle, { color: palette.text }]}>Scan ingredients</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Snap the ingredient panel to unlock insights.
                    </Text>
                  </View>
                </View>
                <Button
                  title={
                    foodScanLocked
                      ? 'Upgrade to scan'
                      : scanLoading.ingredients
                        ? 'Scanning...'
                        : 'Scan ingredients'
                  }
                  onPress={() => handleScan('INGREDIENTS')}
                  variant="secondary"
                  style={styles.stepButton}
                  disabled={scanLoading.ingredients || foodScanLocked}
                />
                {scanLoading.ingredients ? (
                  <View style={styles.processingRow}>
                    <Animated.View
                      style={[styles.processingDot, pulseStyle, { backgroundColor: Colors.brand.mint }]}
                    />
                    <View>
                      <Text style={[styles.processingLabel, { color: palette.text }]}>
                        Reading ingredient list
                      </Text>
                      <Text style={[styles.processingDetail, { color: palette.muted }]}>
                        This powers the wellness score.
                      </Text>
                    </View>
                  </View>
                ) : null}
                {scanError?.ingredients ? (
                  <Text style={[styles.helperText, { color: palette.danger }]}>
                    {scanError.ingredients}
                  </Text>
                ) : null}
                {ingredientsReady ? (
                  <View style={styles.statusRow}>
                    <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
                    <Text style={[styles.statusText, { color: palette.muted }]}>
                      Ingredients captured.
                    </Text>
                  </View>
                ) : null}
              </View>

              {scanInProgress ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  You can scan in any order. We will not overwrite manual edits.
                </Text>
              ) : null}
            </View>
            ) : null}

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {inventoryDetailTitle}
              </Text>
              {inventoryEditorMode !== 'add' ? (
                <Pressable onPress={closeInventoryEditor}>
                  <Text style={[styles.helperText, { color: palette.tint }]}>Hide</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              {inventoryDetailSubtitle}
            </Text>

        {selectedProduct ? (
          <View style={styles.selectedRow}>
            <View style={styles.selectedMeta}>
              <Text style={[styles.helperText, { color: palette.muted }]}>Selected item</Text>
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                {selectedProductLabel}
              </Text>
            </View>
            <View style={styles.selectedActions}>
              <Pressable onPress={handleClearProduct}>
                <Text style={[styles.helperText, { color: palette.tint }]}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDeleteProduct(selectedProduct)}
                disabled={deletingProductId === selectedProduct.id}
              >
                <Text
                  style={[
                    styles.helperText,
                    { color: deletingProductId === selectedProduct.id ? palette.muted : palette.danger },
                  ]}
                >
                  {deletingProductId === selectedProduct.id ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.value}
              label={option.label}
              selected={type === option.value}
              onPress={() => {
                setType(option.value);
                setTypeTouched(true);
              }}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog (optional)</Text>
        <View style={styles.chipRow}>
          <ChoiceChip
            label="Household"
            selected={!dogId}
            onPress={() => setDogId(null)}
            disabled={multiDogLocked}
          />
          {dogs.map((dog) => (
            <ChoiceChip
              key={dog.id}
              label={dog.name}
              selected={dogId === dog.id}
              onPress={() => setDogId(dog.id)}
              disabled={multiDogLocked}
            />
          ))}
        </View>

        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          placeholder={placeholders.brand}
          placeholderTextColor={palette.muted}
          value={brand}
          onChangeText={setBrand}
        />
        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          placeholder={placeholders.productName}
          placeholderTextColor={palette.muted}
          value={productName}
          onChangeText={setProductName}
        />
        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          placeholder={placeholders.portion}
          placeholderTextColor={palette.muted}
          value={portion}
          onChangeText={setPortion}
        />
        <TextInput
          style={[styles.input, styles.textArea, { borderColor: palette.border, color: palette.text }]}
          placeholder={placeholders.ingredients}
          placeholderTextColor={palette.muted}
          value={ingredients}
          onChangeText={setIngredients}
          multiline
        />

        <View style={[styles.insightCard, { borderColor: scoreTone, backgroundColor: palette.background }]}>
          <View style={styles.insightHeader}>
            <View style={styles.insightHeaderCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                Ingredient wellness score
              </Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                {ingredientInsights.scoreSummary}
              </Text>
            </View>
            {scoreMeter}
          </View>
          <View style={[styles.scoreTrack, { backgroundColor: palette.border }]}>
            <View style={[styles.scoreFill, { width: scoreWidth, backgroundColor: scoreTone }]} />
          </View>
          <Text style={[styles.scoreLabel, { color: palette.muted }]}>
            {ingredientInsights.scoreLabel}
          </Text>

          {ingredientInsights.allergens.length > 0 ? (
            <View style={styles.insightSection}>
              <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                Potential allergens
              </Text>
              <View style={styles.tagRow}>
                {ingredientInsights.allergens.map((item) => (
                  <View
                    key={item}
                    style={[styles.tag, { backgroundColor: `${Colors.brand.gold}22`, borderColor: Colors.brand.gold }]}
                  >
                    <Text style={[styles.tagText, { color: Colors.brand.gold }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {ingredientInsights.concerns.length > 0 ? (
            <View style={styles.insightSection}>
              <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                Ingredients to watch
              </Text>
              {ingredientInsights.concerns.map((item) => {
                const tone =
                  item.severity === 'high'
                    ? palette.danger
                    : item.severity === 'medium'
                      ? Colors.brand.gold
                      : palette.tint;
                return (
                  <View key={item.label} style={styles.insightRow}>
                    <View style={[styles.insightDot, { backgroundColor: tone }]} />
                    <View style={styles.insightCopy}>
                      <Text style={[styles.insightLabel, { color: palette.text }]}>
                        {item.label}
                      </Text>
                      <View style={styles.tagRow}>
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: `${tone}22`, borderColor: tone },
                          ]}
                        >
                          <Text style={[styles.tagText, { color: tone }]}>{item.match}</Text>
                        </View>
                      </View>
                      <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {ingredientInsights.benefits.length > 0 ? (
            <View style={styles.insightSection}>
              <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                Good signs
              </Text>
              {ingredientInsights.benefits.map((item) => (
                <View key={item.label} style={styles.insightRow}>
                  <View style={[styles.insightDot, { backgroundColor: Colors.brand.mint }]} />
                  <View style={styles.insightCopy}>
                    <Text style={[styles.insightLabel, { color: palette.text }]}>
                      {item.label}
                    </Text>
                    <View style={styles.tagRow}>
                      <View
                        style={[
                          styles.tag,
                          {
                            backgroundColor: `${Colors.brand.mint}22`,
                            borderColor: Colors.brand.mint,
                          },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: Colors.brand.mint }]}>
                          {item.match}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          placeholder={placeholders.notes}
          placeholderTextColor={palette.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <View style={styles.inlineRow}>
          <Button
            title={
              inventoryLocked && !selectedProduct
                ? 'Upgrade to add'
                : savingProduct
                  ? 'Saving...'
                  : selectedProduct
                    ? 'Save changes'
                    : 'Save to inventory'
            }
            onPress={handleSaveProduct}
            variant="ghost"
            disabled={inventorySaveDisabled}
          />
          {labelAsset ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Uses your last photo.
            </Text>
          ) : null}
        </View>
        {productMessage ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>{productMessage}</Text>
        ) : null}
        {access?.tier === 'FREE' ? (
          <Text
            style={[
              styles.helperText,
              { color: inventoryLocked ? palette.danger : palette.muted },
            ]}
          >
            {inventoryRemaining ?? 0} inventory adds left this month.
          </Text>
        ) : null}
        <Pressable onPress={() => setMode('LOG')}>
          <Text style={[styles.helperText, { color: palette.tint }]}>Log this item now</Text>
        </Pressable>
      </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleMeta}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Auto-log schedule</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Great for daily meals or medication reminders.
                </Text>
              </View>
              <Switch
                value={scheduleEnabled}
                onValueChange={setScheduleEnabled}
                disabled={!productId && !productName.trim() && !brand.trim()}
              />
            </View>
            {selectedProduct ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Item: {selectedProductLabel}
              </Text>
            ) : (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Save an inventory item to enable auto-logs.
              </Text>
            )}
            {scheduleEnabled ? (
              <>
                <Text style={[styles.fieldLabel, { color: palette.muted }]}>Times</Text>
                <View style={styles.chipRow}>
                  {scheduleTimes.length === 0 ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Add a time below.
                    </Text>
                  ) : (
                    scheduleTimes.map((time) => (
                      <Pressable
                        key={time}
                        onPress={() => handleRemoveTime(time)}
                        style={[styles.timeChip, { borderColor: palette.border }]}
                      >
                        <Text style={[styles.timeChipText, { color: palette.text }]}>
                          {formatTimeLabel(time)} x
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
                <Text style={[styles.fieldLabel, { color: palette.muted }]}>Quick add</Text>
                <View style={styles.chipRow}>
                  {QUICK_TIME_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleAddQuickTime(option.value)}
                      style={[styles.timeChip, { borderColor: palette.border }]}
                    >
                      <Text style={[styles.timeChipText, { color: palette.text }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.customTimeRow}>
                  <TextInput
                    style={[styles.input, styles.timeInput, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Add time (e.g., 7:00 AM)"
                    placeholderTextColor={palette.muted}
                    value={scheduleInput}
                    onChangeText={setScheduleInput}
                  />
                  <Pressable
                    style={[styles.addTimeButton, { borderColor: palette.border }]}
                    onPress={handleAddCustomTime}
                  >
                    <Text style={[styles.addTimeLabel, { color: palette.text }]}>Add</Text>
                  </Pressable>
                </View>
                {scheduleMessage ? (
                  <Text style={[styles.helperText, { color: palette.muted }]}>{scheduleMessage}</Text>
                ) : null}
                <Button
                  title={
                    savingSchedule
                      ? 'Saving...'
                      : scheduleEnabled
                        ? activeScheduleId
                          ? 'Update auto-log'
                          : 'Enable auto-log'
                        : activeScheduleId
                          ? 'Pause auto-log'
                          : 'Enable auto-log'
                  }
                  onPress={handleSaveSchedule}
                  disabled={savingSchedule}
                />
              </>
            ) : activeScheduleId ? (
              scheduleIsActive ? (
                <>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Turn it off to pause this schedule.
                  </Text>
                  {scheduleMessage ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>{scheduleMessage}</Text>
                  ) : null}
                  <Button
                    title={savingSchedule ? 'Saving...' : 'Pause auto-log'}
                    onPress={handleSaveSchedule}
                    disabled={savingSchedule}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    Schedule paused. Turn it on to resume.
                  </Text>
                  {scheduleMessage ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>{scheduleMessage}</Text>
                  ) : null}
                  <Button title="Resume auto-log" onPress={() => setScheduleEnabled(true)} />
                </>
              )
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Select an item above to view details, or tap “Add item” to scan a new one.
          </Text>
        </View>
      )}
    </>
  );

  const manualFieldsVisible = manualEntryOpen && !multiSelect;
  const manualToggleLabel = manualFieldsVisible
    ? 'Hide manual details'
    : selectedProduct || selectedProductIds.length
      ? 'Add manual details'
      : 'Log without inventory item';
  const hasInventoryItems = products.length > 0;

  const logView = (
    <>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick check (no log)</Text>
          <Pressable onPress={handleClearProduct}>
            <Text style={[styles.helperText, { color: palette.tint }]}>Clear</Text>
          </Pressable>
        </View>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Scan a label to preview the wellness score before you buy. Save it to inventory if it is a keeper.
        </Text>
        <View style={styles.quickActionRow}>
          <Button
            title={
              foodScanLocked
                ? 'Upgrade to scan'
                : scanLoading.label
                  ? 'Scanning...'
                  : 'Scan item'
            }
            onPress={() => handleScan('LABEL')}
            variant="secondary"
            disabled={scanLoading.label || foodScanLocked}
            style={styles.quickActionButton}
            labelStyle={styles.quickActionLabel}
          />
          <Button
            title={
              foodScanLocked
                ? 'Upgrade to scan'
                : scanLoading.ingredients
                  ? 'Scanning...'
                  : 'Scan ingredients'
            }
            onPress={() => handleScan('INGREDIENTS')}
            variant="secondary"
            disabled={scanLoading.ingredients || foodScanLocked}
            style={styles.quickActionButton}
            labelStyle={styles.quickActionLabel}
          />
        </View>
        {access?.tier === 'FREE' ? (
          <Text
            style={[
              styles.helperText,
              { color: foodScanLocked ? palette.danger : palette.muted },
            ]}
          >
            {foodScansRemaining ?? 0} food scans left this month.
          </Text>
        ) : null}
        {scanLoading.label ? (
          <View style={styles.processingRow}>
            <Animated.View
              style={[styles.processingDot, pulseStyle, { backgroundColor: palette.tint }]}
            />
            <View>
              <Text style={[styles.processingLabel, { color: palette.text }]}>
                Analyzing item photo
              </Text>
              <Text style={[styles.processingDetail, { color: palette.muted }]}>
                We will fill in the label details.
              </Text>
            </View>
          </View>
        ) : null}
        {scanLoading.ingredients ? (
          <View style={styles.processingRow}>
            <Animated.View
              style={[styles.processingDot, pulseStyle, { backgroundColor: Colors.brand.mint }]}
            />
            <View>
              <Text style={[styles.processingLabel, { color: palette.text }]}>
                Reading ingredient list
              </Text>
              <Text style={[styles.processingDetail, { color: palette.muted }]}>
                This powers the wellness score.
              </Text>
            </View>
          </View>
        ) : null}
        {scanError?.label ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{scanError.label}</Text>
        ) : null}
        {scanError?.ingredients ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>
            {scanError.ingredients}
          </Text>
        ) : null}

        {ingredientsReady ? (
          <View style={[styles.insightCard, { borderColor: scoreTone, backgroundColor: palette.background }]}>
            <View style={styles.insightHeader}>
              <View style={styles.insightHeaderCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  Ingredient wellness score
                </Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  {ingredientInsights.scoreSummary}
                </Text>
              </View>
              {scoreMeter}
            </View>
            <View style={[styles.scoreTrack, { backgroundColor: palette.border }]}>
              <View style={[styles.scoreFill, { width: scoreWidth, backgroundColor: scoreTone }]} />
            </View>
            <Text style={[styles.scoreLabel, { color: palette.muted }]}>
              {ingredientInsights.scoreLabel}
            </Text>

            {ingredientInsights.allergens.length > 0 ? (
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                  Potential allergens
                </Text>
                <View style={styles.tagRow}>
                  {ingredientInsights.allergens.map((item) => (
                    <View
                      key={item}
                      style={[styles.tag, { backgroundColor: `${Colors.brand.gold}22`, borderColor: Colors.brand.gold }]}
                    >
                      <Text style={[styles.tagText, { color: Colors.brand.gold }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {ingredientInsights.concerns.length > 0 ? (
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                  Ingredients to watch
                </Text>
                {ingredientInsights.concerns.map((item) => {
                  const tone =
                    item.severity === 'high'
                      ? palette.danger
                      : item.severity === 'medium'
                        ? Colors.brand.gold
                        : palette.tint;
                  return (
                    <View key={item.label} style={styles.insightRow}>
                      <View style={[styles.insightDot, { backgroundColor: tone }]} />
                      <View style={styles.insightCopy}>
                        <Text style={[styles.insightLabel, { color: palette.text }]}>
                          {item.label}
                        </Text>
                        <View style={styles.tagRow}>
                          <View style={[styles.tag, { backgroundColor: `${tone}22`, borderColor: tone }]}>
                            <Text style={[styles.tagText, { color: tone }]}>{item.match}</Text>
                          </View>
                        </View>
                        <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {ingredientInsights.benefits.length > 0 ? (
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                  Good signs
                </Text>
                {ingredientInsights.benefits.map((item) => (
                  <View key={item.label} style={styles.insightRow}>
                    <View style={[styles.insightDot, { backgroundColor: Colors.brand.mint }]} />
                    <View style={styles.insightCopy}>
                      <Text style={[styles.insightLabel, { color: palette.text }]}>
                        {item.label}
                      </Text>
                      <View style={styles.tagRow}>
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: `${Colors.brand.mint}22`, borderColor: Colors.brand.mint },
                          ]}
                        >
                          <Text style={[styles.tagText, { color: Colors.brand.mint }]}>{item.match}</Text>
                        </View>
                      </View>
                      <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Scan ingredients to see the wellness score.
          </Text>
        )}

        <View style={styles.inlineRow}>
          <Button
            title={savingProduct ? 'Saving...' : 'Save to inventory'}
            onPress={handleSaveProduct}
            variant="ghost"
            disabled={savingProduct}
          />
          <Pressable onPress={() => setMode('INVENTORY')}>
            <Text style={[styles.helperText, { color: palette.tint }]}>Manage inventory</Text>
          </Pressable>
        </View>
        {productMessage ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>{productMessage}</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Log a meal or medication</Text>
          <Pressable onPress={() => setMode('INVENTORY')}>
            <Text style={[styles.helperText, { color: palette.tint }]}>Inventory</Text>
          </Pressable>
        </View>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Pick items, add details, then log in seconds.
        </Text>

        <View style={styles.stepBlock}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: palette.tint }]}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={[styles.stepTitle, { color: palette.text }]}>Pick items</Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Choose from inventory, or add a new item.
              </Text>
            </View>
          </View>

          {selectedProduct && !multiSelect ? (
            <View style={styles.selectedRow}>
              <View style={styles.selectedMeta}>
                <Text style={[styles.helperText, { color: palette.muted }]}>Selected item</Text>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {selectedProductLabel}
                </Text>
              </View>
              <Pressable onPress={handleClearProduct}>
                <Text style={[styles.helperText, { color: palette.tint }]}>Clear</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.multiSelectRow}>
            <View style={styles.multiSelectCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Log multiple items</Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Add meals + meds together.
              </Text>
            </View>
            <Switch
              value={multiSelect}
              onValueChange={(value) => {
                setMultiSelect(value);
                if (value) {
                  setManualEntryOpen(false);
                }
              }}
            />
          </View>
          {multiSelect ? (
            <View style={styles.multiSelectMeta}>
              <Text style={[styles.helperText, { color: palette.muted }]}>Selected {selectedProductIds.length}</Text>
              {selectedProductIds.length ? (
                <Pressable onPress={() => setSelectedProductIds([])}>
                  <Text style={[styles.helperText, { color: palette.tint }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.chipRow}>
            <ChoiceChip
              label="All"
              selected={inventoryFilter === 'ALL'}
              onPress={() => setInventoryFilter('ALL')}
            />
            {TYPE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={inventoryFilter === option.value}
                onPress={() => setInventoryFilter(option.value)}
              />
            ))}
          </View>

          {filteredProducts.length === 0 ? (
            <View style={[styles.alertBox, { borderColor: palette.border }]}>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                {hasInventoryItems
                  ? 'No items in this filter yet. Switch filters or add a new item.'
                  : 'No inventory items yet. Add one or log without inventory.'}
              </Text>
              <View style={styles.inlineRow}>
                <Button
                  title="Add item"
                  variant="secondary"
                  onPress={() => {
                    setMode('INVENTORY');
                    handleStartAddItem();
                  }}
                />
                <Pressable
                  onPress={() => {
                    if (selectedProduct || selectedProductIds.length) {
                      handleClearProduct();
                      setSelectedProductIds([]);
                    }
                    setMultiSelect(false);
                    setManualEntryOpen(true);
                  }}
                >
                  <Text style={[styles.helperText, { color: palette.tint }]}>Log without inventory</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
              {filteredProducts.map((product) => {
                const isSelected = multiSelect
                  ? selectedProductIds.includes(product.id)
                  : product.id === productId;
                const label = product.productName || product.brand || 'Saved item';
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => handleSelectProduct(product)}
                    style={[
                      styles.quickCard,
                      {
                        borderColor: isSelected ? palette.tint : palette.border,
                        backgroundColor: isSelected && multiSelect ? `${palette.tint}15` : palette.background,
                      },
                    ]}
                  >
                    {multiSelect && isSelected ? (
                      <View style={[styles.selectedBadge, { backgroundColor: palette.tint }]}>
                        <FontAwesome name="check" size={12} color="#fff" />
                      </View>
                    ) : null}
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.quickImage} />
                    ) : (
                      <View style={[styles.quickImageFallback, { backgroundColor: palette.card }]}>
                        <FontAwesome name="cutlery" size={18} color={palette.muted} />
                      </View>
                    )}
                    <Text style={[styles.quickTitle, { color: palette.text }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={[styles.quickSubtitle, { color: palette.muted }]} numberOfLines={1}>
                      {formatTypeLabel(product.type)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.stepDivider} />

        <View style={styles.stepBlock}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: Colors.brand.mint }]}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={[styles.stepTitle, { color: palette.text }]}>Details (optional)</Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>Dog, timing, qty, notes.</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog (optional)</Text>
          <View style={styles.chipRow}>
            <ChoiceChip
              label="Household"
              selected={!dogId}
              onPress={() => setDogId(null)}
              disabled={multiDogLocked}
            />
            {dogs.map((dog) => (
              <ChoiceChip
                key={dog.id}
                label={dog.name}
                selected={dogId === dog.id}
                onPress={() => setDogId(dog.id)}
                disabled={multiDogLocked}
              />
            ))}
          </View>

          <Pressable style={styles.dateHeaderRow} onPress={() => setCalendarOpen((prev) => !prev)}>
            <Text style={[styles.dateToggle, { color: palette.tint }]}>
              {calendarOpen ? 'Hide log time' : 'Edit log time'}
            </Text>
          </Pressable>

          {calendarOpen ? (
            <>
              <Text style={[styles.dateValue, { color: palette.text }]}>
                {formatLogTimestamp(loggedAt, true)}
              </Text>
              <View style={styles.calendarHeaderRow}>
                <Pressable
                  onPress={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
                    )
                  }
                >
                  <Text style={[styles.calendarNav, { color: palette.tint }]}>Prev</Text>
                </Pressable>
                <Text style={[styles.calendarTitle, { color: palette.text }]}>
                  {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <Pressable
                  onPress={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
                    )
                  }
                >
                  <Text style={[styles.calendarNav, { color: palette.tint }]}>Next</Text>
                </Pressable>
              </View>
              <View style={styles.calendarHeader}>
                {DAY_LABELS.map((label) => (
                  <Text key={label} style={[styles.calendarLabel, { color: palette.muted }]}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {calendarDays.map((date) => {
                  const key = toDateKey(date);
                  const isSelected = selectedKey === key;
                  const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                  const isToday = key === todayKey;
                  const pickDate = new Date(date);
                  pickDate.setHours(loggedAt.getHours(), loggedAt.getMinutes(), 0, 0);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setLoggedAt(pickDate);
                        if (date.getMonth() !== calendarMonth.getMonth()) {
                          setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                        }
                      }}
                      style={[
                        styles.calendarCell,
                        {
                          borderColor: isSelected
                            ? palette.tint
                            : isToday
                              ? palette.accent
                              : palette.border,
                          backgroundColor: isSelected ? palette.tint : palette.background,
                          opacity: isCurrentMonth ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Text style={{ color: isSelected ? '#FFFFFF' : palette.text, fontWeight: '600' }}>
                        {date.getDate()}
                      </Text>
                      {isToday ? (
                        <View style={[styles.todayDot, { backgroundColor: palette.accent }]} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <TextInput
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            placeholder={placeholders.portion}
            placeholderTextColor={palette.muted}
            value={portion}
            onChangeText={setPortion}
          />
          <TextInput
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            placeholder={placeholders.notes}
            placeholderTextColor={palette.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {!multiSelect ? (
            <Pressable
              style={styles.manualToggle}
              onPress={() => {
                if (manualEntryOpen) {
                  setManualEntryOpen(false);
                  return;
                }
                if (selectedProduct || selectedProductIds.length) {
                  handleClearProduct();
                  setSelectedProductIds([]);
                }
                setMultiSelect(false);
                setManualEntryOpen(true);
              }}
            >
              <Text style={[styles.helperText, { color: palette.tint }]}>
                {manualToggleLabel}
              </Text>
            </Pressable>
          ) : null}

          {manualFieldsVisible ? (
            <>
              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Type</Text>
              <View style={styles.chipRow}>
                {TYPE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={type === option.value}
                    onPress={() => {
                      setType(option.value);
                      setTypeTouched(true);
                    }}
                  />
                ))}
              </View>

              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder={placeholders.brand}
                placeholderTextColor={palette.muted}
                value={brand}
                onChangeText={setBrand}
              />
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder={placeholders.productName}
                placeholderTextColor={palette.muted}
                value={productName}
                onChangeText={setProductName}
              />
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: palette.border, color: palette.text }]}
                placeholder={placeholders.ingredients}
                placeholderTextColor={palette.muted}
                value={ingredients}
                onChangeText={setIngredients}
                multiline
              />
              <View style={[styles.insightCard, { borderColor: scoreTone, backgroundColor: palette.background }]}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightHeaderCopy}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>Ingredient wellness score</Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      {ingredientInsights.scoreSummary}
                    </Text>
                  </View>
                  {scoreMeter}
                </View>
                <View style={[styles.scoreTrack, { backgroundColor: palette.border }]}
                >
                  <View style={[styles.scoreFill, { width: scoreWidth, backgroundColor: scoreTone }]} />
                </View>
                <Text style={[styles.scoreLabel, { color: palette.muted }]}>
                  {ingredientInsights.scoreLabel}
                </Text>

                {ingredientInsights.allergens.length > 0 ? (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                      Potential allergens
                    </Text>
                    <View style={styles.tagRow}>
                      {ingredientInsights.allergens.map((item) => (
                        <View
                          key={item}
                          style={[styles.tag, { backgroundColor: `${Colors.brand.gold}22`, borderColor: Colors.brand.gold }]}
                        >
                          <Text style={[styles.tagText, { color: Colors.brand.gold }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {ingredientInsights.concerns.length > 0 ? (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                      Ingredients to watch
                    </Text>
                    {ingredientInsights.concerns.map((item) => {
                      const tone =
                        item.severity === 'high'
                          ? palette.danger
                          : item.severity === 'medium'
                            ? Colors.brand.gold
                            : palette.tint;
                      return (
                        <View key={item.label} style={styles.insightRow}>
                          <View style={[styles.insightDot, { backgroundColor: tone }]} />
                          <View style={styles.insightCopy}>
                            <Text style={[styles.insightLabel, { color: palette.text }]}>
                              {item.label}
                            </Text>
                            <View style={styles.tagRow}>
                              <View style={[styles.tag, { backgroundColor: `${tone}22`, borderColor: tone }]}
                              >
                                <Text style={[styles.tagText, { color: tone }]}>{item.match}</Text>
                              </View>
                            </View>
                            <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {ingredientInsights.benefits.length > 0 ? (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightSectionTitle, { color: palette.text }]}>Good signs</Text>
                    {ingredientInsights.benefits.map((item) => (
                      <View key={item.label} style={styles.insightRow}>
                        <View style={[styles.insightDot, { backgroundColor: Colors.brand.mint }]} />
                        <View style={styles.insightCopy}>
                          <Text style={[styles.insightLabel, { color: palette.text }]}>
                            {item.label}
                          </Text>
                          <View style={styles.tagRow}>
                            <View
                              style={[
                                styles.tag,
                                { backgroundColor: `${Colors.brand.mint}22`, borderColor: Colors.brand.mint },
                              ]}
                            >
                              <Text style={[styles.tagText, { color: Colors.brand.mint }]}>{item.match}</Text>
                            </View>
                          </View>
                          <Text style={[styles.helperText, { color: palette.muted }]}>{item.note}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </View>

        {error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        <View style={styles.quickActionRow}>
          <Button
            title={quickLogTitle}
            onPress={() =>
              multiSelect
                ? handleMultiLogNow()
                : handleSubmit({ loggedAt: new Date(), keepSelection: true })
            }
            disabled={!canQuickLog || saving}
          />
          <Button
            title="Add item"
            onPress={() => {
              setMode('INVENTORY');
              handleStartAddItem();
            }}
            variant="secondary"
            style={styles.quickActionButton}
          />
        </View>
        {!canQuickLog ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Pick an item or add a name to log.
          </Text>
        ) : null}
        {success ? (
          <Text style={[styles.helperText, { color: Colors.brand.mint }]}>{success}</Text>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent entries</Text>
        <Pressable
          onPress={() => {
            setFilterDogId(null);
            setLogFilterType('ALL');
          }}
        >
          <Text style={[styles.helperText, { color: palette.tint }]}>Clear filters</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        <ChoiceChip
          label="All dogs"
          selected={!filterDogId}
          onPress={() => setFilterDogId(null)}
        />
        {dogs.map((dog) => (
          <ChoiceChip
            key={dog.id}
            label={dog.name}
            selected={filterDogId === dog.id}
            onPress={() => setFilterDogId(dog.id)}
          />
        ))}
      </View>
      <View style={styles.chipRow}>
        <ChoiceChip
          label="All types"
          selected={logFilterType === 'ALL'}
          onPress={() => setLogFilterType('ALL')}
        />
        {TYPE_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.value}
            label={option.label}
            selected={logFilterType === option.value}
            onPress={() => setLogFilterType(option.value)}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.inlineRow}>
          <ActivityIndicator size="small" color={palette.tint} />
          <Text style={[styles.helperText, { color: palette.muted }]}>Loading logs...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            No entries yet. Log a meal, treat, supplement, or medication.
          </Text>
        </View>
      ) : (
        filteredLogs.map((log) => (
          <Pressable
            key={log.id}
            onPress={() => setSelectedLog(log)}
            style={[styles.logCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.logHeader}>
              <View style={styles.logHeaderMeta}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {log.productName || log.brand || formatTypeLabel(log.type)}
                </Text>
                <Text style={[styles.helperText, { color: palette.muted }]} numberOfLines={1}>
                  {formatTypeLabel(log.type)} · {log.dogName ?? 'Household'}
                </Text>
              </View>
              <Text style={[styles.helperText, styles.logDate, { color: palette.muted }]}>
                {formatLogTimestamp(log.loggedAt)}
              </Text>
            </View>
            {log.allergenMatches.length > 0 ? (
              <View style={styles.inlineRow}>
                <FontAwesome name="exclamation-triangle" size={12} color={Colors.brand.gold} />
                <Text style={[styles.helperText, { color: palette.muted }]}>Allergens: {log.allergenMatches.join(', ')}</Text>
              </View>
            ) : null}
            {log.portion ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>Qty: {log.portion}</Text>
            ) : null}
            {log.notes ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>{log.notes}</Text>
            ) : null}
            <View style={styles.logFooter}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  handleDeleteLog(log);
                }}
                disabled={deletingId === log.id}
              >
                <Text
                  style={[
                    styles.deleteText,
                    { color: deletingId === log.id ? palette.muted : palette.danger },
                  ]}
                >
                  {deletingId === log.id ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}
    </>
  );


  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Food & meds log</Text>
          <Text style={[styles.title, { color: palette.text }]}>Meal + medication tracker</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Save items to inventory or log a meal in a few taps.
          </Text>
        </View>

        {multiDogLocked ? (
          <View style={[styles.callout, { backgroundColor: palette.card, borderColor: Colors.brand.gold }]}>
            <Text style={[styles.calloutText, { color: palette.text }]}>
              Premium unlocks per-dog food logs. Household-only for now.
            </Text>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((option) => {
            const selected = mode === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setMode(option.key)}
                style={[
                  styles.modeCard,
                  {
                    borderColor: selected ? palette.tint : palette.border,
                    backgroundColor: selected ? palette.background : palette.card,
                  },
                ]}
              >
                <Text style={[styles.modeTitle, { color: palette.text }]}>{option.title}</Text>
                <Text style={[styles.modeCaption, { color: palette.muted }]}>{option.caption}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'INVENTORY' ? inventoryView : logView}
      </ScrollView>

      <Modal
        visible={Boolean(selectedLog)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedLog(null)} />
          <View
            style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Log details</Text>
                <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
                  Wellness breakdown
                </Text>
              </View>
              <Pressable onPress={() => setSelectedLog(null)}>
                <FontAwesome name="times" size={16} color={palette.muted} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
            >
              {selectedLog ? (
                <>
                  <View
                    style={[
                      styles.detailHero,
                      { backgroundColor: palette.background, borderColor: palette.border },
                    ]}
                  >
                    <View style={styles.detailHeroMeta}>
                      <Text style={[styles.detailTitle, { color: palette.text }]}>
                        {selectedLog.productName ||
                          selectedLog.brand ||
                          formatTypeLabel(selectedLog.type)}
                      </Text>
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        {formatTypeLabel(selectedLog.type)} · {selectedLog.dogName ?? 'Household'}
                      </Text>
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        {formatLogTimestamp(selectedLog.loggedAt, true)}
                      </Text>
                    </View>
                    <View style={styles.detailHeroScore}>
                      <Text style={[styles.detailScoreLabel, { color: palette.muted }]}>
                        Wellness score
                      </Text>
                      <Text style={[styles.detailScoreValue, { color: logScoreTone }]}>
                        {logScoreDisplay}
                      </Text>
                      <Text style={[styles.detailScoreCaption, { color: palette.muted }]}>
                        {selectedLogInsights.scoreLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailBlock}>
                    <Text style={[styles.detailLabel, { color: palette.muted }]}>Details</Text>
                    {selectedLog.portion ? (
                      <Text style={[styles.detailValue, { color: palette.text }]}>
                        Qty: {selectedLog.portion}
                      </Text>
                    ) : null}
                    {selectedLog.notes ? (
                      <Text style={[styles.detailValue, { color: palette.text }]}>
                        Notes: {selectedLog.notes}
                      </Text>
                    ) : null}
                    {!selectedLog.portion && !selectedLog.notes ? (
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        No extra notes added.
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.detailBlock}>
                    <Text style={[styles.detailLabel, { color: palette.muted }]}>Ingredients</Text>
                    {selectedLog.ingredients ? (
                      <View style={[styles.ingredientsBox, { borderColor: palette.border }]}>
                        <Text style={[styles.detailValue, { color: palette.text }]}>
                          {selectedLog.ingredients}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        No ingredient details yet.
                      </Text>
                    )}
                  </View>
                  <View style={styles.detailBlock}>
                    <View
                      style={[
                        styles.insightCard,
                        { borderColor: logScoreTone, backgroundColor: palette.background },
                      ]}
                    >
                      <View style={styles.insightHeader}>
                        <View style={styles.insightHeaderCopy}>
                          <Text style={[styles.cardTitle, { color: palette.text }]}>
                            Wellness score
                          </Text>
                          <Text style={[styles.helperText, { color: palette.muted }]}>
                            {selectedLogInsights.scoreSummary}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.scoreTrack, { backgroundColor: palette.border }]}>
                        <View
                          style={[
                            styles.scoreFill,
                            { width: logScoreWidth, backgroundColor: logScoreTone },
                          ]}
                        />
                      </View>
                      <Text style={[styles.scoreLabel, { color: palette.muted }]}>
                        {selectedLogInsights.scoreLabel}
                      </Text>

                      {selectedLogInsights.allergens.length > 0 ? (
                        <View style={styles.insightSection}>
                          <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                            Potential allergens
                          </Text>
                          <View style={styles.tagRow}>
                            {selectedLogInsights.allergens.map((item) => (
                              <View
                                key={item}
                                style={[
                                  styles.tag,
                                  { backgroundColor: `${Colors.brand.gold}22`, borderColor: Colors.brand.gold },
                                ]}
                              >
                                <Text style={[styles.tagText, { color: Colors.brand.gold }]}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {selectedLogInsights.concerns.length > 0 ? (
                        <View style={styles.insightSection}>
                          <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                            Ingredients to watch
                          </Text>
                          {selectedLogInsights.concerns.map((item) => {
                            const tone =
                            item.severity === 'high'
                              ? palette.danger
                              : item.severity === 'medium'
                                ? Colors.brand.gold
                                : palette.tint;
                            return (
                              <View key={item.label} style={styles.insightRow}>
                                <View style={[styles.insightDot, { backgroundColor: tone }]} />
                                <View style={styles.insightCopy}>
                                  <Text style={[styles.insightLabel, { color: palette.text }]}>
                                    {item.label}
                                  </Text>
                                  <View style={styles.tagRow}>
                                    <View
                                      style={[
                                        styles.tag,
                                        { backgroundColor: `${tone}22`, borderColor: tone },
                                      ]}
                                    >
                                      <Text style={[styles.tagText, { color: tone }]}>{item.match}</Text>
                                    </View>
                                  </View>
                                  <Text style={[styles.helperText, { color: palette.muted }]}>
                                    {item.note}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {selectedLogInsights.benefits.length > 0 ? (
                        <View style={styles.insightSection}>
                          <Text style={[styles.insightSectionTitle, { color: palette.text }]}>
                            Nutritional highlights
                          </Text>
                          {selectedLogInsights.benefits.map((item) => (
                            <View key={item.label} style={styles.insightRow}>
                              <View
                                style={[styles.insightDot, { backgroundColor: Colors.brand.mint }]}
                              />
                              <View style={styles.insightCopy}>
                                <Text style={[styles.insightLabel, { color: palette.text }]}>
                                  {item.label}
                                </Text>
                                <View style={styles.tagRow}>
                                  <View
                                    style={[
                                      styles.tag,
                                      {
                                        backgroundColor: `${Colors.brand.mint}22`,
                                        borderColor: Colors.brand.mint,
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.tagText, { color: Colors.brand.mint }]}>
                                      {item.match}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.helperText, { color: palette.muted }]}>
                                  {item.note}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  callout: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  calloutText: {
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeCaption: {
    fontSize: 12,
  },
  stepBlock: {
    gap: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    opacity: 0.6,
  },
  stepButton: {
    alignSelf: 'stretch',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  processingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  processingDetail: {
    fontSize: 11,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  insightCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  insightHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  scoreMeter: {
    width: SCORE_METER_SIZE,
    height: SCORE_METER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scoreRing: {
    width: SCORE_RING_SIZE,
    height: SCORE_RING_SIZE,
    borderRadius: SCORE_RING_SIZE / 2,
    borderWidth: SCORE_RING_THICKNESS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: SCORE_RING_SIZE - SCORE_RING_THICKNESS * 2,
    height: SCORE_RING_SIZE - SCORE_RING_THICKNESS * 2,
    borderRadius: (SCORE_RING_SIZE - SCORE_RING_THICKNESS * 2) / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValueText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreIndicator: {
    position: 'absolute',
    width: SCORE_INDICATOR_SIZE,
    height: SCORE_INDICATOR_SIZE,
    borderRadius: SCORE_INDICATOR_SIZE / 2,
    borderWidth: 2,
  },
  scoreTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 8,
    borderRadius: 999,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  insightSection: {
    gap: 6,
  },
  insightSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  insightCopy: {
    flex: 1,
    gap: 2,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inventoryItem: {
    borderRadius: 14,
    paddingVertical: 10,
    gap: 8,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inventoryImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  inventoryImageFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryMeta: {
    flex: 1,
    gap: 4,
  },
  inventoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  quickActionButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickActionLabel: {
    fontSize: 13,
  },
  manualToggle: {
    alignSelf: 'flex-start',
  },
  quickList: {
    gap: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  multiSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  multiSelectCopy: {
    flex: 1,
    gap: 4,
  },
  multiSelectMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickCard: {
    width: 120,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickImage: {
    width: '100%',
    height: 70,
    borderRadius: 10,
  },
  quickImageFallback: {
    width: '100%',
    height: 70,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickSubtitle: {
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateToggle: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanButton: {
    flex: 1,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  selectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedMeta: {
    flex: 1,
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
  },
  helperText: {
    fontSize: 12,
  },
  alertBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalScrollView: {
    width: '100%',
    flexGrow: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    paddingBottom: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  modalSubtitle: {
    fontSize: 12,
  },
  detailBlock: {
    gap: 6,
    marginBottom: 12,
  },
  detailHero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailHeroMeta: {
    flex: 1,
    gap: 4,
  },
  detailHeroScore: {
    alignItems: 'flex-end',
    minWidth: 88,
  },
  detailScoreLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  detailScoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  detailScoreCaption: {
    fontSize: 11,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  ingredientsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleMeta: {
    flex: 1,
    gap: 4,
  },
  timeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customTimeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
  },
  addTimeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  logHeaderMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  logDate: {
    textAlign: 'right',
  },
  logFooter: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarNav: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  calendarLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
});
