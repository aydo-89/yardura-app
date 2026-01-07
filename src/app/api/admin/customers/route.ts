import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { listCustomersForAdmin } from "@/lib/admin/customers";

const GOD_MODE_EMAIL = "ayden@yardura.com";

export async function GET(_request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user || session.user.email !== GOD_MODE_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await listCustomersForAdmin();
  return NextResponse.json({ ok: true, customers });
}

export const runtime = "nodejs";
