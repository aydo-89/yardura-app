import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { deleteUserCascade } from "./users";

function isMissingTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

async function runOrIgnoreMissingTable<T>(
  promise: Promise<T>,
  label: string,
) {
  try {
    await promise;
  } catch (error) {
    if (isMissingTable(error)) {
      console.warn(`[admin.customers] Skipping ${label}; table not present in this environment.`);
      return;
    }
    throw error;
  }
}

export async function listCustomersForAdmin(options?: { limit?: number }) {
  const take = options?.limit ?? 200;
  return prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      orgId: true,
      name: true,
      email: true,
      phone: true,
      userId: true,
      createdAt: true,
      jobs: {
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          jobs: true,
          dogs: true,
          serviceVisits: true,
        },
      },
    },
  });
}

export async function deleteCustomerCascade(
  customerId: string,
  options?: { orgId?: string; skipUserDeletion?: boolean },
) {
  let customerUserId: string | null = null;
  let customerEmail: string | null = null;

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
        ...(options?.orgId ? { orgId: options.orgId } : {}),
      },
      select: { id: true, userId: true, email: true },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    customerUserId = customer.userId;
    customerEmail = customer.email;

    const visitIds = await tx.serviceVisit
      .findMany({
        where: {
          customerId,
          ...(options?.orgId ? { orgId: options.orgId } : {}),
        },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id));

    let routeStopIds: string[] = [];
    if (visitIds.length) {
      routeStopIds = await tx.routeStop
        .findMany({
          where: { serviceVisitId: { in: visitIds } },
          select: { id: true },
        })
        .then((rows) => rows.map((row) => row.id));

      if (routeStopIds.length) {
        await runOrIgnoreMissingTable(
          tx.dispatchEvent.deleteMany({
            where: { routeStopId: { in: routeStopIds } },
          }),
          "dispatchEvent-by-routeStop",
        );
      }

      await runOrIgnoreMissingTable(
        tx.dispatchEvent.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "dispatchEvent-by-visit",
      );

      await runOrIgnoreMissingTable(
        tx.serviceVisitMedia.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "serviceVisitMedia",
      );

      await runOrIgnoreMissingTable(
        tx.visitInsight.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "visitInsight",
      );

      await runOrIgnoreMissingTable(
        tx.visitCommunication.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "visitCommunication",
      );

      await runOrIgnoreMissingTable(
        tx.dataReading.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "dataReading",
      );

      await runOrIgnoreMissingTable(
        tx.commission.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "commission",
      );

      await runOrIgnoreMissingTable(
        tx.routeStop.deleteMany({
          where: { serviceVisitId: { in: visitIds } },
        }),
        "routeStop",
      );

      await tx.serviceVisit.deleteMany({
        where: { id: { in: visitIds } },
      });
    }

    const sampleIds = await tx.sample
      .findMany({
        where: {
          OR: [
            { customerId },
            { dog: { customerId } },
            { job: { customerId } },
          ],
        },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id));

    if (sampleIds.length) {
      await runOrIgnoreMissingTable(
        tx.sampleScore.deleteMany({ where: { sampleId: { in: sampleIds } } }),
        "sampleScore",
      );
      await runOrIgnoreMissingTable(
        tx.groundTruth.deleteMany({ where: { sampleId: { in: sampleIds } } }),
        "groundTruth",
      );
      await runOrIgnoreMissingTable(
        tx.alert.deleteMany({ where: { sampleId: { in: sampleIds } } }),
        "alert",
      );
      await runOrIgnoreMissingTable(
        tx.sample.deleteMany({ where: { id: { in: sampleIds } } }),
        "sample",
      );
    }

    await runOrIgnoreMissingTable(
      tx.billingSnapshot.deleteMany({ where: { customerId } }),
      "billingSnapshot",
    );
    await runOrIgnoreMissingTable(
      tx.ecoStat.deleteMany({ where: { customerId } }),
      "ecoStat",
    );
    await tx.lead.updateMany({
      where: { convertedToCustomerId: customerId },
      data: { convertedToCustomerId: null },
    });

    // Delete billing records BEFORE jobs (foreign key constraint)
    await runOrIgnoreMissingTable(
      tx.customerBillingLedgerEntry.deleteMany({ where: { customerId } }),
      "customerBillingLedgerEntry",
    );
    await runOrIgnoreMissingTable(
      tx.customerBillingPlan.deleteMany({ where: { customerId } }),
      "customerBillingPlan",
    );

    await tx.job.deleteMany({ where: { customerId } });
    await tx.dog.deleteMany({ where: { customerId } });

    // Delete the customer record
    await tx.customer.delete({ where: { id: customerId } });
  });

  // After customer is deleted, delete the associated User account (outside transaction)
  // This handles User-specific data that may not be tied to Customer
  let userIdToDelete: string | null = null;
  const linkedUserId = customerUserId;
  const fallbackEmail = customerEmail;

  if (linkedUserId) {
    userIdToDelete = linkedUserId;
    console.log(`[deleteCustomer] Will delete linked user account: ${userIdToDelete}`);
  } else if (fallbackEmail) {
    // Fallback: Find user by email (for old records without userId link)
    const user = await prisma.user.findUnique({
      where: { email: fallbackEmail },
      select: { id: true },
    });
    if (user) {
      userIdToDelete = user.id;
      console.log(`[deleteCustomer] Found user by email, will delete: ${userIdToDelete}`);
    }
  }

  // Delete the user account (with cascade cleanup for user-specific data)
  if (userIdToDelete && !options?.skipUserDeletion) {
    try {
      await deleteUserCascade({ userId: userIdToDelete });
      console.log(`[deleteCustomer] Successfully deleted user account: ${userIdToDelete}`);
    } catch (error) {
      console.error(`[deleteCustomer] Failed to delete user ${userIdToDelete}:`, error);
      // Don't throw - customer is already deleted, this is cleanup
    }
  }
}

export async function cancelJobSubscriptionByAdmin(
  jobId: string,
  options?: { immediate?: boolean },
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      stripeSubscriptionId: true,
      status: true,
    },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.stripeSubscriptionId) {
    if (options?.immediate) {
      await stripe.subscriptions.cancel(job.stripeSubscriptionId);
    } else {
      await stripe.subscriptions.update(job.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  const now = new Date();

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "CANCELED",
      cancelledAt: now,
      cancellationReason: "admin_cancelled",
    },
  });

  return job;
}
