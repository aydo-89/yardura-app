import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { apiRequest } from '@/lib/api/client';
import { logWarn } from '@/lib/logger';
import { getItem, setItem } from '@/lib/storage';

const TOKEN_STORAGE_KEY = 'insightscoop_push_token';

type RegisterPayload = {
  token: string;
  platform: string;
  deviceId?: string;
  appVersion?: string;
  provider: string;
};

// Check if we're running in Expo Go (push notifications not supported in SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy-load notifications module to avoid crash in Expo Go
let Notifications: typeof import('expo-notifications') | null = null;

function getNotifications() {
  if (isExpoGo) {
    logWarn('push', 'Push notifications are not available in Expo Go. Use a development build.');
    return null;
  }
  if (!Notifications) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Notifications = require('expo-notifications');
    } catch (e) {
      logWarn('push.expo-notifications.unavailable', e);
      return null;
    }
  }
  return Notifications;
}

const resolveProjectId = (): string | undefined => {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).expoConfig?.extra?.eas?.projectId
  );
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  const notifs = getNotifications();
  if (!notifs) return;
  const channels = [
    { id: 'default', name: 'General updates', importance: notifs.AndroidImportance.DEFAULT },
    { id: 'visits', name: 'Visit updates', importance: notifs.AndroidImportance.HIGH },
    { id: 'wellness', name: 'Wellness reminders', importance: notifs.AndroidImportance.DEFAULT },
    { id: 'offers', name: 'Job offers', importance: notifs.AndroidImportance.HIGH },
    { id: 'reminders', name: 'Medication reminders', importance: notifs.AndroidImportance.HIGH },
    { id: 'payouts', name: 'Payouts', importance: notifs.AndroidImportance.DEFAULT },
  ];

  await Promise.all(
    channels.map((channel) =>
      notifs.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
      }),
    ),
  );
};

export async function ensurePushRegistration(authToken: string): Promise<void> {
  if (__DEV__) console.log('[PUSH] Starting push registration...');

  if (!authToken) {
    if (__DEV__) console.log('[PUSH] No auth token, skipping');
    return;
  }
  if (Platform.OS === 'web') {
    if (__DEV__) console.log('[PUSH] Web platform, skipping');
    return;
  }
  if (!Device.isDevice) {
    if (__DEV__) console.log('[PUSH] Not a physical device, skipping');
    return;
  }

  const notifs = getNotifications();
  if (!notifs) {
    if (__DEV__) console.log('[PUSH] Notifications module not available');
    return;
  }

  try {
    if (__DEV__) console.log('[PUSH] Checking permissions...');
    const permission = await notifs.getPermissionsAsync();
    let status = permission.status;
    if (__DEV__) console.log('[PUSH] Current permission status:', status);

    if (status !== 'granted') {
      if (__DEV__) console.log('[PUSH] Requesting permission...');
      const requested = await notifs.requestPermissionsAsync();
      status = requested.status;
      if (__DEV__) console.log('[PUSH] New permission status:', status);
    }
    if (status !== 'granted') {
      if (__DEV__) console.log('[PUSH] Permission denied, cannot register');
      return;
    }

    await ensureAndroidChannel();

    const projectId = resolveProjectId();
    if (__DEV__) console.log('[PUSH] Project ID:', projectId);

    const tokenResult = await notifs.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const pushToken = tokenResult.data;

    if (__DEV__) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('PUSH TOKEN (copy this for testing):');
      console.log(pushToken);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    }

    const storedToken = await getItem(TOKEN_STORAGE_KEY);
    if (storedToken === pushToken) {
      if (__DEV__) console.log('[PUSH] Token already registered, skipping API call');
      return;
    }

    const payload: RegisterPayload = {
      token: pushToken,
      platform: Platform.OS,
      deviceId: Device.modelName ?? Device.deviceName ?? undefined,
      appVersion: Constants.expoConfig?.version,
      provider: 'EXPO',
    };

    if (__DEV__) console.log('[PUSH] Registering token with server...');
    await apiRequest('/api/mobile/push/register', {
      method: 'POST',
      token: authToken,
      body: payload,
    });

    await setItem(TOKEN_STORAGE_KEY, pushToken);
    if (__DEV__) console.log('[PUSH] Token registered successfully!');
  } catch (error) {
    if (__DEV__) console.log('[PUSH] Registration failed:', error);
  }
}
