import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { normalizeEmailOrThrow } from "@/lib/auth/email-normalizer";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmailOrThrow(email);
    } catch {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const emailPrefix = normalizedEmail.split("@")[0];

    // Create a personal organization for the user
    const organization = await prisma.org.create({
      data: {
        name: `${name || emailPrefix}'s Yardura Service`,
        slug: `${emailPrefix}-${Date.now()}`.toLowerCase(),
      },
    });

    // Create the user account with organization association
    const user = await prisma.user.create({
      data: {
        name: name || emailPrefix, // Use email prefix if no name provided
        email: normalizedEmail,
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        orgId: organization.id,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: normalizedEmail,
            access_token: hashedPassword,
          },
        },
      },
    });

    // If an inbound lead exists with a sales rep assignment, carry it forward
    const latestLeadWithRep = await prisma.lead.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        salesRepId: { not: null },
      },
      orderBy: { submittedAt: "desc" },
      select: { id: true, salesRepId: true },
    });

    if (latestLeadWithRep?.salesRepId) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { salesRepId: latestLeadWithRep.salesRepId },
        });

        const existingCustomer = await prisma.customer.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
          select: { id: true },
        });

        if (existingCustomer) {
          await prisma.lead.update({
            where: { id: latestLeadWithRep.id },
            data: {
              status: "WON",
              convertedAt: new Date(),
              convertedToCustomerId: existingCustomer.id,
            },
          });
        }
      } catch (error) {
        console.warn(
          "signup: unable to propagate sales rep assignment",
          error,
        );
      }
    }

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
