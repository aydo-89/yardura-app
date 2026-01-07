import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

async function fetchConnectStatus(accountId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Stripe is not configured for payouts yet." };
  }
  try {
    const { fetchStripeConnectStatus } = await import("@/lib/stripe/connect");
    const status = await fetchStripeConnectStatus(accountId);
    return { status };
  } catch {
    return { error: "Unable to verify payout setup. Try again shortly." };
  }
}

export async function PATCH(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const autoPayoutEnabled =
    typeof body?.autoPayoutEnabled === "boolean"
      ? body.autoPayoutEnabled
      : null;

  if (autoPayoutEnabled === null) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 422 });
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  if (autoPayoutEnabled) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true },
    });

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json(
        { ok: false, error: "Add a payout method before enabling auto payouts." },
        { status: 409 },
      );
    }

    const statusResult = await fetchConnectStatus(user.stripeConnectAccountId);
    if (statusResult.error) {
      return NextResponse.json({ ok: false, error: statusResult.error }, { status: 503 });
    }
    if (!statusResult.status?.payoutsEnabled) {
      return NextResponse.json(
        { ok: false, error: "Finish Stripe onboarding before enabling auto payouts." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.scooperProfile.update({
    where: { userId },
    data: { payoutAutoReleaseEnabled: autoPayoutEnabled },
    select: { payoutAutoReleaseEnabled: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      autoPayoutEnabled: updated.payoutAutoReleaseEnabled,
    },
  });
}

export const runtime = "nodejs";
