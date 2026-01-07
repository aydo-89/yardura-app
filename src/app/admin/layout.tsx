import { redirect } from "next/navigation";
import { safeGetServerSession, authOptions } from "@/lib/auth";
import { extractUserRoles } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeGetServerSession(authOptions);

  console.log("[Admin Layout] Session:", !!session);
  console.log("[Admin Layout] User:", session?.user?.email);

  // Redirect to signin if not logged in
  if (!session?.user) {
    console.log("[Admin Layout] No session, redirecting to signin");
    redirect("/signin?callbackUrl=/admin");
  }

  // Check for admin roles
  const roles = extractUserRoles(session);
  const isAdmin = roles.includes("ADMIN") || roles.includes("OWNER");

  console.log("[Admin Layout] User roles:", roles);
  console.log("[Admin Layout] Is admin:", isAdmin);

  if (!isAdmin) {
    console.log("[Admin Layout] User is not admin, redirecting to dashboard");
    redirect("/dashboard");
  }

  return <>{children}</>;
}

