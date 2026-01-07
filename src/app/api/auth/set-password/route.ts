import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/set-password
 * 
 * Allows a newly onboarded customer to set a password for web access.
 * This is called from the completion page as an optional step.
 */
export async function POST(request: NextRequest) {
  try {
    const { customerId, password } = await request.json();

    if (!customerId || !password) {
      return NextResponse.json(
        { error: "Customer ID and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Find the customer and their associated user
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    if (!customer.user) {
      return NextResponse.json(
        { error: "No user account associated with this customer" },
        { status: 400 },
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Find or create a credentials account for this user
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: customer.user.id,
        provider: "credentials",
      },
    });

    if (existingAccount) {
      // Update existing credentials account
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: hashedPassword,
        },
      });
    } else {
      // Create new credentials account
      await prisma.account.create({
        data: {
          userId: customer.user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: customer.user.email ?? customer.user.id,
          access_token: hashedPassword,
        },
      });
    }

    return NextResponse.json({
      message: "Password set successfully",
      email: customer.user.email,
    });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "An error occurred while setting the password" },
      { status: 500 },
    );
  }
}
