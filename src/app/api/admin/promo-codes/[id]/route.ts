import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().min(1).optional(),
  maxUses: z.number().min(1).optional(),
  validFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  validUntil: z.string().optional().transform(val => val ? new Date(val) : undefined),
  isActive: z.boolean().optional(),
});

// GET - Get specific promo code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const promoCode = await prisma.promoCode.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    });

    if (!promoCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error("Error fetching promo code:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo code" },
      { status: 500 }
    );
  }
}

// PUT - Update promo code
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    const promoCode = await prisma.promoCode.update({
      where: {
        id,
        orgId: session.user.orgId,
      },
      data: {
        ...data,
        ...(data.code && { code: data.code.toUpperCase() }),
      },
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error("Error updating promo code:", error);
    return NextResponse.json(
      { error: "Failed to update promo code" },
      { status: 500 }
    );
  }
}

// DELETE - Delete promo code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.promoCode.delete({
      where: {
        id,
        orgId: session.user.orgId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    return NextResponse.json(
      { error: "Failed to delete promo code" },
      { status: 500 }
    );
  }
}
