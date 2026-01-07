import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/env";
import { normalizeEmailOrThrow } from "@/lib/auth/email-normalizer";

/**
 * Check if an email exists as a user or customer
 * Used to validate before sending magic links
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmailOrThrow(email);
    } catch {
      return NextResponse.json(
        { exists: false, error: "A valid email is required" },
        { status: 400 }
      );
    }

    // Admin emails always exist
    if (isAdminEmail(normalizedEmail)) {
      return NextResponse.json({ exists: true, type: "admin" });
    }

    // Check User table (case insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: { id: true, role: true }
    });

    if (existingUser) {
      return NextResponse.json({ 
        exists: true, 
        type: "user",
        role: existingUser.role 
      });
    }

    // Check Customer table
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: { id: true }
    });

    if (existingCustomer) {
      return NextResponse.json({ 
        exists: true, 
        type: "customer" 
      });
    }

    // Not found
    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("[check-email] Error:", error);
    return NextResponse.json(
      { exists: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

