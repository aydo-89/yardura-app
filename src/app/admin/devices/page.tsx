"use client";
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then(r=>r.json());

export default function DevicesPage() {
  const { data, mutate } = useSWR('/api/admin/devices/list', fetcher);
  const devices = data?.devices || [];
  const issue = async (deviceId: string) => {
    const res = await fetch('/api/admin/devices/issue-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
    const json = await res.json();
    if (json.deviceKey) alert(`Device key (copy now):\n\n${json.deviceKey}`);
    mutate();
  };
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Devices</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d: any) => (
          <Card key={d.id}>
            <CardHeader><CardTitle className="text-sm">{d.name} · {d.uniqueId}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xs text-slate-600 mb-2">Org: {d.orgId}</div>
              <div className="text-xs text-slate-600 mb-4">Last seen: {d.lastSeenAt || '—'}</div>
              <Button onClick={() => issue(d.id)}>Issue Key</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

