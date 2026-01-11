import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const allowedRoles = [
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
];

const readRoles = [...allowedRoles, "SALES_REP"];

const createCadenceSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(500).optional(),
  targetStage: z.string().optional(),
  steps: z
    .array(
      z.object({
        channel: z.string().min(1, "Channel is required"),
        waitMinutes: z.number().int().min(0).default(0),
        slaMinutes: z.number().int().min(0).optional(),
        autoComplete: z.boolean().default(false),
      }),
    )
    .min(1, "At least one step is required"),
});

function forbidden(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveApiAuth(req);
    if (!auth?.userId) {
      return forbidden();
    }

    const hasAccess =
      (auth.role && readRoles.includes(auth.role)) ||
      auth.roles.some((role) => readRoles.includes(role));
    if (!hasAccess) {
      return forbidden();
    }

    // Default to "yardura" org for multi-tenancy while keeping a sensible default
    const orgId = auth.orgId || "yardura";

    const cadences = await prisma.cadence.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
        enrollments: {
          select: { id: true, status: true },
        },
      },
    });

    return NextResponse.json({ ok: true, data: cadences });
  } catch (error) {
    console.error("GET /api/cadences error", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveApiAuth(req);
    if (!auth?.userId) {
      return forbidden();
    }

    const hasAccess =
      (auth.role && allowedRoles.includes(auth.role)) ||
      auth.roles.some((role) => allowedRoles.includes(role));
    if (!hasAccess) {
      return forbidden();
    }

    // Default to "yardura" org for multi-tenancy while keeping a sensible default
    const orgId = auth.orgId || "yardura";
    const userId = auth.userId;

    const json = await req.json();
    const parsed = createCadenceSchema.parse(json);

    const created = await prisma.$transaction(async (tx) => {
      const cadence = await tx.cadence.create({
        data: {
          orgId,
          name: parsed.name,
          description: parsed.description,
          targetStage: parsed.targetStage,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.cadenceStep.createMany({
        data: parsed.steps.map((step, index) => ({
          cadenceId: cadence.id,
          order: index + 1,
          channel: step.channel,
          templateId: null,
          waitMinutes: step.waitMinutes,
          slaMinutes: step.slaMinutes ?? null,
          autoComplete: step.autoComplete,
          metadata: Prisma.JsonNull,
        })),
      });

      return tx.cadence.findUnique({
        where: { id: cadence.id },
        include: {
          steps: { orderBy: { order: "asc" } },
          enrollments: { select: { id: true, status: true } },
        },
      });
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/cadences error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
