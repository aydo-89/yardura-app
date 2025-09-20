import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
        },
        select: { id: true },
      });
      userId = newUser.id;
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Generate magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const magicLinkUrl = `${baseUrl}/auth/verify-magic-link?token=${token}&email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl || "/dashboard")}`;

    // Send magic link email
    if (resend) {
      await resend.emails.send({
        from: "Yardura <auth@yardura.com>",
        to: email,
        subject: "Complete your Yardura account setup",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Welcome to Yardura!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Click the button below to complete your account setup</p>
            </div>

            <div style="padding: 40px 30px; background: white; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
                Hi ${lead.firstName},<br><br>
                We're excited to help you get started with cleaner, greener yards! Click the button below to complete your account setup and start your service.
              </p>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${magicLinkUrl}"
                   style="display: inline-block; padding: 16px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Complete Account Setup
                </a>
              </div>

              <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 30px;">
                This link will expire in 24 hours for security reasons.<br>
                If you didn't request this, please ignore this email.
              </p>
            </div>
          </div>
        `,
      });
    }

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
