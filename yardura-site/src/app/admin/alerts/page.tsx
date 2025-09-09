import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Alerts</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {alerts.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {a.level} · {a.kind}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm mb-2">{a.message}</div>
              <div className="text-xs text-slate-600 mb-3">{a.createdAt.toISOString()}</div>
              {!a.acknowledged && (
                <form
                  action={async () => {
                    'use server';
                    await fetch('/api/admin/alerts/ack', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: a.id }),
                    });
                  }}
                >
                  <Button type="submit" size="sm">
                    Acknowledge
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
