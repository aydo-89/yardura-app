import { addDays, startOfDay } from "date-fns";

import { prisma } from "@/lib/prisma";
import { computeRouteSuggestions, attachVisitToRoute } from "@/lib/dispatch/routes";
import type { RouteSuggestion } from "@/lib/dispatch/routes";
import { ensureDispatchSchema } from "@/lib/dispatch/schema-guard";
import { normalizePreferredTimeWindowSlug } from "@/lib/time-window";
import type { Prisma } from "@prisma/client";

interface GenerateRouteDraftArgs {
  orgId: string;
  date?: Date;
  lookAheadDays?: number;
  autopromote?: boolean;
}

interface GenerateRouteDraftResult {
  draftsCreated: number;
  autoPromoted: number;
  suggestions: RouteSuggestion[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculateConfidence(suggestion: RouteSuggestion): number {
  let score = suggestion.type === "existing" ? 0.82 : 0.62;

  if (suggestion.windowSlug) {
    score += 0.05;
  }

  if (typeof suggestion.distanceMeters === "number") {
    const km = suggestion.distanceMeters / 1000;
    score -= clamp(km / 40, 0, 0.2);
  }

  if (typeof suggestion.durationSeconds === "number") {
    const minutes = suggestion.durationSeconds / 60;
    score -= clamp((minutes - 20) / 120, 0, 0.15);
  }

  if (suggestion.frequency === "TWICE_WEEKLY" || suggestion.frequency === "DAILY") {
    score -= 0.03;
  }

  return clamp(score, 0.1, 0.99);
}

function serializeSuggestionMetadata(
  suggestion: RouteSuggestion,
  extra?: Record<string, unknown>,
): Prisma.JsonObject {
  const base = JSON.parse(JSON.stringify(suggestion)) as Record<string, unknown>;
  return {
    ...base,
    ...(extra ?? {}),
  } as Prisma.JsonObject;
}

async function autoPromoteExistingSuggestion(
  orgId: string,
  suggestion: RouteSuggestion,
  confidence: number,
) {
  if (!suggestion.routeId) return false;

  const route = await prisma.routeInstance.findUnique({
    where: { id: suggestion.routeId },
    select: { stops: { select: { position: true }, orderBy: { position: "asc" } }, technicianId: true, orgId: true },
  });

  if (!route) return false;

  let position = route.stops.length;
  for (const visitId of suggestion.visitIds) {
    await attachVisitToRoute(suggestion.routeId, visitId, position);
    position += 1;
  }

  await prisma.dispatchDecisionLog.create({
    data: {
      orgId,
      action: "auto_promote_route_assignment",
      routeInstanceId: suggestion.routeId,
      serviceVisitId: suggestion.visitIds[0],
      confidence,
      metadata: serializeSuggestionMetadata(suggestion),
    },
  });

  return true;
}

export async function generateRouteDrafts(
  args: GenerateRouteDraftArgs,
): Promise<GenerateRouteDraftResult> {
  await ensureDispatchSchema();
  // Auto-promotion disabled to prevent automatic route assignments.
  const autoPromoteEnabled = false;

  const date = args.date ? startOfDay(args.date) : startOfDay(new Date());
  const to = addDays(date, (args.lookAheadDays ?? 0) + 1);

  const suggestions = await computeRouteSuggestions({
    orgId: args.orgId,
    from: date,
    to,
  });

  const routeTechnicianMap = new Map<string, string | null>();
  const routeIds = suggestions
    .map((suggestion) => suggestion.routeId)
    .filter((id): id is string => Boolean(id));

  if (routeIds.length) {
    const routes = await prisma.routeInstance.findMany({
      where: { id: { in: Array.from(new Set(routeIds)) } },
      select: { id: true, technicianId: true },
    });
    routes.forEach((route) => {
      routeTechnicianMap.set(route.id, route.technicianId ?? null);
    });
  }

  await prisma.dispatchRouteDraft.deleteMany({
    where: {
      orgId: args.orgId,
      scheduledDate: {
        gte: date,
        lt: to,
      },
    },
  });

  let draftsCreated = 0;
  let autoPromoted = 0;

  for (const suggestion of suggestions) {
    const confidence = calculateConfidence(suggestion);
    const windowSlug = normalizePreferredTimeWindowSlug(
      suggestion.windowSlug ?? null,
    );

    const draft = await prisma.dispatchRouteDraft.create({
      data: {
        orgId: args.orgId,
        scheduledDate: new Date(suggestion.scheduledDate),
        windowSlug: windowSlug ?? undefined,
        technicianId: suggestion.routeId
          ? routeTechnicianMap.get(suggestion.routeId) ?? undefined
          : undefined,
        confidence,
        totalDriveMinutes: suggestion.distanceMeters
          ? suggestion.distanceMeters / 1000 / 0.8
          : null,
        metadata: serializeSuggestionMetadata(suggestion),
      },
    });
    draftsCreated += 1;

    if (
      autoPromoteEnabled &&
      args.autopromote !== false &&
      suggestion.type === "existing" &&
      confidence >= 0.9
    ) {
      const promoted = await autoPromoteExistingSuggestion(
        args.orgId,
        suggestion,
        confidence,
      );
      if (promoted) {
        autoPromoted += 1;
        await prisma.dispatchRouteDraft.update({
          where: { id: draft.id },
          data: {
            metadata: serializeSuggestionMetadata(suggestion, {
              autoPromoted: true,
              autopromotedAt: new Date().toISOString(),
            }),
          },
        });
      }
    }
  }

  return { draftsCreated, autoPromoted, suggestions };
}
