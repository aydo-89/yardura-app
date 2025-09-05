import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function getRecentSamples() {
  const samples = await prisma.sample.findMany({
    orderBy: { capturedAt: 'desc' },
    take: 60,
    include: { groundTruth: true },
  });
  return samples;
}

export default async function LabelingPage() {
  const samples = await getRecentSamples();
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Labeling</h1>
        <a href="/api/admin/labeling/export">
          <Button variant="outline">Export CSV</Button>
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {samples.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-sm">{s.id.slice(0, 8)} · {s.capturedAt.toISOString().slice(0,10)}</CardTitle>
            </CardHeader>
            <CardContent>
              {s.imageUrl ? (
                <div className="relative w-full h-40 mb-2 bg-slate-100">
                  {/* signed URL is generated in worker; here we show storage path */}
                  <div className="text-xs text-slate-600 break-all">{s.imageUrl}</div>
                </div>
              ) : (
                <div className="h-40 grid place-items-center text-slate-500">No image</div>
              )}
              <form
                action={async (formData) => {
                  'use server';
                  const payload = {
                    sampleId: s.id,
                    dataset: 'v0.1',
                    split: 'train',
                    colorLabel: formData.get('colorLabel') as string,
                    consistency: formData.get('consistency') as string,
                    contentFlags: (formData.get('contentFlags') as string || '').split(',').map(v=>v.trim()).filter(Boolean),
                    freshness: formData.get('freshness') as string,
                    notStool: formData.get('notStool') === 'on',
                    notes: formData.get('notes') as string,
                  };
                  await fetch('/api/admin/labeling/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                  revalidatePath('/admin/labeling');
                }}
              >
                <div className="space-y-2">
                  <input name="colorLabel" placeholder="color" className="w-full border p-1 rounded" defaultValue={s.groundTruth?.[0]?.colorLabel || ''} />
                  <input name="consistency" placeholder="consistency" className="w-full border p-1 rounded" defaultValue={s.groundTruth?.[0]?.consistency || ''} />
                  <input name="contentFlags" placeholder="flags (comma)" className="w-full border p-1 rounded" defaultValue={s.groundTruth?.[0]?.contentFlags || ''} />
                  <input name="freshness" placeholder="fresh|stale|old" className="w-full border p-1 rounded" defaultValue={s.groundTruth?.[0]?.freshness || ''} />
                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" name="notStool" defaultChecked={s.groundTruth?.[0]?.notStool || false} /> Not stool
                  </label>
                  <input name="notes" placeholder="notes" className="w-full border p-1 rounded" defaultValue={s.groundTruth?.[0]?.notes || ''} />
                </div>
                <Button type="submit" className="w-full mt-2">Save</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

