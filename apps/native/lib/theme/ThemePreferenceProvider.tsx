import { type ColorSchemeName, useColorScheme as useSystemColorScheme } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getItem, setItem } from '@/lib/storage';

type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedScheme: ColorSchemeName;
  setPreference: (preference: ThemePreference) => void;
  loading: boolean;
};

const STORAGE_KEY = 'theme_preference';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadPreference = async () => {
      const stored = await getItem(STORAGE_KEY);
      if (!mounted) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setLoading(false);
    };
    loadPreference();
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void setItem(STORAGE_KEY, next);
  }, []);

  const resolvedScheme = preference === 'system' ? systemScheme : preference;

  const value = useMemo(
    () => ({
      preference,
      resolvedScheme,
      setPreference,
      loading,
    }),
    [preference, resolvedScheme, setPreference, loading],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
