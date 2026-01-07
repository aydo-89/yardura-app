import { NextRequest, NextResponse } from "next/server";

import { createMagicLink } from "@/lib/auth/magicLink";

export async function POST(request: NextRequest) {
  try {
    const { email, callbackUrl } = await request.json();

    if (typeof email !== "string" || email.trim() === "") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const magicLinkUrl = await createMagicLink({
      email: normalizedEmail,
      callbackUrl,
      expiresInMs: 5 * 60 * 1000,
    });

    const url = new URL(magicLinkUrl);
    const token = url.searchParams.get("token");
    const resolvedCallback =
      url.searchParams.get("callbackUrl") ?? callbackUrl ?? "/dashboard";

    if (!token) {
      return NextResponse.json(
        { error: "Unable to generate verification token" },
        { status: 500 },
      );
    }

    return NextResponse.json({ token, callbackUrl: resolvedCallback });
  } catch (error) {
    console.error("Failed to create inline magic session:", error);
    return NextResponse.json(
      { error: "Failed to create magic session" },
      { status: 500 },
    );
  }
}
