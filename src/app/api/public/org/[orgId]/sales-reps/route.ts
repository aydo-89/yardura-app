import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  try {
    const params = await context.params;
    const rawOrgId = params?.orgId?.trim();
    if (!rawOrgId) {
      return NextResponse.json(
        { ok: false, error: "Organization id is required" },
        { status: 400 },
      );
    }

    const org = await prisma.org.findFirst({
      where: {
        OR: [{ id: rawOrgId }, { slug: rawOrgId }],
      },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      );
    }

    const reps = await prisma.user.findMany({
      where: {
        orgId: org.id,
        ...buildUserRoleFilter([UserRole.SALES_REP]),
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: reps.map((rep) => ({
        id: rep.id,
        name: rep.name,
        email: rep.email,
        label:
          rep.name && rep.email
            ? `${rep.name} (${rep.email})`
            : rep.name || rep.email || "Sales representative",
      })),
    });
  } catch (error) {
    console.error("GET /api/public/org/[orgId]/sales-reps error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
