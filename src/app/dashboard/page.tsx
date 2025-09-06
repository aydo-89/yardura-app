import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClientNew';

export default async function DashboardPage() {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string };
  } | null;

  if (!session?.user) {
    redirect('/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      dogs: true,
      serviceVisits: {
        orderBy: { scheduledDate: 'desc' },
        take: 5,
      },
      dataReadings: {
        orderBy: { timestamp: 'desc' },
        take: 20,
      },
    },
  });

  if (!user) {
    redirect('/signin');
  }

  // Calculate insights
  const totalWaste = user.dataReadings
    .filter((d) => d.weight)
    .reduce((sum, reading) => sum + (reading.weight || 0), 0);

  const avgHealthScore = user.dataReadings.filter((d) => d.consistency).length > 0 ? 85 : 0;
  const recentVisits = user.serviceVisits.slice(0, 3);
  const totalSamples = user.dataReadings.length;
  const ecoImpact = totalWaste * 0.00220462 * 0.8;

  return (
    <DashboardClient
      user={user}
      totalWaste={totalWaste}
      avgHealthScore={avgHealthScore}
      recentVisits={recentVisits}
      totalSamples={totalSamples}
      ecoImpact={ecoImpact}
    />
  );
}
