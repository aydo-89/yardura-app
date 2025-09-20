import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from './StatusPill';
import { wellnessTheme, type WellnessComputed } from '@/shared/wellness';

interface WellnessHeaderProps {
  wellnessData: WellnessComputed;
  onExport: () => void;
  onNavigateToSection?: (sectionId: string) => void;
}

export const WellnessHeader: React.FC<WellnessHeaderProps> = ({
  wellnessData,
  onExport,
  onNavigateToSection,
}) => {
  const { latestStatus, latestCopy } = wellnessData;

  // Identify concerning issues for navigation
  const concerningIssues = [];

  // Check for color issues - use same logic as ColorAnalysis component
  const totalColorSamples =
    wellnessData.trends.colorDonut.normal +
    wellnessData.trends.colorDonut.yellow +
    wellnessData.trends.colorDonut.red +
    wellnessData.trends.colorDonut.black;

  if (totalColorSamples > 0) {
    // Calculate percentages consistent with ColorAnalysis
    const yellowPercent = Math.round(
      (wellnessData.trends.colorDonut.yellow / totalColorSamples) * 100
    );
    const redPercent = Math.round((wellnessData.trends.colorDonut.red / totalColorSamples) * 100);
    const blackPercent = Math.round(
      (wellnessData.trends.colorDonut.black / totalColorSamples) * 100
    );

    if (yellowPercent > 0) {
      concerningIssues.push({
        label: 'Yellow Color',
        sectionId: 'color-analysis',
        icon: '🟡',
      });
    }
    if (redPercent > 0 || blackPercent > 0) {
      concerningIssues.push({
        label: 'Red/Black Color',
        sectionId: 'color-analysis',
        icon: '🔴',
      });
    }
  }

  // Check for consistency issues - only show if there are actual concerning patterns
  const softTotal = wellnessData.trends.consistencyStack.reduce((sum, w) => sum + w.soft, 0);
  const dryTotal = wellnessData.trends.consistencyStack.reduce((sum, w) => sum + w.dry, 0);
  const totalConsistencySamples = wellnessData.trends.consistencyStack.reduce(
    (sum, w) => sum + w.normal + w.soft + w.dry,
    0
  );

  if (totalConsistencySamples > 0) {
    const softPercent = Math.round((softTotal / totalConsistencySamples) * 100);
    const dryPercent = Math.round((dryTotal / totalConsistencySamples) * 100);

    if (softPercent > 0) {
      concerningIssues.push({
        label: 'Soft Consistency',
        sectionId: 'consistency-analysis',
        icon: '💧',
      });
    }
    if (dryPercent > 0) {
      concerningIssues.push({
        label: 'Hard Consistency',
        sectionId: 'consistency-analysis',
        icon: '🏜️',
      });
    }
  }

  // Check for content signal issues - only show if there are actual detections
  const signalIssues = wellnessData.trends.signalSparklines.filter((signal) =>
    signal.series.some((point) => point.y > 0)
  );
  if (signalIssues.length > 0) {
    concerningIssues.push({
      label: 'Content Signals',
      sectionId: 'content-signals',
      icon: '🔍',
    });
  }

  const handleNavigate = (sectionId: string) => {
    if (onNavigateToSection) {
      onNavigateToSection(sectionId);
    } else {
      // Fallback: scroll to element
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        className="border-0 shadow-sm"
        style={{
          backgroundColor: 'white',
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-6">
            {/* Status Section - Just the Chip */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <StatusPill status={latestStatus} size="md" />
                <p className="text-slate-600 text-sm leading-relaxed mb-2">{latestCopy.subtitle}</p>
              </div>

              {/* Compact Advice List */}
              {latestCopy.advice.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {latestCopy.advice.map((advice, index) => (
                    <span key={index} className="text-xs text-slate-500">
                      {advice}
                    </span>
                  ))}
                </div>
              )}

              {/* Navigation Links for Concerning Issues */}
              {concerningIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-600 mb-2 font-medium">Review concerns:</div>
                  <div className="flex flex-wrap gap-2">
                    {concerningIssues.map((issue, index) => (
                      <button
                        key={index}
                        onClick={() => handleNavigate(issue.sectionId)}
                        className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
                      >
                        <span>{issue.icon}</span>
                        <span>{issue.label}</span>
                        <span className="text-slate-400">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA Section - More Compact */}
            <div className="flex items-center gap-3">
              <Button
                onClick={onExport}
                variant="outline"
                size="sm"
                className="text-xs"
                style={{
                  borderColor: wellnessTheme.slate200,
                  borderRadius: wellnessTheme.radiusLg,
                }}
              >
                Export
              </Button>

              {latestCopy.cta && (
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <Button
                    asChild
                    size="sm"
                    className="text-xs font-medium"
                    style={{
                      backgroundColor:
                        latestStatus === 'attention' ? wellnessTheme.colors.red : wellnessTheme.colors.teal,
                      borderRadius: wellnessTheme.radiusLg,
                    }}
                  >
                    <a
                      href={latestCopy.cta.href}
                      className="inline-flex items-center justify-center gap-1.5 text-white"
                    >
                      {latestCopy.cta.label}
                      <span className="text-xs">→</span>
                    </a>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
