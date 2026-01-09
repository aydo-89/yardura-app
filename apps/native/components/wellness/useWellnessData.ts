import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';

import { apiRequest } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import { parseDateInput } from '@/lib/dates';
import type {
  CustomerSummary,
  WellnessCheckInContext,
  WellnessReading,
  WellnessReport,
} from '@/lib/api/types';

type WeatherAlertLevel = 'caution' | 'danger';
type WeatherAlertWindow = 'now' | 'soon';
type WeatherAlert = {
  type: 'heat' | 'cold';
  level: WeatherAlertLevel;
  window: WeatherAlertWindow;
  headline: string;
  message: string;
};

type WeatherAlertPayload = {
  location?: { city?: string | null; state?: string | null };
  weather?: {
    currentTemp: number | null;
    feelsLike: number | null;
    dailyHigh: number | null;
    dailyLow: number | null;
  } | null;
  alert?: WeatherAlert | null;
  alerts?: { heat: WeatherAlert | null; cold: WeatherAlert | null };
};

export type WellnessWeatherAlert = {
  message: string;
  headline: string;
  label: string;
  level: WeatherAlertLevel;
  type: WeatherAlert['type'];
  window: WeatherAlertWindow;
  currentTemp: number | null;
  feelsLike: number | null;
};

export type WellnessAccess = CustomerSummary['wellnessAccess'];

export function useWellnessData(token: string | undefined) {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [reports, setReports] = useState<WellnessReport[]>([]);
  const [readings, setReadings] = useState<WellnessReading[]>([]);
  const [checkInContext, setCheckInContext] = useState<WellnessCheckInContext | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<WellnessWeatherAlert | null>(null);

  const [loading, setLoading] = useState(false);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingsError, setReadingsError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ reports: WellnessReport[] }>(
        '/api/mobile/customer/wellness-reports?limit=6',
        { token },
      );
      setReports(data.reports ?? []);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', { token });
      setSummary(data);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
      }
    }
  }, [token]);

  const loadReadings = useCallback(async () => {
    if (!token) return;
    setReadingsLoading(true);
    setReadingsError(null);
    try {
      const data = await apiRequest<{ readings: WellnessReading[] }>(
        '/api/mobile/customer/wellness-readings',
        { token },
      );
      setReadings(data.readings ?? []);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      setReadingsError(err instanceof Error ? err.message : 'Unable to load insights.');
    } finally {
      setReadingsLoading(false);
    }
  }, [token]);

  const loadCheckInContext = useCallback(async () => {
    if (!token) return;
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      const data = await apiRequest<WellnessCheckInContext>(
        '/api/mobile/customer/wellness-check-in',
        { token },
      );
      setCheckInContext(data);
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      setCheckInError(err instanceof Error ? err.message : 'Unable to load check-in status.');
    } finally {
      setCheckInLoading(false);
    }
  }, [token]);

  const loadWeather = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<WeatherAlertPayload>('/api/mobile/customer/weather', { token });
      const alert = data.alert ?? data.alerts?.heat ?? data.alerts?.cold ?? null;
      if (alert) {
        const locationLabel =
          data.location?.city && data.location?.state
            ? `${data.location.city}, ${data.location.state}`
            : 'Your area';
        setWeatherAlert({
          message: alert.message,
          headline: alert.headline,
          label: locationLabel,
          level: alert.level,
          type: alert.type,
          window: alert.window,
          currentTemp: data.weather?.currentTemp ?? null,
          feelsLike: data.weather?.feelsLike ?? null,
        });
      } else {
        setWeatherAlert(null);
      }
    } catch {
      setWeatherAlert(null);
    }
  }, [token]);

  const loadAll = useCallback(() => {
    loadReports();
    loadReadings();
    loadCheckInContext();
    loadWeather();
    loadSummary();
  }, [loadReports, loadReadings, loadCheckInContext, loadWeather, loadSummary]);

  // Derived data
  const access = summary?.wellnessAccess ?? null;
  const hasService = access?.hasActiveService ?? false;
  const isPremium = access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || hasService;

  const checkInMeta = useMemo(() => {
    const dogs = checkInContext?.dogs ?? [];
    const totalDogs = dogs.length;
    const pending = dogs.filter((dog) => !dog.currentWeekReport).length;
    const hasDogs = totalDogs > 0;
    const allSubmitted = hasDogs && pending === 0;
    const label = !hasDogs
      ? 'Add dogs to start check-ins'
      : allSubmitted
        ? "Edit this week's check-in"
        : pending === totalDogs
          ? 'Start weekly check-in'
          : `Finish ${pending} check-in${pending === 1 ? '' : 's'}`;
    const helper = checkInContext?.weekStart
      ? `Week of ${parseDateInput(checkInContext.weekStart).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}`
      : 'This week';
    return {
      hasDogs,
      allSubmitted,
      label,
      helper,
      pending,
      totalDogs,
      weekStart: checkInContext?.weekStart ?? null,
    };
  }, [checkInContext]);

  const wellnessSummary = useMemo(() => {
    const totalSamples = readings.length;
    const flaggedSamples = readings.filter((r) => r.issues.length > 0).length;
    if (totalSamples === 0) {
      return {
        title: 'No samples yet',
        subtitle: hasService
          ? 'Wellness insights appear after your next service visit.'
          : 'Capture a stool photo to start wellness insights.',
        status: 'pending' as const,
        totalSamples,
        flaggedSamples,
      };
    }
    if (flaggedSamples > 0) {
      return {
        title: 'Keep an eye on recent samples',
        subtitle: 'We detected signals in recent samples. Review the notes below.',
        status: 'alert' as const,
        totalSamples,
        flaggedSamples,
      };
    }
    return {
      title: 'Everything looks stable',
      subtitle: 'Recent samples look healthy. Keep up the great work.',
      status: 'good' as const,
      totalSamples,
      flaggedSamples,
    };
  }, [readings, hasService]);

  const flaggedReadings = useMemo(
    () => readings.filter((r) => r.issues.length > 0),
    [readings],
  );

  return {
    // Raw data
    summary,
    reports,
    readings,
    checkInContext,
    weatherAlert,
    // Loading states
    loading,
    readingsLoading,
    checkInLoading,
    // Errors
    error,
    readingsError,
    checkInError,
    // Actions
    loadAll,
    loadReadings,
    loadCheckInContext,
    // Derived
    access,
    hasService,
    isPremium,
    checkInMeta,
    wellnessSummary,
    flaggedReadings,
  };
}
