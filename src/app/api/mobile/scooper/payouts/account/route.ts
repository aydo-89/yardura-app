import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

function isStripeMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "stripe_unconfigured" ||
    error.message.includes("STRIPE_SECRET_KEY")
  );
}

type StripeErrorDetails = {
  message: string;
  code?: string;
  type?: string;
};

function extractStripeErrorDetails(error: unknown): StripeErrorDetails | null {
  if (!error || typeof error !== "object") return null;
  const anyError = error as {
    message?: string;
    type?: string;
    code?: string;
    raw?: { message?: string; type?: string; code?: string };
  };
  const message = anyError.raw?.message ?? anyError.message;
  if (!message) return null;
  return {
    message,
    code: anyError.raw?.code ?? anyError.code,
    type: anyError.raw?.type ?? anyError.type,
  };
}

function isMissingAccountError(error: unknown): boolean {
  const details = extractStripeErrorDetails(error);
  const message = details?.message?.toLowerCase() ?? "";
  return details?.code === "resource_missing" || message.includes("no such account");
}

function resolveStripeSetupError(error: unknown): { message: string; code: string } | null {
  if (isStripeMissingError(error)) {
    return { message: "Stripe is not configured for payouts yet.", code: "stripe_unconfigured" };
  }
  const details = extractStripeErrorDetails(error);
  if (!details?.message) return null;
  const message = details.message.toLowerCase();
  if (message.includes("invalid api key")) {
    return { message: "Stripe is not configured for payouts yet.", code: "stripe_invalid_key" };
  }
  if (
    message.includes("connect") &&
    (message.includes("access") ||
      message.includes("enable") ||
      message.includes("signed up for connect") ||
      message.includes("sign up for connect"))
  ) {
    return {
      message: "Stripe Connect is not enabled for this account yet.",
      code: "stripe_connect_unavailable",
    };
  }
  if (details?.code === "resource_missing" || message.includes("no such account")) {
    return {
      message: "Payout setup needs a reset. Please try again.",
      code: "stripe_account_missing",
    };
  }
  return {
    message: "Unable to start payout setup right now.",
    code: "stripe_connect_error",
  };
}

async function loadStripeConnect() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("stripe_unconfigured");
  }
  try {
    return await import("@/lib/stripe/connect");
  } catch (error) {
    if (isStripeMissingError(error)) {
      throw new Error("stripe_unconfigured");
    }
    throw error;
  }
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function emptyStatus() {
  return {
    accountId: null,
    detailsSubmitted: false,
    payoutsEnabled: false,
    requirements: [],
    disabledReason: null,
  };
}

export async function GET(request: NextRequest) {
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

  const profile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });

  if (!user?.stripeConnectAccountId) {
    return NextResponse.json({ ok: true, data: emptyStatus() });
  }

  try {
    const stripeConnect = await loadStripeConnect();
    const status = await stripeConnect.fetchStripeConnectStatus(user.stripeConnectAccountId);
    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    if (isStripeMissingError(error)) {
      return NextResponse.json(
        { ok: false, error: "Stripe is not configured for payouts yet." },
        { status: 503 },
      );
    }
    console.warn("[mobile-payouts] failed to fetch connect status", error);
    await prisma.user.update({
      where: { id: userId },
      data: { stripeConnectAccountId: null },
    });
    return NextResponse.json({ ok: true, data: emptyStatus() });
  }
}

export async function POST(request: NextRequest) {
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

  const profile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const payloadBody = await request.json().catch(() => ({}));
  const intent = payloadBody?.intent === "update" ? "update" : "onboarding";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 422 },
    );
  }

  try {
    const stripeConnect = await loadStripeConnect();
    let accountId = await stripeConnect.ensureStripeConnectAccount({
      userId,
      email: user.email,
      name: user.name,
    });

    let status;
    try {
      status = await stripeConnect.fetchStripeConnectStatus(accountId);
    } catch (error) {
      if (isMissingAccountError(error)) {
        await prisma.user.update({
          where: { id: userId },
          data: { stripeConnectAccountId: null },
        });
        accountId = await stripeConnect.ensureStripeConnectAccount({
          userId,
          email: user.email,
          name: user.name,
        });
        status = await stripeConnect.fetchStripeConnectStatus(accountId);
      } else {
        throw error;
      }
    }
    const hasRequirements = status.requirements.length > 0;
    const needsDetails = !status.detailsSubmitted;
    const needsPayoutEnable = !status.payoutsEnabled;
    const needsAttention =
      intent === "onboarding" || needsDetails || needsPayoutEnable || hasRequirements;
    const linkType = needsAttention
      ? "account_onboarding"
      : intent === "update"
        ? "account_update"
        : "account_onboarding";
    const link = await stripeConnect.createStripeConnectAccountLink(accountId, linkType);

    return NextResponse.json({
      ok: true,
      data: {
        url: link.url,
      },
    });
  } catch (error) {
    console.warn("[mobile-payouts] failed to create connect link", error);
    const resolved = resolveStripeSetupError(error);
    if (resolved?.code === "stripe_unconfigured" || resolved?.code === "stripe_invalid_key") {
      return NextResponse.json(
        { ok: false, error: resolved.message, details: { code: resolved.code } },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: resolved?.message ?? "Unable to start payout setup right now.",
        details: resolved?.code ? { code: resolved.code } : undefined,
      },
      { status: 502 },
    );
  }
}

export const runtime = "nodejs";
