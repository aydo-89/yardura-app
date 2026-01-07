import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { NewCustomerForm } from "@/components/admin/NewCustomerForm";

export default async function NewCustomerPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/admin/customers/new");
  }

  const orgId = (session.user as any)?.orgId;
  if (!orgId) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Add customer</h1>
        <p className="text-sm text-slate-600">
          Capture a manual signup, batch import, or special case where the customer did not
          flow through quote checkout. You can schedule visits immediately after creation.
        </p>
      </div>
      <NewCustomerForm />
    </div>
  );
}
