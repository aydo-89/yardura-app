const DATE_PART_RE = /^(\d{4}-\d{2}-\d{2})/;

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function parseDateInput(value: string): Date {
  if (!value) return new Date(NaN);
  const match = DATE_PART_RE.exec(value);
  if (match) {
    return parseDateOnly(match[1]);
  }
  return new Date(value);
}
