import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';

/**
 * Request App Tracking Transparency permission on iOS.
 * This is required by Apple for apps that track users across apps/websites.
 *
 * Should be called after the app has fully loaded (not during splash).
 * Returns the permission status.
 */
export async function requestTrackingPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'restricted'> {
  // Only needed on iOS
  if (Platform.OS !== 'ios') {
    return 'granted';
  }

  try {
    // Check current status first
    const { status: existingStatus } = await TrackingTransparency.getTrackingPermissionsAsync();

    // If already determined, return current status
    if (existingStatus !== 'undetermined') {
      return existingStatus;
    }

    // Request permission
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
    return status;
  } catch (error) {
    // In development or if the API isn't available, default to granted
    if (__DEV__) {
      console.log('[ATT] Tracking transparency not available in development');
    }
    return 'undetermined';
  }
}

/**
 * Check if tracking is allowed without requesting permission.
 */
export async function isTrackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
