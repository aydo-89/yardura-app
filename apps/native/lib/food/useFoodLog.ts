import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { apiRequest, apiUpload } from '@/lib/api/client';
import type {
  CustomerSummary,
  DogSummary,
  WellnessFoodLog,
  WellnessFoodProduct,
  WellnessFoodSchedule,
} from '@/lib/api/types';

export const TYPE_OPTIONS = [
  { label: 'Food', value: 'FOOD', examples: 'Kibble, wet food, raw diet, toppers' },
  { label: 'Treat', value: 'TREAT', examples: 'Training treats, dental chews, bully sticks' },
  { label: 'Supplement', value: 'SUPPLEMENT', examples: 'Probiotics, joint support, fish oil, vitamins' },
  { label: 'Medication', value: 'MEDICATION', examples: 'Flea/tick, heartworm, prescriptions, pain relief' },
] as const;

export type FoodType = (typeof TYPE_OPTIONS)[number]['value'];

export const TYPE_LABELS: Record<FoodType, string> = {
  FOOD: 'Food',
  TREAT: 'Treat',
  SUPPLEMENT: 'Supplement',
  MEDICATION: 'Medication',
};

export const PORTION_PRESETS: Record<FoodType, { label: string; value: string }[]> = {
  FOOD: [
    { label: 'Light', value: 'Light' },
    { label: 'Regular', value: 'Regular' },
    { label: 'Hearty', value: 'Hearty' },
  ],
  TREAT: [
    { label: 'Small', value: 'Small' },
    { label: 'Regular', value: 'Regular' },
    { label: 'Extra', value: 'Extra' },
  ],
  SUPPLEMENT: [
    { label: 'Half dose', value: 'Half dose' },
    { label: '1 dose', value: '1 dose' },
    { label: '2 doses', value: '2 doses' },
  ],
  MEDICATION: [
    { label: 'Half dose', value: 'Half dose' },
    { label: '1 dose', value: '1 dose' },
    { label: '2 doses', value: '2 doses' },
  ],
};

export const QUICK_TIME_OPTIONS = [
  { label: '7:00 AM', value: '07:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '9:00 PM', value: '21:00' },
] as const;

export type ScanAsset = {
  uri: string;
  name: string;
  type: string;
};

type FoodScanResult = {
  brand?: string | null;
  productName?: string | null;
  ingredients?: string | null;
  confidence?: number | null;
  type?: string | null;
};

export const formatTimeLabel = (value: string) => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

export const parseTimeInput = (value: string) => {
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

export const sortTimes = (values: string[]) => {
  return [...values].sort((a, b) => {
    const [aHour, aMin] = a.split(':').map(Number);
    const [bHour, bMin] = b.split(':').map(Number);
    return aHour * 60 + aMin - (bHour * 60 + bMin);
  });
};

export const formatLogTimestamp = (value: string | Date, includeYear = false) => {
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

export const formatTypeLabel = (value: FoodType) => TYPE_LABELS[value] ?? value.toLowerCase();

export const normalizeScanType = (value?: string | null): FoodType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (!upper || upper === 'UNKNOWN') return null;
  const match = TYPE_OPTIONS.find((option) => option.value === upper);
  return match?.value ?? null;
};

export const getPlaceholders = (type: FoodType) => {
  if (type === 'MEDICATION') {
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

export type LogOverrides = {
  productId?: string | null;
  dogId?: string | null;
  type?: FoodType;
  brand?: string;
  productName?: string;
  ingredients?: string;
  portion?: string;
  notes?: string;
  loggedAt?: Date;
};

type UseFoodLogOptions = {
  token: string | undefined;
  filterDogId?: string | null;
};

export function useFoodLog({ token, filterDogId }: UseFoodLogOptions) {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [logs, setLogs] = useState<WellnessFoodLog[]>([]);
  const [products, setProducts] = useState<WellnessFoodProduct[]>([]);
  const [schedules, setSchedules] = useState<WellnessFoodSchedule[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [quickLogId, setQuickLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

  const [scanLoading, setScanLoading] = useState({ label: false, ingredients: false });
  const [scanError, setScanError] = useState<{ label?: string | null; ingredients?: string | null } | null>(null);

  // Derived access values
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

  const dogNameMap = useMemo(
    () => new Map(dogs.map((dog) => [dog.id, dog.name])),
    [dogs],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, dogPayload, logPayload, productPayload, schedulePayload] = await Promise.all([
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', { token }),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', { token }),
        apiRequest<{ logs: WellnessFoodLog[] }>(
          `/api/mobile/customer/food-log?limit=50${filterDogId ? `&dogId=${filterDogId}` : ''}`,
          { token },
        ),
        apiRequest<{ products: WellnessFoodProduct[] }>(
          '/api/mobile/customer/food-products?limit=100',
          { token },
        ),
        apiRequest<{ schedules: WellnessFoodSchedule[] }>(
          '/api/mobile/customer/food-schedules',
          { token },
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
  }, [filterDogId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createLog = useCallback(
    async (params: {
      type: FoodType;
      dogId?: string | null;
      productId?: string | null;
      brand?: string;
      productName?: string;
      ingredients?: string;
      portion?: string;
      notes?: string;
      loggedAt?: Date;
    }) => {
      if (!token || saving) return null;
      if (!params.productName?.trim() && !params.brand?.trim() && !params.productId) {
        setError('Add a name or brand.');
        return null;
      }
      setSaving(true);
      setError(null);
      setSuccess(null);
      try {
        const payload = {
          type: params.type,
          ...(params.dogId ? { dogId: params.dogId } : {}),
          ...(params.productId ? { productId: params.productId } : {}),
          ...(params.loggedAt ? { loggedAt: params.loggedAt.toISOString() } : {}),
          ...(params.brand?.trim() ? { brand: params.brand.trim() } : {}),
          ...(params.productName?.trim() ? { productName: params.productName.trim() } : {}),
          ...(params.ingredients?.trim() ? { ingredients: params.ingredients.trim() } : {}),
          ...(params.portion?.trim() ? { portion: params.portion.trim() } : {}),
          ...(params.notes?.trim() ? { notes: params.notes.trim() } : {}),
        };
        const data = await apiRequest<{ log: WellnessFoodLog }>(
          '/api/mobile/customer/food-log',
          { method: 'POST', token, body: payload },
        );
        if (data.log) {
          setLogs((prev) => [data.log, ...prev.filter((item) => item.id !== data.log.id)]);
          setSuccess(
            data.log.allergenMatches.length
              ? `Allergens flagged: ${data.log.allergenMatches.join(', ')}`
              : 'Log saved. No common allergens detected.',
          );
        }
        return data.log ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save log.';
        setError(message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [token, saving],
  );

  const deleteLog = useCallback(
    (log: WellnessFoodLog) => {
      if (!token || deletingLogId) return;
      Alert.alert('Delete food log?', 'This removes the log entry.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingLogId(log.id);
            setError(null);
            try {
              await apiRequest(`/api/mobile/customer/food-log/${log.id}`, {
                method: 'DELETE',
                token,
              });
              setLogs((prev) => prev.filter((item) => item.id !== log.id));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unable to delete food log.';
              setError(message);
            } finally {
              setDeletingLogId(null);
            }
          },
        },
      ]);
    },
    [token, deletingLogId],
  );

  const quickLogProduct = useCallback(
    async (product: WellnessFoodProduct) => {
      if (!token || saving) return null;
      setQuickLogId(product.id);
      const result = await createLog({
        productId: product.id,
        dogId: product.dogId ?? undefined,
        type: product.type,
        loggedAt: new Date(),
      });
      setQuickLogId(null);
      return result;
    },
    [token, saving, createLog],
  );

  const createProduct = useCallback(
    async (params: {
      type: FoodType;
      dogId?: string | null;
      brand?: string;
      productName?: string;
      ingredients?: string;
      portion?: string;
      notes?: string;
      labelAsset?: ScanAsset | null;
      announce?: boolean;
    }) => {
      if (!token) return null;
      if (inventoryLocked) {
        if (params.announce) {
          setProductMessage('Inventory limit reached. Upgrade to add more items.');
        }
        return null;
      }
      if (!params.productName?.trim() && !params.brand?.trim()) {
        if (params.announce) {
          setProductMessage('Add an item name or brand first.');
        }
        return null;
      }
      setSavingProduct(true);
      if (params.announce) setProductMessage(null);
      try {
        const formData = new FormData();
        formData.append('type', params.type);
        if (params.dogId) formData.append('dogId', params.dogId);
        if (params.brand?.trim()) formData.append('brand', params.brand.trim());
        if (params.productName?.trim()) formData.append('productName', params.productName.trim());
        if (params.ingredients?.trim()) formData.append('ingredients', params.ingredients.trim());
        if (params.portion?.trim()) formData.append('portion', params.portion.trim());
        if (params.notes?.trim()) formData.append('notes', params.notes.trim());
        if (params.labelAsset) formData.append('image', params.labelAsset as any);

        const data = await apiUpload<{ product: WellnessFoodProduct }>(
          '/api/mobile/customer/food-products',
          { token, body: formData },
        );
        if (data.product) {
          setProducts((prev) => [data.product, ...prev.filter((item) => item.id !== data.product.id)]);
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
          if (params.announce) setProductMessage('Saved to inventory.');
        }
        return data.product ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save item.';
        if (params.announce) setProductMessage(message);
        return null;
      } finally {
        setSavingProduct(false);
      }
    },
    [token, inventoryLocked],
  );

  const updateProduct = useCallback(
    async (
      productId: string,
      params: {
        type: FoodType;
        dogId?: string | null;
        brand?: string;
        productName?: string;
        ingredients?: string;
        portion?: string;
        notes?: string;
        labelAsset?: ScanAsset | null;
        announce?: boolean;
      },
    ) => {
      if (!token) return null;
      if (!params.productName?.trim() && !params.brand?.trim()) {
        if (params.announce) setProductMessage('Add an item name or brand first.');
        return null;
      }
      setSavingProduct(true);
      if (params.announce) setProductMessage(null);
      try {
        const endpoint = `/api/mobile/customer/food-products/${productId}`;
        let data: { product: WellnessFoodProduct } | null = null;

        if (params.labelAsset) {
          const formData = new FormData();
          formData.append('type', params.type);
          formData.append('dogId', params.dogId ?? 'null');
          formData.append('brand', params.brand?.trim() ?? '');
          formData.append('productName', params.productName?.trim() ?? '');
          formData.append('ingredients', params.ingredients?.trim() ?? '');
          formData.append('portion', params.portion?.trim() ?? '');
          formData.append('notes', params.notes?.trim() ?? '');
          formData.append('image', params.labelAsset as any);
          data = await apiUpload<{ product: WellnessFoodProduct }>(endpoint, {
            method: 'PATCH',
            token,
            body: formData,
          });
        } else {
          const payload = {
            type: params.type,
            dogId: params.dogId ?? null,
            brand: params.brand?.trim() || null,
            productName: params.productName?.trim() || null,
            ingredients: params.ingredients?.trim() || null,
            portion: params.portion?.trim() || null,
            notes: params.notes?.trim() || null,
          };
          data = await apiRequest<{ product: WellnessFoodProduct }>(endpoint, {
            method: 'PATCH',
            token,
            body: payload,
          });
        }
        if (data?.product) {
          setProducts((prev) =>
            prev.map((item) => (item.id === data!.product.id ? data!.product : item)),
          );
          if (params.announce) setProductMessage('Changes saved.');
        }
        return data?.product ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update item.';
        if (params.announce) setProductMessage(message);
        return null;
      } finally {
        setSavingProduct(false);
      }
    },
    [token],
  );

  const deleteProduct = useCallback(
    (product: WellnessFoodProduct, onDeleted?: () => void) => {
      if (!token || deletingProductId) return;
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
                token,
              });
              setProducts((prev) => prev.filter((item) => item.id !== product.id));
              setSchedules((prev) => prev.filter((schedule) => schedule.productId !== product.id));
              onDeleted?.();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unable to delete item.';
              setProductMessage(message);
            } finally {
              setDeletingProductId(null);
            }
          },
        },
      ]);
    },
    [token, deletingProductId],
  );

  const saveSchedule = useCallback(
    async (params: {
      productId: string;
      dogId?: string | null;
      active: boolean;
      timesOfDay: string[];
      existingScheduleId?: string | null;
    }) => {
      if (!token || savingSchedule) return null;
      setScheduleMessage(null);

      if (!params.active && params.existingScheduleId) {
        setSavingSchedule(true);
        try {
          const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
            `/api/mobile/customer/food-schedules/${params.existingScheduleId}`,
            { method: 'PATCH', token, body: { active: false } },
          );
          setSchedules((prev) =>
            prev.map((item) => (item.id === data.schedule.id ? data.schedule : item)),
          );
          setScheduleMessage('Daily auto-log paused.');
          return data.schedule;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to pause the schedule.';
          setScheduleMessage(message);
          return null;
        } finally {
          setSavingSchedule(false);
        }
      }

      if (params.timesOfDay.length === 0) {
        setScheduleMessage('Add at least one daily time.');
        return null;
      }

      setSavingSchedule(true);
      try {
        if (params.existingScheduleId) {
          const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
            `/api/mobile/customer/food-schedules/${params.existingScheduleId}`,
            {
              method: 'PATCH',
              token,
              body: { timesOfDay: params.timesOfDay, active: true, dogId: params.dogId },
            },
          );
          setSchedules((prev) =>
            prev.map((item) => (item.id === data.schedule.id ? data.schedule : item)),
          );
          setScheduleMessage('Daily auto-log updated.');
          return data.schedule;
        } else {
          const data = await apiRequest<{ schedule: WellnessFoodSchedule }>(
            '/api/mobile/customer/food-schedules',
            {
              method: 'POST',
              token,
              body: {
                productId: params.productId,
                dogId: params.dogId,
                timesOfDay: params.timesOfDay,
                active: true,
              },
            },
          );
          setSchedules((prev) => [data.schedule, ...prev]);
          setScheduleMessage('Daily auto-log enabled.');
          return data.schedule;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save the schedule.';
        setScheduleMessage(message);
        return null;
      } finally {
        setSavingSchedule(false);
      }
    },
    [token, savingSchedule],
  );

  const scanFood = useCallback(
    async (
      mode: 'LABEL' | 'INGREDIENTS',
      captureImage: () => Promise<{ uri: string; fileName?: string | null; mimeType?: string } | null>,
    ) => {
      if (!token) return null;
      const modeKey = mode === 'LABEL' ? 'label' : 'ingredients';
      if (scanLoading[modeKey]) return null;
      if (foodScanLocked) {
        setScanError((prev) => ({
          ...(prev ?? {}),
          [modeKey]: 'Monthly food scan limit reached. Upgrade to continue.',
        }));
        return null;
      }
      setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: null }));
      setSuccess(null);
      setError(null);
      setScanLoading((prev) => ({ ...prev, [modeKey]: true }));
      try {
        const result = await captureImage();
        if (!result) {
          setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: 'Scan cancelled.' }));
          return null;
        }
        const asset: ScanAsset = {
          uri: result.uri,
          name: result.fileName ?? `food-scan-${Date.now()}.jpg`,
          type: result.mimeType ?? 'image/jpeg',
        };
        const formData = new FormData();
        formData.append('image', asset as any);
        formData.append('mode', mode);

        const data = await apiUpload<{ scan: FoodScanResult }>(
          '/api/mobile/customer/food-log/scan',
          { token, body: formData },
        );
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
        setSuccess('Scan complete. Review and save.');
        return { scan: data.scan ?? {}, asset };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to scan food.';
        setScanError((prev) => ({ ...(prev ?? {}), [modeKey]: message }));
        return null;
      } finally {
        setScanLoading((prev) => ({ ...prev, [modeKey]: false }));
      }
    },
    [token, scanLoading, foodScanLocked],
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
    setProductMessage(null);
    setScheduleMessage(null);
    setScanError(null);
  }, []);

  return {
    // Data
    summary,
    dogs,
    logs,
    products,
    schedules,
    dogNameMap,

    // Loading states
    loading,
    saving,
    savingProduct,
    savingSchedule,
    deletingLogId,
    deletingProductId,
    quickLogId,
    scanLoading,

    // Messages
    error,
    success,
    productMessage,
    scheduleMessage,
    scanError,

    // Access/limits
    access,
    multiDogLocked,
    foodScansRemaining,
    inventoryRemaining,
    foodScanLocked,
    inventoryLocked,

    // Actions
    loadData,
    createLog,
    deleteLog,
    quickLogProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    saveSchedule,
    scanFood,
    clearMessages,

    // State setters for external control
    setError,
    setSuccess,
    setProductMessage,
    setScheduleMessage,
  };
}

export type UseFoodLogReturn = ReturnType<typeof useFoodLog>;
