"use client";
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardKpis() {
  const { data } = useSWR('/api/dashboard/kpis', fetcher, { refreshInterval: 30000 });
  const k = data || { deposits30: 0, avgWeight30: 0, freq7: 0, eco: { lbs: 0, methane: 0 }, alertsOpen: 0 };
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card><CardHeader><CardTitle className="text-sm">Deposits (30d)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.deposits30}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Avg Weight (30d)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.avgWeight30.toFixed?.(1) || 0} g</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Frequency (7d)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.freq7}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Eco (MTD lbs)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.eco.lbs?.toFixed?.(1) || 0}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Methane (MTD ft³)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.eco.methane?.toFixed?.(2) || 0}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Open Alerts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{k.alertsOpen}</div></CardContent></Card>
    </div>
  );
}

