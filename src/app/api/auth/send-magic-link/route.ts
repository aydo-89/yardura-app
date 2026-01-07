import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicLink } from "@/lib/auth/magicLink";
import { sendTransactionalEmail } from "@/lib/email";
import { buildMagicLinkEmail } from "@/lib/email/templates";

export async function POST(request: NextRequest) {
  try {
    const { email, leadId, callbackUrl } = await request.json();

    if (!email || !leadId) {
      return NextResponse.json(
        { error: "Email and leadId are required" },
        { status: 400 },
      );
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        zipCode: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    let userId: string;

    if (existingUser) {
      // User exists, just send magic link
      userId = existingUser.id;
    } else {
      // Create new user account
      const newUser = await prisma.user.create({
        data: {
          email,
          name: lead.firstName,
          phone: lead.phone || null,
          address: lead.address || null,
          city: lead.city || null,
          zipCode: lead.zipCode || null,
          roles: ["CUSTOMER"],
        },
        select: { id: true },
      });
      userId = newUser.id;
    }

    const magicLinkUrl = await createMagicLink({
      email,
      callbackUrl: callbackUrl || "/dashboard",
    });

    const subject = "Complete your InsightScoop account setup";
    const { html, text } = buildMagicLinkEmail(lead.firstName ?? lead.email ?? "there", magicLinkUrl);

    await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
    });

    return NextResponse.json({
      success: true,
      message: "Magic link sent successfully",
      userId,
    });
  } catch (error) {
    console.error("Error sending magic link:", error);
    return NextResponse.json(
      { error: "Failed to send magic link" },
      { status: 500 },
    );
  }
}
