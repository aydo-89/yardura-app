"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  defaultTrackingConsent,
  persistStoredConsent,
  clearStoredConsent,
  readStoredConsent,
} from "@/lib/trackingConsent";

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
}

interface TrackingConsentContextValue {
  consent: ConsentState;
  setConsent: (next: ConsentState) => void;
  resetConsent: () => void;
  isReady: boolean;
}

const TrackingConsentContext = createContext<TrackingConsentContextValue | null>(
  null,
);

const defaultConsent: ConsentState = defaultTrackingConsent;

export function TrackingConsentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [consent, setConsentState] = useState<ConsentState>(defaultConsent);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setConsentState(readStoredConsent());
    } catch (error) {
      console.warn("Failed to parse tracking consent", error);
    } finally {
      setIsReady(true);
    }
  }, []);

  const persistConsent = (next: ConsentState) => {
    setConsentState(next);
    persistStoredConsent(next);
  };

  const resetConsent = () => {
    setConsentState(defaultConsent);
    clearStoredConsent();
  };

  const contextValue = useMemo<TrackingConsentContextValue>(
    () => ({ consent, setConsent: persistConsent, resetConsent, isReady }),
    [consent, isReady],
  );

  const pathname = usePathname() ?? "/";
  const showPreferencesButton = pathname === "/";

  return (
    <TrackingConsentContext.Provider value={contextValue}>
      {children}
      <CookieConsentBanner
        consent={consent}
        isReady={isReady}
        onUpdate={persistConsent}
      />
      <CookiePreferencesButton
        consent={consent}
        isReady={isReady}
        showManageButton={showPreferencesButton}
        onManage={() =>
          persistConsent({
            analytics: consent.analytics,
            marketing: consent.marketing,
            decided: false,
          })
        }
      />
    </TrackingConsentContext.Provider>
  );
}

export function useTrackingConsent() {
  const ctx = useContext(TrackingConsentContext);
  if (!ctx) {
    throw new Error(
      "useTrackingConsent must be used within a TrackingConsentProvider",
    );
  }
  return ctx;
}

function CookieConsentBanner({
  consent,
  isReady,
  onUpdate,
}: {
  consent: ConsentState;
  isReady: boolean;
  onUpdate: (next: ConsentState) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isReady && !consent.decided) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [consent.decided, isReady]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-[rgba(20,92,69,0.2)] bg-white/95 p-4 text-brand-ink shadow-xl backdrop-blur-md sm:p-6 dark:border-emerald-500/40 dark:bg-[#061a12]/95 dark:text-emerald-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-sm text-[rgba(var(--graphite-rgb-commas),0.72)] dark:text-emerald-100/80">
          <p className="font-semibold text-brand-ink dark:text-emerald-50">Cookies & analytics</p>
          <p className="text-[rgba(var(--graphite-rgb-commas),0.65)] dark:text-emerald-100/75">
            We use cookies to learn how visitors use InsightScoop and to run future
            marketing campaigns. You can accept or decline. Read more in our{' '}
            <a
              href="/legal/privacy"
              className="font-semibold text-[#145c45] underline-offset-2 hover:underline dark:text-emerald-200"
            >
              privacy policy
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onUpdate({ analytics: false, marketing: false, decided: true });
            }}
            className="w-full border-[rgba(20,92,69,0.3)] text-brand-ink dark:border-emerald-400/40 dark:text-emerald-50 sm:w-auto"
          >
            Decline
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onUpdate({ analytics: true, marketing: false, decided: true });
            }}
            className="w-full text-brand-ink dark:text-emerald-900 sm:w-auto"
          >
            Analytics only
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onUpdate({ analytics: true, marketing: true, decided: true });
            }}
            className="w-full sm:w-auto"
          >
            Allow cookies
          </Button>
        </div>
      </div>
    </div>
  );
}

function CookiePreferencesButton({
  consent,
  isReady,
  showManageButton,
  onManage,
}: {
  consent: ConsentState;
  isReady: boolean;
  showManageButton: boolean;
  onManage: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isReady) {
      setVisible(false);
      return;
    }

    setVisible(consent.decided);
  }, [consent.decided, isReady]);

  if (!visible || !showManageButton) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[90]">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full border border-[rgba(20,92,69,0.2)] bg-white/90 px-4 py-2 text-xs text-[rgba(var(--graphite-rgb-commas),0.75)] shadow-sm backdrop-blur hover:bg-white dark:border-emerald-500/40 dark:bg-[#0b2016]/90 dark:text-emerald-100 dark:hover:bg-[#123422]"
        onClick={onManage}
      >
        Cookie preferences
      </Button>
    </div>
  );
}
