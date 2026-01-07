import Constants from 'expo-constants';

const extraApiBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  'https://www.getinsightscoop.com';

const resolveDevApiBaseUrl = (): string | null => {
  if (!__DEV__) return null;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).expoConfig?.extra?.expoClient?.hostUri;
  if (!hostUri || typeof hostUri !== 'string') return null;
  const host = hostUri.split(':')[0];
  return host ? `http://${host}:3000` : null;
};

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const devApiBaseUrl = resolveDevApiBaseUrl();

export const API_BASE_URL =
  envApiBaseUrl ?? devApiBaseUrl ?? extraApiBaseUrl;

export const APP_NAME = 'InsightScoop';

const defaultRevenueCatKey = __DEV__ ? 'test_hvzStXcggKXdScuGiEzKsfqkgxb' : '';

const revenueCatIosApiKey =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ??
  Constants.expoConfig?.extra?.revenueCatIosApiKey ??
  defaultRevenueCatKey;

const revenueCatAndroidApiKey =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ??
  Constants.expoConfig?.extra?.revenueCatAndroidApiKey ??
  defaultRevenueCatKey;

export const REVENUECAT_API_KEYS = {
  ios: revenueCatIosApiKey,
  android: revenueCatAndroidApiKey,
};
