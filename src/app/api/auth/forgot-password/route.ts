import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/database-access";
import { getEmailConfig } from "@/lib/env";
import crypto from "crypto";

const prisma = getDb();

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { accounts: true },
    });

    if (!user) {
      // For security, don't reveal if email exists or not
      return NextResponse.json({
        message:
          "If an account with this email exists, we have sent a password reset link.",
      });
    }

    // Find the credentials account (password-based auth)
    const credentialsAccount = user.accounts.find(
      (account) => account.provider === "credentials",
    );

    if (!credentialsAccount) {
      // User doesn't have a password account (e.g., only OAuth)
      return NextResponse.json({
        message:
          "If an account with this email exists, we have sent a password reset link.",
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
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    const emailSent = await sendPasswordResetEmail(
      email,
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
  const subject = "Reset your Yardura password";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your Yardura password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10b981; margin: 0; font-size: 28px;">Yardura</h1>
        <p style="color: #666; margin: 5px 0;">Clean yards. Smart insights.</p>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h2 style="color: #333; margin-top: 0; margin-bottom: 20px;">Reset your password</h2>

        <p style="margin-bottom: 20px;">Hi ${name},</p>

        <p style="margin-bottom: 20px;">
          We received a request to reset your password for your Yardura account.
          Click the button below to create a new password:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
          This link will expire in 24 hours for security reasons.
        </p>

        <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
          If you didn't request this password reset, please ignore this email.
          Your password will remain unchanged.
        </p>
      </div>

      <div style="text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
        <p>This email was sent to ${to}</p>
        <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999;">
        <p>© 2024 Yardura. All rights reserved.</p>
        <p>1234 Main Street, Minneapolis, MN 55401</p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Reset your Yardura password

    Hi ${name},

    We received a request to reset your password for your Yardura account.

    Click this link to create a new password:
    ${resetUrl}

    This link will expire in 24 hours for security reasons.

    If you didn't request this password reset, please ignore this email.
    Your password will remain unchanged.

    --
    Yardura Support
    support@yardura.com
  `;

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
      // Send via Resend
      const { Resend } = await import("resend");
      const resend = new Resend(emailConfig.resendApiKey);

      // In development, if using a non-verified domain, use Resend's onboarding sender to ensure delivery
      const fromAddress =
        process.env.NODE_ENV === "development" &&
        /@yardura\.com$/i.test(emailConfig.from)
          ? "Yardura <onboarding@resend.dev>"
          : emailConfig.from;

      const result = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html: htmlContent,
        text: textContent,
      });

      // Basic logging for diagnostics
      if ((result as any)?.error) {
        console.error("Resend send error:", (result as any).error);
        throw new Error("Resend send failed");
      }
      if ((result as any)?.data?.id) {
        console.log("Resend email id:", (result as any).data.id);
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
