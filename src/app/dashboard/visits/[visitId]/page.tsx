import { notFound, redirect } from "next/navigation";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { getVisitDetailForUser } from "@/lib/service-visits/getVisitDetail";

import VisitDetailClient from "./visit-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ visitId: string }>;
}

export default async function VisitDetailPage({ params }: PageProps) {
  const { visitId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  const visit = await getVisitDetailForUser({
    visitId,
    userId: userId!,
  });

  if (!visit) {
    return notFound();
  }

  return <VisitDetailClient visit={visit} />;
}
