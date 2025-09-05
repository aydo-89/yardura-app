import { prisma } from '@/lib/prisma';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SchedulePage() {
  const session = (await safeGetServerSession(authOptions as any)) as { user?: { id?: string } } | null;
  const jobs = await prisma.job.findMany({ orderBy: { nextVisitAt: 'asc' }, take: 10 });
  const first = jobs[0];
  return (
    <div className="container py-8">
      <Card>
        <CardHeader><CardTitle>Next Pickup</CardTitle></CardHeader>
        <CardContent>
          {first?.nextVisitAt ? (
            <div className="text-lg mb-4">{first.nextVisitAt.toISOString()}</div>
          ) : (
            <div className="mb-4">No scheduled visits yet.</div>
          )}
          {first && (
            <form
              action={async (formData) => {
                'use server';
                const action = formData.get('action') as string;
                const nextVisitAt = formData.get('nextVisitAt') as string;
                await fetch('/api/schedule/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: first.id, action, nextVisitAt }) });
              }}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="datetime-local" name="nextVisitAt" className="border p-2 rounded" />
                <button className="px-3 py-2 border rounded" name="action" value="reschedule">Request Reschedule</button>
                <button className="px-3 py-2 border rounded" name="action" value="skip">Skip Next</button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

