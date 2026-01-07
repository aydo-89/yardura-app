import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .transform((value) => value?.trim().toLowerCase() || null),
  phone: z
    .string()
    .min(7, "Phone number too short")
    .max(32)
    .optional()
    .transform((value) => value?.trim() || null),
  addressLine1: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z
    .string()
    .min(2, "State required")
    .max(32)
    .transform((value) => value.trim().toUpperCase()),
  zip: z.string().min(3, "ZIP required").max(16),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((value) => value?.trim() || null),
  latitude: z
    .number()
    .finite("Latitude must be finite")
    .min(-90)
    .max(90)
    .optional(),
  longitude: z
    .number()
    .finite("Longitude must be finite")
    .min(-180)
    .max(180)
    .optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = (session.user as any)?.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "org_not_set" }, { status: 400 });
  }

  let payload: z.infer<typeof createCustomerSchema>;
  try {
    payload = createCustomerSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        orgId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        addressLine1: payload.addressLine1,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        notes: payload.notes,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
      },
    });

    return NextResponse.json({ ok: true, customer }, { status: 201 });
  } catch (error) {
    console.error("customers.POST", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
