import { getJson, setJson } from '@/lib/storage';

const WALK_PREFERENCES_KEY = 'insightscoop_walk_preferences';

export type WalkTrackingMode = 'everywhere' | 'near_home' | 'disabled';

export type WalkPreferences = {
  /** How walk tracking should behave */
  mode: WalkTrackingMode;
  /** Home coordinates for "near home" mode */
  homeLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  /** Radius in meters for "near home" detection (default: 500m ~ 0.3 miles) */
  homeRadiusMeters: number;
  /** Whether to show walk notification prompts */
  showNotifications: boolean;
  /** Last updated timestamp */
  updatedAt?: string;
};

const DEFAULT_PREFERENCES: WalkPreferences = {
  mode: 'everywhere',
  homeLocation: null,
  homeRadiusMeters: 500,
  showNotifications: true,
};

/**
 * Get current walk tracking preferences
 */
export async function getWalkPreferences(): Promise<WalkPreferences> {
  const stored = await getJson<WalkPreferences>(WALK_PREFERENCES_KEY);
  return { ...DEFAULT_PREFERENCES, ...stored };
}

/**
 * Update walk tracking preferences
 */
export async function setWalkPreferences(
  updates: Partial<WalkPreferences>,
): Promise<WalkPreferences> {
  const current = await getWalkPreferences();
  const next: WalkPreferences = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await setJson(WALK_PREFERENCES_KEY, next);
  return next;
}

/**
 * Set the tracking mode
 */
export async function setWalkTrackingMode(mode: WalkTrackingMode): Promise<void> {
  await setWalkPreferences({ mode });
}

/**
 * Set home location for "near home" mode
 */
export async function setWalkHomeLocation(
  location: { latitude: number; longitude: number } | null,
): Promise<void> {
  await setWalkPreferences({ homeLocation: location });
}

/**
 * Set home radius for "near home" detection
 */
export async function setWalkHomeRadius(radiusMeters: number): Promise<void> {
  await setWalkPreferences({ homeRadiusMeters: Math.max(100, Math.min(5000, radiusMeters)) });
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Check if a location is within the home radius
 */
export function isNearHome(
  location: { latitude: number; longitude: number },
  preferences: WalkPreferences,
): boolean {
  if (!preferences.homeLocation) return false;
  const distance = distanceMeters(location, preferences.homeLocation);
  return distance <= preferences.homeRadiusMeters;
}

/**
 * Check if walk tracking should be active based on preferences and location
 */
export async function shouldTrackWalk(
  currentLocation: { latitude: number; longitude: number } | null,
): Promise<{ allowed: boolean; reason?: string }> {
  const prefs = await getWalkPreferences();

  if (prefs.mode === 'disabled') {
    return { allowed: false, reason: 'Walk tracking is disabled' };
  }

  if (prefs.mode === 'everywhere') {
    return { allowed: true };
  }

  // mode === 'near_home'
  if (!prefs.homeLocation) {
    return { allowed: false, reason: 'Home location not set' };
  }

  if (!currentLocation) {
    return { allowed: false, reason: 'Unable to determine current location' };
  }

  const near = isNearHome(currentLocation, prefs);
  if (!near) {
    return { allowed: false, reason: 'Not near home location' };
  }

  return { allowed: true };
}

/**
 * Convert radius in meters to a human-readable string
 */
export function formatRadius(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.5) {
    return `${Math.round(meters)} m`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Common radius presets
 */
export const RADIUS_PRESETS = [
  { value: 250, label: '250m (~800ft)' },
  { value: 500, label: '500m (~0.3mi)' },
  { value: 800, label: '800m (~0.5mi)' },
  { value: 1600, label: '1.6km (~1mi)' },
] as const;
