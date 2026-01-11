import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import Constants from 'expo-constants';

import { logWarn } from '@/lib/logger';

type PressHandlers = {
  onSinglePress: () => void;
  onDoublePress: () => void;
  enabled?: boolean;
  delayMs?: number;
};

type VolumeManagerType = {
  addVolumeListener: (listener: (event: { volume: number }) => void) => { remove: () => void };
  getVolume: () => Promise<{ volume: number }>;
  setVolume: (volume: number, config?: { showUI?: boolean; playSound?: boolean; type?: string }) => Promise<void>;
  showNativeVolumeUI?: (config: { enabled: boolean }) => Promise<void>;
  enable?: (enabled: boolean, async?: boolean) => Promise<void>;
  setActive?: (enabled: boolean, async?: boolean) => Promise<void>;
};

// Check if we're running in Expo Go (which doesn't support native modules)
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let activeShutterSessions = 0;
let sharedManager: VolumeManagerType | null = null;
let volumeUiSuppressed = false;

function resolveSharedManager(manager: VolumeManagerType | null) {
  if (!manager) return null;
  if (!sharedManager) {
    sharedManager = manager;
  }
  return sharedManager;
}

function suppressVolumeUi(manager: VolumeManagerType) {
  if (typeof manager.showNativeVolumeUI !== 'function') return;
  manager
    .showNativeVolumeUI({ enabled: false })
    .then(() => {
      volumeUiSuppressed = true;
    })
    .catch((error) => {
      logWarn('remoteShutter.volume.ui.disable.failed', error);
    });
}

function restoreVolumeUi(manager: VolumeManagerType) {
  if (!volumeUiSuppressed || typeof manager.showNativeVolumeUI !== 'function') return;
  manager
    .showNativeVolumeUI({ enabled: true })
    .then(() => {
      volumeUiSuppressed = false;
    })
    .catch((error) => {
      logWarn('remoteShutter.volume.ui.enable.failed', error);
    });
}

function acquireRemoteShutter(manager: VolumeManagerType | null) {
  const resolved = resolveSharedManager(manager);
  if (!resolved) return;
  activeShutterSessions += 1;
  if (activeShutterSessions !== 1) return;

  if (typeof resolved.enable === 'function') {
    resolved.enable(true, true).catch((error) => {
      logWarn('remoteShutter.enable.failed', error);
    });
  }

  if (typeof resolved.setActive === 'function') {
    resolved.setActive(true, true).catch((error) => {
      logWarn('remoteShutter.active.enable.failed', error);
    });
  }

  suppressVolumeUi(resolved);
}

function releaseRemoteShutter(manager: VolumeManagerType | null) {
  const resolved = resolveSharedManager(manager);
  if (!resolved) return;
  activeShutterSessions = Math.max(activeShutterSessions - 1, 0);
  if (activeShutterSessions !== 0) return;

  restoreVolumeUi(resolved);

  if (typeof resolved.setActive === 'function') {
    resolved.setActive(false, true).catch((error) => {
      logWarn('remoteShutter.active.disable.failed', error);
    });
  }

  if (typeof resolved.enable === 'function') {
    resolved.enable(false, true).catch((error) => {
      logWarn('remoteShutter.enable.disable.failed', error);
    });
  }
}

function resolveVolumeManager(): VolumeManagerType | null {
  // Skip loading native module in Expo Go - it's not available
  if (isExpoGo) {
    if (__DEV__) console.log('remoteShutter: Skipping volume manager in Expo Go');
    return null;
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-volume-manager') as VolumeManagerType;
  } catch (error) {
    logWarn('remoteShutter.unavailable', error);
    return null;
  }
}

export function useRemoteShutter({
  onSinglePress,
  onDoublePress,
  enabled = true,
  delayMs = 280,
}: PressHandlers) {
  const [supported, setSupported] = useState(false);
  const onSingleRef = useRef(onSinglePress);
  const onDoubleRef = useRef(onDoublePress);
  const pressCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreRef = useRef(false);
  const ignoreVolumeUntilRef = useRef(0);

  useEffect(() => {
    onSingleRef.current = onSinglePress;
    onDoubleRef.current = onDoublePress;
  }, [onSinglePress, onDoublePress]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setSupported(false);
      return;
    }

    let isMounted = true;
    let subscription: { remove: () => void } | null = null;
    let nativeSubscription: { remove: () => void } | null = null;
    let baselineVolume: number | null = null;
    const volumeConfig = {
      showUI: false,
      playSound: false,
      type: Platform.OS === 'android' ? 'music' : undefined,
    };

    const handlePress = () => {
      pressCountRef.current += 1;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        const count = pressCountRef.current;
        pressCountRef.current = 0;
        if (count >= 2) {
          onDoubleRef.current();
        } else {
          onSingleRef.current();
        }
      }, delayMs);
    };

    const clampVolume = (value: number) => Math.min(Math.max(value, 0.2), 0.8);
    const manager = resolveVolumeManager();
    acquireRemoteShutter(manager);

    const setup = async () => {
      nativeSubscription = DeviceEventEmitter.addListener(
        'native-shutter',
        (payload?: { direction?: string }) => {
          if (!isMounted || !enabled) return;
          if (payload?.direction === 'down') return;
          ignoreVolumeUntilRef.current = Date.now() + 160;
          handlePress();
        },
      );

      if (!manager) {
        if (isMounted) {
          setSupported(Platform.OS === 'android');
        }
        return;
      }

      subscription = manager.addVolumeListener(({ volume }) => {
        if (!isMounted || ignoreRef.current || !enabled) return;
        if (Date.now() < ignoreVolumeUntilRef.current) return;
        if (Number.isFinite(volume) && baselineVolume === null) {
          baselineVolume = clampVolume(volume);
        }
        handlePress();
        if (
          Number.isFinite(volume) &&
          baselineVolume !== null &&
          Math.abs(volume - baselineVolume) > 0.02 &&
          typeof manager.setVolume === 'function'
        ) {
          ignoreRef.current = true;
          manager
            .setVolume(baselineVolume, volumeConfig)
            .catch((error) => logWarn('remoteShutter.volume.reset.failed', error))
            .finally(() => {
              setTimeout(() => {
                ignoreRef.current = false;
              }, 120);
            });
        } else if (Number.isFinite(volume) && baselineVolume !== null && Math.abs(volume - baselineVolume) > 0.02) {
          ignoreRef.current = true;
          setTimeout(() => {
            ignoreRef.current = false;
          }, 120);
        }
      });

      const reassertVolumeUi = async () => {
        if (!manager) return;
        suppressVolumeUi(manager);
      };

      try {
        await reassertVolumeUi();
        setTimeout(() => {
          if (!isMounted) return;
          reassertVolumeUi();
        }, 300);

        const volume = await manager.getVolume();
        const current = Number.isFinite(volume?.volume) ? volume.volume : null;
        if (current !== null && baselineVolume === null) {
          baselineVolume = clampVolume(current);
        }
        if (current !== null && baselineVolume !== null && Math.abs(current - baselineVolume) > 0.02 && typeof manager.setVolume === 'function') {
          ignoreRef.current = true;
          try {
            await manager.setVolume(baselineVolume, volumeConfig);
          } catch (error) {
            logWarn('remoteShutter.volume.set.failed', error);
          } finally {
            setTimeout(() => {
              ignoreRef.current = false;
            }, 200);
          }
        }
      } catch (error) {
        logWarn('remoteShutter.volume.read.failed', error);
      }

      if (isMounted) {
        setSupported(true);
      }
    };

    setup();

    return () => {
      isMounted = false;
      subscription?.remove();
      nativeSubscription?.remove();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      releaseRemoteShutter(manager);
    };
  }, [enabled, delayMs]);

  return { supported };
}
