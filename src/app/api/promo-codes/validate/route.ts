import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1).max(50),
  orgId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { code, orgId } = schema.parse(await request.json());

    const promoCode = await prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } }
        ],
        orgId: orgId || "yardura", // Default to yardura org if not specified
      },
    });

    if (!promoCode) {
      return NextResponse.json(
        { error: "Invalid or expired promo code" },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json(
        { error: "Promo code has reached maximum uses" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: promoCode.id,
      code: promoCode.code,
      description: promoCode.description,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      validUntil: promoCode.validUntil,
    });
  } catch (error) {
    console.error("Promo code validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}


