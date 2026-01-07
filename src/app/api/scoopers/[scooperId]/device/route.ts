import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "@/lib/tenant";

const deviceSchema = z.object({
  deviceId: z.string().min(4),
  platform: z.string().optional(),
  bluetoothMac: z.string().optional(),
});

type RouteContext = { params: Promise<{ scooperId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { scooperId } = await params;
  const orgId = await resolveBusinessId(request);
  const payload = await request.json();
  const parsed = deviceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperId },
    select: { id: true, orgId: true },
  });

  if (!profile || profile.orgId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const device = await prisma.scooperDevice.upsert({
    where: {
      orgId_deviceId: {
        orgId,
        deviceId: parsed.data.deviceId,
      },
    },
    update: {
      scooperId,
      platform: parsed.data.platform ?? undefined,
      bluetoothMac: parsed.data.bluetoothMac ?? undefined,
      lastSeenAt: new Date(),
      status: "ACTIVE",
    },
    create: {
      orgId,
      scooperId,
      deviceId: parsed.data.deviceId,
      platform: parsed.data.platform ?? null,
      bluetoothMac: parsed.data.bluetoothMac ?? null,
    },
  });

  return NextResponse.json({ ok: true, device });
}

export const runtime = "nodejs";
