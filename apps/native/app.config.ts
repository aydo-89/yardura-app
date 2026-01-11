import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const resolveMapsKeys = () => {
  const shared =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    undefined;
  return {
    android: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || shared,
    ios: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || shared,
  };
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = resolveMapsKeys();
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const isPreview = buildProfile === 'preview';
  const isDev = buildProfile === 'development' || buildProfile === 'development-local';
  const appName = config.name ?? 'InsightScoop';
  // Only use separate bundle IDs for development builds, not preview
  const packageSuffix = isDev ? 'dev' : null;
  const displaySuffix = isDev ? 'Dev' : null;
  const resolvedName = displaySuffix ? `${appName} ${displaySuffix}` : appName;
  const baseAndroidPackage = config.android?.package ?? 'com.yardura.insightscoop';
  const baseIosBundle = config.ios?.bundleIdentifier ?? 'com.yardura.insightscoop';
  const baseAndroidServices = config.android?.googleServicesFile;
  const baseIosServices = config.ios?.googleServicesFile;
  const resolvedAndroidPackage = packageSuffix
    ? baseAndroidPackage.endsWith(`.${packageSuffix}`)
      ? baseAndroidPackage
      : `${baseAndroidPackage}.${packageSuffix}`
    : baseAndroidPackage;
  const resolvedIosBundle = packageSuffix
    ? baseIosBundle.endsWith(`.${packageSuffix}`)
      ? baseIosBundle
      : `${baseIosBundle}.${packageSuffix}`
    : baseIosBundle;

  const resolveServicesFile = (filePath?: string) => {
    if (!filePath) return undefined;
    const absolutePath = path.resolve(filePath);
    return fs.existsSync(absolutePath) ? filePath : undefined;
  };

  const androidServicesFile = packageSuffix
    ? resolveServicesFile(`./google-services.${packageSuffix}.json`)
    : resolveServicesFile(baseAndroidServices);
  const iosServicesFile = packageSuffix
    ? resolveServicesFile(`./GoogleService-Info.${packageSuffix}.plist`)
    : resolveServicesFile(baseIosServices);

  if (packageSuffix && !androidServicesFile) {
    console.warn(
      `[google-services] Missing google-services.${packageSuffix}.json for ${resolvedAndroidPackage}. ` +
        'Firebase will be disabled for this build.',
    );
  }
  if (packageSuffix && !iosServicesFile) {
    console.warn(
      `[google-services] Missing GoogleService-Info.${packageSuffix}.plist for ${resolvedIosBundle}. ` +
        'Firebase will be disabled for this build.',
    );
  }
  if (!googleMapsApiKey.android) {
    console.warn(
      '[maps] Missing EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY; Android maps will render blank without a valid key.',
    );
  }
  if (!googleMapsApiKey.ios) {
    console.warn(
      '[maps] Missing EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY; iOS Google Maps provider will be unavailable.',
    );
  }

  return {
    ...config,
    name: resolvedName,
    slug: config.slug ?? 'insightscoop',
    android: {
      ...config.android,
      package: resolvedAndroidPackage,
      googleServicesFile: androidServicesFile,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey.android ?? config.android?.config?.googleMaps?.apiKey,
        },
      },
    },
    ios: {
      ...config.ios,
      bundleIdentifier: resolvedIosBundle,
      googleServicesFile: iosServicesFile,
      config: {
        ...config.ios?.config,
        googleMapsApiKey:
          googleMapsApiKey.ios ?? config.ios?.config?.googleMapsApiKey,
      },
    },
  };
};
