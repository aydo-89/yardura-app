import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId") || "yardura";
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200);

    const reps = await prisma.user.findMany({
      where: {
        orgId,
        ...buildUserRoleFilter([UserRole.SALES_REP]),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: limit,
    });

    const data = reps.map((rep) => ({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      label: rep.name || rep.email || "Unnamed representative",
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("GET /api/public/sales-reps error", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load sales representatives" },
      { status: 500 },
    );
  }
}
