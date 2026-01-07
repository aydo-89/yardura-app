import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortRoles } from "@/lib/auth/roles";

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

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, roles: true, orgId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const nextRoles = sortRoles([...(existing.roles ?? []), "ADMIN"]);
    const primaryRole = nextRoles[0] ?? "ADMIN";

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: primaryRole,
        roles: nextRoles,
        orgId: existing.orgId ?? "yardura",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        orgId: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error promoting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
