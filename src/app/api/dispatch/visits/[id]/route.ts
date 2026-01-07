import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  resolvePreferredTimeWindowLabel,
  normalizePreferredTimeWindowSlug,
} from "@/lib/time-window";

const schema = z.object({
  preferredTimeWindowSlug: z.union([
    z.literal("morning"),
    z.literal("afternoon"),
    z.literal("evening"),
    z.literal("flex"),
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalizedSlug = normalizePreferredTimeWindowSlug(body.preferredTimeWindowSlug);
  const label = resolvePreferredTimeWindowLabel(normalizedSlug);

  try {
    const visit = await prisma.serviceVisit.update({
      where: { id },
      data: {
        preferredTimeWindowSlug: normalizedSlug,
        preferredTimeWindow: label,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, visit });
  } catch (error) {
    console.error("dispatch.visit.window.update", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
