import { prisma } from "@/lib/prisma";

interface DeleteUserCascadeOptions {
  userId: string;
  fallbackUserId?: string | null;
}

let ensuredVisitCommunicationColumn = false;

async function ensureVisitCommunicationSchema() {
  if (ensuredVisitCommunicationColumn) return;
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "VisitCommunication" ADD COLUMN IF NOT EXISTS "sentBy" TEXT;',
  );
  ensuredVisitCommunicationColumn = true;
}

export async function deleteUserCascade({
  userId,
  fallbackUserId,
}: DeleteUserCascadeOptions): Promise<void> {
  await ensureVisitCommunicationSchema();

  const safeFallback = fallbackUserId && fallbackUserId !== userId ? fallbackUserId : null;
  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });
  if (customer) {
    const { deleteCustomerCascade } = await import("./customers");
    await deleteCustomerCascade(customer.id, {
      orgId: customer.orgId,
      skipUserDeletion: true,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.commission.deleteMany({
      where: {
        OR: [{ salesRepId: userId }, { customerId: userId }],
      },
    });

    await tx.territoryAssignment.deleteMany({ where: { userId } });

    await tx.lead.updateMany({ where: { salesRepId: userId }, data: { salesRepId: null } });
    await tx.lead.updateMany({ where: { ownerId: userId }, data: { ownerId: safeFallback } });
    await tx.lead.updateMany({ where: { createdById: userId }, data: { createdById: safeFallback } });

    await tx.leadActivity.updateMany({ where: { userId }, data: { userId: null } });

    await tx.dispatchEvent.updateMany({ where: { actorId: userId }, data: { actorId: null } });

    await tx.routeInstance.updateMany({ where: { dispatcherId: userId }, data: { dispatcherId: null } });
    await tx.routeInstance.updateMany({ where: { technicianId: userId }, data: { technicianId: null } });
    await tx.routeStop.updateMany({ where: { technicianId: userId }, data: { technicianId: null } });

    await tx.serviceVisit.updateMany({ where: { assignedToId: userId }, data: { assignedToId: null } });
    await tx.serviceVisit.updateMany({ where: { backupAssignedToId: userId }, data: { backupAssignedToId: null } });
    await tx.serviceVisit.updateMany({ where: { userId }, data: { userId: null } });

    await tx.serviceVisitMedia.updateMany({ where: { technicianId: userId }, data: { technicianId: null } });
    await tx.serviceVisitMedia.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.serviceVisitReview.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null } });
    await tx.scooperDailyCheck.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.scooperQaAudit.updateMany({ where: { auditorId: userId }, data: { auditorId: null } });
    await tx.scooperCertification.updateMany({ where: { issuedById: userId }, data: { issuedById: null } });
    await tx.visitInsight.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.visitCommunication.updateMany({ where: { sentBy: userId }, data: { sentBy: null } });

    await tx.visitOffer.updateMany({ where: { offeredToId: userId }, data: { offeredToId: null } });
    await tx.job.updateMany({ where: { primaryScooperId: userId }, data: { primaryScooperId: null } });

    await tx.routeShift.updateMany({ where: { scooperId: userId }, data: { scooperId: null } });
    await tx.routeShift.updateMany({ where: { createdById: userId }, data: { createdById: null } });

    await tx.scooperRewardRedemption.deleteMany({ where: { scooperId: userId } });
    await tx.scooperLedgerEntry.updateMany({ where: { recordedById: userId }, data: { recordedById: null } });
    await tx.scooperLedgerEntry.deleteMany({ where: { scooperId: userId } });
    await tx.visitPayout.deleteMany({ where: { scooperId: userId } });
    await tx.dataReading.deleteMany({ where: { userId } });
    await tx.customer.updateMany({ where: { userId }, data: { userId: null } });

    if (safeFallback) {
      await tx.trip.updateMany({ where: { ownerId: userId }, data: { ownerId: safeFallback } });
      await tx.trip.updateMany({ where: { createdById: userId }, data: { createdById: safeFallback } });
      await tx.prospectImport.updateMany({ where: { uploadedById: userId }, data: { uploadedById: safeFallback } });
    } else {
      const trips = await tx.trip.findMany({
        where: { OR: [{ ownerId: userId }, { createdById: userId }] },
        select: { id: true },
      });
      if (trips.length) {
        const tripIds = trips.map((trip) => trip.id);
        await tx.tripStop.deleteMany({ where: { tripId: { in: tripIds } } });
        await tx.trip.deleteMany({ where: { id: { in: tripIds } } });
      }

      await tx.prospectImport.deleteMany({ where: { uploadedById: userId } });
    }

    await tx.user.delete({ where: { id: userId } });
  });
}
