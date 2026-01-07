import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import {
  getQuickBooksSettings,
  updateBusinessConfig,
} from "@/lib/business-config";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

const patchSchema = z.object({
  orgId: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  realmId: z.union([z.string(), z.null()]).optional(),
  clientId: z.union([z.string(), z.null()]).optional(),
  clientSecret: z.union([z.string(), z.null()]).optional(),
  refreshToken: z.union([z.string(), z.null()]).optional(),
  needsReconnect: z.boolean().optional(),
});

const countsSchema = z.object({
  pending: z.number(),
  queued: z.number(),
  blocked: z.number(),
});

type QuickBooksCounts = z.infer<typeof countsSchema>;

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
    throw new Error("unauthorized");
  }
}

async function getLedgerCounts(orgId: string): Promise<QuickBooksCounts> {
  try {
    const [pending, queued, blocked] = await Promise.all([
      prisma.customerBillingLedgerEntry.count({
        where: {
          orgId,
          metadata: {
            path: ["quickbooks", "status"],
            equals: "pending",
          },
        },
      }),
      prisma.customerBillingLedgerEntry.count({
        where: {
          orgId,
          metadata: {
            path: ["quickbooks", "status"],
            equals: "queued",
          },
        },
      }),
      prisma.customerBillingLedgerEntry.count({
        where: {
          orgId,
          metadata: {
            path: ["quickbooks", "status"],
            equals: "blocked",
          },
        },
      }),
    ]);

    return countsSchema.parse({ pending, queued, blocked });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return countsSchema.parse({ pending: 0, queued: 0, blocked: 0 });
    }
    throw error;
  }
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const orgId = await resolveBusinessId(request);
  const settings = await getQuickBooksSettings(orgId);
  const counts = await getLedgerCounts(orgId);

  return NextResponse.json({
    ok: true,
    data: {
      orgId,
      enabled: Boolean(settings.enabled),
      realmId: settings.realmId ?? null,
      clientId: settings.clientId ?? null,
      hasClientSecret: Boolean(settings.clientSecret),
      hasRefreshToken: Boolean(settings.refreshToken),
      needsReconnect: Boolean(settings.needsReconnect),
      lastSyncAt: settings.lastSyncAt ?? null,
      counts,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const payload = parsed.data;
  const orgId = payload.orgId ?? (await resolveBusinessId(request));

  const updates: Record<string, unknown> = {};

  if (typeof payload.enabled === "boolean") {
    updates.enabled = payload.enabled;
  }
  if (payload.realmId !== undefined) {
    if (payload.realmId === null) {
      updates.realmId = null;
    } else {
      updates.realmId = payload.realmId.trim() || null;
    }
  }
  if (payload.clientId !== undefined) {
    if (payload.clientId === null) {
      updates.clientId = null;
    } else {
      updates.clientId = payload.clientId.trim() || null;
    }
  }

  if (payload.clientSecret !== undefined) {
    const trimmed = typeof payload.clientSecret === "string" ? payload.clientSecret.trim() : null;
    updates.clientSecret = trimmed && trimmed.length ? trimmed : null;
  }

  if (payload.refreshToken !== undefined) {
    const trimmed = typeof payload.refreshToken === "string" ? payload.refreshToken.trim() : null;
    updates.refreshToken = trimmed && trimmed.length ? trimmed : null;
  }

  if (typeof payload.needsReconnect === "boolean") {
    updates.needsReconnect = payload.needsReconnect;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, data: { updated: false } });
  }

  await updateBusinessConfig(orgId, {
    integrations: {
      quickbooks: updates as any,
    },
  });

  const settings = await getQuickBooksSettings(orgId);
  const counts = await getLedgerCounts(orgId);

  return NextResponse.json({
    ok: true,
    data: {
      orgId,
      enabled: Boolean(settings.enabled),
      realmId: settings.realmId ?? null,
      clientId: settings.clientId ?? null,
      hasClientSecret: Boolean(settings.clientSecret),
      hasRefreshToken: Boolean(settings.refreshToken),
      needsReconnect: Boolean(settings.needsReconnect),
      lastSyncAt: settings.lastSyncAt ?? null,
      counts,
    },
  });
}
