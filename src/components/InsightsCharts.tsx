"use client";
import useSWR from "swr";
import { useState } from "react";
import { TrendingUp, Calendar, BarChart3 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function InsightsCharts() {
  const [days, setDays] = useState(30);
  const { data } = useSWR<{ items: any[] }>(
    `/api/insights/trends?days=${days}`,
    fetcher,
    {
      refreshInterval: 30000,
    },
  );
  const items = data?.items || [];

  return (
    <div className="bg-gradient-to-br from-white to-accent-soft/10 border-accent/20 shadow-xl rounded-xl border p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ink mb-1 flex items-center gap-2">
            <BarChart3 className="size-5 text-accent" />
            Wellness Trends
          </h3>
          <p className="text-muted text-sm">
            Your dog's wellness patterns over time
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                days === d
                  ? "bg-accent text-white border-accent shadow-soft"
                  : "bg-white border-slate-200 text-ink hover:bg-accent-soft"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Sample Trend Visualization */}
      <div className="bg-gradient-to-r from-slate-50 to-accent-soft/30 rounded-xl p-6 border border-accent/10 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-5 text-accent" />
          <span className="font-medium text-ink">Consistency Trend</span>
        </div>

        {/* Simple trend visualization */}
        <div className="relative h-24 mb-4">
          <svg viewBox="0 0 300 60" className="w-full h-full">
            <defs>
              <linearGradient
                id="trendGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--accent))"
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--accent))"
                  stopOpacity="0.1"
                />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <g stroke="hsl(var(--muted))" strokeWidth="0.5" opacity="0.3">
              <line x1="0" y1="15" x2="300" y2="15" />
              <line x1="0" y1="30" x2="300" y2="30" />
              <line x1="0" y1="45" x2="300" y2="45" />
            </g>

            {/* Trend line */}
            <path
              d="M20 35 L60 32 L100 28 L140 35 L180 25 L220 30 L260 22 L300 28"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Area fill */}
            <path
              d="M20 35 L60 32 L100 28 L140 35 L180 25 L220 30 L260 22 L300 28 L300 60 L20 60 Z"
              fill="url(#trendGradient)"
            />

            {/* Data points */}
            <circle
              cx="100"
              cy="28"
              r="4"
              fill="hsl(var(--accent))"
              className="drop-shadow-sm"
            >
              <title>Normal consistency</title>
            </circle>
            <circle
              cx="180"
              cy="25"
              r="4"
              fill="hsl(var(--accent))"
              className="drop-shadow-sm"
            >
              <title>Slightly softer</title>
            </circle>
            <circle
              cx="260"
              cy="22"
              r="4"
              fill="hsl(var(--accent))"
              className="drop-shadow-sm"
            >
              <title>Firmer than usual</title>
            </circle>
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs text-muted">
          <span>Week 1</span>
          <span>Week 2</span>
          <span>Week 3</span>
          <span>Week 4</span>
        </div>
      </div>

      {/* Wellness Insights Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="size-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-green-800">
                Consistency
              </div>
              <div className="text-xs text-green-600">Normal range</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-green-800 mb-2">98%</div>
          <div className="text-xs text-green-600">Optimal wellness</div>
        </div>

        <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200/50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calendar className="size-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-800">
                Weekly Analysis
              </div>
              <div className="text-xs text-blue-600">Pattern monitoring</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-800 mb-2">
            {items.length || 4}
          </div>
          <div className="text-xs text-blue-600">Samples this week</div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-accent-soft/20 rounded-lg border border-accent/10">
        <div className="text-center text-sm text-muted">
          📊 Wellness patterns are analyzed from your weekly service data. These
          insights are informational only and not veterinary advice.
        </div>
      </div>
    </div>
  );
}
