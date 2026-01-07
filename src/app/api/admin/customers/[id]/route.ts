import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { deleteCustomerCascade } from "@/lib/admin/customers";
import { geocodeAddress } from "@/lib/google/maps";
import { prisma } from "@/lib/prisma";

const GOD_MODE_EMAIL = "ayden@yardura.com";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  const userRole = (session as any)?.userRole ?? (session?.user as any)?.role;
  
  // Only OWNER and ADMIN can edit customers
  if (!session?.user || !["OWNER", "ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const { name, email, phone, addressLine1, city, state, zip } = body;

    // Validate required fields
    if (!name || !addressLine1 || !city || !state || !zip) {
      return NextResponse.json(
        { error: "Name, address, city, state, and zip are required" },
        { status: 400 },
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: {
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const addressChanged =
      existing.addressLine1 !== addressLine1 ||
      existing.city !== city ||
      existing.state !== state ||
      existing.zip !== zip;

    let latitude = existing.latitude ?? null;
    let longitude = existing.longitude ?? null;

    if (addressChanged) {
      const formattedAddress = `${addressLine1}, ${city}, ${state} ${zip}`;
      try {
        const geo = await geocodeAddress(formattedAddress);
        latitude = geo?.location.lat ?? null;
        longitude = geo?.location.lng ?? null;
      } catch (geoError) {
        console.warn("admin.customers.update.geocode_failed", geoError);
        latitude = null;
        longitude = null;
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        addressLine1,
        city,
        state,
        zip,
        latitude,
        longitude,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("admin.customers.update", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user || session.user.email !== GOD_MODE_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteCustomerCascade(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin.customers.delete", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to delete customer" }, { status: 500 });
  }
}

export const runtime = "nodejs";
