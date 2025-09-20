import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { Disclosure } from "./Disclosure";
import { wellnessTheme } from "@/shared/wellness";

interface FrequencyAnalysisProps {
  weeklyData: Array<{
    start: Date;
    deposits: number;
  }>;
  dogCount?: number; // Number of dogs in household
}

export const FrequencyAnalysis: React.FC<FrequencyAnalysisProps> = ({
  weeklyData,
  dogCount = 1,
}) => {
  // Calculate frequency statistics (weekly data)
  const depositsPerWeek = weeklyData.map((week) => week.deposits);
  const avgDeposits =
    depositsPerWeek.length > 0
      ? depositsPerWeek.reduce((sum, count) => sum + count, 0) /
        depositsPerWeek.length
      : 0;
  const minDeposits = Math.min(...depositsPerWeek.filter((d) => d > 0), 0); // Exclude zeros for min calculation
  const maxDeposits = Math.max(...depositsPerWeek, 0);
  const totalDeposits = depositsPerWeek.reduce((sum, count) => sum + count, 0);

  // Calculate per-dog frequencies
  const avgDepositsPerDogPerWeek = avgDeposits / dogCount;
  const minDepositsPerDogPerWeek = minDeposits > 0 ? minDeposits / dogCount : 0;
  const maxDepositsPerDogPerWeek = maxDeposits / dogCount;

  // Calculate daily equivalents for better understanding
  const avgDepositsPerDogPerDay = avgDepositsPerDogPerWeek / 7;
  const minDepositsPerDogPerDay = minDepositsPerDogPerWeek / 7;
  const maxDepositsPerDogPerDay = maxDepositsPerDogPerWeek / 7;

  // Calculate weekly variation (per dog)
  const variation = maxDepositsPerDogPerWeek - minDepositsPerDogPerWeek;
  const consistency =
    variation <= 0.5
      ? "Very Consistent"
      : variation <= 1
        ? "Moderately Consistent"
        : "Variable";

  // Get frequency range description (per dog per week)
  const getFrequencyDescription = (avgPerDog: number) => {
    if (avgPerDog < 10)
      return "Below normal - may indicate constipation or illness";
    if (avgPerDog >= 10 && avgPerDog <= 18)
      return "Normal range for healthy dogs (1.4-2.6/day)";
    if (avgPerDog > 18 && avgPerDog <= 25)
      return "Above normal - monitor for diarrhea";
    return "Very high - consult veterinarian";
  };

  return (
    <Disclosure title="Frequency Analysis" defaultOpen={true}>
      <Card
        style={{
          backgroundColor: wellnessTheme.slate50,
          boxShadow: wellnessTheme.cardShadow,
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="size-5 text-slate-600" />
            Deposit Frequency {dogCount > 1 && `(Per Dog)`}
          </CardTitle>
          {dogCount > 1 && (
            <div className="text-sm text-slate-600 mt-1">
              Based on {dogCount} dog{dogCount !== 1 ? "s" : ""} in household
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Main stats - Average and Range */}
            <div className="space-y-3">
              <div
                className="flex justify-between items-center p-3 bg-white rounded-lg border"
                title={`Average bowel movements per dog per week: ${avgDepositsPerDogPerWeek.toFixed(1)}`}
              >
                <span className="text-sm text-slate-600">Weekly Average</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-sky-600">
                    {avgDepositsPerDogPerWeek.toFixed(1)}/week
                  </span>
                  <span className="text-xs text-slate-500 block">
                    ({avgDepositsPerDogPerDay.toFixed(1)}/day)
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-600">Daily Range</span>
                  <span className="text-xs text-slate-500">Per dog</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-sky-600">
                    {minDepositsPerDogPerDay.toFixed(1)}-
                    {maxDepositsPerDogPerDay.toFixed(1)}/day
                  </span>
                  <span className="text-xs text-slate-500 block">
                    ({minDepositsPerDogPerWeek.toFixed(1)}-
                    {maxDepositsPerDogPerWeek.toFixed(1)}
                    /week)
                  </span>
                </div>
              </div>
            </div>

            {/* Beautiful frequency visualization like insights.tsx */}
            <div className="space-y-3">
              <div className="text-xs text-slate-600 text-center font-medium">
                Weekly Pattern
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-end justify-center gap-2 h-12 mb-2">
                  {weeklyData.slice(-7).map((week, i) => {
                    const depositsPerDog = week.deposits / dogCount;
                    const maxDepositsPerDog =
                      Math.max(...depositsPerWeek) / dogCount;
                    const heightPercent =
                      depositsPerDog > 0
                        ? (depositsPerDog / maxDepositsPerDog) * 100
                        : 0;
                    return (
                      <div
                        key={i}
                        className="w-3 bg-sky-400 rounded-sm transition-all duration-300 hover:bg-sky-500"
                        style={{ height: `${Math.max(heightPercent, 8)}%` }}
                        title={`${depositsPerDog.toFixed(1)} deposits per dog`}
                      />
                    );
                  })}
                </div>
                <div className="text-center text-xs text-slate-500">
                  Week over week pattern (per dog)
                </div>
              </div>
            </div>

            {/* Health assessment */}
            <div
              className={`p-4 rounded-lg border ${
                avgDepositsPerDogPerWeek >= 10 && avgDepositsPerDogPerWeek <= 18
                  ? "bg-green-50 border-green-200"
                  : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <div
                className={`text-sm font-medium mb-2 ${
                  avgDepositsPerDogPerWeek >= 10 &&
                  avgDepositsPerDogPerWeek <= 18
                    ? "text-green-800"
                    : "text-yellow-800"
                }`}
              >
                Frequency Assessment
              </div>
              <div
                className={`text-sm ${
                  avgDepositsPerDogPerWeek >= 10 &&
                  avgDepositsPerDogPerWeek <= 18
                    ? "text-green-700"
                    : "text-yellow-700"
                }`}
              >
                {getFrequencyDescription(avgDepositsPerDogPerWeek)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Disclosure>
  );
};
