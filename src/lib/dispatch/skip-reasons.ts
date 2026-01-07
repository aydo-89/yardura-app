import { prisma } from "@/lib/prisma";
import { SkipBillingBehavior, SkipReason } from "@prisma/client";

export interface CreateSkipReasonInput {
  orgId: string;
  code: string;
  label: string;
  description?: string | null;
  billingBehavior?: SkipBillingBehavior;
  notifyCustomer?: boolean;
}

export interface UpdateSkipReasonInput {
  label?: string;
  description?: string | null;
  billingBehavior?: SkipBillingBehavior;
  notifyCustomer?: boolean;
}

export async function listSkipReasons(orgId: string): Promise<SkipReason[]> {
  return prisma.skipReason.findMany({
    where: { orgId },
    orderBy: [{ code: "asc" }, { createdAt: "asc" }],
  });
}

export async function createSkipReason(
  data: CreateSkipReasonInput,
): Promise<SkipReason> {
  return prisma.skipReason.create({
    data: {
      orgId: data.orgId,
      code: data.code,
      label: data.label,
      description: data.description ?? undefined,
      billingBehavior: data.billingBehavior ?? SkipBillingBehavior.NO_CHARGE,
      notifyCustomer: data.notifyCustomer ?? true,
    },
  });
}

export async function updateSkipReason(
  id: string,
  orgId: string,
  data: UpdateSkipReasonInput,
): Promise<SkipReason> {
  const existing = await prisma.skipReason.findUnique({
    where: { id },
  });

  if (!existing || existing.orgId !== orgId) {
    throw new Error("Skip reason not found for this org");
  }

  return prisma.skipReason.update({
    where: { id },
    data: {
      label: data.label ?? existing.label,
      description: data.description ?? existing.description,
      billingBehavior: data.billingBehavior ?? existing.billingBehavior,
      notifyCustomer:
        typeof data.notifyCustomer === "boolean"
          ? data.notifyCustomer
          : existing.notifyCustomer,
    },
  });
}

export async function deleteSkipReason(id: string, orgId: string): Promise<void> {
  const existing = await prisma.skipReason.findUnique({
    where: { id },
    select: { orgId: true },
  });

  if (!existing || existing.orgId !== orgId) {
    throw new Error("Skip reason not found for this org");
  }

  await prisma.skipReason.delete({ where: { id } });
}
