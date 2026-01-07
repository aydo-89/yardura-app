import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';

type CaptureKind = 'photo' | 'video';

type CaptureOptions = {
  kind: CaptureKind;
  quality?: number;
  cameraType?: ImagePicker.CameraType;
  videoMaxDuration?: number;
  source?: 'auto' | 'camera' | 'library';
};

function isCameraUnavailable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = (error as Error).message ?? '';
  const codeValue = (error as { code?: string }).code ?? '';
  const messageLower = message.toLowerCase();
  const codeLower = String(codeValue).toLowerCase();
  return (
    messageLower.includes('camera not available') ||
    messageLower.includes('simulator') ||
    codeLower.includes('camera') && codeLower.includes('unavailable')
  );
}

export async function captureWithFallback(options: CaptureOptions) {
  const { kind, quality = 0.85, cameraType, videoMaxDuration, source = 'auto' } = options;
  const mediaTypes = (kind === 'video' ? ['videos'] : ['images']) as ImagePicker.MediaType[];
  const isSimulator = Platform.OS !== 'web' && Device.isDevice !== true;

  if (!isSimulator && source !== 'library') {
    let cameraPermission: ImagePicker.PermissionResponse | null = null;
    try {
      cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    } catch (error) {
      cameraPermission = null;
    }

    if (cameraPermission?.granted) {
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes,
          quality,
          cameraType,
          videoMaxDuration,
        });
        if (!result.canceled && result.assets.length > 0) {
          return result.assets[0];
        }
      } catch (error) {
        if (!isCameraUnavailable(error)) {
          console.warn('camera.launch.failed', error);
        }
      }
    }
  }

  if (source === 'camera') {
    return null;
  }

  const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libraryPermission.granted) {
    return null;
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality,
      videoMaxDuration,
    });
    if (result.canceled || result.assets.length === 0) {
      return null;
    }
    return result.assets[0];
  } catch {
    return null;
  }
}
