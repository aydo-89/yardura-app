import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMagicLink } from "@/lib/auth/magicLink";
import { sendTransactionalEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/email/templates";
import { extractUserRole } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    const role = extractUserRole(session);
    if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { role: { not: "CUSTOMER" } },
          { roles: { hasSome: ["ADMIN", "OWNER", "SALES_REP", "TECH"] } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        orgId: true,
        createdAt: true,
        scooperProfile: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            assignedLeads: true,
            serviceVisits: true,
            accounts: true,
            dogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    const role = extractUserRole(session);
    if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      email,
      name,
      role: singleRole,
      roles: multipleRoles,
      orgId = "yardura",
      addressLine1,
      city,
      state,
      zip,
    } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!addressLine1 || !city || !state || !zip) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    // Support both single role (legacy) and multiple roles
    const validRoles = ["ADMIN", "OWNER", "SALES_REP", "TECH", "CUSTOMER"];
    let requestedRoles: string[] = [];
    
    if (Array.isArray(multipleRoles) && multipleRoles.length > 0) {
      requestedRoles = multipleRoles.map((r: string) => String(r).toUpperCase());
    } else if (singleRole) {
      requestedRoles = [String(singleRole).toUpperCase()];
    } else {
      requestedRoles = ["CUSTOMER"];
    }

    // Validate all roles
    for (const r of requestedRoles) {
      if (!validRoles.includes(r)) {
        return NextResponse.json({ error: `Invalid role: ${r}` }, { status: 400 });
      }
    }

    requestedRoles = Array.from(new Set([...requestedRoles, "CUSTOMER"]));

    // Determine primary role (highest priority for User.role field)
    const rolePriority = ["OWNER", "ADMIN", "SALES_REP", "TECH", "CUSTOMER"];
    const primaryRole = rolePriority.find((r) => requestedRoles.includes(r)) ?? "CUSTOMER";

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

    // Create the user and any related records in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create base user with primary role
      const newUser = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          role: primaryRole as UserRole,
          roles: requestedRoles as UserRole[],
          orgId,
          address: addressLine1,
          city,
          zipCode: zip,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          roles: true,
          orgId: true,
          createdAt: true,
        },
      });

      // If TECH role requested, create ScooperProfile
      if (requestedRoles.includes("TECH")) {
        await tx.scooperProfile.create({
          data: {
            userId: newUser.id,
            orgId,
            status: "CERTIFIED",
            metadata: {},
          },
        });
      }

      await tx.customer.create({
        data: {
          userId: newUser.id,
          orgId,
          name: newUser.name ?? email.split("@")[0],
          email,
          addressLine1,
          city,
          state,
          zip,
        },
      });

      return newUser;
    });

    try {
      const magicLinkUrl = await createMagicLink({
        email,
        callbackUrl: requestedRoles.includes("TECH") ? "/field-tech" : "/dashboard",
      });

      const inviterName = session.user?.name || "The InsightScoop team";
      const recipientName = user.name || email.split("@")[0];
      const subject = "Your InsightScoop account is ready";
      const roleLabelMap: Record<string, string> = {
        ADMIN: "Admin",
        OWNER: "Owner",
        SALES_REP: "Sales rep",
        TECH: "Field tech",
        CUSTOMER: "Customer",
      };
      const emailRoles =
        requestedRoles.length > 1
          ? requestedRoles.filter((role) => role !== "CUSTOMER")
          : requestedRoles;
      const roleLabels = emailRoles.map((r) => roleLabelMap[r] ?? r);
      const roleLabel = roleLabels.length > 1 ? roleLabels.join(" + ") : roleLabels[0];

      const { html, text } = buildInviteEmail(inviterName, recipientName, magicLinkUrl, roleLabel);
      await sendTransactionalEmail({
        to: email,
        subject,
        html,
        text,
      });
    } catch (error) {
      console.error("Failed to send invite email", error);
    }

    return NextResponse.json({ ...user, invited: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
