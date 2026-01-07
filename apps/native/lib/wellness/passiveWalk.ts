import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';

import { getJson, removeItem, setJson } from '@/lib/storage';

export const PASSIVE_WALK_TASK = 'insightscoop-passive-walk';
const PASSIVE_WALK_STATE_KEY = 'insightscoop_passive_walk_state';
const PASSIVE_WALK_PENDING_KEY = 'insightscoop_passive_walk_pending';

type WalkPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  timestamp?: string | null;
};

type PassiveWalkSession = {
  startedAt: string;
  lastAt: string;
  lastMovingAt: string;
  distanceMeters: number;
  points: WalkPoint[];
  lastPoint: WalkPoint | null;
  maxSpeedMps: number;
  lastSpeedMps: number;
};

export type PassiveWalkPending = {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  path: WalkPoint[];
  averageSpeedMps: number;
  maxSpeedMps: number;
  createdAt: string;
};

type PassiveWalkState = {
  enabled: boolean;
  session?: PassiveWalkSession | null;
  lastNotifiedAt?: string | null;
};

const MIN_WALK_DISTANCE_METERS = 300;
const MIN_WALK_DURATION_SECONDS = 8 * 60;
const WALK_MIN_SPEED_MPS = 0.4;
const WALK_MAX_SPEED_MPS = 2.8;
const DRIVE_SPEED_MPS = 5.5;
const STOP_IDLE_SECONDS = 180;
const MAX_ACCURACY_METERS = 60;
const MAX_POINTS = 600;
const MIN_POINT_DISTANCE_METERS = 8;
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const isExpoGo = Constants.appOwnership === 'expo';

let TaskManager: typeof import('expo-task-manager') | null = null;
let Notifications: typeof import('expo-notifications') | null = null;

const getTaskManager = () => {
  if (Platform.OS === 'web') return null;
  if (!TaskManager) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      TaskManager = require('expo-task-manager');
    } catch (error) {
      console.warn('[walk-passive] TaskManager unavailable', error);
      return null;
    }
  }
  return TaskManager;
};

const getNotifications = () => {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;
  if (!Notifications) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Notifications = require('expo-notifications');
    } catch (error) {
      console.warn('[walk-passive] Notifications unavailable', error);
      return null;
    }
  }
  return Notifications;
};

const TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 15,
  timeInterval: 10000,
  activityType: Location.ActivityType.Fitness,
  pausesUpdatesAutomatically: true,
  showsBackgroundLocationIndicator: false,
  foregroundService: {
    notificationTitle: 'Tracking walks',
    notificationBody: 'Passive walk detection is running in the background.',
    notificationColor: '#22C55E',
  },
};

const ensureNotificationPermission = async () => {
  const notifs = getNotifications();
  if (!notifs) return;
  const permission = await notifs.getPermissionsAsync();
  if (permission.status !== 'granted') {
    await notifs.requestPermissionsAsync();
  }
};

const startPassiveUpdates = async () => {
  const taskManager = getTaskManager();
  if (!taskManager || !taskManager.isTaskDefined(PASSIVE_WALK_TASK)) {
    throw new Error('Background tasks are unavailable on this device.');
  }
  const started = await Location.hasStartedLocationUpdatesAsync(PASSIVE_WALK_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(PASSIVE_WALK_TASK, TASK_OPTIONS);
};

const stopPassiveUpdates = async () => {
  const started = await Location.hasStartedLocationUpdatesAsync(PASSIVE_WALK_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(PASSIVE_WALK_TASK);
  }
};

const toTimestamp = (value?: string | null, fallback?: number) => {
  if (value) {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback ?? Date.now();
};

const formatDistance = (meters: number) => {
  const miles = meters / 1609.34;
  return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(2)} mi`;
};

const haversineMeters = (a: WalkPoint, b: WalkPoint) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.sqrt(h));
};

const computeSpeed = (point: WalkPoint, prevPoint: WalkPoint | null, fallbackSpeed: number | null) => {
  if (fallbackSpeed != null && Number.isFinite(fallbackSpeed)) {
    return Math.max(0, fallbackSpeed);
  }
  if (!prevPoint) return null;
  const now = toTimestamp(point.timestamp);
  const prev = toTimestamp(prevPoint.timestamp);
  const deltaSeconds = Math.max(1, Math.round((now - prev) / 1000));
  const deltaMeters = haversineMeters(prevPoint, point);
  return deltaMeters / deltaSeconds;
};

const appendPoint = (session: PassiveWalkSession, point: WalkPoint) => {
  const lastStored = session.points[session.points.length - 1];
  if (!lastStored) {
    session.points.push(point);
    return;
  }
  const delta = haversineMeters(lastStored, point);
  if (delta < MIN_POINT_DISTANCE_METERS) return;
  session.points.push(point);
  if (session.points.length > MAX_POINTS) {
    session.points.shift();
  }
};

const finalizeSession = (session: PassiveWalkSession, endTime: string): PassiveWalkPending | null => {
  const durationSeconds = Math.max(
    1,
    Math.floor((toTimestamp(endTime) - toTimestamp(session.startedAt)) / 1000),
  );
  if (durationSeconds < MIN_WALK_DURATION_SECONDS) return null;
  if (session.distanceMeters < MIN_WALK_DISTANCE_METERS) return null;
  const averageSpeedMps = session.distanceMeters / durationSeconds;
  return {
    startedAt: session.startedAt,
    endedAt: endTime,
    durationSeconds,
    distanceMeters: session.distanceMeters,
    path: session.points,
    averageSpeedMps,
    maxSpeedMps: session.maxSpeedMps,
    createdAt: new Date().toISOString(),
  };
};

const scheduleNotification = async (pending: PassiveWalkPending) => {
  const notifs = getNotifications();
  if (!notifs) return;
  if (Platform.OS === 'android') {
    await notifs.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: notifs.AndroidImportance.DEFAULT,
    });
  }
  const distanceLabel = formatDistance(pending.distanceMeters);
  const durationMinutes = Math.max(1, Math.round(pending.durationSeconds / 60));
  await notifs.scheduleNotificationAsync({
    content: {
      title: 'Walk detected',
      body: `Looks like a ${distanceLabel} walk (${durationMinutes} min). Confirm it?`,
      data: {
        kind: 'passive-walk',
        href: '/(app)/(customer)/wellness-walks',
      },
    },
    trigger: null,
  });
};

const processLocations = async (
  locations: Location.LocationObject[],
  state: PassiveWalkState,
): Promise<{ session: PassiveWalkSession | null; pending: PassiveWalkPending | null; notifiedAt?: string | null }> => {
  let session = state.session ?? null;
  let pending: PassiveWalkPending | null = null;

  for (const location of locations) {
    const coords = location.coords;
    if (!coords) continue;
    if (coords.accuracy != null && coords.accuracy > MAX_ACCURACY_METERS) continue;

    const point: WalkPoint = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      timestamp: new Date(location.timestamp).toISOString(),
    };
    const speed = computeSpeed(point, session?.lastPoint ?? null, coords.speed ?? null);
    if (speed != null && speed > DRIVE_SPEED_MPS) {
      session = null;
      continue;
    }

    const isWalking = speed != null && speed >= WALK_MIN_SPEED_MPS && speed <= WALK_MAX_SPEED_MPS;

    if (isWalking) {
      if (!session) {
        session = {
          startedAt: point.timestamp ?? new Date(location.timestamp).toISOString(),
          lastAt: point.timestamp ?? new Date(location.timestamp).toISOString(),
          lastMovingAt: point.timestamp ?? new Date(location.timestamp).toISOString(),
          distanceMeters: 0,
          points: [],
          lastPoint: null,
          maxSpeedMps: speed ?? 0,
          lastSpeedMps: speed ?? 0,
        };
      }
      if (session.lastPoint) {
        const delta = haversineMeters(session.lastPoint, point);
        session.distanceMeters += delta;
      }
      session.lastPoint = point;
      session.lastAt = point.timestamp ?? new Date(location.timestamp).toISOString();
      session.lastMovingAt = session.lastAt;
      session.lastSpeedMps = speed ?? session.lastSpeedMps;
      if (speed != null) {
        session.maxSpeedMps = Math.max(session.maxSpeedMps, speed);
      }
      appendPoint(session, point);
      continue;
    }

    if (session) {
      session.lastAt = point.timestamp ?? new Date(location.timestamp).toISOString();
      const idleSeconds =
        (toTimestamp(session.lastAt) - toTimestamp(session.lastMovingAt)) / 1000;
      if (idleSeconds >= STOP_IDLE_SECONDS) {
        pending = finalizeSession(session, session.lastAt);
        session = null;
        if (pending) break;
      }
    }
  }

  return { session, pending };
};

const definePassiveWalkTask = () => {
  const taskManager = getTaskManager();
  if (!taskManager) return;
  if (taskManager.isTaskDefined(PASSIVE_WALK_TASK)) return;

  taskManager.defineTask(PASSIVE_WALK_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[walk-passive] task error', error);
      return;
    }
    const payload = data as { locations?: Location.LocationObject[] } | null;
    const locations = payload?.locations ?? [];
    if (locations.length === 0) return;

    const state =
      (await getJson<PassiveWalkState>(PASSIVE_WALK_STATE_KEY)) ?? {
        enabled: true,
      };
    if (!state.enabled) return;

    const pendingExisting = await getJson<PassiveWalkPending>(PASSIVE_WALK_PENDING_KEY);
    if (pendingExisting) return;

    const { session, pending } = await processLocations(locations, state);
    const nextState: PassiveWalkState = {
      enabled: true,
      session,
      lastNotifiedAt: state.lastNotifiedAt ?? null,
    };

    if (pending) {
      const lastNotifiedAt = state.lastNotifiedAt ? new Date(state.lastNotifiedAt).getTime() : 0;
      const now = Date.now();
      if (!lastNotifiedAt || now - lastNotifiedAt > NOTIFY_COOLDOWN_MS) {
        await setJson(PASSIVE_WALK_PENDING_KEY, pending);
        await scheduleNotification(pending);
        nextState.lastNotifiedAt = new Date().toISOString();
      }
      nextState.session = null;
    }

    await setJson(PASSIVE_WALK_STATE_KEY, nextState);
  });
};

definePassiveWalkTask();

export async function getPassiveWalkState(): Promise<PassiveWalkState | null> {
  return getJson<PassiveWalkState>(PASSIVE_WALK_STATE_KEY);
}

export async function getPendingPassiveWalk(): Promise<PassiveWalkPending | null> {
  return getJson<PassiveWalkPending>(PASSIVE_WALK_PENDING_KEY);
}

export async function clearPendingPassiveWalk(): Promise<void> {
  await removeItem(PASSIVE_WALK_PENDING_KEY);
}

export async function enablePassiveWalkDetection(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (isExpoGo) {
    throw new Error('Passive walk detection requires a development build.');
  }
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    throw new Error('Location permission is required.');
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    throw new Error('Background location is required for passive walk detection.');
  }
  await startPassiveUpdates();
  await ensureNotificationPermission();
  await setJson(PASSIVE_WALK_STATE_KEY, { enabled: true, session: null, lastNotifiedAt: null });
}

export async function disablePassiveWalkDetection(): Promise<void> {
  if (Platform.OS === 'web') return;
  await stopPassiveUpdates();
  await setJson(PASSIVE_WALK_STATE_KEY, { enabled: false, session: null });
}

export async function syncPassiveWalkDetection(): Promise<PassiveWalkState | null> {
  const state = await getJson<PassiveWalkState>(PASSIVE_WALK_STATE_KEY);
  if (!state || Platform.OS === 'web') return state ?? null;

  if (state.enabled) {
    const background = await Location.getBackgroundPermissionsAsync();
    if (background.granted) {
      try {
        await startPassiveUpdates();
      } catch {
        return state;
      }
    } else {
      await setJson(PASSIVE_WALK_STATE_KEY, { enabled: false, session: null });
      return { enabled: false, session: null };
    }
  } else {
    await stopPassiveUpdates();
  }

  return state;
}
