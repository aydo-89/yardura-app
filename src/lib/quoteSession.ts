const QUOTE_SESSION_STORAGE_KEY = "yardura-quote-session-id";

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `qs_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
}

export function ensureQuoteSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(QUOTE_SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const id = generateSessionId();
    window.localStorage.setItem(QUOTE_SESSION_STORAGE_KEY, id);
    return id;
  } catch (error) {
    console.warn("Unable to persist quote session id", error);
    return null;
  }
}

export function getQuoteSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(QUOTE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read quote session id", error);
    return null;
  }
}

export function clearQuoteSessionId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUOTE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear quote session id", error);
  }
}

export function getQuoteSessionKey() {
  return QUOTE_SESSION_STORAGE_KEY;
}
