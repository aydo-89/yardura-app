import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@prisma/client";

import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { ensureStripeCustomerId } from "@/lib/stripe/customer";

const requestSchema = z.object({
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.user as any)?.orgId ?? "yardura";

    const { reason, feedback } = requestSchema.parse(await request.json());

    const [user, customer] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, stripeCustomerId: true },
      }),
      prisma.customer.findFirst({
        where: {
          orgId,
          email: session.user.email,
        },
        include: {
          jobs: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);

    const stripeCustomerId = await ensureStripeCustomerId({
      email: session.user.email,
      currentCustomerId: user?.stripeCustomerId ?? null,
      userId: user?.id ?? null,
    });

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 },
      );
    }

    if (!customer || customer.jobs.length === 0) {
      return NextResponse.json(
        { error: "We couldn’t find an active service plan" },
        { status: 404 },
      );
    }

    const job = customer.jobs[0];

    let subscriptionId = job.stripeSubscriptionId;
    let subscription;

    try {
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });
      } else {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
          limit: 20,
          expand: ["data.items.data.price"],
        });

        subscription = subscriptions.data.find((entry) => {
          const metadataCustomerId = (entry.metadata || {}).customerId;
          return metadataCustomerId === customer.id;
        }) || subscriptions.data[0];

        if (!subscription) {
          return NextResponse.json(
            { error: "No Stripe subscription found" },
            { status: 404 },
          );
        }

        subscriptionId = subscription.id;
      }
    } catch (stripeError) {
      console.error("Failed to load Stripe subscription", stripeError);
      return NextResponse.json(
        { error: "Unable to locate your subscription in Stripe" },
        { status: 500 },
      );
    }

    const subscriptionItem = subscription.items?.data?.[0] ?? null;
    const price = subscriptionItem?.price ?? null;
    const priceRecurring = price?.recurring ?? null;

    const priceMetadataPreference =
      price && !("deleted" in price) && typeof price.metadata?.billingPreference === "string"
        ? price.metadata.billingPreference
        : "";

    const rawMetadataPreference =
      typeof subscription?.metadata?.billingPreference === "string"
        ? subscription.metadata.billingPreference
        : typeof subscription?.metadata?.serviceBilling === "string"
          ? subscription.metadata.serviceBilling
          : priceMetadataPreference;

    const normalizedBillingPreference = (() => {
      const lower = rawMetadataPreference.toLowerCase();
      if (lower === "monthly") return "monthly" as const;
      if (lower === "weekly") return "weekly" as const;
      if (priceRecurring?.interval === "month") return "monthly" as const;
      return "weekly" as const;
    })();

    const subscriptionCurrentPeriodEnd = (() => {
      if (typeof (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end === "number") {
        return (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      }
      return undefined;
    })();

    const preliminaryServiceEndIso = subscriptionCurrentPeriodEnd
      ? new Date(subscriptionCurrentPeriodEnd * 1000).toISOString()
      : undefined;

    const cancellationMetadata = {
      cancellation_reason: reason || "user_requested",
      cancellation_feedback: feedback || "",
      cancelled_at: new Date().toISOString(),
      ...(preliminaryServiceEndIso
        ? { service_access_ends_on: preliminaryServiceEndIso }
        : {}),
      billing_preference: normalizedBillingPreference,
    } as Record<string, string>;

    const cancelledSubscription = await stripe.subscriptions.update(subscriptionId!, {
      cancel_at_period_end: true,
      metadata: {
        ...(subscription?.metadata ?? {}),
        ...cancellationMetadata,
      },
    });

    const cancelledSubscriptionCurrentPeriodEnd = (() => {
      const raw = cancelledSubscription as Stripe.Subscription & { current_period_end?: number };
      return typeof raw.current_period_end === "number" ? raw.current_period_end : undefined;
    })();

    const finalServiceDate = cancelledSubscriptionCurrentPeriodEnd
      ? new Date(cancelledSubscriptionCurrentPeriodEnd * 1000)
      : null;
    const finalServiceDateValid = finalServiceDate && !Number.isNaN(finalServiceDate.getTime())
      ? finalServiceDate
      : null;

    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);

    let visitCancellationFilter: Prisma.ServiceVisitWhereInput | null = null;
    if (normalizedBillingPreference === "monthly" && finalServiceDateValid) {
      const boundary = new Date(finalServiceDateValid.getTime());
      boundary.setHours(23, 59, 59, 999);
      visitCancellationFilter = {
        jobId: job.id,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gt: boundary },
      };
    } else {
      visitCancellationFilter = {
        jobId: job.id,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gte: fortyEightHoursFromNow },
      };
    }

    let cancelledVisitIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: "CANCELED",
          cancelledAt: new Date(),
          cancellationReason: reason || "user_requested",
          subscriptionEndDate: finalServiceDateValid ?? undefined,
        },
      });

      if (visitCancellationFilter) {
        const visits = await tx.serviceVisit.findMany({
          where: visitCancellationFilter,
          select: { id: true },
        });
        cancelledVisitIds = visits.map((visit) => visit.id);

        if (cancelledVisitIds.length) {
          await tx.serviceVisit.updateMany({
            where: { id: { in: cancelledVisitIds } },
            data: { status: "CANCELLED" },
          });

          await tx.routeStop.deleteMany({
            where: { serviceVisitId: { in: cancelledVisitIds } },
          });
        }
      }

      const noteSegments = [`Cancelled on ${new Date().toISOString()} (${cancellationMetadata.cancellation_reason})`];
      if (finalServiceDateValid) {
        noteSegments.push(`Service access through ${finalServiceDateValid.toISOString()}`);
      }
      if (cancelledVisitIds.length) {
        noteSegments.push(
          `Cancelled ${cancelledVisitIds.length} future visit${cancelledVisitIds.length === 1 ? "" : "s"}`,
        );
      }
      const noteLine = noteSegments.join(" | ");
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          notes: customer.notes
            ? `${customer.notes}\n${noteLine}`
            : noteLine,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
      subscriptionEndDate: finalServiceDateValid?.toISOString() ?? null,
      serviceAccessEndsOn: finalServiceDateValid?.toISOString() ?? null,
      visitsCancelled: cancelledVisitIds.length,
      billingPreference: normalizedBillingPreference,
      finalBillingDate: finalServiceDateValid
        ? finalServiceDateValid.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null,
    });
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
