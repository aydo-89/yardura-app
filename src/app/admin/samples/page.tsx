import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function SamplesPage() {
  const samples = await prisma.sample.findMany({
    orderBy: { capturedAt: 'desc' },
    take: 100,
    include: { scores: true },
  });
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Samples</h1>
        <div className="flex gap-2">
          <a href="/api/admin/samples/export">
            <Button variant="outline">Export Samples</Button>
          </a>
          <a href="/api/admin/labeling/export">
            <Button variant="outline">Export GroundTruth</Button>
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {samples.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {s.id.slice(0, 8)} · {s.capturedAt.toISOString().slice(0, 10)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 break-all mb-2">
                {s.imageUrl || 'no image'}
              </div>
              <div className="text-sm mb-2">
                <div>Weight: {s.weightG ?? '—'} g</div>
                <div>Moisture: {s.moistureRaw ?? '—'}</div>
              </div>
              <div className="text-sm mb-3">
                <div>Color: {s.scores[0]?.colorLabel ?? '—'}</div>
                <div>Consistency: {s.scores[0]?.consistencyLabel ?? '—'}</div>
                <div>Flags: {s.scores[0]?.contentFlags ?? '—'}</div>
              </div>
              <form
                action={async () => {
                  'use server';
                  await fetch('/api/admin/samples/rescore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sampleId: s.id }),
                  });
                }}
              >
                <Button type="submit" variant="secondary" className="w-full">
                  Re-score
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
