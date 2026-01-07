import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, BarChart3, Camera, AlertTriangle } from "lucide-react";
import { Disclosure } from "./Disclosure";
import {
  COLOR_HEX,
  type ColorStatsWindow,
  type WeekRollup,
} from "@/shared/wellness";

interface ColorAnalysisProps {
  colorStats: {
    normal: { count: number; pct: number };
    yellow: { count: number; pct: number };
    red: { count: number; pct: number };
    black: { count: number; pct: number };
  };
  weekly: WeekRollup[];
}

export const ColorAnalysis: React.FC<ColorAnalysisProps> = ({
  colorStats,
  weekly,
}) => {
  const colorConfig = {
    normal: {
      label: "Normal",
      description: "Healthy brown/tan colors",
      color: COLOR_HEX.normal,
    },
    yellow: {
      label: "Yellow/Gray",
      description: "May indicate liver issues",
      color: COLOR_HEX.yellow,
    },
    red: {
      label: "Red",
      description: "Possible blood in stool",
      color: COLOR_HEX.red,
    },
    black: {
      label: "Black/Tarry",
      description: "Possible digested blood",
      color: COLOR_HEX.black,
    },
  };

  // Handle image request for critical detections
  const handleImageRequest = (color: string, count: number) => {
    // In a real implementation, this would navigate to a detailed view or open a modal
    console.log(`Requesting images for ${count} ${color} detections`);
    // For now, we'll show an alert
    alert(
      `📸 Image request submitted for ${count} ${color} detection(s). A veterinarian will review the images and contact you within 24 hours.`,
    );
  };

  const colorEntries = Object.entries(colorStats);

  return (
    <Disclosure title="Color Analysis" defaultOpen={true}>
      <div className="space-y-6">
        {/* Color Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {colorEntries.map(([key, stat]) => {
            const config = colorConfig[key as keyof typeof colorConfig];
            const isConcerning =
              key === "red" || key === "black" || key === "yellow";

            // Calculate total samples for percentage calculation
            const totalSamples = colorEntries.reduce(
              (sum, [, s]) => sum + s.count,
              0,
            );
            const actualPercentage =
              totalSamples > 0
                ? Math.round((stat.count / totalSamples) * 100)
                : 0;
            const shouldShowConcerning =
              isConcerning && stat.count > 0 && actualPercentage > 0;

            // For display purposes, show 0 samples if percentage rounds to 0
            const displayCount = actualPercentage > 0 ? stat.count : 0;

            return (
              <div
                key={key}
                className={`text-center p-3 rounded-lg border-2 transition-all duration-200 min-h-[100px] flex flex-col justify-center ${
                  shouldShowConcerning
                    ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                    : stat.count ===
                          Math.max(...colorEntries.map(([, s]) => s.count)) &&
                        stat.count > 0
                      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                }`}
              >
                <div
                  className="text-xl font-bold mb-1"
                  style={{ color: config.color }}
                  title={`${actualPercentage}% of samples were ${config.label.toLowerCase()} - ${config.description}`}
                >
                  {actualPercentage}%
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1 leading-tight break-words">
                  {config.label.split("/")[0]}
                  {config.label.includes("/") && <br />}
                  {config.label.includes("/") && config.label.split("/")[1]}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {displayCount} samples
                </div>
                {shouldShowConcerning && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div
                      className={`text-xs font-medium flex items-center justify-center gap-1 mb-1 ${
                        key === "red" || key === "black"
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      <AlertTriangle className="size-3" />
                      {key === "red" || key === "black"
                        ? "Critical"
                        : "Concerning"}
                    </div>
                    <button
                      onClick={() =>
                        handleImageRequest(config.label, stat.count)
                      }
                      className={`text-xs px-2 py-1 rounded flex items-center gap-1 mx-auto transition-colors ${
                        key === "red" || key === "black"
                          ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                          : "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                      }`}
                      title={`Request veterinary review of ${config.label.toLowerCase()} stool`}
                    >
                      <Camera className="size-3" />
                      Review
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Donut Chart */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 140 140" className="w-44 h-44 [--chart-text:theme(colors.slate.900)] dark:[--chart-text:theme(colors.white)] [--chart-text-muted:theme(colors.slate.600)] dark:[--chart-text-muted:theme(colors.slate.300)]">
            {(() => {
              const radius = 50;
              const circumference = 2 * Math.PI * radius;
              const center = 70;

              // Get percentages for each color - using consistent calculation
              const normalEntry = colorEntries.find(
                ([key]) => key === "normal",
              );
              const yellowEntry = colorEntries.find(
                ([key]) => key === "yellow",
              );
              const redEntry = colorEntries.find(([key]) => key === "red");
              const blackEntry = colorEntries.find(([key]) => key === "black");

              // Calculate consistent percentages based on actual sample counts
              const totalSamples = colorEntries.reduce(
                (sum, [, s]) => sum + s.count,
                0,
              );
              const normalPercent =
                normalEntry && totalSamples > 0
                  ? Math.round((normalEntry[1].count / totalSamples) * 100)
                  : 0;
              const yellowPercent =
                yellowEntry && totalSamples > 0
                  ? Math.round((yellowEntry[1].count / totalSamples) * 100)
                  : 0;
              const redPercent =
                redEntry && totalSamples > 0
                  ? Math.round((redEntry[1].count / totalSamples) * 100)
                  : 0;
              const blackPercent =
                blackEntry && totalSamples > 0
                  ? Math.round((blackEntry[1].count / totalSamples) * 100)
                  : 0;

              // Filter out very small percentages for cleaner display
              const filteredRedPercent = redPercent > 0 ? redPercent : 0;
              const filteredBlackPercent = blackPercent > 0 ? blackPercent : 0;

              // Calculate dash lengths
              const normalLength = (normalPercent / 100) * circumference;
              const yellowLength = (yellowPercent / 100) * circumference;
              const redLength = (redPercent / 100) * circumference;
              const blackLength = (blackPercent / 100) * circumference;

              // Find the dominant color for center display
              const maxPercent = Math.max(
                normalPercent,
                filteredRedPercent,
                filteredBlackPercent,
                yellowPercent,
              );
              
              // Handle no data case
              const hasData = totalSamples > 0;
              const dominantLabel = !hasData
                ? "No data"
                : normalPercent >= maxPercent
                  ? "Normal"
                  : filteredRedPercent >= maxPercent
                    ? "Red"
                    : filteredBlackPercent >= maxPercent
                      ? "Black"
                      : "Yellow";

              return (
                <>
                  {/* Background circle for reference */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    className="stroke-slate-200 dark:stroke-slate-600"
                    strokeWidth="15"
                  />

                  {/* Normal segment - Green */}
                  {normalPercent > 0 && (
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="15"
                      strokeDasharray={`${normalLength} ${circumference - normalLength}`}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Yellow segment */}
                  {yellowPercent > 0 && (
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="15"
                      strokeDasharray={`${yellowLength} ${circumference - yellowLength}`}
                      strokeLinecap="round"
                      transform={`rotate(${(normalPercent / 100) * 360} ${center} ${center})`}
                    />
                  )}

                  {/* Red segment */}
                  {filteredRedPercent > 0 && (
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="15"
                      strokeDasharray={`${redLength} ${circumference - redLength}`}
                      strokeLinecap="round"
                      transform={`rotate(${((normalPercent + yellowPercent) / 100) * 360} ${center} ${center})`}
                    />
                  )}

                  {/* Black segment */}
                  {filteredBlackPercent > 0 && (
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke="#374151"
                      strokeWidth="15"
                      strokeDasharray={`${blackLength} ${circumference - blackLength}`}
                      strokeLinecap="round"
                      transform={`rotate(${((normalPercent + yellowPercent + filteredRedPercent) / 100) * 360} ${center} ${center})`}
                    />
                  )}

                  {/* Center circle - properly centered text */}
                  <circle
                    cx={center}
                    cy={center}
                    r="32"
                    className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-600"
                    strokeWidth="1"
                  />
                  {/* Percentage text - vertically centered */}
                  <text
                    x={center}
                    y={center - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="18"
                    fontWeight="bold"
                    fill="var(--chart-text)"
                  >
                    {hasData ? `${maxPercent}%` : "–"}
                  </text>
                  {/* Label text - below percentage */}
                  <text
                    x={center}
                    y={center + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="500"
                    fill="var(--chart-text-muted)"
                  >
                    {dominantLabel}
                  </text>
                </>
              );
            })()}
          </svg>
        </div>

        {/* Weekly Trend Overview */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <BarChart3 className="size-4" />
            Weekly Color Trends
          </h4>

          <div className="grid grid-cols-8 gap-2">
            {weekly.slice(0, 8).map((week, i) => {
              const totalDeposits = week.deposits;
              const hasIssues =
                week.colors.red > 0 ||
                week.colors.black > 0 ||
                week.colors.yellow > 0;

              return (
                <div key={i} className="text-center">
                  {/* Color composition bar with issue indicator */}
                  <div className="relative mb-1">
                    <div className="relative h-12 bg-slate-100 dark:bg-slate-700 rounded-md overflow-hidden">
                      {totalDeposits > 0 && (
                        <>
                          {/* Normal (bottom) */}
                          <div
                            className="absolute bottom-0 w-full"
                            style={{
                              height: `${(week.colors.normal / totalDeposits) * 100}%`,
                              backgroundColor: COLOR_HEX.normal,
                            }}
                          />
                          {/* Yellow (middle) */}
                          {week.colors.yellow > 0 && (
                            <div
                              className="absolute w-full"
                              style={{
                                bottom: `${(week.colors.normal / totalDeposits) * 100}%`,
                                height: `${(week.colors.yellow / totalDeposits) * 100}%`,
                                backgroundColor: COLOR_HEX.yellow,
                              }}
                            />
                          )}
                          {/* Red (top) */}
                          {week.colors.red > 0 && (
                            <div
                              className="absolute w-full border-t border-white dark:border-slate-600"
                              style={{
                                bottom: `${((week.colors.normal + week.colors.yellow) / totalDeposits) * 100}%`,
                                height: `${(week.colors.red / totalDeposits) * 100}%`,
                                backgroundColor: COLOR_HEX.red,
                              }}
                            />
                          )}
                          {/* Black (top with border) */}
                          {week.colors.black > 0 && (
                            <div
                              className="absolute w-full border-t border-white dark:border-slate-600"
                              style={{
                                bottom: `${((week.colors.normal + week.colors.yellow + week.colors.red) / totalDeposits) * 100}%`,
                                height: `${(week.colors.black / totalDeposits) * 100}%`,
                                backgroundColor: COLOR_HEX.black,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Issue indicator - positioned above the bar */}
                    {hasIssues && (
                      <div
                        className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
                        title="Week contains concerning colors (red, black, or yellow)"
                      >
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>

                  {/* Date label */}
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {(() => {
                      const weekDate = new Date(week.start);
                      const month = weekDate.toLocaleDateString("en-US", {
                        month: "short",
                      });
                      const day = weekDate.getDate();
                      return `${month} ${day}`;
                    })()}
                  </div>
                  <div
                    className="text-xs text-slate-500 dark:text-slate-500"
                    title={`${totalDeposits} samples analyzed this week`}
                  >
                    {totalDeposits} samples
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex flex-wrap justify-center gap-4 text-xs mb-2">
              {colorEntries.map(([key, stat]) => {
                const config = colorConfig[key as keyof typeof colorConfig];
                return (
                  <div key={config.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-400">{config.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Issue indicator explanation */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="w-3 h-3 bg-red-500 rounded-full border border-white dark:border-slate-800 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <span>Concerning colors detected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Health Insights */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Waste Color Insights
          </h4>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-slate-900 dark:text-white mb-2">
                Normal Range
              </div>
              <div className="text-slate-600 dark:text-slate-400 space-y-1">
                <div>• Brown/tan colors are typical and healthy</div>
                <div>• Slight variations are usually normal</div>
                <div>
                  • {colorStats.normal.count} normal readings (
                  {colorStats.normal.pct}%)
                </div>
              </div>
            </div>

            <div>
              <div className="font-medium text-slate-900 dark:text-white mb-2">
                Concerning Signs
              </div>
              <div className="text-slate-600 dark:text-slate-400 space-y-1">
                {colorStats.red.count > 0 && (
                  <div className="text-red-600 dark:text-red-400">
                    • Red color may indicate fresh blood
                  </div>
                )}
                {colorStats.black.count > 0 && (
                  <div className="text-red-600 dark:text-red-400">
                    • Black/tarry may indicate digested blood
                  </div>
                )}
                {colorStats.yellow.count > 0 && (
                  <div className="text-amber-600 dark:text-amber-400">
                    • Yellow may indicate liver issues
                  </div>
                )}
                {colorStats.red.count === 0 &&
                  colorStats.black.count === 0 &&
                  colorStats.yellow.count === 0 && (
                    <div>• No concerning colors detected</div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Disclosure>
  );
};
