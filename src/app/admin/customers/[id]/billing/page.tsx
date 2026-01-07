import { redirect } from "next/navigation";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerBillingPage({ params }: PageProps) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    redirect("/signin");
  }

  const { id } = await params;

  // For now, redirect back to the customer detail page
  // TODO: Implement actual billing portal
  redirect(`/admin/customers/${id}`);
}

