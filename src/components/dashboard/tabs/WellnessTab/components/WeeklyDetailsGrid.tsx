import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Eye, AlertTriangle, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { Disclosure } from './Disclosure';
import { toneForStatus, COLOR_HEX, CONS_HEX, type WeekRollup, type WellnessSimpleStatus } from '@/shared/wellness';

interface WeeklyDetailsGridProps {
  weeks: WeekRollup[];
}

export const WeeklyDetailsGrid: React.FC<WeeklyDetailsGridProps> = ({ weeks }) => {
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const displayedWeeks = showAllWeeks ? weeks : weeks.slice(-4); // Show most recent 4 by default

  const getConsistencyColor = (key: string) => {
    switch (key) {
      case 'normal':
        return COLOR_HEX.normal;
      case 'soft':
        return CONS_HEX.soft;
      case 'dry':
        return '#d97706';
      default:
        return COLOR_HEX.normal;
    }
  };

  const getColorColor = (key: string) => {
    return COLOR_HEX[key as keyof typeof COLOR_HEX] || COLOR_HEX.normal;
  };

  return (
    <Disclosure title="Detailed Week-by-Week Analysis" defaultOpen={true}>
      <div className="space-y-4">
        {/* Horizontal scrolling compact cards */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {displayedWeeks.map((week) => (
              <Card key={week.start.toISOString()} className="flex-shrink-0 w-64 shadow-sm">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">
                          {new Date(week.start).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-500">
                          {(() => {
                            const endDate = new Date(week.start);
                            endDate.setDate(endDate.getDate() + 6);
                            return endDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            });
                          })()}
                        </span>
                      </div>
                      <StatusPill status={(week.healthStatus as WellnessSimpleStatus) || week.status} />
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {week.deposits}
                    </div>
                  </div>

                  {/* Key Metrics Summary */}
                  <div className="mb-3">
                    <div className="text-xs text-slate-600 mb-2">Summary</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Deposits:</span>
                        <span className="font-medium">{week.deposits}</span>
                      </div>
                      {week.issues.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Issues:</span>
                          <span className="font-medium text-amber-600">{week.issues.length}</span>
                        </div>
                      )}
                      {week.avgWeight && week.avgWeight > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Weight:</span>
                          <span className="font-medium">{week.avgWeight.toFixed(1)}g</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consistency - Compact */}
                  <div className="mb-3">
                    <div className="text-xs text-slate-600 mb-2">Consistency</div>
                    <div className="space-y-1">
                      {Object.entries(week.consistency).map(([key, count]) => {
                        if (count === 0) return null;
                        const percentage =
                          week.deposits > 0 ? Math.round((count / week.deposits) * 100) : 0;
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getConsistencyColor(key) }}
                              />
                              <span className="text-xs capitalize">{key}</span>
                            </div>
                            <span className="text-xs text-slate-600">{percentage}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color - Compact */}
                  <div className="mb-3">
                    <div className="text-xs text-slate-600 mb-2">Color</div>
                    <div className="space-y-1">
                      {Object.entries(week.colors).map(([key, count]) => {
                        if (count === 0) return null;
                        const percentage =
                          week.deposits > 0 ? Math.round((count / week.deposits) * 100) : 0;
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full border border-white"
                                style={{ backgroundColor: getColorColor(key) }}
                              />
                              <span className="text-xs capitalize">{key}</span>
                            </div>
                            <span className="text-xs text-slate-600">{percentage}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Issues - Compact */}
                  {week.issues.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="size-3 text-amber-500" />
                        <span className="text-xs text-slate-600">Issues</span>
                      </div>
                      <div className="text-xs text-slate-600 leading-tight">
                        {week.issues.slice(0, 2).join(', ')}
                        {week.issues.length > 2 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Optional: View abnormal samples link */}
                  {(week.colors.red > 0 || week.colors.black > 0) && (
                    <div className="pt-2 border-t border-slate-200">
                      <Button variant="outline" size="sm" asChild className="text-xs w-full">
                        <a
                          href={`/reports?filter=critical&week=${week.start.toISOString().split('T')[0]}`}
                        >
                          <Eye className="size-3 mr-1" />
                          View samples
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Expand/Collapse button */}
        {weeks.length > 4 && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAllWeeks(!showAllWeeks)}
              className="inline-flex items-center gap-2"
            >
              {showAllWeeks ? (
                <>
                  <ChevronUp className="size-4" />
                  Show recent 4 weeks
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" />
                  Show all {weeks.length} weeks
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Disclosure>
  );
};
