import React from 'react';
import { CheckCircle, Eye, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { wellnessTheme, type WellnessComputed } from '@/shared/wellness';

interface WeeklyTimelineProps {
  weekly: WellnessComputed['weekly'];
}

const statusConfig = {
  good: {
    color: wellnessTheme.green,
    label: 'Normal',
  },
  monitor: {
    color: wellnessTheme.yellow,
    label: 'Monitor',
  },
  attention: {
    color: wellnessTheme.red,
    label: 'Attention',
  },
};

export const WeeklyTimeline: React.FC<WeeklyTimelineProps> = ({ weekly }) => {
  const weeks = weekly.slice(0, 8);
  const maxDeposits = Math.max(...weeks.map(w => w.deposits), 1);

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 220;
  const padding = 60;
  const innerWidth = chartWidth - (padding * 2);
  const innerHeight = chartHeight - (padding * 2) - 20; // Extra space for two-line labels

  // Generate path for the line
  const stepX = innerWidth / (weeks.length - 1);
  const getY = (value: number) => chartHeight - padding - ((value / maxDeposits) * innerHeight);

  let pathData = '';
  weeks.forEach((week, index) => {
    const x = padding + (index * stepX);
    const y = getY(week.deposits);
    pathData += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return (
    <Card
      style={{
        backgroundColor: wellnessTheme.slate50,
        boxShadow: wellnessTheme.cardShadow,
        borderRadius: wellnessTheme.radiusLg,
      }}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="size-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Weekly Deposits
          </h3>
        </div>

        {/* Chart Container */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            style={{ maxHeight: '240px' }}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartHeight - padding - (ratio * innerHeight);
              const value = Math.round(ratio * maxDeposits);
              return (
                <g key={ratio}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    opacity={ratio === 0 ? 1 : 0.6}
                  />
                  <text
                    x={padding - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500"
                    fontSize="12"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            {/* Y-axis label */}
            <text
              x={padding - 40}
              y={chartHeight / 2}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="12"
              transform={`rotate(-90 ${padding - 40} ${chartHeight / 2})`}
            >
              Deposits
            </text>

            {/* Main line */}
            <path
              d={pathData}
              fill="none"
              stroke={wellnessTheme.teal}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points with status indicators */}
            {weeks.map((week, index) => {
              const x = padding + (index * stepX);
              const y = getY(week.deposits);
              const config = statusConfig[week.status];

              return (
                <g key={week.startISO}>
                  {/* Data point circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill={wellnessTheme.slate50}
                    stroke={config.color}
                    strokeWidth="3"
                  />

                  {/* Status indicator dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill={config.color}
                  />

                  {/* Week label with date range */}
                  <text
                    x={x}
                    y={chartHeight - 30}
                    textAnchor="middle"
                    className="fill-slate-600"
                    fontSize="9"
                    fontWeight="500"
                  >
                    <tspan x={x} dy="0">
                      {new Date(week.startISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </tspan>
                    <tspan x={x} dy="10">
                      {(() => {
                        const endDate = new Date(week.startISO);
                        endDate.setDate(endDate.getDate() + 6);
                        return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{ backgroundColor: wellnessTheme.teal, borderColor: wellnessTheme.teal }}
            />
            <span className="text-sm text-slate-600">Deposits</span>
          </div>

          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-slate-600">{config.label}</span>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">
              {weeks.reduce((sum, w) => sum + w.deposits, 0)}
            </div>
            <div className="text-xs text-slate-500">Total deposits</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">
              {(weeks.reduce((sum, w) => sum + w.deposits, 0) / weeks.length).toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">Avg per week</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">
              {maxDeposits}
            </div>
            <div className="text-xs text-slate-500">Peak week</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
