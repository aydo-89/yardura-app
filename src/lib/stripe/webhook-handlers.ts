import { prisma } from "@/lib/prisma";
import { JobStatus, WellnessPlanStatus } from "@prisma/client";

export async function handleSubscriptionUpdate(subscription: any) {
  const jobId = subscription.metadata?.jobId as string | undefined;
  if (!jobId) return;

  let nextStatus: JobStatus = JobStatus.ACTIVE;
  if (subscription.status === "canceled") {
    nextStatus = JobStatus.CANCELED;
  } else if (subscription.status === "past_due") {
    nextStatus = JobStatus.PAUSED;
  }

  await prisma.job.updateMany({
    where: { id: jobId },
    data: { status: nextStatus },
  });
}

export async function handleSubscriptionCancellation(subscription: any) {
  const jobId = subscription.metadata?.jobId as string | undefined;
  if (!jobId) return;

  await prisma.job.updateMany({
    where: { id: jobId },
    data: { status: JobStatus.CANCELED, cancelledAt: new Date() },
  });
}

function resolveWellnessPlanStatus(subscription: any): WellnessPlanStatus {
  const status = subscription?.status;
  if (status === "canceled" || status === "unpaid") {
    return WellnessPlanStatus.CANCELED;
  }
  if (
    status === "past_due" ||
    status === "incomplete" ||
    status === "incomplete_expired" ||
    status === "paused"
  ) {
    return WellnessPlanStatus.PAUSED;
  }
  return WellnessPlanStatus.ACTIVE;
}

export async function handleWellnessSubscriptionUpdate(subscription: any) {
  const metadata = subscription?.metadata ?? {};
  const customerId = metadata.wellnessCustomerId as string | undefined;
  const orgId = metadata.orgId as string | undefined;

  if (!customerId || !orgId) {
    return;
  }

  const planStatus = resolveWellnessPlanStatus(subscription);
  const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);
  const currentPeriodEnd =
    typeof subscription?.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000)
      : null;

  const endsAt =
    planStatus === WellnessPlanStatus.CANCELED || cancelAtPeriodEnd
      ? currentPeriodEnd
      : null;

  const startedAt =
    typeof subscription?.start_date === "number"
      ? new Date(subscription.start_date * 1000)
      : new Date();

  const existingPlan = await prisma.customerWellnessPlan.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existingPlan) {
    await prisma.customerWellnessPlan.update({
      where: { id: existingPlan.id },
      data: {
        status: planStatus,
        endsAt,
      },
    });
    return;
  }

  await prisma.customerWellnessPlan.create({
    data: {
      orgId,
      customerId,
      tier: "PREMIUM",
      status: planStatus,
      source: "DIRECT",
      stripeSubscriptionId: subscription.id,
      startedAt,
      endsAt,
    },
  });
}
