type WeatherSnapshot = {
  observedAt: string;
  temperatureF: number | null;
  feelsLikeF: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  windMph: number | null;
  weatherCode: number | null;
  condition: string | null;
  source: 'open-meteo';
  locationSource: 'capture_gps' | 'home_address';
};

type WeatherSnapshotOptions = {
  lat: number;
  lng: number;
  capturedAt: Date;
  locationSource: WeatherSnapshot['locationSource'];
  timeoutMs?: number;
};

type HourlyWeatherData = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  apparent_temperature?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  precipitation?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  weather_code?: Array<number | null>;
};

type WeatherResponse = {
  hourly?: HourlyWeatherData;
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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatDateUTC = (value: Date) => value.toISOString().slice(0, 10);

const normalizeTime = (value: string) =>
  value.endsWith('Z') || value.includes('+') ? value : `${value}Z`;

const resolveNearestIndex = (times: string[], targetMs: number) => {
  let bestIndex = 0;
  let bestDiff = Infinity;
  times.forEach((time, index) => {
    const parsed = Date.parse(normalizeTime(time));
    if (!Number.isFinite(parsed)) return;
    const diff = Math.abs(parsed - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return bestIndex;
};

export async function fetchWeatherSnapshot(
  options: WeatherSnapshotOptions,
): Promise<WeatherSnapshot | null> {
  const { lat, lng, capturedAt, locationSource, timeoutMs = 2500 } = options;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;

  const today = formatDateUTC(new Date());
  const capturedDate = formatDateUTC(capturedAt);
  const useArchive = capturedDate < today;
  const baseUrl = useArchive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';

  const url = new URL(baseUrl);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'wind_speed_10m',
      'weather_code',
    ].join(','),
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', 'UTC');
  if (useArchive) {
    url.searchParams.set('start_date', capturedDate);
    url.searchParams.set('end_date', capturedDate);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as WeatherResponse;
    const hourly = data.hourly;
    if (!hourly?.time?.length) return null;
    const index = resolveNearestIndex(hourly.time, capturedAt.getTime());

    const temperatureF = isFiniteNumber(hourly.temperature_2m?.[index])
      ? hourly.temperature_2m?.[index] ?? null
      : null;
    const feelsLikeF = isFiniteNumber(hourly.apparent_temperature?.[index])
      ? hourly.apparent_temperature?.[index] ?? null
      : null;
    const humidityPct = isFiniteNumber(hourly.relative_humidity_2m?.[index])
      ? hourly.relative_humidity_2m?.[index] ?? null
      : null;
    const precipitationMm = isFiniteNumber(hourly.precipitation?.[index])
      ? hourly.precipitation?.[index] ?? null
      : null;
    const windMph = isFiniteNumber(hourly.wind_speed_10m?.[index])
      ? hourly.wind_speed_10m?.[index] ?? null
      : null;
    const weatherCode = isFiniteNumber(hourly.weather_code?.[index])
      ? hourly.weather_code?.[index] ?? null
      : null;
    const condition = describeWeatherCode(weatherCode);
    const observedAt = hourly.time[index]
      ? new Date(normalizeTime(hourly.time[index])).toISOString()
      : capturedAt.toISOString();

    return {
      observedAt,
      temperatureF,
      feelsLikeF,
      humidityPct,
      precipitationMm,
      windMph,
      weatherCode,
      condition,
      source: 'open-meteo',
      locationSource,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
