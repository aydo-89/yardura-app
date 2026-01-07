import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { deleteFile } from "@/lib/supabase-admin";

const DEFAULT_BATCH_SIZE = 100;

export async function purgeExpiredServiceVisitMedia({
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
}: {
  batchSize?: number;
  dryRun?: boolean;
} = {}) {
  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    console.warn("[media-retention] STORAGE_BUCKET not configured; skipping purge");
    return { deleted: 0, skipped: 0 };
  }

  let deleted = 0;
  let skipped = 0;

  while (true) {
    const expired = await prisma.serviceVisitMedia.findMany({
      where: {
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
      select: {
        id: true,
        storagePath: true,
        thumbnailPath: true,
      },
      take: batchSize,
    });

    if (expired.length === 0) {
      break;
    }

    for (const media of expired) {
      try {
        if (!dryRun) {
          if (media.storagePath) {
            await deleteFile(bucket, media.storagePath);
          }
          if (media.thumbnailPath && media.thumbnailPath !== media.storagePath) {
            await deleteFile(bucket, media.thumbnailPath);
          }
          await prisma.serviceVisitMedia.delete({ where: { id: media.id } });
        }
        deleted += 1;
      } catch (error) {
        skipped += 1;
        console.error("[media-retention] Failed to remove media", {
          mediaId: media.id,
          error,
        });
      }
    }
  }

  return { deleted, skipped };
}

export async function purgeExpiredDailyChecks({
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
}: {
  batchSize?: number;
  dryRun?: boolean;
} = {}) {
  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    console.warn("[media-retention] STORAGE_BUCKET not configured; skipping daily check purge");
    return { deleted: 0, skipped: 0 };
  }

  let deleted = 0;
  let skipped = 0;

  while (true) {
    const expired = await prisma.scooperDailyCheck.findMany({
      where: {
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
      select: {
        id: true,
        storagePath: true,
        thumbnailPath: true,
      },
      take: batchSize,
    });

    if (expired.length === 0) {
      break;
    }

    for (const check of expired) {
      try {
        if (!dryRun) {
          if (check.storagePath) {
            await deleteFile(bucket, check.storagePath);
          }
          if (check.thumbnailPath && check.thumbnailPath !== check.storagePath) {
            await deleteFile(bucket, check.thumbnailPath);
          }
          await prisma.scooperDailyCheck.delete({ where: { id: check.id } });
        }
        deleted += 1;
      } catch (error) {
        skipped += 1;
        console.error("[media-retention] Failed to remove daily check", {
          checkId: check.id,
          error,
        });
      }
    }
  }

  return { deleted, skipped };
}
