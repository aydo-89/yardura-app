import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

const enrollSchema = z.object({
  cadenceId: z.string().min(1, "Cadence is required"),
});

const allowedRoles = [
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
  "SALES_REP",
];

function forbidden(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const orgId = auth.orgId;
    const userId = auth.userId;
    if (!orgId || !userId) {
      return NextResponse.json({ ok: false, error: "Organization not set" }, { status: 400 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Lead ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = enrollSchema.parse(body);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const cadence = await prisma.cadence.findFirst({
      where: { id: parsed.cadenceId, orgId, active: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!cadence) {
      return NextResponse.json({ ok: false, error: "Cadence not found" }, { status: 404 });
    }

    const firstStep = cadence.steps.at(0) ?? null;
    const now = new Date();
    const nextRunAt = firstStep
      ? new Date(now.getTime() + firstStep.waitMinutes * 60000)
      : now;

    const enrollment = await prisma.leadCadenceEnrollment.create({
      data: {
        orgId,
        leadId,
        cadenceId: cadence.id,
        status: "active",
        startedAt: now,
        lastExecutedAt: null,
        nextRunAt,
        currentStepId: firstStep?.id ?? null,
      },
      include: {
        cadence: {
          select: { id: true, name: true, targetStage: true },
        },
        currentStep: {
          select: { id: true, order: true, channel: true, waitMinutes: true },
        },
      },
    });

    return NextResponse.json({ ok: true, data: enrollment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads/[id]/cadences error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
