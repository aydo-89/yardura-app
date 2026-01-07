import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { ScooperProfileEmailPayload } from "@/lib/emails/scooper-profile";

const SCOOPER_PROFILE_METADATA_KEYS = [
  "initialScooperProfilePending",
  "initialScooperProfileSentAt",
  "initialScooperProfileTechId",
] as const;

const isJsonObject = (value: unknown): value is Record<string, any> => {
  if (!value) return false;
  if (value === Prisma.DbNull || value === Prisma.JsonNull) return false;
  return typeof value === "object" && !Array.isArray(value);
};

const hasScooperProfileMetadata = (metadata: Record<string, any>) =>
  SCOOPER_PROFILE_METADATA_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(metadata, key),
  );

type ServiceVisitWithScooperRelations = Prisma.ServiceVisitGetPayload<{
  include: {
    customer: {
      select: {
        email: true;
        name: true;
        addressLine1: true;
        city: true;
        zip: true;
      };
    };
    user: {
      select: {
        email: true;
        name: true;
      };
    };
    assignedTo: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        image: true;
      };
    };
  };
}>;

type PrismaClientOrTx = Prisma.TransactionClient | PrismaClient;

export async function collectScooperProfileEmails(
  tx: PrismaClientOrTx,
  visitIds: string[],
): Promise<ScooperProfileEmailPayload[]> {
  if (!visitIds.length) return [];

  const visits = await tx.serviceVisit.findMany({
    where: { id: { in: visitIds } },
    include: {
      customer: {
        select: {
          email: true,
          name: true,
          addressLine1: true,
          city: true,
          zip: true,
        },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  });

  const nowIso = new Date().toISOString();
  const payloads: ScooperProfileEmailPayload[] = [];

  for (const visit of visits as ServiceVisitWithScooperRelations[]) {
    if (!visit.assignedToId || !visit.assignedTo) continue;

    const metadataValue = visit.metadata as Prisma.JsonValue | null | undefined;
    const metadata: Record<string, any> = isJsonObject(metadataValue)
      ? { ...metadataValue }
      : {};

    if (!hasScooperProfileMetadata(metadata)) continue;

    const pending = metadata.initialScooperProfilePending === true;
    const previousTechId =
      typeof metadata.initialScooperProfileTechId === "string"
        ? metadata.initialScooperProfileTechId
        : null;
    const previouslySentAt =
      typeof metadata.initialScooperProfileSentAt === "string"
        ? metadata.initialScooperProfileSentAt
        : null;

    const shouldSend =
      pending || !previouslySentAt || (previousTechId && previousTechId !== visit.assignedToId);

    if (!shouldSend) continue;

    const toEmail =
      visit.customer?.email?.trim() || visit.user?.email?.trim() || undefined;

    if (!toEmail) continue;

    metadata.initialScooperProfilePending = false;
    metadata.initialScooperProfileSentAt = nowIso;
    metadata.initialScooperProfileTechId = visit.assignedToId;

    await tx.serviceVisit.update({
      where: { id: visit.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });

    payloads.push({
      toEmail,
      customerName: visit.customer?.name ?? visit.user?.name ?? null,
      technicianName: visit.assignedTo.name,
      technicianEmail: visit.assignedTo.email,
      technicianPhone: visit.assignedTo.phone,
      technicianImage: visit.assignedTo.image,
      scheduledDate: visit.scheduledDate,
      preferredTimeWindow: visit.preferredTimeWindow,
      preferredTimeWindowSlug: visit.preferredTimeWindowSlug,
      addressLine1: visit.customer?.addressLine1 ?? null,
      city: visit.customer?.city ?? null,
      zip: visit.customer?.zip ?? null,
    });
  }

  return payloads;
}
