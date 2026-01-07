import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";

const schema = z.object({
  orgId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const orgId = parsed.data.orgId || (session.user as any)?.orgId || undefined;
  if (!orgId) {
    return NextResponse.json({ error: "Missing org" }, { status: 400 });
  }

  const technicians = await prisma.user.findMany({
    where: {
      orgId,
      ...buildUserRoleFilter([UserRole.TECH, UserRole.SALES_REP], {
        includeProfileFallback: true,
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, technicians });
}

export const runtime = "nodejs";
