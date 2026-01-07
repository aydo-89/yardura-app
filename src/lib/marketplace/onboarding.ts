import {
  AvailabilityWindow,
  BackgroundCheckStatus,
  CertificationStatus,
  CertificationType,
  ScooperStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sortRoles } from "@/lib/auth/roles";

export interface ScooperApplicantInput {
  orgId: string;
  email: string;
  name: string;
  phone?: string | null;
  vehicleDetail: string;
  insuranceProofUrl?: string | null;
  availability: Array<{
    tileId: string;
    weekday: number;
    window?: AvailabilityWindow;
    maxStops?: number | null;
  }>;
  autoApprove?: boolean;
  homeBaseAddress?: string | null;
  homeBaseCity?: string | null;
  homeBaseZip?: string | null;
  homeBaseLocation?: { lat: number; lng: number } | null;
  preferredTileSlugs?: string[] | null;
  applicationDetails?: Record<string, unknown> | null;
}

function coerceMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function upsertScooperApplicant(
  input: ScooperApplicantInput,
) {
  const {
    orgId,
    email,
    name,
    phone,
    vehicleDetail,
    insuranceProofUrl,
    availability,
    autoApprove,
    homeBaseAddress,
    homeBaseCity,
    homeBaseZip,
    homeBaseLocation,
    preferredTileSlugs,
    applicationDetails,
  } = input;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { roles: true },
  });
  const nextRoles = sortRoles([...(existingUser?.roles ?? []), "TECH"]);
  const primaryRole = nextRoles[0] ?? "TECH";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      phone: phone ?? undefined,
      role: primaryRole,
      roles: nextRoles,
      orgId,
    },
    create: {
      email,
      name,
      phone: phone ?? null,
      role: "TECH",
      roles: ["TECH"],
      orgId,
    },
  });

  const existingProfile = await prisma.scooperProfile.findUnique({
    where: { userId: user.id },
    select: { metadata: true },
  });

  const metadataBase = coerceMetadata(existingProfile?.metadata);

  const metadata: Prisma.JsonObject = {
    ...(metadataBase as Prisma.JsonObject),
    applicantChannel:
      typeof metadataBase.applicantChannel === "string"
        ? (metadataBase.applicantChannel as string)
        : "self-serve",
    applicationUpdatedAt: new Date().toISOString(),
  };

  if (applicationDetails && typeof applicationDetails === "object") {
    const existingApplication =
      metadataBase.application && typeof metadataBase.application === "object"
        ? (metadataBase.application as Record<string, unknown>)
        : {};
    metadata.application = {
      ...existingApplication,
      ...applicationDetails,
    } as Prisma.JsonObject;
  }

  if (!metadataBase.applicationSubmittedAt) {
    metadata.applicationSubmittedAt = new Date().toISOString();
  }

  if (homeBaseCity) {
    metadata.homeBaseCity = homeBaseCity;
  }

  if (homeBaseAddress) {
    metadata.homeBaseAddress = homeBaseAddress;
  }

  if (homeBaseZip) {
    metadata.homeBaseZip = homeBaseZip;
  }

  if (homeBaseLocation) {
    metadata.homeBaseLocation = homeBaseLocation as Prisma.JsonValue;
  }

  if (preferredTileSlugs && preferredTileSlugs.length > 0) {
    metadata.preferredTileSlugs = Array.from(new Set(preferredTileSlugs)) as unknown as Prisma.JsonValue;
  }

  const status = autoApprove ? ScooperStatus.CERTIFIED : ScooperStatus.PENDING_REVIEW;
  const backgroundStatus = autoApprove
    ? BackgroundCheckStatus.PASSED
    : BackgroundCheckStatus.NOT_SUBMITTED;

  const profile = await prisma.scooperProfile.upsert({
    where: { userId: user.id },
    update: {
      orgId,
      status,
      backgroundCheckStatus: backgroundStatus,
      vehicleVerified: Boolean(insuranceProofUrl),
      vehicleDetail,
      insuranceProofUrl: insuranceProofUrl ?? undefined,
      updatedAt: new Date(),
      metadata,
    },
    create: {
      orgId,
      userId: user.id,
      status,
      backgroundCheckStatus: backgroundStatus,
      vehicleVerified: Boolean(insuranceProofUrl),
      vehicleDetail,
      insuranceProofUrl: insuranceProofUrl ?? undefined,
      metadata,
    },
    include: {
      certifications: true,
      availabilities: true,
    },
  });

  if (availability?.length) {
    await replaceScooperAvailability(profile.id, availability);
  }

  // Ensure baseline bin-drop certification exists
  const existingBinDrop = profile.certifications.find(
    (cert) => cert.type === CertificationType.BIN_DROP,
  );

  if (!existingBinDrop) {
    await prisma.scooperCertification.create({
      data: {
        orgId,
        scooperId: profile.id,
        type: CertificationType.BIN_DROP,
        status: autoApprove ? CertificationStatus.ACTIVE : CertificationStatus.PENDING,
        issuedAt: autoApprove ? new Date() : null,
      },
    });
  }

  return prisma.scooperProfile.findUnique({
    where: { id: profile.id },
    include: {
      user: true,
      certifications: true,
      availabilities: true,
    },
  });
}

export async function replaceScooperAvailability(
  scooperProfileId: string,
  availability: Array<{
    tileId: string;
    weekday: number;
    window?: AvailabilityWindow;
    maxStops?: number | null;
  }> = [],
) {
  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperProfileId },
    select: { orgId: true },
  });

  if (!profile) {
    throw new Error(`Scooper profile ${scooperProfileId} not found`);
  }

  await prisma.scooperAvailability.deleteMany({
    where: { scooperId: scooperProfileId },
  });

  if (!availability.length) {
    return [];
  }

  const createPromises = availability.map((entry) =>
    prisma.scooperAvailability.create({
      data: {
        orgId: profile.orgId,
        scooperId: scooperProfileId,
        tileId: entry.tileId,
        weekday: entry.weekday,
        window: entry.window ?? AvailabilityWindow.FULL,
        maxStops: entry.maxStops ?? null,
      },
    }),
  );

  return Promise.all(createPromises);
}

export async function setScooperStatus(
  scooperProfileId: string,
  status: ScooperStatus,
  options?: { backgroundCheckStatus?: BackgroundCheckStatus },
) {
  return prisma.scooperProfile.update({
    where: { id: scooperProfileId },
    data: {
      status,
      backgroundCheckStatus: options?.backgroundCheckStatus,
      updatedAt: new Date(),
    },
    include: {
      user: true,
      certifications: true,
      availabilities: true,
    },
  });
}

export async function issueScooperCertification(options: {
  orgId: string;
  scooperProfileId: string;
  type: CertificationType;
  status?: CertificationStatus;
  issuedById?: string | null;
  evidenceUrl?: string | null;
  expiresAt?: Date | null;
}) {
  const {
    orgId,
    scooperProfileId,
    type,
    status = CertificationStatus.PENDING,
    issuedById,
    evidenceUrl,
    expiresAt,
  } = options;

  return prisma.scooperCertification.upsert({
    where: {
      scooperId_type: {
        scooperId: scooperProfileId,
        type,
      },
    },
    update: {
      status,
      issuedById,
      evidenceUrl: evidenceUrl ?? undefined,
      expiresAt: expiresAt ?? undefined,
      issuedAt: status === CertificationStatus.ACTIVE ? new Date() : undefined,
    },
    create: {
      orgId,
      scooperId: scooperProfileId,
      type,
      status,
      issuedById,
      evidenceUrl: evidenceUrl ?? undefined,
      expiresAt: expiresAt ?? undefined,
      issuedAt: status === CertificationStatus.ACTIVE ? new Date() : null,
    },
  });
}

export async function getScooperSummaryByUserId(userId: string) {
  return prisma.scooperProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      certifications: true,
      availabilities: {
        include: {
          tile: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  });
}
