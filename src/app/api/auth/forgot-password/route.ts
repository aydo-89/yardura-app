import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailConfig, getSiteUrl } from "@/lib/env";
import { buildPasswordResetEmail } from "@/lib/email/templates";
import crypto from "crypto";
import { normalizeEmailOrThrow } from "@/lib/auth/email-normalizer";


export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmailOrThrow(email);
    } catch {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    // Find user by email (case insensitive)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      include: { accounts: true },
    });

    if (!user) {
      // For security, don't reveal if email exists or not
      return NextResponse.json({
        message:
          "If an account with this email exists, we have sent a password reset link.",
      });
    }

    // Find or create the credentials account (password-based auth)
    let credentialsAccount = user.accounts.find(
      (account) => account.provider === "credentials",
    );

    // If user doesn't have a credentials account yet (signed up with magic link),
    // create one now so they can set a password
    if (!credentialsAccount) {
      credentialsAccount = await prisma.account.create({
        data: {
          userId: user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: user.id,
          access_token: "", // Will be set when they reset password
        },
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save reset token to database
    await prisma.account.update({
      where: { id: credentialsAccount.id },
      data: {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      },
    });

    // Send reset email
    const emailConfig = getEmailConfig();
    const resetUrl = `${getSiteUrl()}/reset-password?token=${resetToken}`;

    const emailSent = await sendPasswordResetEmail(
      user.email,
      user.name || "User",
      resetUrl,
      emailConfig,
    );

    if (!emailSent) {
      console.error("Failed to send password reset email");
      // Don't reveal email sending failure for security
    }

    return NextResponse.json({
      message:
        "If an account with this email exists, we have sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}

async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
  emailConfig: any,
): Promise<boolean> {
  const subject = "Reset your InsightScoop password";
  const { html: htmlContent, text: textContent } = buildPasswordResetEmail(name || null, resetUrl);

  try {
    if (emailConfig.provider === "smtp" && emailConfig.smtp) {
      // Send via SMTP
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport(emailConfig.smtp as any);

      await transporter.sendMail({
        from: emailConfig.from,
        to,
        subject,
        html: htmlContent,
        text: textContent,
      });
    } else if (emailConfig.provider === "resend" && emailConfig.resendApiKey) {
      // Send via Resend - use fetch like the magic link does (more reliable)
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${emailConfig.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailConfig.from,
          to: [to],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.error) {
        console.error("Resend send error:", result?.error || response.status);
        
        // In development, log the reset URL so testing can continue
        if (process.env.NODE_ENV === "development") {
          console.log("\n" + "=".repeat(60));
          console.log("⚠️  RESEND SEND FAILED - DEV MODE FALLBACK");
          console.log("=".repeat(60));
          console.log("To:", to);
          console.log("Reset URL:", resetUrl);
          console.log("=".repeat(60) + "\n");
          return true;
        }
        
        throw new Error("Resend send failed");
      }
      
      if (result?.id) {
        console.log("Resend email id:", result.id);
      }
    } else {
      // Development: log to console
      console.log("\n[Password Reset Email - DEV MODE]");
      console.log("To:", to);
      console.log("Subject:", subject);
      console.log("Reset URL:", resetUrl);
      console.log("Email content would be sent in production\n");
    }

    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
}
