import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { customerId, returnUrl } = await req.json();
    if (!customerId)
      return NextResponse.json(
        { error: "customerId required" },
        { status: 400 },
      );
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || getSiteUrl(),
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
