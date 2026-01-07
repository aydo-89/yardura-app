import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { deleteUserCascade } from "@/lib/admin/users";
import { extractUserRole, sortRoles } from "@/lib/auth/roles";
import {
  getStrikeDetails,
  setStrikeCount,
  STRIKE_LIMIT,
} from "@/lib/marketplace/discipline";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);
  if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
    return { error: "Unauthorized", status: 403 } as const;
  }
  return { session } as const;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      roles: true,
      orgId: true,
      createdAt: true,
      phone: true,
      address: true,
      city: true,
      zipCode: true,
      commissionRate: true,
      scooperProfile: {
        select: {
          id: true,
          status: true,
          backgroundCheckStatus: true,
          trainingCompletedAt: true,
          vehicleVerified: true,
          insuranceProofUrl: true,
          metadata: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  const strike =
    user.scooperProfile
      ? getStrikeDetails(user.scooperProfile.metadata, now)
      : null;

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
    strikes: strike
      ? {
          count: strike.count,
          limit: STRIKE_LIMIT,
          windowStart: strike.windowStart,
          lastAt: strike.lastAt ?? null,
          lastReason: strike.lastReason ?? null,
        }
      : null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: userId } = await params;
  const payload = await request.json().catch(() => ({}));

  if (payload?.strikeCount !== undefined) {
    const rawCount = payload?.strikeCount;
    const reason =
      typeof payload?.strikeReason === "string" && payload.strikeReason.trim()
        ? payload.strikeReason.trim()
        : null;

    if (typeof rawCount !== "number" || Number.isNaN(rawCount)) {
      return NextResponse.json({ error: "strike_count_required" }, { status: 422 });
    }

    const profile = await prisma.scooperProfile.findUnique({
      where: { userId },
      select: { id: true, metadata: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
    }

    const now = new Date();
    const strikeUpdate = setStrikeCount(profile.metadata, now, rawCount, reason);

    await prisma.scooperProfile.update({
      where: { id: profile.id },
      data: { metadata: strikeUpdate.metadata },
    });

    return NextResponse.json({
      strikes: {
        count: strikeUpdate.currentCount,
        limit: STRIKE_LIMIT,
        windowStart: strikeUpdate.windowStart,
        lastAt: strikeUpdate.lastAt ?? null,
        lastReason: strikeUpdate.lastReason ?? null,
      },
    });
  }

  if (Array.isArray(payload?.roles) || typeof payload?.role === "string") {
    const validRoles = ["OWNER", "ADMIN", "SALES_REP", "TECH", "CUSTOMER"];
    const requestedRoles = Array.isArray(payload.roles)
      ? payload.roles.map((role: string) => String(role).toUpperCase())
      : [String(payload.role).toUpperCase()];

    if (requestedRoles.length === 0) {
      return NextResponse.json({ error: "roles_required" }, { status: 422 });
    }

    const invalidRole = requestedRoles.find(
      (role: string) => !validRoles.includes(role),
    );
    if (invalidRole) {
      return NextResponse.json({ error: "invalid_role" }, { status: 422 });
    }

    const normalizedRoles = sortRoles(
      requestedRoles as Array<"OWNER" | "ADMIN" | "SALES_REP" | "TECH" | "CUSTOMER">,
    );
    const primaryRole = normalizedRoles[0] ?? "CUSTOMER";
    const wantsTech = normalizedRoles.includes("TECH");

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });
    const orgId = userRecord?.orgId ?? "yardura";

    const updated = await prisma.$transaction(async (tx) => {
      const existingProfile = await tx.scooperProfile.findUnique({
        where: { userId },
        select: { id: true, status: true },
      });

      if (wantsTech && !existingProfile) {
        await tx.scooperProfile.create({
          data: {
            userId,
            orgId,
            status: "CERTIFIED",
            metadata: {},
          },
        });
      }

      if (!wantsTech && existingProfile) {
        await tx.scooperProfile.update({
          where: { id: existingProfile.id },
          data: { status: "DEACTIVATED" },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          role: primaryRole,
          roles: normalizedRoles,
        },
        select: {
          id: true,
          role: true,
          roles: true,
        },
      });
    });

    return NextResponse.json({ ok: true, user: updated });
  }

  if (payload?.scooperProfile) {
    const profile = await prisma.scooperProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
    }

    const updateData: Prisma.ScooperProfileUpdateInput = {};
    if (typeof payload.scooperProfile.status === "string") {
      updateData.status = payload.scooperProfile.status;
    }
    if (typeof payload.scooperProfile.backgroundCheckStatus === "string") {
      updateData.backgroundCheckStatus = payload.scooperProfile.backgroundCheckStatus;
    }
    if (typeof payload.scooperProfile.trainingCompletedAt === "string") {
      updateData.trainingCompletedAt = payload.scooperProfile.trainingCompletedAt
        ? new Date(payload.scooperProfile.trainingCompletedAt)
        : null;
    } else if (payload.scooperProfile.trainingCompletedAt === null) {
      updateData.trainingCompletedAt = null;
    }
    if (typeof payload.scooperProfile.vehicleVerified === "boolean") {
      updateData.vehicleVerified = payload.scooperProfile.vehicleVerified;
    }
    if (typeof payload.scooperProfile.insuranceProofUrl === "string" || payload.scooperProfile.insuranceProofUrl === null) {
      updateData.insuranceProofUrl = payload.scooperProfile.insuranceProofUrl;
    }

    await prisma.scooperProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Only allow god mode users
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email !== "ayden@yardura.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: userId } = await params;

    // Prevent deleting the god mode user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.email === "ayden@yardura.com") {
      return NextResponse.json(
        { error: "Cannot delete god mode user" },
        { status: 403 },
      );
    }

    const fallback = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    await deleteUserCascade({
      userId,
      fallbackUserId: fallback?.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
