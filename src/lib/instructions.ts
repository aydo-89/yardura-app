export function splitInstructions(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/\s*\(driveway side\)/gi, ""))
    .filter((line) => line.length > 0);
}
