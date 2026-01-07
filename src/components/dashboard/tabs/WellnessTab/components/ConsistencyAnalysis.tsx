import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import { Camera, AlertTriangle } from "lucide-react";
import { Disclosure } from "./Disclosure";
import {
  wellnessTheme,
  type ConsistencyStatsWindow,
  type WeekRollup,
} from "@/shared/wellness";

interface ConsistencyAnalysisProps {
  consistencyStats: {
    normal: { count: number; pct: number };
    soft: { count: number; pct: number };
    dry: { count: number; pct: number };
  };
  weekly: WeekRollup[];
}

export const ConsistencyAnalysis: React.FC<ConsistencyAnalysisProps> = ({
  consistencyStats,
  weekly,
}) => {
  // Handle image request for concerning consistency issues
  const handleImageRequest = (consistencyType: string, count: number) => {
    console.log(
      `Requesting images for ${count} ${consistencyType.toLowerCase()} consistency`,
    );
    alert(
      `📸 Image request submitted for ${count} ${consistencyType.toLowerCase()} consistency samples. A veterinarian will review the images and contact you within 24 hours.`,
    );
  };
  // Prepare data for stacked bar chart (last 8 weeks, reversed so oldest is first)
  const chartData = [...weekly.slice(-8)].reverse().map((week, index) => {
    const startDate = new Date(week.start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const dateLabel = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    return {
      week: dateLabel,
      fullLabel: `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      normal: week.consistency.normal,
      soft: week.consistency.soft,
      dry: week.consistency.dry,
    };
  });

  // Calculate percentages based on the actual weekly data being displayed
  const totalDeposits = chartData.reduce(
    (sum, week) => sum + week.normal + week.soft + week.dry,
    0,
  );
  const normalTotal = chartData.reduce((sum, week) => sum + week.normal, 0);
  const softTotal = chartData.reduce((sum, week) => sum + week.soft, 0);
  const dryTotal = chartData.reduce((sum, week) => sum + week.dry, 0);

  const statsWithPercentages = [
    {
      label: "Normal",
      count: normalTotal,
      pct:
        totalDeposits > 0 ? Math.round((normalTotal / totalDeposits) * 100) : 0,
    },
    {
      label: "Soft",
      count: softTotal,
      pct:
        totalDeposits > 0 ? Math.round((softTotal / totalDeposits) * 100) : 0,
    },
    {
      label: "Hard",
      count: dryTotal,
      pct: totalDeposits > 0 ? Math.round((dryTotal / totalDeposits) * 100) : 0,
    },
  ];

  return (
    <Disclosure title="Consistency Analysis" defaultOpen={true}>
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-3 gap-4">
          {statsWithPercentages.map((stat) => {
            // Determine if this consistency type is concerning
            const isConcerning =
              (stat.label === "Soft" && stat.pct > 20) ||
              (stat.label === "Hard" && stat.pct > 15);
            const isCritical =
              (stat.label === "Soft" && stat.pct > 40) ||
              (stat.label === "Hard" && stat.pct > 30);

            // Define distinct colors for each consistency type
            const consistencyColors = {
              Normal: {
                bg: "bg-green-50 dark:bg-green-900/20",
                border: "border-green-200 dark:border-green-800",
                text: "text-green-700 dark:text-green-400",
              },
              Soft: {
                bg: "bg-sky-50 dark:bg-sky-900/20",
                border: "border-sky-200 dark:border-sky-800",
                text: "text-sky-700 dark:text-sky-400",
              },
              Hard: {
                bg: "bg-amber-50 dark:bg-amber-900/20",
                border: "border-amber-200 dark:border-amber-800",
                text: "text-amber-700 dark:text-amber-400",
              },
            };

            const colors = consistencyColors[
              stat.label as keyof typeof consistencyColors
            ] || {
              bg: "bg-slate-50 dark:bg-slate-800",
              border: "border-slate-200 dark:border-slate-700",
              text: "text-slate-600 dark:text-slate-400",
            };

            return (
              <Card
                key={stat.label}
                className={`text-center ${colors.bg} ${colors.border} border-2`}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {stat.pct}%
                  </div>
                  <div className={`text-sm font-medium ${colors.text}`}>
                    {stat.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {stat.count} deposits
                  </div>

                  {/* Review Button for Concerning Consistency */}
                  {isConcerning && stat.count > 0 && (
                    <div
                      className={`mt-2 pt-2 border-t ${
                        isCritical ? "border-red-200 dark:border-red-800" : "border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium flex items-center justify-center gap-1 mb-1 ${
                          isCritical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        <AlertTriangle className="size-3" />
                        {isCritical ? "Critical" : "Concerning"}
                      </div>
                      <button
                        onClick={() =>
                          handleImageRequest(stat.label, stat.count)
                        }
                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 mx-auto transition-colors ${
                          isCritical
                            ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                            : "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                        }`}
                        title={`Request veterinary review of ${stat.label.toLowerCase()} consistency`}
                      >
                        <Camera className="size-3" />
                        {isCritical ? "Urgent Review" : "Request Review"}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bristol Scale Visual */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Bristol Stool Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Scale indicators */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Hard</span>
                <span>Normal</span>
                <span>Soft</span>
              </div>

              {/* Scale bar */}
              <div className="relative h-4 bg-gradient-to-r from-red-200 via-green-200 to-yellow-200 dark:from-red-800 dark:via-green-800 dark:to-yellow-800 rounded-full overflow-hidden">
                {/* Normal range indicator */}
                <div className="absolute inset-y-0 left-1/3 right-1/3 bg-green-400 dark:bg-green-600 bg-opacity-60 dark:bg-opacity-60 rounded-full"></div>

                {/* Current position marker - only show if there's data, positioned based on consistency distribution */}
                {totalDeposits > 0 && (
                <div
                    className="absolute top-0 bottom-0 w-1 bg-slate-700 dark:bg-white rounded-full transform -translate-x-0.5"
                  style={{
                    left: (() => {
                      // More accurate positioning based on actual percentages
                      // Bristol Scale: Hard (0-33%), Normal (33-66%), Soft (67-100%)
                      const normalPct = statsWithPercentages[0].pct;
                      const softPct = statsWithPercentages[1].pct;
                      const hardPct = statsWithPercentages[2].pct;

                      // Calculate weighted position based on actual percentages
                      // Bristol Scale: Hard (0-33%), Normal (33-66%), Soft (67-100%)
                      // Position = (hardPct * 16.5 + normalPct * 49.5 + softPct * 83.5) / 100

                      const hardWeight = 16.5; // Center of hard range (0-33%)
                      const normalWeight = 49.5; // Center of normal range (33-66%)
                      const softWeight = 83.5; // Center of soft range (67-100%)

                      const position =
                        (hardPct * hardWeight +
                          normalPct * normalWeight +
                          softPct * softWeight) /
                        100;

                      // Convert to percentage and ensure it's within bounds
                      const percentage = Math.max(5, Math.min(95, position));

                      return `${percentage}%`;
                    })(),
                  }}
                ></div>
                )}
              </div>

              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                Current trend:{" "}
                {(() => {
                  const normalPct = statsWithPercentages[0].pct;
                  const softPct = statsWithPercentages[1].pct;
                  const dryPct = statsWithPercentages[2].pct;

                  // Handle no data case
                  if (totalDeposits === 0) return "No data yet";

                  if (normalPct >= 60) return "Mostly Normal";
                  if (softPct > dryPct) return "Softer";
                  if (dryPct > softPct) return "Harder";
                  return "Mixed";
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trends */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Weekly Consistency Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11 }}
                    className="fill-slate-600 dark:fill-slate-400"
                    axisLine={{ className: "stroke-slate-200 dark:stroke-slate-700" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-slate-600 dark:fill-slate-400"
                    axisLine={{ className: "stroke-slate-200 dark:stroke-slate-700" }}
                  />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullLabel;
                      }
                      return label;
                    }}
                    contentStyle={{
                      backgroundColor: "var(--tooltip-bg, white)",
                      border: "1px solid var(--tooltip-border, #e2e8f0)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    wrapperClassName="dark:[--tooltip-bg:#1e293b] dark:[--tooltip-border:#334155]"
                  />
                  <Bar dataKey="normal" stackId="a" fill="#10B981" />{" "}
                  {/* Green - matches card */}
                  <Bar dataKey="soft" stackId="a" fill="#0EA5E9" />{" "}
                  {/* Sky blue - matches card */}
                  <Bar dataKey="dry" stackId="a" fill="#F59E0B" />{" "}
                  {/* Amber - matches card theme */}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: "#10B981" }}
                  />
                  <span className="text-slate-600 dark:text-slate-400">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: "#0EA5E9" }}
                  />
                  <span className="text-slate-600 dark:text-slate-400">Soft</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: "#F59E0B" }}
                  />
                  <span className="text-slate-600 dark:text-slate-400">Dry/Hard</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              {softTotal > normalTotal && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Soft Stools Detected
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Consider reviewing diet or hydration levels
                    </div>
                  </div>
                </div>
              )}

              {dryTotal > normalTotal && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Hard Stools Detected
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      May indicate dehydration or low fiber intake
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const totalDeposits = normalTotal + softTotal + dryTotal;
                const normalPct =
                  totalDeposits > 0 ? (normalTotal / totalDeposits) * 100 : 0;
                const softPct =
                  totalDeposits > 0 ? (softTotal / totalDeposits) * 100 : 0;
                const hardPct =
                  totalDeposits > 0 ? (dryTotal / totalDeposits) * 100 : 0;

                // Determine appropriate message based on actual percentages
                if (normalPct >= 85) {
                  return (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Excellent Consistency
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Keep up the current diet and hydration routine
                        </div>
                      </div>
                    </div>
                  );
                } else if (normalPct >= 70) {
                  return (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Good Consistency
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Generally normal with some variation - monitor for
                          changes
                        </div>
                      </div>
                    </div>
                  );
                } else if (normalPct >= 50) {
                  return (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400 mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Mixed Consistency
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Consider reviewing diet or consulting your vet about
                          consistency
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Needs Attention
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Significant consistency issues - consult your
                          veterinarian
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </Disclosure>
  );
};
