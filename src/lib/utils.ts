import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(input: string): string {
  if (!input) {
    return "";
  }

  let digits = input.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function getVisitsBounds(visitsPerMonth?: number | null): { min: number; max: number } | null {
  if (typeof visitsPerMonth !== "number" || !Number.isFinite(visitsPerMonth) || visitsPerMonth <= 0) {
    return null;
  }

  let minVisits = Math.max(1, Math.floor(visitsPerMonth));
  let maxVisits = Math.max(minVisits, Math.ceil(visitsPerMonth));

  if (visitsPerMonth <= 2.5) {
    const rounded = Math.max(1, Math.round(visitsPerMonth));
    minVisits = rounded;
    maxVisits = rounded;
  }

  return { min: minVisits, max: maxVisits };
}

export function formatVisitsRange(visitsPerMonth?: number | null): string | null {
  const bounds = getVisitsBounds(visitsPerMonth);
  if (!bounds) {
    return null;
  }

  if (bounds.min === bounds.max) {
    return `${bounds.min} visit${bounds.min === 1 ? "" : "s"}/mo`;
  }

  const start = Math.max(1, Math.floor(bounds.min));
  const end = Math.max(start, Math.ceil(bounds.max));
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }

  if (values.length === 2) {
    return `${values[0]} or ${values[1]} visits/mo`;
  }

  const head = values.slice(0, -1).join(", ");
  const tail = values[values.length - 1];
  return `${head}, or ${tail} visits/mo`;
}
