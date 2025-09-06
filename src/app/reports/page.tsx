'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [orgId, setOrgId] = useState('org_demo');
  const [customerId, setCustomerId] = useState('');
  const [url, setUrl] = useState<string | null>(null);

  const onGenerate = async () => {
    const params = new URLSearchParams({ orgId, month });
    if (customerId) params.set('customerId', customerId);
    const res = await fetch(`/api/reports/monthly?${params.toString()}`);
    const json = await res.json();
    setUrl(json.url);
  };

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <input
              className="border p-2 rounded"
              placeholder="Org ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <input
              className="border p-2 rounded"
              placeholder="Customer ID (optional)"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
            <input
              className="border p-2 rounded"
              placeholder="YYYY-MM"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button onClick={onGenerate}>Generate PDF</Button>
          </div>
          {url && (
            <a className="text-blue-600 underline" href={url} target="_blank" rel="noreferrer">
              Download latest report
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
