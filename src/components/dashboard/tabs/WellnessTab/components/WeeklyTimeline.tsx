import React, { useMemo } from "react";
import { CheckCircle, Eye, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { wellnessTheme, type WellnessComputed } from "@/shared/wellness";

interface WeeklyTimelineProps {
  weekly: WellnessComputed["weekly"];
}

const statusConfig = {
  good: {
    color: wellnessTheme.colors.green,
    label: "Normal",
  },
  monitor: {
    color: wellnessTheme.colors.yellow,
    label: "Monitor",
  },
  attention: {
    color: wellnessTheme.colors.red,
    label: "Attention",
  },
};

export const WeeklyTimeline: React.FC<WeeklyTimelineProps> = ({ weekly }) => {
  // Take last 8 weeks and reverse so oldest is on left, newest on right
  const weeks = useMemo(() => {
    const sliced = weekly.slice(0, 8);
    return [...sliced].reverse(); // Reverse: oldest first (left), newest last (right)
  }, [weekly]);
  
  const maxDeposits = Math.max(...weeks.map((w) => w.deposits), 1);

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 240; // Increased height for better date label visibility
  const padding = 60;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2 - 30; // Extra space for date labels

  // Generate path for the line
  const stepX = weeks.length > 1 ? innerWidth / (weeks.length - 1) : 0;
  const getY = (value: number) =>
    chartHeight - padding - 20 - (value / maxDeposits) * innerHeight;

  let pathData = "";
  weeks.forEach((week, index) => {
    const x = padding + index * stepX;
    const y = getY(week.deposits);
    pathData += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Format date range for display
  const formatDateRange = (startISO: string) => {
    const startDate = new Date(startISO);
    const endDate = new Date(startISO);
    endDate.setDate(endDate.getDate() + 6);
    
    const startStr = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    
    return `${startStr} – ${endStr}`;
  };

  return (
    <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="size-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Weekly Deposits
          </h3>
        </div>

        {/* Chart Container */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto [--chart-text:theme(colors.slate.600)] dark:[--chart-text:theme(colors.slate.300)] [--chart-text-muted:theme(colors.slate.500)] dark:[--chart-text-muted:theme(colors.slate.400)]"
            style={{ maxHeight: "260px" }}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartHeight - padding - 20 - ratio * innerHeight;
              const value = Math.round(ratio * maxDeposits);
              return (
                <g key={ratio}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeWidth="1"
                    opacity={ratio === 0 ? 1 : 0.6}
                  />
                  <text
                    x={padding - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="var(--chart-text)"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            {/* Y-axis label */}
            <text
              x={padding - 40}
              y={(chartHeight - 20) / 2}
              textAnchor="middle"
              fontSize="12"
              fill="var(--chart-text)"
              transform={`rotate(-90 ${padding - 40} ${(chartHeight - 20) / 2})`}
            >
              Deposits
            </text>

            {/* Main line */}
            {weeks.length > 1 && (
            <path
              d={pathData}
              fill="none"
              stroke={wellnessTheme.colors.teal}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            )}

            {/* Data points with status indicators */}
            {weeks.map((week, index) => {
              const x = padding + index * stepX;
              const y = getY(week.deposits);
              const config = statusConfig[week.status];
              const dateRange = formatDateRange(week.startISO);

              return (
                <g key={week.startISO}>
                  {/* Data point circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    className="fill-slate-50 dark:fill-slate-900"
                    stroke={config.color}
                    strokeWidth="3"
                  />

                  {/* Status indicator dot */}
                  <circle cx={x} cy={y} r="3" fill={config.color} />

                  {/* Week label with date range (start – end) */}
                  <text
                    x={x}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="500"
                    fill="var(--chart-text)"
                  >
                    {dateRange}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                backgroundColor: wellnessTheme.colors.teal,
                borderColor: wellnessTheme.colors.teal,
              }}
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Deposits</span>
          </div>

          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">{config.label}</span>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {weeks.reduce((sum, w) => sum + w.deposits, 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total deposits</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {weeks.length > 0
                ? (weeks.reduce((sum, w) => sum + w.deposits, 0) / weeks.length).toFixed(1)
                : "0"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg per week</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {maxDeposits}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Peak week</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
