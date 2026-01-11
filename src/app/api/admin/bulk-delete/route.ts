import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { deleteUserCascade } from "@/lib/admin/users";
import { deleteCustomerCascade } from "@/lib/admin/customers";
import { prisma } from "@/lib/prisma";

const GOD_MODE_EMAIL = "ayden@yardura.com";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== GOD_MODE_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.type || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: "Invalid payload. Expected { type: string, ids: string[] }" },
      { status: 400 },
    );
  }

  const { type, ids } = body as { type: string; ids: string[] };

  const fallbackUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  const results: { id: string; success: boolean; error?: string }[] = [];

  if (type === "users") {
    for (const userId of ids) {
      try {
        // Prevent deleting god mode user
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        if (!user) {
          results.push({ id: userId, success: false, error: "User not found" });
          continue;
        }

        if (user.email === GOD_MODE_EMAIL) {
          results.push({ id: userId, success: false, error: "Cannot delete god mode user" });
          continue;
        }

        await deleteUserCascade({
          userId,
          fallbackUserId: fallbackUser?.id,
        });

        results.push({ id: userId, success: true });
      } catch (error) {
        console.error(`bulk-delete.user.${userId}`, error);
        results.push({
          id: userId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } else if (type === "customers") {
    for (const customerId of ids) {
      try {
        await deleteCustomerCascade(customerId);
        results.push({ id: customerId, success: true });
      } catch (error) {
        console.error(`bulk-delete.customer.${customerId}`, error);
        results.push({
          id: customerId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } else if (type === "free-pet-owners") {
    // Free pet owners are customers without active jobs
    // We delete them the same way as customers
    for (const customerId of ids) {
      try {
        await deleteCustomerCascade(customerId);
        results.push({ id: customerId, success: true });
      } catch (error) {
        console.error(`bulk-delete.free-pet-owner.${customerId}`, error);
        results.push({
          id: customerId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } else {
    return NextResponse.json(
      { error: `Unknown type: ${type}. Expected: users, customers, or free-pet-owners` },
      { status: 400 },
    );
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    ok: true,
    deleted: successCount,
    failed: failCount,
    results,
  });
}

export const runtime = "nodejs";
