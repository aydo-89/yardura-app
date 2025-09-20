import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const territorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  type: z.string().min(1),
  color: z.string().optional(),
  geometry: z.any(),
  parentId: z.string().optional(),
  assignees: z
    .array(
      z.object({
        userId: z.string(),
        role: z.enum(["OWNER", "CONTRIBUTOR", "VIEWER"]).default("OWNER"),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
});

function forbidden(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const role = (session as any)?.userRole;
    const isManager = [
      "ADMIN",
      "OWNER",
      "SALES_MANAGER",
      "FRANCHISE_OWNER",
    ].includes(role);
    if (!isManager) {
      return forbidden();
    }

    const orgId = (session.user as any)?.orgId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not set" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || undefined;
    const parentId = searchParams.get("parentId") || undefined;
    const includeAssignments =
      searchParams.get("includeAssignments") === "true";
    const search = searchParams.get("search") || undefined;

    const where: Record<string, unknown> = { orgId };

    if (type) {
      where.type = type;
    }

    if (parentId === "NULL") {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const territories = await prisma.territory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: includeAssignments
        ? {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          }
        : undefined,
    });

    return NextResponse.json({ ok: true, data: territories });
  } catch (error) {
    console.error("GET /api/territories error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const role = (session as any)?.userRole;
    const isManager = [
      "ADMIN",
      "OWNER",
      "SALES_MANAGER",
      "FRANCHISE_OWNER",
    ].includes(role);
    if (!isManager) {
      return forbidden();
    }

    const orgId = (session.user as any)?.orgId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not set" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const parsed = territorySchema.parse(json);

    if (parsed.parentId) {
      const parent = await prisma.territory.findFirst({
        where: { id: parsed.parentId, orgId },
      });
      if (!parent) {
        return NextResponse.json(
          { ok: false, error: "Parent territory not found" },
          { status: 404 },
        );
      }
    }

    const data = {
      orgId,
      name: parsed.name,
      slug:
        parsed.slug ?? parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      type: parsed.type,
      color: parsed.color,
      geometry: parsed.geometry,
      parentId: parsed.parentId,
    };

    const territory = await prisma.$transaction(async (tx) => {
      const created = await tx.territory.create({ data });

      if (parsed.assignees?.length) {
        await tx.territoryAssignment.createMany({
          data: parsed.assignees.map((assignee) => ({
            orgId,
            territoryId: created.id,
            userId: assignee.userId,
            role: assignee.role,
            isPrimary: assignee.isPrimary ?? false,
          })),
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, data: territory }, { status: 201 });
  } catch (error) {
    console.error("POST /api/territories error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }

    if ((error as any)?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Territory slug already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
