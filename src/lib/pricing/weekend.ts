export function extractWeekendUpgrade(...sources: unknown[]): boolean {
  const queue: unknown[] = [];

  for (const source of sources) {
    if (source === undefined || source === null) {
      continue;
    }

    if (typeof source === "boolean") {
      if (source) {
        return true;
      }
      continue;
    }

    if (typeof source === "string") {
      const trimmed = source.trim();
      if (!trimmed) {
        continue;
      }
      try {
        queue.push(JSON.parse(trimmed));
        continue;
      } catch {
        continue;
      }
    }

    queue.push(source);
  }

  const visited = new Set<object>();

  while (queue.length) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    if (typeof current === "boolean") {
      if (current) {
        return true;
      }
      continue;
    }

    if (typeof current === "string") {
      try {
        queue.push(JSON.parse(current));
      } catch {
        continue;
      }
      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    const asObject = current as Record<string, unknown>;
    if (visited.has(asObject)) {
      continue;
    }
    visited.add(asObject);

    if (typeof asObject.weekendUpgrade === "boolean") {
      if (asObject.weekendUpgrade) {
        return true;
      }
    }

    if (Array.isArray(current)) {
      for (const value of current) {
        if (value !== undefined) {
          queue.push(value);
        }
      }
      continue;
    }

    for (const value of Object.values(asObject)) {
      if (value !== undefined) {
        queue.push(value);
      }
    }
  }

  return false;
}
