import React from "react";
import { motion } from "@/lib/framermotion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./StatusPill";
import { wellnessTheme, type WellnessComputed } from "@/shared/wellness";
import { brandColors, withAlpha } from "@/shared/brand";

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
  const latestWeek = wellnessData.weekly[0];
  const depositsThisWeek = latestWeek?.deposits ?? 0;
  const monitorWeeks = wellnessData.weekly.filter((week) => week.status === "monitor").length;
  const attentionWeeks = wellnessData.weekly.filter((week) => week.status === "attention").length;
  const healthyWeeks = wellnessData.weekly.filter((week) => week.status === "good").length;

  // Identify concerning issues for navigation
  const concerningIssues: Array<{ label: string; sectionId: string; icon: string }> = [];

  // Check for color issues - use same logic as ColorAnalysis component
  const totalColorSamples =
    wellnessData.trends.colorDonut.normal +
    wellnessData.trends.colorDonut.yellow +
    wellnessData.trends.colorDonut.red +
    wellnessData.trends.colorDonut.black;

  if (totalColorSamples > 0) {
    // Calculate percentages consistent with ColorAnalysis
    const yellowPercent = Math.round(
      (wellnessData.trends.colorDonut.yellow / totalColorSamples) * 100,
    );
    const redPercent = Math.round(
      (wellnessData.trends.colorDonut.red / totalColorSamples) * 100,
    );
    const blackPercent = Math.round(
      (wellnessData.trends.colorDonut.black / totalColorSamples) * 100,
    );

    if (yellowPercent > 0) {
      concerningIssues.push({
        label: "Yellow Color",
        sectionId: "color-analysis",
        icon: "🟡",
      });
    }
    if (redPercent > 0 || blackPercent > 0) {
      concerningIssues.push({
        label: "Red/Black Color",
        sectionId: "color-analysis",
        icon: "🔴",
      });
    }
  }

  // Check for consistency issues - only show if there are actual concerning patterns
  const softTotal = wellnessData.trends.consistencyStack.reduce(
    (sum, w) => sum + w.soft,
    0,
  );
  const dryTotal = wellnessData.trends.consistencyStack.reduce(
    (sum, w) => sum + w.dry,
    0,
  );
  const totalConsistencySamples = wellnessData.trends.consistencyStack.reduce(
    (sum, w) => sum + w.normal + w.soft + w.dry,
    0,
  );

  if (totalConsistencySamples > 0) {
    const softPercent = Math.round((softTotal / totalConsistencySamples) * 100);
    const dryPercent = Math.round((dryTotal / totalConsistencySamples) * 100);

    if (softPercent > 0) {
      concerningIssues.push({
        label: "Soft Consistency",
        sectionId: "consistency-analysis",
        icon: "💧",
      });
    }
    if (dryPercent > 0) {
      concerningIssues.push({
        label: "Hard Consistency",
        sectionId: "consistency-analysis",
        icon: "🏜️",
      });
    }
  }

  // Check for content signal issues - only show if there are actual detections
  const signalIssues = wellnessData.trends.signalSparklines.filter((signal) =>
    signal.series.some((point) => point.y > 0),
  );
  if (signalIssues.length > 0) {
    concerningIssues.push({
      label: "Content Signals",
      sectionId: "content-signals",
      icon: "🔍",
    });
  }

  const handleNavigate = (sectionId: string) => {
    if (onNavigateToSection) {
      onNavigateToSection(sectionId);
    } else {
      // Fallback: scroll to element
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Using a div with explicit backgrounds instead of Card to avoid default styles */}
      <div className="relative overflow-hidden rounded-xl border border-graphite/20 dark:border-white/10 bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-[#25292f] dark:via-[#1e2227] dark:to-[#25292f] shadow-lg">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-mint-500/15 to-transparent" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              <span className="size-1.5 rounded-full bg-mint" />
              Wellness status
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={latestStatus} size="md" />
              <div>
                <p className="text-xl font-heading font-semibold text-white">
                  {latestCopy.title}
                </p>
                <p className="max-w-xl text-sm text-white/70">
                  {latestCopy.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-md shadow-black/20 bg-gradient-to-r from-mint/40 to-evergreen/60 border-mint/40">
                <div className="size-3 rounded-full animate-pulse shadow-sm bg-mint"></div>
                <span className="text-sm font-semibold text-white">
                  3C baseline stable · Dashboard preview
                </span>
              </div>
            </div>

            {latestCopy.advice.length > 0 && (
              <div className="grid gap-2 rounded-2xl border border-white/12 bg-white/8 p-4 text-xs text-white/80">
                {latestCopy.advice.map((advice, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="mt-0.5 text-mint">•</span>
                    <span>{advice}</span>
                  </div>
                ))}
              </div>
            )}

            {concerningIssues.length > 0 && (
              <div className="rounded-2xl border border-coral/32 bg-coral/12 px-4 py-3 text-xs text-white/80">
                <div className="mb-2 font-semibold text-white">Review these sections</div>
                <div className="flex flex-wrap gap-2">
                  {concerningIssues.map((issue, index) => (
                    <button
                      key={index}
                      onClick={() => handleNavigate(issue.sectionId)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 text-white/90 shadow-sm transition-all hover:bg-white/20"
                    >
                      <span>{issue.icon}</span>
                      <span>{issue.label}</span>
                      <span className="text-white/60">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-xs space-y-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-2xl border border-white/16 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/65">
                  Deposits this week
                </div>
                <div className="text-lg font-heading font-semibold text-white">
                  {depositsThisWeek}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-mint/42 bg-mint/16 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/70">
                  Weeks to monitor
                </div>
                <div className="text-lg font-heading font-semibold text-white">
                  {monitorWeeks + attentionWeeks}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-coral/40 bg-coral/14 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/70">
                  Healthy streak
                </div>
                <div className="text-lg font-heading font-semibold text-white">
                  {healthyWeeks} wks
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={onExport}
                variant="outline"
                className="flex-1 border-white/25 bg-white/10 text-white hover:bg-white/18 hover:text-white"
              >
                Export report
              </Button>
              {latestCopy.cta && (
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <Button
                    asChild
                    className="bg-coral hover:bg-coral-ink text-white"
                    size="sm"
                  >
                    <a href={latestCopy.cta.href || "#"}>
                      {latestCopy.cta.text || latestCopy.cta.label}
                    </a>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
