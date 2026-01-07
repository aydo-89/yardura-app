import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const resolveMapsKey = () =>
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = resolveMapsKey();

  return {
    ...config,
    name: config.name ?? 'InsightScoop',
    slug: config.slug ?? 'insightscoop',
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey ?? config.android?.config?.googleMaps?.apiKey,
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey:
          googleMapsApiKey ?? config.ios?.config?.googleMapsApiKey,
      },
    },
  };
};
