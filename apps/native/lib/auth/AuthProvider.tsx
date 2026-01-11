import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import * as AppleAuthentication from 'expo-apple-authentication';

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
  signInWithApple: () => Promise<AuthSession>;
  isAppleAuthAvailable: boolean;
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
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const purchasesConfigured = useRef(false);
  const revenueCatUserId = useRef<string | null>(null);

  // Check Apple Sign In availability on mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable).catch(() => setIsAppleAuthAvailable(false));
    }
  }, []);

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
      // Test keys are silently ignored in release builds
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

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign In is only available on iOS');
    }

    // Request Apple credentials
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Apple only returns name/email on first sign in, so we need to handle both cases
    const fullName = credential.fullName
      ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
      : null;

    // Send to backend for verification and user creation/login
    const payload = await apiRequest<AuthLoginResponse>(
      '/api/mobile/auth/apple',
      {
        method: 'POST',
        body: {
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          email: credential.email,
          fullName,
          user: credential.user, // Apple user ID (stable across sessions)
        },
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
  }, [persistSession]);

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
    () => ({ session, loading, signIn, signInWithApple, isAppleAuthAvailable, signOut, setActiveRole }),
    [session, loading, signIn, signInWithApple, isAppleAuthAvailable, signOut, setActiveRole],
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
