import { prisma } from '@/lib/prisma';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SchedulePage() {
  const session = (await safeGetServerSession(authOptions as any)) as { user?: { id?: string } } | null;
  const jobs = await prisma.job.findMany({ orderBy: { nextVisitAt: 'asc' }, take: 10 });
  return (
    <div className="container py-8">
      <Card>
        <CardHeader><CardTitle>Next Pickup</CardTitle></CardHeader>
        <CardContent>
          {jobs[0]?.nextVisitAt ? (
            <div className="text-lg">{jobs[0].nextVisitAt.toISOString()}</div>
          ) : (
            <div>No scheduled visits yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

