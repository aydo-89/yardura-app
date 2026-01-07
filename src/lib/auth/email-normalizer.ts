const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  const trimmed = value.trim();
  return trimmed.toLowerCase();
}

export function normalizeEmailOrThrow(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Email must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Email is required");
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new Error("Invalid email address");
  }
  return trimmed.toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}
