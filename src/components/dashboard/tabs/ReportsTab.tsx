// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React from 'react';
import { track } from '@/lib/analytics';

interface ReportsTabProps {
  orgId: string;
}

function ReportsList({ orgId }: { orgId: string }) {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(label);
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {months.map((m) => (
        <a
          key={m}
          className="border rounded-lg p-3 flex items-center justify-between hover:bg-accent-soft"
          href={`/api/reports/monthly?orgId=${encodeURIComponent(orgId)}&month=${m}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('report_download', { month: m, orgId })}
        >
          <span className="text-sm">{m}</span>
          <span className="text-accent text-xs underline">Download</span>
        </a>
      ))}
    </div>
  );
}

export default function ReportsTab({ orgId }: ReportsTabProps) {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Monthly Reports</h3>
        <p className="text-slate-600 mb-6">Download detailed reports for your organization.</p>
      </div>
      <ReportsList orgId={orgId} />
    </div>
  );
}
