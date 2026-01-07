import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { apiRequest } from '@/lib/api/client';
import { getJson, removeItem, setJson } from '@/lib/storage';
import { ensurePushRegistration } from '@/lib/notifications/push';
import type { AppUserRole, AuthLoginResponse, AuthSession } from '@/lib/auth/types';
import { REVENUECAT_API_KEYS } from '@/lib/config';

const AUTH_STORAGE_KEY = 'insightscoop_auth';

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  setActiveRole: (role: AppUserRole) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function resolveActiveRole(
  roles: AppUserRole[],
  preferred?: AppUserRole | null,
): AppUserRole | null {
  if (preferred && roles.includes(preferred)) return preferred;
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  return roles[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const purchasesConfigured = useRef(false);
  const revenueCatUserId = useRef<string | null>(null);

  const persistSession = useCallback(async (next: AuthSession | null) => {
    if (!next) {
      await removeItem(AUTH_STORAGE_KEY);
      return;
    }
    await setJson(AUTH_STORAGE_KEY, next);
  }, []);

  const refreshSession = useCallback(
    async (existing?: AuthSession | null) => {
      if (!existing) return null;
      const preferredRole = existing.activeRole ?? undefined;
      const refreshed = await apiRequest<AuthLoginResponse>(
        '/api/mobile/auth/me',
        {
          token: existing.token,
          headers: preferredRole ? { 'X-Preferred-Role': preferredRole } : {},
        },
      );
      const roles = refreshed.roles ?? existing.roles;
      const activeRole = resolveActiveRole(roles, refreshed.activeRole ?? existing.activeRole);
      const next: AuthSession = {
        token: refreshed.token ?? existing.token,
        user: refreshed.user ?? existing.user,
        roles,
        activeRole,
      };
      setSession(next);
      await persistSession(next);
      return next;
    },
    [persistSession],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const stored = await getJson<AuthSession>(AUTH_STORAGE_KEY);
      if (!mounted) return;
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        await refreshSession(stored);
      } catch {
        setSession(null);
        await removeItem(AUTH_STORAGE_KEY);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.token) return;
    void ensurePushRegistration(session.token);
  }, [session?.token]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const apiKey =
      Platform.OS === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
    if (!apiKey) return;
    if (!__DEV__ && apiKey.startsWith('test_')) {
      console.warn('RevenueCat test key ignored in release builds.');
      return;
    }

    if (!purchasesConfigured.current) {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);
      const config: { apiKey: string; appUserID?: string } = { apiKey };
      if (session?.user?.id) {
        config.appUserID = session.user.id;
      }
      Purchases.configure(config);
      purchasesConfigured.current = true;
      revenueCatUserId.current = session?.user?.id ?? null;
      return;
    }

    const nextUserId = session?.user?.id ?? null;
    if (nextUserId && nextUserId !== revenueCatUserId.current) {
      Purchases.logIn(nextUserId).catch(() => null);
      revenueCatUserId.current = nextUserId;
      return;
    }

    if (!nextUserId && revenueCatUserId.current) {
      Purchases.logOut().catch(() => null);
      revenueCatUserId.current = null;
    }
  }, [session?.user?.id]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const payload = await apiRequest<AuthLoginResponse>(
        '/api/mobile/auth/login',
        {
          method: 'POST',
          body: { email, password },
        },
      );
      const roles = payload.roles ?? [];
      const activeRole = resolveActiveRole(roles, payload.activeRole);
      const next: AuthSession = {
        token: payload.token,
        user: payload.user,
        roles,
        activeRole,
      };
      setSession(next);
      await persistSession(next);
      return next;
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    setSession(null);
    await removeItem(AUTH_STORAGE_KEY);
  }, []);

  const setActiveRole = useCallback(
    async (role: AppUserRole) => {
      if (!session) return;
      const next = { ...session, activeRole: role };
      setSession(next);
      await persistSession(next);
    },
    [session, persistSession],
  );

  const value = useMemo(
    () => ({ session, loading, signIn, signOut, setActiveRole }),
    [session, loading, signIn, signOut, setActiveRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
