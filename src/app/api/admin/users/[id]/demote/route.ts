import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { sortRoles, type AppUserRole } from "@/lib/auth/roles";

export async function POST(
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

    // Prevent demoting the god mode user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, roles: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.email === "ayden@yardura.com") {
      return NextResponse.json(
        { error: "Cannot demote god mode user" },
        { status: 403 },
      );
    }

    const currentRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const filteredRoles = currentRoles.filter((role) => role !== "ADMIN");
    const nextRoles = (filteredRoles.length > 0
      ? sortRoles(filteredRoles as AppUserRole[])
      : ["CUSTOMER"]) as UserRole[];
    const primaryRole = (nextRoles[0] ?? "CUSTOMER") as UserRole;

    // Update user to remove admin role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: primaryRole, roles: nextRoles },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        orgId: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error demoting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
