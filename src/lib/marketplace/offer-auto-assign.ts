import { Prisma } from "@prisma/client";

type AutoAssignState = {
  declinedBy: string[];
  lastAttemptAt?: string;
  lastOfferedToId?: string;
  lastDeclinedAt?: string;
};

type MetadataShape = {
  autoAssign?: Record<string, unknown>;
  [key: string]: unknown;
};

function normalizeMetadata(raw: Prisma.JsonValue | null | undefined): MetadataShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

function normalizeAutoAssign(raw: unknown): AutoAssignState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { declinedBy: [] };
  }

  const record = raw as Record<string, unknown>;
  const declinedBy = Array.isArray(record.declinedBy)
    ? record.declinedBy.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    declinedBy,
    lastAttemptAt: typeof record.lastAttemptAt === "string" ? record.lastAttemptAt : undefined,
    lastOfferedToId: typeof record.lastOfferedToId === "string" ? record.lastOfferedToId : undefined,
    lastDeclinedAt: typeof record.lastDeclinedAt === "string" ? record.lastDeclinedAt : undefined,
  };
}

export function readAutoAssignState(raw: Prisma.JsonValue | null | undefined): AutoAssignState {
  const metadata = normalizeMetadata(raw);
  return normalizeAutoAssign(metadata.autoAssign);
}

export function markAutoAssignAttempt(
  raw: Prisma.JsonValue | null | undefined,
  options: { userId: string; now: Date },
): Prisma.InputJsonValue {
  const metadata = normalizeMetadata(raw);
  const autoAssign = normalizeAutoAssign(metadata.autoAssign);

  autoAssign.lastAttemptAt = options.now.toISOString();
  autoAssign.lastOfferedToId = options.userId;

  metadata.autoAssign = autoAssign as Record<string, unknown>;
  return metadata as Prisma.InputJsonValue;
}

export function markAutoAssignDecline(
  raw: Prisma.JsonValue | null | undefined,
  options: { userId: string; now: Date },
): Prisma.InputJsonValue {
  const metadata = normalizeMetadata(raw);
  const autoAssign = normalizeAutoAssign(metadata.autoAssign);
  const declines = new Set(autoAssign.declinedBy);
  declines.add(options.userId);

  autoAssign.declinedBy = Array.from(declines);
  autoAssign.lastDeclinedAt = options.now.toISOString();
  autoAssign.lastOfferedToId = options.userId;

  metadata.autoAssign = autoAssign as Record<string, unknown>;
  return metadata as Prisma.InputJsonValue;
}
