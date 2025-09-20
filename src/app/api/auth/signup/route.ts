import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/database-access";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

const prisma = getDb();

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create a personal organization for the user
    const orgName = `${name || email.split("@")[0]}'s Yardura Service`;
    const orgSlug = `${email.split("@")[0]}-${Date.now()}`.toLowerCase();

    const organization = await prisma.org.create({
      data: {
        name: orgName,
        slug: orgSlug,
      },
    });

    // Create the user account with organization association
    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0], // Use email prefix if no name provided
        email,
        role: UserRole.CUSTOMER,
        orgId: organization.id, // Associate user with their organization
        // Create a direct password account
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: email,
            access_token: hashedPassword,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Account created successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
