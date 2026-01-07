import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';
const getLocalStorage = () => {
  if (!isWeb) return null;
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage) return null;
    if (typeof window.localStorage.getItem !== 'function') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};
const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

const normalizeKey = (key: string): string | null => {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (KEY_PATTERN.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/[^A-Za-z0-9_.-]/g, '_');
  return normalized.length > 0 ? normalized : null;
};

async function secureStoreAvailable(): Promise<boolean> {
  if (isWeb) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  const safeKey = normalizeKey(key);
  if (!safeKey) return;
  if (await secureStoreAvailable()) {
    await SecureStore.setItemAsync(safeKey, value);
    return;
  }
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(safeKey, value);
    } catch {
      return;
    }
  }
}

export async function getItem(key: string): Promise<string | null> {
  const safeKey = normalizeKey(key);
  if (!safeKey) return null;
  if (await secureStoreAvailable()) {
    return SecureStore.getItemAsync(safeKey);
  }
  const storage = getLocalStorage();
  if (storage) {
    try {
      return storage.getItem(safeKey);
    } catch {
      return null;
    }
  }
  return null;
}

export async function removeItem(key: string): Promise<void> {
  const safeKey = normalizeKey(key);
  if (!safeKey) return;
  if (await secureStoreAvailable()) {
    await SecureStore.deleteItemAsync(safeKey);
    return;
  }
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(safeKey);
    } catch {
      return;
    }
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
