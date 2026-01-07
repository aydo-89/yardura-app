import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import {
  createSkipReason,
  listSkipReasons,
} from "@/lib/dispatch/skip-reasons";
import { SkipBillingBehavior } from "@prisma/client";

const getSchema = z.object({ orgId: z.string().min(1) });

const postSchema = z.object({
  orgId: z.string().min(1),
  code: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_\-]+$/i, "Alphanumeric, dash, underscore only"),
  label: z.string().min(1),
  description: z.string().optional(),
  billingBehavior: z.nativeEnum(SkipBillingBehavior).optional(),
  notifyCustomer: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = getSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const skipReasons = await listSkipReasons(parsed.data.orgId);
  return NextResponse.json({ ok: true, skipReasons });
}

export async function POST(req: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = postSchema.parse(await req.json());
    const reason = await createSkipReason(payload);
    return NextResponse.json({ ok: true, skipReason: reason }, { status: 201 });
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
    console.error("dispatch.skipReasons.POST", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
