import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().min(1),
  maxUses: z.number().min(1).optional(),
  validFrom: z.string().transform(val => new Date(val)),
  validUntil: z.string().optional().transform(val => val ? new Date(val) : undefined),
}).refine((data) => {
  // Validate discount value based on type
  if (data.discountType === "percentage") {
    return data.discountValue <= 100;
  } else {
    return data.discountValue <= 1000000; // Max $10,000 for fixed
  }
}, {
  message: "Invalid discount value for the selected discount type",
  path: ["discountValue"],
});

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

// GET - List promo codes
export async function GET(request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || session.user.orgId;

    const promoCodes = await prisma.promoCode.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(promoCodes);
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo codes" },
      { status: 500 }
    );
  }
}

// POST - Create promo code
export async function POST(request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = createSchema.parse(await request.json());
    const orgId = session.user.orgId;

    const promoCode = await prisma.promoCode.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
        orgId,
      },
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error("Error creating promo code:", error);
    return NextResponse.json(
      { error: "Failed to create promo code" },
      { status: 500 }
    );
  }
}
