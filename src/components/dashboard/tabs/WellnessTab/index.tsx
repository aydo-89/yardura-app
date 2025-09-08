import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { useWellnessData } from './hooks/useWellnessData';
import { WellnessHeader } from './components/WellnessHeader';
import { WeeklyTimeline } from './components/WeeklyTimeline';
import { WeeklyDetailsGrid } from './components/WeeklyDetailsGrid';
import { KeyInsights } from './components/KeyInsights';
import { ColorAnalysis } from './components/ColorAnalysis';
import { ConsistencyAnalysis } from './components/ConsistencyAnalysis';
import { ContentSignals } from './components/ContentSignals';
import { wellnessTheme } from '@/shared/wellness';
import type { DataReading, ServiceVisit, WeekRollup, WellnessComputed } from '@/shared/wellness';

interface WellnessTabProps {
  dataReadings: DataReading[];
  serviceVisits: ServiceVisit[];
}

// Temporary adapter functions to convert new data format to old format
const convertWeeklyToWeekRollup = (weekly: WellnessComputed['weekly']): WeekRollup[] => {
  return weekly.map((week) => ({
    start: new Date(week.startISO),
    label: `Week ${weekly.length - weekly.indexOf(week)}`, // Week 8, 7, 6, etc.
    deposits: week.deposits,
    avgWeight: 0, // Not available in new format
    colors: week.colors,
    consistency: week.consistency,
    issues: week.issues,
    healthStatus: week.status === 'good' ? 'normal' : week.status === 'monitor' ? 'monitor' : 'action',
    wellnessScore: 85, // Simplified
  }));
};

export const WellnessTab: React.FC<WellnessTabProps> = ({
  dataReadings,
  serviceVisits,
}) => {
  const wellnessData = useWellnessData(dataReadings, serviceVisits);

  const handleExport = () => {
    // Navigate to reports page - this preserves existing functionality
    window.location.href = '/reports';
  };

  // Convert data formats for components that haven't been updated yet
  const weekRollupData = convertWeeklyToWeekRollup(wellnessData.weekly);

  return (
    <div
      className="space-y-6"
      style={{
        backgroundColor: wellnessTheme.slate50,
      }}
    >
      {/* Wellness Header - Always visible */}
      <WellnessHeader
        wellnessData={wellnessData}
        onExport={handleExport}
      />

      {/* Weekly Timeline - Compact overview */}
      <WeeklyTimeline weekly={wellnessData.weekly} />

      {/* Detailed Week-by-Week Analysis */}
      <Card
        style={{
          backgroundColor: wellnessTheme.slate50,
          boxShadow: wellnessTheme.cardShadow,
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">
            Detailed Week-by-Week Analysis
          </h3>
          <WeeklyDetailsGrid weeks={weekRollupData} />
        </CardContent>
      </Card>

      {/* Key Insights - Health status summaries */}
      <KeyInsights
        weeks={wellnessData.weekly}
        avgWellness4w={85} // Simplified for now
      />

      {/* Two-column layout for detailed analysis */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Color Analysis */}
          <ColorAnalysis
            colorStats={{
              normal: { count: wellnessData.trends.colorDonut.normal, pct: 0 },
              yellow: { count: wellnessData.trends.colorDonut.yellow, pct: 0 },
              red: { count: wellnessData.trends.colorDonut.red, pct: 0 },
              black: { count: wellnessData.trends.colorDonut.black, pct: 0 },
            }}
            weekly={weekRollupData}
          />

          {/* Content Signals */}
          <ContentSignals
            signals={wellnessData.trends.signalSparklines}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Consistency Analysis */}
          <ConsistencyAnalysis
            consistencyStats={{
              normal: { count: wellnessData.trends.consistencyStack.reduce((sum, w) => sum + w.normal, 0), pct: 0 },
              soft: { count: wellnessData.trends.consistencyStack.reduce((sum, w) => sum + w.soft, 0), pct: 0 },
              dry: { count: wellnessData.trends.consistencyStack.reduce((sum, w) => sum + w.dry, 0), pct: 0 },
            }}
            weekly={weekRollupData}
          />
        </div>
      </div>

      {/* Important Disclaimer - Always at the bottom */}
      <Card
        className="bg-blue-50 border-blue-200"
        style={{
          borderRadius: wellnessTheme.radiusLg,
          boxShadow: wellnessTheme.cardShadow,
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <div className="font-semibold mb-2">Important Medical Disclaimer</div>
              <div className="space-y-1 text-blue-700">
                <div>• This waste monitoring system is <strong>not a substitute for professional veterinary care</strong></div>
                <div>• Waste quality scores and alerts are monitoring tools only - they do not constitute medical diagnosis</div>
                <div>• Always consult your veterinarian for any health concerns or changes in your pet's waste patterns</div>
                <div>• Regular veterinary check-ups are essential for your pet's overall health and wellness</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
