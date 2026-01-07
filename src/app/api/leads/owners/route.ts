import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";

const allowedRoles = new Set([
  "ADMIN",
  "OWNER",
  "TECH",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
  "SALES_REP",
]);

const assignableRoles: UserRole[] = ["ADMIN", "OWNER", "TECH", "SALES_REP"];

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiAuth(request);
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess =
      (auth.role && allowedRoles.has(auth.role)) ||
      auth.roles.some((role) => allowedRoles.has(role));
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const orgId = auth.orgId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not configured" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isNaN(limitParam) ? 100 : Math.max(1, Math.min(limitParam, 200));

    const where: any = {
      orgId,
      ...buildUserRoleFilter(assignableRoles),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const owners = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: [
        { role: "asc" },
        { name: "asc" },
        { email: "asc" },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    const results = owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
      label:
        owner.name && owner.email
          ? `${owner.name} (${owner.email})`
          : owner.name || owner.email || "Unnamed user",
    }));

    return NextResponse.json({ ok: true, data: results });
  } catch (error) {
    console.error("GET /api/leads/owners error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
