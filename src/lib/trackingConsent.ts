export interface StoredConsent {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
}

export const TRACKING_CONSENT_STORAGE_KEY = "yardura-tracking-consent";

const defaultConsent: StoredConsent = {
  analytics: false,
  marketing: false,
  decided: false,
};

export function readStoredConsent(): StoredConsent {
  if (typeof window === "undefined") {
    return defaultConsent;
  }

  try {
    const stored = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    if (!stored) return defaultConsent;

    const parsed = JSON.parse(stored) as Partial<StoredConsent>;
    return {
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decided: Boolean(parsed.decided),
    };
  } catch (error) {
    console.warn("Failed to read stored tracking consent", error);
    return defaultConsent;
  }
}

export function persistStoredConsent(consent: StoredConsent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    TRACKING_CONSENT_STORAGE_KEY,
    JSON.stringify(consent),
  );
}

export function clearStoredConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TRACKING_CONSENT_STORAGE_KEY);
}

export function hasAnalyticsConsent(consent?: StoredConsent): boolean {
  const source = consent ?? readStoredConsent();
  return Boolean(source.analytics);
}

export function hasMarketingConsent(consent?: StoredConsent): boolean {
  const source = consent ?? readStoredConsent();
  return Boolean(source.marketing);
}

export { defaultConsent as defaultTrackingConsent };
