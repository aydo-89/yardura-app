import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { getCustomerWellnessAccess } from "@/lib/wellness/access";

const dogSchema = z.object({
  name: z.string().trim().min(1),
  breed: z.string().trim().min(1).nullable().optional(),
  age: z.coerce.number().int().min(0).max(40).nullable().optional(),
  weight: z.coerce.number().min(1).max(300).nullable().optional(),
  allergies: z.string().trim().max(300).nullable().optional(),
  medications: z.string().trim().max(300).nullable().optional(),
  dietNotes: z.string().trim().max(500).nullable().optional(),
  vetName: z.string().trim().max(200).nullable().optional(),
  vetPhone: z.string().trim().max(50).nullable().optional(),
  vetClinic: z.string().trim().max(200).nullable().optional(),
});

const updateSchema = dogSchema.partial().extend({
  id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = dogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid dog payload", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const customerMatches = [
      { userId: session.user.id },
      session.user.email ? { email: session.user.email } : null,
    ].filter(Boolean) as Array<{ userId?: string; email?: string }>;
    const customer =
      customerMatches.length > 0
        ? await prisma.customer.findFirst({
            where: { OR: customerMatches },
            select: { id: true, orgId: true },
          })
        : null;

    if (customer) {
      const access = await getCustomerWellnessAccess({
        customerId: customer.id,
        orgId: customer.orgId,
      });
      const maxDogs = access.maxDogs;
      const existingDogCount = await prisma.dog.count({
        where: {
          OR: [{ customerId: customer.id }, { userId: session.user.id }],
        },
      });

      if (maxDogs !== null && existingDogCount >= maxDogs) {
        return NextResponse.json(
          { error: "limit_reached", message: "Upgrade to add more dogs." },
          { status: 403 },
        );
      }
    }

    const dog = await prisma.dog.create({
      data: {
        name: parsed.data.name,
        breed: parsed.data.breed ?? null,
        age: parsed.data.age ?? null,
        weight: typeof parsed.data.weight === "number" ? parsed.data.weight : null,
        allergies: parsed.data.allergies ?? null,
        medications: parsed.data.medications ?? null,
        dietNotes: parsed.data.dietNotes ?? null,
        vetName: parsed.data.vetName ?? null,
        vetPhone: parsed.data.vetPhone ?? null,
        vetClinic: parsed.data.vetClinic ?? null,
        userId: session.user.id,
        customerId: customer?.id ?? null,
      },
    });

    return NextResponse.json({ dog });
  } catch (error) {
    console.error("Error creating dog:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dogs = await prisma.dog.findMany({
      where: { userId: session.user.id },
      include: {
        dataReadings: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({ dogs });
  } catch (error) {
    console.error("Error fetching dogs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid dog payload", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { id } = parsed.data;

    const dog = await prisma.dog.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    const updated = await prisma.dog.update({
      where: { id },
      data: {
        name:
          typeof parsed.data.name === "string" && parsed.data.name.trim().length
            ? parsed.data.name.trim()
            : dog.name,
        breed: parsed.data.breed ?? undefined,
        age: typeof parsed.data.age === "number" ? parsed.data.age : undefined,
        weight: typeof parsed.data.weight === "number" ? parsed.data.weight : undefined,
        allergies: parsed.data.allergies ?? undefined,
        medications: parsed.data.medications ?? undefined,
        dietNotes: parsed.data.dietNotes ?? undefined,
        vetName: parsed.data.vetName ?? undefined,
        vetPhone: parsed.data.vetPhone ?? undefined,
        vetClinic: parsed.data.vetClinic ?? undefined,
      },
    });

    return NextResponse.json({ dog: updated });
  } catch (error) {
    console.error("Error updating dog:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dogId = searchParams.get("id");

    if (!dogId) {
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

    // Verify the dog belongs to this user
    const dog = await prisma.dog.findFirst({
      where: {
        id: dogId,
        userId: session.user.id,
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    // Delete the dog
    await prisma.dog.delete({
      where: { id: dogId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dog:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
