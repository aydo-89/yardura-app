import { AvailabilityWindow, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface ScooperAvailabilityRow {
  id: string;
  tileId: string;
  tileSlug: string;
  tileName: string;
  weekday: number;
  window: AvailabilityWindow;
  maxStops: number | null;
}

export interface ScooperAvailabilitySummary {
  profileId: string;
  userId: string;
  name: string;
  status: string;
  availability: ScooperAvailabilityRow[];
}

type AvailabilityWithTile = Prisma.ScooperAvailabilityGetPayload<{
  include: {
    tile: {
      select: {
        id: true;
        slug: true;
        name: true;
      };
    };
  };
}>;

function toRow(entry: AvailabilityWithTile): ScooperAvailabilityRow {
  const tile = entry.tile;
  return {
    id: entry.id,
    tileId: tile?.id ?? entry.tileId ?? "",
    tileSlug: tile?.slug ?? "",
    tileName: tile?.name ?? "Unknown tile",
    weekday: entry.weekday,
    window: entry.window,
    maxStops: entry.maxStops,
  };
}

export async function listScooperAvailability(orgId: string): Promise<ScooperAvailabilitySummary[]> {
  const profiles = await prisma.scooperProfile.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      availabilities: {
        include: {
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return profiles.map((profile) => ({
    profileId: profile.id,
    userId: profile.userId,
    name: profile.user?.name ?? "",
    status: profile.status,
    availability: profile.availabilities.map(toRow),
  }));
}

export async function updateScooperAvailability(
  orgId: string,
  scooperProfileId: string,
  options: {
    removeIds?: string[];
    add?: Array<{
      tileId: string;
      weekday: number;
      window?: AvailabilityWindow;
      maxStops?: number | null;
    }>;
  },
) {
  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperProfileId, orgId },
  });

  if (!profile) {
    throw new Error("scooper_not_found");
  }

  const removeIds = Array.from(new Set(options.removeIds ?? [])).filter(Boolean);
  const addBlocks = options.add ?? [];

  return prisma.$transaction(async (tx) => {
    if (removeIds.length) {
      await tx.scooperAvailability.deleteMany({
        where: {
          id: { in: removeIds },
          scooperId: scooperProfileId,
        },
      });
    }

    if (addBlocks.length) {
      const existing = await tx.scooperAvailability.findMany({
        where: { scooperId: scooperProfileId },
      });

      const existingKeyMap = new Map<string, typeof existing[number]>();
      for (const entry of existing) {
        const key = `${entry.tileId}:${entry.weekday}:${entry.window}`;
        existingKeyMap.set(key, entry);
      }

      for (const block of addBlocks) {
        const key = `${block.tileId}:${block.weekday}:${block.window ?? AvailabilityWindow.FULL}`;
        const payload = {
          tileId: block.tileId,
          weekday: block.weekday,
          window: block.window ?? AvailabilityWindow.FULL,
          maxStops: block.maxStops ?? null,
        };

        const existingEntry = existingKeyMap.get(key);
        if (existingEntry) {
          await tx.scooperAvailability.update({
            where: { id: existingEntry.id },
            data: {
              maxStops: payload.maxStops,
            },
          });
        } else {
          const created = await tx.scooperAvailability.create({
            data: {
              orgId,
              scooperId: scooperProfileId,
              tileId: payload.tileId,
              weekday: payload.weekday,
              window: payload.window,
              maxStops: payload.maxStops,
            },
          });
          existingKeyMap.set(key, created);
        }
      }
    }

    const refreshed = await tx.scooperAvailability.findMany({
      where: { scooperId: scooperProfileId },
      include: {
        tile: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy: [
        { tile: { name: "asc" } },
        { weekday: "asc" },
      ],
    });

    return refreshed.map(toRow);
  });
}
