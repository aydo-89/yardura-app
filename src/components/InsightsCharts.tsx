"use client";
import useSWR from 'swr';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function InsightsCharts() {
  const { data } = useSWR<{ items: any[] }>("/api/insights/trends", fetcher, { refreshInterval: 30000 });
  const items = data?.items || [];

  return (
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
  );
}

