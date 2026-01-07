import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import {
  Prisma,
  ScooperStatus,
  BackgroundCheckStatus,
  ScooperRewardEventType,
} from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { uploadImage, createSignedUrl, deleteFile } from "@/lib/supabase-admin";
import {
  calculateDailyCheckPoints,
  calculateDailyStreak,
  buildDailyCheckRewardSummary,
  getDayKey,
} from "@/lib/field-tech/dailyCheckRewards";
import {
  awardScooperPoints,
  getScooperRewardBalance,
} from "@/lib/field-tech/rewardEvents";
import { SERVICE_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function resolveTimeZone(
  request: NextRequest,
  metadata: Record<string, unknown>,
) {
  const headerRaw =
    request.headers.get("x-time-zone") ?? request.headers.get("x-timezone");
  const headerTimeZone = isValidTimeZone(headerRaw?.trim())
    ? headerRaw!.trim()
    : null;
  const storedRaw = typeof metadata.timeZone === "string" ? metadata.timeZone : null;
  const storedTimeZone = isValidTimeZone(storedRaw) ? storedRaw : null;
  const timeZone = headerTimeZone ?? storedTimeZone ?? SERVICE_TIME_ZONE;
  return {
    timeZone,
    shouldPersist: Boolean(headerTimeZone && headerTimeZone !== storedTimeZone),
    persistedValue: headerTimeZone ?? storedTimeZone,
  };
}

function inferExtension(contentType?: string) {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg")) return "jpg";
  return "jpg";
}

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      orgId: true,
      metadata: true,
    },
  });

  if (!profile) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true },
    });

    if (!userRecord?.orgId) {
      return NextResponse.json({ lastGearCheckAt: null, check: null });
    }

    profile = await prisma.scooperProfile.create({
      data: {
        orgId: userRecord.orgId,
        userId,
        status: ScooperStatus.APPLICANT,
        backgroundCheckStatus: BackgroundCheckStatus.NOT_SUBMITTED,
        vehicleVerified: false,
        metadata: Prisma.JsonNull,
      },
      select: {
        id: true,
        orgId: true,
        metadata: true,
      },
    });
  }

  let metadata = normalizeMetadata(profile.metadata);
  const timeZoneState = resolveTimeZone(request, metadata);
  if (timeZoneState.shouldPersist && timeZoneState.persistedValue) {
    metadata = {
      ...metadata,
      timeZone: timeZoneState.persistedValue,
    };
    await prisma.scooperProfile.update({
      where: { id: profile.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  const latestCheck = await prisma.scooperDailyCheck.findFirst({
    where: { userId },
    orderBy: { capturedAt: "desc" },
  });

  const allChecks = await prisma.scooperDailyCheck.findMany({
    where: { userId },
    select: { capturedAt: true, pointsAwarded: true },
  });

  const { spentPoints, balance } = await getScooperRewardBalance(
    profile.orgId,
    userId,
    timeZoneState.timeZone,
  );
  const rewards = buildDailyCheckRewardSummary(
    allChecks,
    latestCheck
      ? { capturedAt: latestCheck.capturedAt, pointsAwarded: latestCheck.pointsAwarded ?? null }
      : null,
    new Date(),
    spentPoints,
    timeZoneState.timeZone,
  );
  const rewardsSummary = { ...rewards, pointsBalance: balance };

  const gearCheck = normalizeMetadata(metadata.gearCheck);
  const lastMetadataIso =
    typeof gearCheck.lastLoggedAt === "string" ? gearCheck.lastLoggedAt : null;

  const bucket = env.STORAGE_BUCKET;
  const latestMetadata = normalizeMetadata(latestCheck?.metadata);
  const latestUploadFailed = Boolean(latestMetadata.uploadFailed);
  const latestSelfieSkipped = Boolean(latestMetadata.selfieSkipped);
  let signedUrl: string | null = null;
  if (bucket && latestCheck?.storagePath && !latestUploadFailed) {
    try {
      signedUrl = await createSignedUrl(bucket, latestCheck.storagePath, 60 * 60);
    } catch (error) {
      console.error("[gear-check] Unable to sign daily check url", {
        checkId: latestCheck.id,
        error,
      });
    }
  }

  return NextResponse.json({
    lastGearCheckAt: latestCheck?.capturedAt.toISOString() ?? lastMetadataIso,
    check: latestCheck
      ? {
          id: latestCheck.id,
          capturedAt: latestCheck.capturedAt.toISOString(),
          photoUrl: signedUrl,
          uploadStatus: latestUploadFailed ? "skipped" : "uploaded",
          reviewStatus: latestCheck.reviewStatus,
          notes: latestCheck.notes,
          pointsAwarded: latestCheck.pointsAwarded ?? null,
          streakCount: latestCheck.streakCount ?? null,
          selfieSkipped: latestSelfieSkipped,
        }
      : null,
    rewards: rewardsSummary,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      orgId: true,
      metadata: true,
    },
  });

  if (!profile) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true },
    });

    if (!userRecord?.orgId) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    profile = await prisma.scooperProfile.create({
      data: {
        orgId: userRecord.orgId,
        userId,
        status: ScooperStatus.APPLICANT,
        backgroundCheckStatus: BackgroundCheckStatus.NOT_SUBMITTED,
        vehicleVerified: false,
        metadata: Prisma.JsonNull,
      },
      select: {
        id: true,
        orgId: true,
        metadata: true,
      },
    });
  }

  let formData: FormData | null = null;
  try {
    formData = await request.formData();
  } catch {
    formData = null;
  }
  const skipSelfie = formData?.get("skipSelfie") === "true";
  const fileEntry = formData?.get("file");
  if (!(fileEntry instanceof File) && !skipSelfie) {
    return NextResponse.json(
      { error: "photo_required" },
      { status: 422 },
    );
  }

  const bucket = env.STORAGE_BUCKET;
  const storageConfigured = Boolean(
    bucket && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let metadata = normalizeMetadata(profile.metadata);
  const timeZoneState = resolveTimeZone(request, metadata);
  const gearCheck = normalizeMetadata(metadata.gearCheck);
  if (timeZoneState.shouldPersist && timeZoneState.persistedValue) {
    metadata = {
      ...metadata,
      timeZone: timeZoneState.persistedValue,
    };
  }

  const checklistRaw = formData?.get("checklist");
  let checklist: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  if (typeof checklistRaw === "string" && checklistRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(checklistRaw);
      checklist = parsed === null ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue);
    } catch (error) {
      return NextResponse.json(
        { error: "invalid_checklist" },
        { status: 422 },
      );
    }
  }

  const gpsLatRaw = formData?.get("gpsLat");
  const gpsLngRaw = formData?.get("gpsLng");
  const gpsLat = typeof gpsLatRaw === "string" ? Number.parseFloat(gpsLatRaw) : undefined;
  const gpsLng = typeof gpsLngRaw === "string" ? Number.parseFloat(gpsLngRaw) : undefined;

  const now = new Date();
  const existingChecks = await prisma.scooperDailyCheck.findMany({
    where: { userId },
    select: { id: true, capturedAt: true, pointsAwarded: true },
  });
  const todayKey = getDayKey(now, timeZoneState.timeZone);
  const existingToday = existingChecks.find(
    (check) => getDayKey(check.capturedAt, timeZoneState.timeZone) === todayKey,
  );
  const existingDates = existingChecks.map((check) => check.capturedAt);
  const streakIfSubmit = Math.max(
    1,
    calculateDailyStreak([...existingDates, now], now, timeZoneState.timeZone),
  );
  const streakCount = existingToday
    ? calculateDailyStreak(existingDates, now, timeZoneState.timeZone)
    : streakIfSubmit;
  const pointsBreakdown = calculateDailyCheckPoints(streakCount);
  const pointsAwarded =
    typeof existingToday?.pointsAwarded === "number"
      ? existingToday.pointsAwarded
      : pointsBreakdown.totalPoints;
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const extension = fileEntry instanceof File ? inferExtension(fileEntry.type) : "txt";
  const key = `${now.getTime()}-${randomUUID()}.${extension}`;
  const storagePath = `daily-checks/${profile.orgId}/${userId}/${key}`;

  let uploadFailed = skipSelfie;
  let uploadErrorMessage: string | null = skipSelfie ? "selfie_skipped" : null;

  if (!skipSelfie && fileEntry instanceof File) {
    const fileBuffer = await fileEntry.arrayBuffer();
    if (!storageConfigured || !bucket) {
      uploadFailed = true;
      uploadErrorMessage = "storage_unavailable";
    } else {
      try {
        await uploadImage(bucket, storagePath, fileBuffer, fileEntry.type);
      } catch (error) {
        console.error("[gear-check] Failed to store daily check", {
          userId,
          error,
        });
        uploadFailed = true;
        uploadErrorMessage =
          error instanceof Error ? error.message : "storage_upload_failed";
      }
    }
  }

  const created = await prisma.scooperDailyCheck.create({
    data: {
      orgId: profile.orgId,
      userId,
      storagePath,
      thumbnailPath: storagePath,
      gpsLat: Number.isFinite(gpsLat) ? gpsLat : undefined,
      gpsLng: Number.isFinite(gpsLng) ? gpsLng : undefined,
      ...(typeof checklist !== "undefined" ? { checklist } : {}),
      pointsAwarded,
      streakCount,
      metadata: uploadFailed
        ? {
            uploadFailed: true,
            uploadError: uploadErrorMessage,
            selfieSkipped: skipSelfie,
          }
        : Prisma.JsonNull,
      expiresAt,
    },
  });

  if (!existingToday) {
    await awardScooperPoints({
      orgId: profile.orgId,
      scooperId: userId,
      eventType: ScooperRewardEventType.DAILY_CHECK,
      sourceKey: `daily-check:${userId}:${getDayKey(created.capturedAt, timeZoneState.timeZone)}`,
      points: pointsAwarded,
      metadata: {
        checkId: created.id,
      },
    });
  }

  const nextMetadata = {
    ...metadata,
    timeZone: (timeZoneState.persistedValue ?? metadata.timeZone) as string | undefined,
    gearCheck: {
      ...gearCheck,
      lastLoggedAt: created.capturedAt.toISOString(),
    },
  };

  await prisma.scooperProfile.update({
    where: { id: profile.id },
    data: {
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  const previousCheckIdRaw = formData?.get("previousCheckId");
  if (typeof previousCheckIdRaw === "string" && previousCheckIdRaw.trim().length > 0) {
    const previous = await prisma.scooperDailyCheck.findUnique({
      where: { id: previousCheckIdRaw },
      select: { id: true, storagePath: true, thumbnailPath: true, metadata: true },
    });
    if (previous) {
      try {
        await prisma.scooperDailyCheck.delete({ where: { id: previous.id } });
        const previousMeta = normalizeMetadata(previous.metadata);
        if (
          storageConfigured &&
          bucket &&
          !previousMeta.uploadFailed &&
          previous.storagePath
        ) {
          await deleteFile(bucket, previous.storagePath);
        }
        if (
          storageConfigured &&
          bucket &&
          !previousMeta.uploadFailed &&
          previous.thumbnailPath &&
          previous.thumbnailPath !== previous.storagePath
        ) {
          await deleteFile(bucket, previous.thumbnailPath);
        }
      } catch (error) {
        console.error("[gear-check] Failed to clean previous daily check", {
          checkId: previous.id,
          error,
        });
      }
    }
  }

  let signedUrl: string | null = null;
  if (storageConfigured && bucket && !uploadFailed) {
    try {
      signedUrl = await createSignedUrl(bucket, created.storagePath, 60 * 60);
    } catch (error) {
      console.error("[gear-check] Unable to sign new daily check url", {
        checkId: created.id,
        error,
      });
    }
  }

  const updatedChecks = await prisma.scooperDailyCheck.findMany({
    where: { userId },
    select: { capturedAt: true, pointsAwarded: true },
  });
  const { spentPoints: updatedSpentPoints, balance } = await getScooperRewardBalance(
    profile.orgId,
    userId,
    timeZoneState.timeZone,
  );
  const rewards = buildDailyCheckRewardSummary(
    updatedChecks,
    { capturedAt: created.capturedAt, pointsAwarded: created.pointsAwarded ?? null },
    created.capturedAt,
    updatedSpentPoints,
    timeZoneState.timeZone,
  );
  const rewardsSummary = { ...rewards, pointsBalance: balance };

  return NextResponse.json({
    lastGearCheckAt: created.capturedAt.toISOString(),
    check: {
      id: created.id,
      capturedAt: created.capturedAt.toISOString(),
      photoUrl: signedUrl,
      uploadStatus: uploadFailed ? "skipped" : "uploaded",
      reviewStatus: created.reviewStatus,
      notes: created.notes,
      pointsAwarded: created.pointsAwarded ?? null,
      streakCount: created.streakCount ?? null,
      selfieSkipped: skipSelfie,
    },
    rewards: rewardsSummary,
  });
}

export const runtime = "nodejs";
