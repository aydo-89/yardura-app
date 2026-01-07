import { randomUUID, createHash } from "node:crypto";

import { Prisma, VisitMediaType, StoolSampleView } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { uploadImage } from "@/lib/supabase-admin";

export class ServiceVisitMediaUnavailableError extends Error {
  constructor(message = "Service visit media storage is unavailable") {
    super(message);
    this.name = "ServiceVisitMediaUnavailableError";
  }
}

interface CreateMediaInput {
  serviceVisitId: string;
  technicianId?: string | null;
  assetType: VisitMediaType;
  file: ArrayBuffer | Buffer;
  contentType?: string;
  capturedAt?: Date;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  notes?: string;
  stoolSampleId?: string;
  stoolSampleView?: StoolSampleView | null;
}

export async function createServiceVisitMedia(input: CreateMediaInput) {
  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("STORAGE_BUCKET is not configured");
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: input.serviceVisitId },
    select: { id: true, orgId: true },
  });

  if (!visit) {
    throw new Error("Service visit not found");
  }

  const mediaId = randomUUID();
  const fileBuffer = Buffer.isBuffer(input.file)
    ? input.file
    : Buffer.from(input.file as ArrayBuffer);
  const hash = createHash("sha256").update(fileBuffer).digest("hex");

  const basePath = `service-visits/${visit.orgId ?? "global"}/${visit.id}`;
  const fileName = `${mediaId}`;
  const extension = inferExtension(input.contentType);
  const storagePath = `${basePath}/${fileName}.${extension}`;

  await uploadImage(bucket, storagePath, fileBuffer, input.contentType);

  const now = new Date();
  
  // Stool sample images (INSIGHTSCOOP) should NEVER expire - we're building a permanent dataset
  // Other media types expire after 30 days for storage management
  const isStoolSample = input.assetType === "INSIGHTSCOOP";
  const expiresAt = isStoolSample 
    ? null  // Never expire - permanent dataset
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days for non-stool media
  
  try {
    return await prisma.serviceVisitMedia.create({
      data: {
        id: mediaId,
        serviceVisitId: visit.id,
        technicianId: input.technicianId ?? null,
        orgId: visit.orgId,
        assetType: input.assetType,
        storagePath,
        thumbnailPath: storagePath,
        capturedAt: input.capturedAt ?? now,
        uploadedAt: now,
        gpsLat: input.gpsLat,
        gpsLng: input.gpsLng,
        gpsAccuracy: input.gpsAccuracy,
        fileHash: hash,
        notes: input.notes,
        stoolSampleId: input.stoolSampleId ?? null,
        stoolSampleView: input.stoolSampleView ?? null,
        expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      throw new ServiceVisitMediaUnavailableError();
    }
    throw error;
  }
}

function inferExtension(contentType?: string) {
  if (!contentType) return "jpg";
  // Video formats
  if (contentType.includes("video/mp4")) return "mp4";
  if (contentType.includes("video/webm")) return "webm";
  if (contentType.includes("video/quicktime")) return "mov";
  // Image formats
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg")) return "jpg";
  return "jpg";
}
