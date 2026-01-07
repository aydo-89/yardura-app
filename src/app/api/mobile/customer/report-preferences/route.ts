import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildCustomerSetupResponse, canSetupCustomer } from "@/lib/mobile/customer-setup";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

const preferenceSchema = z.object({
  enabled: z.boolean().optional(),
  cadence: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  timeZone: z.string().optional().nullable(),
  recipients: z.array(z.string().email()).optional(),
  includeWellness: z.boolean().optional(),
  includeScooping: z.boolean().optional(),
  includeFood: z.boolean().optional(),
  includeWalks: z.boolean().optional(),
  includeReminders: z.boolean().optional(),
  includeChats: z.boolean().optional(),
  includePhotos: z.boolean().optional(),
});

const DEFAULT_PREFERENCES = {
  enabled: false,
  cadence: "WEEKLY" as const,
  sendHour: 8,
  dayOfWeek: 1,
  dayOfMonth: 1,
  timeZone: null as string | null,
  recipients: [] as string[],
  includeWellness: true,
  includeScooping: true,
  includeFood: true,
  includeWalks: true,
  includeReminders: true,
  includeChats: true,
  includePhotos: true,
};

export async function GET(request: NextRequest) {
  const deviceTimeZone = request.headers.get("x-time-zone");
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }

  const preference = await prisma.customerEmailReportPreference.findUnique({
    where: { customerId: customer.id },
  });

  const data = preference
    ? {
        enabled: preference.enabled,
        cadence: preference.cadence,
        sendHour: preference.sendHour,
        dayOfWeek: preference.dayOfWeek,
        dayOfMonth: preference.dayOfMonth,
        timeZone: preference.timeZone ?? deviceTimeZone ?? null,
        recipients: preference.recipients,
        includeWellness: preference.includeWellness,
        includeScooping: preference.includeScooping,
        includeFood: preference.includeFood,
        includeWalks: preference.includeWalks,
        includeReminders: preference.includeReminders,
        includeChats: preference.includeChats,
        includePhotos: preference.includePhotos,
      }
    : { ...DEFAULT_PREFERENCES, timeZone: deviceTimeZone ?? DEFAULT_PREFERENCES.timeZone };

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: NextRequest) {
  const deviceTimeZone = request.headers.get("x-time-zone");
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid preferences payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const payloadData = parsed.data;
  const existing = await prisma.customerEmailReportPreference.findUnique({
    where: { customerId: customer.id },
  });

  const data = {
    ...(payloadData.enabled !== undefined ? { enabled: payloadData.enabled } : {}),
    ...(payloadData.cadence ? { cadence: payloadData.cadence } : {}),
    ...(payloadData.sendHour !== undefined ? { sendHour: payloadData.sendHour } : {}),
    ...(payloadData.dayOfWeek !== undefined ? { dayOfWeek: payloadData.dayOfWeek } : {}),
    ...(payloadData.dayOfMonth !== undefined ? { dayOfMonth: payloadData.dayOfMonth } : {}),
    ...(payloadData.timeZone !== undefined
      ? { timeZone: payloadData.timeZone }
      : existing?.timeZone
        ? {}
        : deviceTimeZone
          ? { timeZone: deviceTimeZone }
          : {}),
    ...(payloadData.recipients !== undefined ? { recipients: payloadData.recipients } : {}),
    ...(payloadData.includeWellness !== undefined
      ? { includeWellness: payloadData.includeWellness }
      : {}),
    ...(payloadData.includeScooping !== undefined
      ? { includeScooping: payloadData.includeScooping }
      : {}),
    ...(payloadData.includeFood !== undefined ? { includeFood: payloadData.includeFood } : {}),
    ...(payloadData.includeWalks !== undefined ? { includeWalks: payloadData.includeWalks } : {}),
    ...(payloadData.includeReminders !== undefined
      ? { includeReminders: payloadData.includeReminders }
      : {}),
    ...(payloadData.includeChats !== undefined ? { includeChats: payloadData.includeChats } : {}),
    ...(payloadData.includePhotos !== undefined ? { includePhotos: payloadData.includePhotos } : {}),
  };

  const preference = existing
    ? await prisma.customerEmailReportPreference.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.customerEmailReportPreference.create({
        data: {
          orgId: customer.orgId,
          customerId: customer.id,
          ...DEFAULT_PREFERENCES,
          timeZone: deviceTimeZone ?? DEFAULT_PREFERENCES.timeZone,
          ...data,
        },
      });

  return NextResponse.json({
    ok: true,
    data: {
      enabled: preference.enabled,
      cadence: preference.cadence,
      sendHour: preference.sendHour,
      dayOfWeek: preference.dayOfWeek,
      dayOfMonth: preference.dayOfMonth,
      timeZone: preference.timeZone,
      recipients: preference.recipients,
      includeWellness: preference.includeWellness,
      includeScooping: preference.includeScooping,
      includeFood: preference.includeFood,
      includeWalks: preference.includeWalks,
      includeReminders: preference.includeReminders,
      includeChats: preference.includeChats,
      includePhotos: preference.includePhotos,
    },
  });
}

export const runtime = "nodejs";
