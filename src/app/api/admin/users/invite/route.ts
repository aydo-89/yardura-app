import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/env";
import { extractUserRole } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";
import { createMagicLink } from "@/lib/auth/magicLink";
import { sendTransactionalEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/email/templates";

export async function POST(request: NextRequest) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    const role = extractUserRole(session);
    if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const {
      email,
      name,
      role: requestedRole = "OWNER",
      roles: requestedRoles,
      orgId = "yardura",
      addressLine1,
      city,
      state,
      zip,
    } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!addressLine1 || !city || !state || !zip) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "OWNER", "SALES_REP", "TECH", "CUSTOMER"];
    const normalizedRoles = Array.isArray(requestedRoles) && requestedRoles.length > 0
      ? requestedRoles.map((role: string) => String(role).toUpperCase())
      : [String(requestedRole || "OWNER").toUpperCase()];
    const invalidRole = normalizedRoles.find((role) => !validRoles.includes(role));
    if (invalidRole) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 },
      );
    }

    // Create the user
    const rolePriority = ["OWNER", "ADMIN", "SALES_REP", "TECH", "CUSTOMER"];
    const primaryRole = rolePriority.find((role) => normalizedRoles.includes(role)) ?? "CUSTOMER";

    const user = await prisma.$transaction(async (tx) => {
      const finalRoles = Array.from(new Set([...normalizedRoles, "CUSTOMER"]));
      const created = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          role: primaryRole as UserRole,
          roles: finalRoles as UserRole[],
          orgId,
          address: addressLine1,
          city,
          zipCode: zip,
        },
      });

      if (normalizedRoles.includes("TECH")) {
        await tx.scooperProfile.create({
          data: {
            userId: created.id,
            orgId,
            status: "CERTIFIED",
            metadata: {},
          },
        });
      }

      await tx.customer.create({
        data: {
          userId: created.id,
          orgId,
          name: created.name ?? email.split("@")[0],
          email,
          addressLine1,
          city,
          state,
          zip,
        },
      });

      return created;
    });

    // Send invitation email
    const magicLinkUrl = await createMagicLink({
      email,
      callbackUrl: "/dashboard",
    });
    const roleLabelMap: Record<string, string> = {
      ADMIN: "Admin",
      OWNER: "Owner",
      SALES_REP: "Sales rep",
      TECH: "Field tech",
      CUSTOMER: "Customer",
    };
    const roleLabel = normalizedRoles
      .map((role) => roleLabelMap[role] ?? role)
      .join(" + ");
    const { html, text } = buildInviteEmail(
      session.user?.name || "The InsightScoop team",
      name || email.split("@")[0],
      magicLinkUrl,
      roleLabel,
    );

    try {
      await sendTransactionalEmail({
        to: email,
        subject: "Welcome to InsightScoop Service OS",
        html,
        text,
      });
      console.log(`Invitation email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
    }

    return NextResponse.json(
      {
        ...user,
        inviteSent: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user with invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
