import type { ZipEligibilityResult } from "@/lib/zip-eligibility";
import type { ServiceTileStatus } from "@prisma/client";

export interface TileMessaging {
  headline: string;
  detail?: string;
  advisories: string[];
}

function buildWaitlistCopy(tile: ZipEligibilityResult["tile"], eligible: boolean): TileMessaging {
  if (!tile) {
    return {
      headline: eligible
        ? "We're activating routes here shortly."
        : "You're on our expansion radar.",
      detail: eligible
        ? "Lock in your spot now and you'll get first access when we open scheduling."
        : "We'll keep you posted as soon as we flip this tile live.",
      advisories: [],
    };
  }

  const activationEligible = tile.activationEligible ?? true;
  const advisories = tile.advisoryReasons ?? [];

  if (!activationEligible) {
    return {
      headline: eligible
        ? "We're activating routes here shortly."
        : "You're already on our expansion radar.",
      detail: "We need just a few more neighbors to hit the minimum density—join the early list and we'll fast-track your start date.",
      advisories,
    };
  }

  const detail = advisories[0] ?? "Demand is strong—save your spot now and we'll confirm dates as soon as the crew opens.";
  return {
    headline: eligible
      ? "We're activating routes here shortly."
      : "You're already on our expansion radar.",
    detail,
    advisories,
  };
}

function buildSuspendedCopy(tile: ZipEligibilityResult["tile"]): TileMessaging {
  return {
    headline: "Coverage is temporarily paused in this tile.",
    detail: tile?.advisoryReasons?.[0] ?? "We'll alert you the moment service resumes.",
    advisories: tile?.advisoryReasons ?? [],
  };
}

function buildLiveCopy(estimatedDelivery?: string | null, advisories: string[] = []): TileMessaging {
  return {
    headline: "🎉 We're live in your neighborhood!",
    detail:
      estimatedDelivery ||
      "We can typically schedule your kickoff within a couple business days.",
    advisories,
  };
}

function buildOutOfAreaCopy(tile: ZipEligibilityResult["tile"]): TileMessaging {
  if (tile?.status === "WAITLIST") {
    return buildWaitlistCopy(tile, false);
  }

  return {
    headline: "We're expanding soon! Join our waitlist.",
    detail: tile?.advisoryReasons?.[0] ?? "Share your contact info and we'll keep you updated on launch timing.",
    advisories: tile?.advisoryReasons ?? [],
  };
}

export function buildTileMessaging(result: ZipEligibilityResult): TileMessaging {
  const tile = result.tile;
  const advisories = tile?.advisoryReasons ?? [];

  if (!result.eligible) {
    return buildOutOfAreaCopy(tile);
  }

  const status = tile?.status as ServiceTileStatus | undefined;

  switch (status) {
    case "LIVE":
      return buildLiveCopy(result.estimatedDelivery, advisories);
    case "WAITLIST":
      return buildWaitlistCopy(tile, true);
    case "SUSPENDED":
      return buildSuspendedCopy(tile);
    default:
      return {
        headline: result.message || "We service your area!",
        detail: result.estimatedDelivery || undefined,
        advisories,
      };
  }
}
