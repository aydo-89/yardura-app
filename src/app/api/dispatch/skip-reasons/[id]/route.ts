import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import {
  deleteSkipReason,
  updateSkipReason,
} from "@/lib/dispatch/skip-reasons";
import { SkipBillingBehavior } from "@prisma/client";

const patchSchema = z.object({
  orgId: z.string().min(1),
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  billingBehavior: z.nativeEnum(SkipBillingBehavior).optional(),
  notifyCustomer: z.boolean().optional(),
});

const deleteSchema = z.object({ orgId: z.string().min(1) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = patchSchema.parse(await req.json());
    const { id } = await params;
    const result = await updateSkipReason(id, payload.orgId, payload);
    return NextResponse.json({ ok: true, skipReason: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    if (error instanceof Error && /not found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("dispatch.skipReasons.PATCH", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = deleteSchema.parse(await req.json());
    const { id } = await params;
    await deleteSkipReason(id, payload.orgId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    if (error instanceof Error && /not found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("dispatch.skipReasons.DELETE", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
