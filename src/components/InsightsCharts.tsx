"use client";
import useSWR from 'swr';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function InsightsCharts() {
  const [days, setDays] = useState(30);
  const { data } = useSWR<{ items: any[] }>(`/api/insights/trends?days=${days}`, fetcher, { refreshInterval: 30000 });
  const items = data?.items || [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[7,30,90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded border ${days===d?'bg-black text-white':'bg-white'}`}>{d}d</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={items}>
              <XAxis dataKey="ts" hide />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="weightG" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items}>
              <XAxis dataKey="ts" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="moistureRaw" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

