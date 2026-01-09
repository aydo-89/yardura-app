import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

type WeatherData = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    time?: string;
  };
  hourly?: {
    time?: string[];
    apparent_temperature?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

type AlertLevel = 'caution' | 'danger';
type AlertWindow = 'now' | 'soon';
type WeatherAlert = {
  type: 'heat' | 'cold';
  level: AlertLevel;
  window: AlertWindow;
  headline: string;
  message: string;
};

const describeWeatherCode = (code?: number | null) => {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code ?? -1)) return 'Mostly clear';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code ?? -1)) return 'Fog';
  if (code && code >= 51 && code <= 67) return 'Drizzle or rain';
  if (code && code >= 71 && code <= 77) return 'Snow';
  if (code && code >= 80 && code <= 82) return 'Rain showers';
  if (code && code >= 95) return 'Thunderstorms';
  return 'Mixed';
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const summarizeTemps = (values: Array<number | null | undefined>) => {
  const cleaned = values.filter(isFiniteNumber);
  if (cleaned.length === 0) {
    return { high: null as number | null, low: null as number | null };
  }
  return {
    high: Math.max(...cleaned),
    low: Math.min(...cleaned),
  };
};

const resolveAlertRank = (alert: WeatherAlert) => {
  const levelScore = alert.level === 'danger' ? 2 : 1;
  const windowScore = alert.window === 'now' ? 2 : 1;
  return levelScore * 10 + windowScore;
};

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, city: true, state: true, latitude: true, longitude: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const lat = customer.latitude;
  const lng = customer.longitude;

  let weather: WeatherData | null = null;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      '&current=temperature_2m,apparent_temperature,weather_code' +
      '&hourly=apparent_temperature' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=auto';
    try {
      const res = await fetch(url, { next: { revalidate: 900 } });
      if (res.ok) {
        weather = (await res.json()) as WeatherData;
      }
    } catch {
      weather = null;
    }
  }

  const hourlyTemps = weather?.hourly?.apparent_temperature ?? [];
  const next6Temps = hourlyTemps.slice(0, 6);
  const next24Temps = hourlyTemps.slice(0, 24);
  const next6Summary = summarizeTemps(next6Temps);
  const next24Summary = summarizeTemps(next24Temps);

  const currentTemp = isFiniteNumber(weather?.current?.temperature_2m)
    ? weather?.current?.temperature_2m
    : next6Summary.high ?? null;
  const feelsLike = isFiniteNumber(weather?.current?.apparent_temperature)
    ? weather?.current?.apparent_temperature
    : currentTemp;
  const condition = describeWeatherCode(weather?.current?.weather_code ?? null);

  const HEAT_CAUTION = 85;
  const HEAT_DANGER = 95;
  const COLD_CAUTION = 20;
  const COLD_DANGER = 10;

  const heatAlert = (() => {
    const currentFeels = isFiniteNumber(feelsLike) ? feelsLike : null;
    if (currentFeels !== null && currentFeels >= HEAT_DANGER) {
      return {
        type: 'heat',
        level: 'danger',
        window: 'now',
        headline: 'Extreme heat now',
        message: 'Limit outdoor time, seek shade, and add extra water breaks.',
      } satisfies WeatherAlert;
    }
    if (next6Summary.high !== null && next6Summary.high >= HEAT_DANGER) {
      return {
        type: 'heat',
        level: 'danger',
        window: 'soon',
        headline: 'Heat spike expected',
        message: 'Plan shaded breaks and avoid midday pavement.',
      } satisfies WeatherAlert;
    }
    if (currentFeels !== null && currentFeels >= HEAT_CAUTION) {
      return {
        type: 'heat',
        level: 'caution',
        window: 'now',
        headline: 'Warm conditions',
        message: 'Keep walks short and bring extra water.',
      } satisfies WeatherAlert;
    }
    if (next6Summary.high !== null && next6Summary.high >= HEAT_CAUTION) {
      return {
        type: 'heat',
        level: 'caution',
        window: 'soon',
        headline: 'Warm stretch ahead',
        message: 'Hydration and shade will help during walks.',
      } satisfies WeatherAlert;
    }
    return null;
  })();

  const coldAlert = (() => {
    const currentFeels = isFiniteNumber(feelsLike) ? feelsLike : null;
    if (currentFeels !== null && currentFeels <= COLD_DANGER) {
      return {
        type: 'cold',
        level: 'danger',
        window: 'now',
        headline: 'Dangerous cold now',
        message: 'Limit outdoor time and protect paws.',
      } satisfies WeatherAlert;
    }
    if (next6Summary.low !== null && next6Summary.low <= COLD_DANGER) {
      return {
        type: 'cold',
        level: 'danger',
        window: 'soon',
        headline: 'Cold snap expected',
        message: 'Plan short outings and paw protection.',
      } satisfies WeatherAlert;
    }
    if (currentFeels !== null && currentFeels <= COLD_CAUTION) {
      return {
        type: 'cold',
        level: 'caution',
        window: 'now',
        headline: 'Chilly conditions',
        message: 'Consider a coat for short-haired dogs.',
      } satisfies WeatherAlert;
    }
    if (next6Summary.low !== null && next6Summary.low <= COLD_CAUTION) {
      return {
        type: 'cold',
        level: 'caution',
        window: 'soon',
        headline: 'Chilly stretch ahead',
        message: 'Bundle up for early morning or evening walks.',
      } satisfies WeatherAlert;
    }
    return null;
  })();

  const dailyHigh =
    weather?.daily?.temperature_2m_max?.[0] ?? next24Summary.high ?? null;
  const dailyLow =
    weather?.daily?.temperature_2m_min?.[0] ?? next24Summary.low ?? null;

  const alertCandidates = [heatAlert, coldAlert].filter(Boolean) as WeatherAlert[];
  const primaryAlert = alertCandidates.sort(
    (a, b) => resolveAlertRank(b) - resolveAlertRank(a),
  )[0] ?? null;

  return NextResponse.json({
    ok: true,
    data: {
      location: {
        city: customer.city ?? null,
        state: customer.state ?? null,
        lat,
        lng,
      },
      weather: weather
        ? {
            currentTemp,
            feelsLike,
            condition,
            dailyHigh,
            dailyLow,
            next6High: next6Summary.high,
            next6Low: next6Summary.low,
            next24High: next24Summary.high,
            next24Low: next24Summary.low,
            observedAt: weather?.current?.time ?? new Date().toISOString(),
          }
        : null,
      alert: primaryAlert,
      alerts: {
        heat: heatAlert,
        cold: coldAlert,
      },
    },
  });
}
