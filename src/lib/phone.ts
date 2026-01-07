export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.startsWith("+")) {
    return digits;
  }

  return `+${digits}`;
}
