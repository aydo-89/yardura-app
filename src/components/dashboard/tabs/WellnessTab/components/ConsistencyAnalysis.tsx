import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Disclosure } from './Disclosure';
import { wellnessTheme, type ConsistencyStatsWindow, type WeekRollup } from '@/shared/wellness';

interface ConsistencyAnalysisProps {
  consistencyStats: ConsistencyStatsWindow;
  weekly: WeekRollup[];
}

export const ConsistencyAnalysis: React.FC<ConsistencyAnalysisProps> = ({
  consistencyStats,
  weekly,
}) => {
  // Prepare data for stacked bar chart (last 8 weeks, most recent first)
  const chartData = weekly.slice(-8).map((week, index) => {
    const startDate = new Date(week.start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const dateLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    return {
      week: dateLabel,
      fullLabel: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      normal: week.consistency.normal,
      soft: week.consistency.soft,
      dry: week.consistency.dry,
    };
  });

  // Calculate percentages based on the actual weekly data being displayed
  const totalDeposits = chartData.reduce((sum, week) => sum + week.normal + week.soft + week.dry, 0);
  const normalTotal = chartData.reduce((sum, week) => sum + week.normal, 0);
  const softTotal = chartData.reduce((sum, week) => sum + week.soft, 0);
  const dryTotal = chartData.reduce((sum, week) => sum + week.dry, 0);

  const statsWithPercentages = [
    {
      label: 'Normal',
      count: normalTotal,
      pct: totalDeposits > 0 ? Math.round((normalTotal / totalDeposits) * 100) : 0,
    },
    {
      label: 'Soft',
      count: softTotal,
      pct: totalDeposits > 0 ? Math.round((softTotal / totalDeposits) * 100) : 0,
    },
    {
      label: 'Dry',
      count: dryTotal,
      pct: totalDeposits > 0 ? Math.round((dryTotal / totalDeposits) * 100) : 0,
    },
  ];

  return (
    <Disclosure title="Consistency Analysis" defaultOpen={false}>
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-3 gap-4">
          {statsWithPercentages.map((stat) => (
            <Card key={stat.label} className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {stat.pct}%
                </div>
                <div className="text-sm text-slate-600">
                  {stat.label}
                </div>
                <div className="text-xs text-slate-500">
                  {stat.count} deposits
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bristol Scale Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bristol Stool Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Scale indicators */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Hard</span>
                <span>Normal</span>
                <span>Soft</span>
              </div>

              {/* Scale bar */}
              <div className="relative h-4 bg-gradient-to-r from-red-200 via-green-200 to-yellow-200 rounded-full overflow-hidden">
                {/* Normal range indicator */}
                <div className="absolute inset-y-0 left-1/3 right-1/3 bg-green-400 bg-opacity-60 rounded-full"></div>

                {/* Current position marker */}
                <div className="absolute top-0 bottom-0 w-1 bg-slate-700 rounded-full transform -translate-x-0.5"
                     style={{ left: `${(softTotal / Math.max(totalDeposits, 1)) * 100}%` }}>
                </div>
              </div>

              <div className="text-center text-sm text-slate-600">
                Current trend: {(() => {
                  const normalPct = statsWithPercentages[0].pct;
                  const softPct = statsWithPercentages[1].pct;
                  const dryPct = statsWithPercentages[2].pct;

                  if (normalPct >= 60) return 'Mostly Normal';
                  if (softPct > dryPct) return 'Softer';
                  if (dryPct > softPct) return 'Harder';
                  return 'Mixed';
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Consistency Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullLabel;
                      }
                      return label;
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="normal" stackId="a" fill={wellnessTheme.green} />
                  <Bar dataKey="soft" stackId="a" fill={wellnessTheme.yellow} />
                  <Bar dataKey="dry" stackId="a" fill={wellnessTheme.orange} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {softTotal > normalTotal && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Soft Stools Detected</div>
                    <div className="text-xs text-slate-600">Consider reviewing diet or hydration levels</div>
                  </div>
                </div>
              )}

              {dryTotal > normalTotal && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Hard Stools Detected</div>
                    <div className="text-xs text-slate-600">May indicate dehydration or low fiber intake</div>
                  </div>
                </div>
              )}

              {normalTotal > (softTotal + dryTotal) * 1.5 && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Excellent Consistency</div>
                    <div className="text-xs text-slate-600">Keep up the current diet and hydration routine</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Disclosure>
  );
};
