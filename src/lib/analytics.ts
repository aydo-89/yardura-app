type AnalyticsPayload = Record<string, unknown>;

const hasRealAnalytics = false; // Flip when wiring a real provider

export function track(eventName: string, payload: AnalyticsPayload = {}) {
  if (!eventName) return;
  if (hasRealAnalytics) {
    // Wire real analytics provider here
    // e.g., window.gtag?.('event', eventName, payload);
  } else {
    // Safe no-op with debug log for development
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.info(`[analytics] ${eventName}`, payload);
    }
  }
}

