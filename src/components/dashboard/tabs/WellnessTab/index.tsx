import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useWellnessData } from "./hooks/useWellnessData";
import { WellnessHeader } from "./components/WellnessHeader";
import { WeeklyTimeline } from "./components/WeeklyTimeline";
import { WeeklyDetailsGrid } from "./components/WeeklyDetailsGrid";
import { KeyInsights } from "./components/KeyInsights";
import { ColorAnalysis } from "./components/ColorAnalysis";
import { ConsistencyAnalysis } from "./components/ConsistencyAnalysis";
import { ContentSignals } from "./components/ContentSignals";
import { FrequencyAnalysis } from "./components/FrequencyAnalysis";
import { ComingSoonOverlay } from "./components/ComingSoonOverlay";
import { wellnessTheme } from "@/shared/wellness";
import type {
  DataReading,
  ServiceVisit,
  WeekRollup,
  WellnessComputed,
} from "@/shared/wellness";

interface WellnessTabProps {
  dataReadings: DataReading[];
  serviceVisits: ServiceVisit[];
  isWellnessEnabled?: boolean;
}

// Temporary adapter functions to convert new data format to old format
const convertWeeklyToWeekRollup = (
  weekly: WellnessComputed["weekly"],
): WeekRollup[] => {
  return weekly.map((week) => ({
    startISO: week.startISO,
    start: new Date(week.startISO),
    label: `Week ${weekly.length - weekly.indexOf(week)}`, // Week 8, 7, 6, etc.
    deposits: week.deposits,
    avgWeight: 0, // Not available in new format
    colors: week.colors,
    consistency: week.consistency,
    issues: week.issues,
    status: week.status,
    healthStatus:
      week.status === "good"
        ? "normal"
        : week.status === "monitor"
          ? "monitor"
          : "action",
    wellnessScore: 85, // Simplified
  }));
};

export const WellnessTab: React.FC<WellnessTabProps> = ({
  dataReadings,
  serviceVisits,
  isWellnessEnabled = false,
}) => {
  const wellnessData = useWellnessData(dataReadings, serviceVisits);
  const [showOverlay, setShowOverlay] = useState(!isWellnessEnabled);

  const handleExport = () => {
    // Navigate to reports page - this preserves existing functionality
    window.location.href = "/reports";
  };

  const handleNavigateToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleJoinWaitlist = async (email: string) => {
    try {
      // Send to your backend API
      const response = await fetch("/api/waitlist/wellness-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          feature: "wellness-insights",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to join waitlist");
      }

      const result = await response.json();

      // You could also send analytics events here
      console.log("Successfully joined waitlist:", result);

      // Optional: Send confirmation email
      // This would typically be handled by your backend
    } catch (error) {
      console.error("Error joining waitlist:", error);

      // Fallback: Store locally if API fails
      const waitlistData = {
        email,
        feature: "wellness-insights",
        timestamp: new Date().toISOString(),
        offline: true, // Mark as offline submission
      };

      // Store in localStorage as fallback
      const existingWaitlist = JSON.parse(
        localStorage.getItem("yardura_waitlist") || "[]",
      );
      existingWaitlist.push(waitlistData);
      localStorage.setItem(
        "yardura_waitlist",
        JSON.stringify(existingWaitlist),
      );

      console.log("Stored waitlist signup locally:", waitlistData);
    }

    // Show success message to user
    setTimeout(() => {
      alert(
        `Thank you for joining the waitlist! We'll notify you at ${email} when advanced wellness insights are available.`,
      );
    }, 500);
  };

  // Convert data formats for components that haven't been updated yet
  const weekRollupData = convertWeeklyToWeekRollup(wellnessData.weekly);

  return (
    <div
      className="space-y-6 relative"
      style={{
        backgroundColor: wellnessTheme.slate50,
      }}
    >
      {/* Wellness Header - Always visible */}
      <WellnessHeader
        wellnessData={wellnessData}
        onExport={handleExport}
        onNavigateToSection={handleNavigateToSection}
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

      {/* Four-column layout for detailed analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Color Analysis */}
        <div id="color-analysis">
          {(() => {
            const totalColorCount =
              wellnessData.trends.colorDonut.normal +
              wellnessData.trends.colorDonut.yellow +
              wellnessData.trends.colorDonut.red +
              wellnessData.trends.colorDonut.black;

            return (
              <ColorAnalysis
                colorStats={{
                  normal: {
                    count: wellnessData.trends.colorDonut.normal,
                    pct:
                      totalColorCount > 0
                        ? Math.round(
                            (wellnessData.trends.colorDonut.normal /
                              totalColorCount) *
                              100,
                          )
                        : 0,
                  },
                  yellow: {
                    count: wellnessData.trends.colorDonut.yellow,
                    pct:
                      totalColorCount > 0
                        ? Math.round(
                            (wellnessData.trends.colorDonut.yellow /
                              totalColorCount) *
                              100,
                          )
                        : 0,
                  },
                  red: {
                    count: wellnessData.trends.colorDonut.red,
                    pct:
                      totalColorCount > 0
                        ? Math.round(
                            (wellnessData.trends.colorDonut.red /
                              totalColorCount) *
                              100,
                          )
                        : 0,
                  },
                  black: {
                    count: wellnessData.trends.colorDonut.black,
                    pct:
                      totalColorCount > 0
                        ? Math.round(
                            (wellnessData.trends.colorDonut.black /
                              totalColorCount) *
                              100,
                          )
                        : 0,
                  },
                }}
                weekly={weekRollupData}
              />
            );
          })()}
        </div>

        {/* Consistency Analysis */}
        <div id="consistency-analysis">
          <ConsistencyAnalysis
            consistencyStats={{
              normal: {
                count: wellnessData.trends.consistencyStack.reduce(
                  (sum, w) => sum + w.normal,
                  0,
                ),
                pct: 0,
              },
              soft: {
                count: wellnessData.trends.consistencyStack.reduce(
                  (sum, w) => sum + w.soft,
                  0,
                ),
                pct: 0,
              },
              dry: {
                count: wellnessData.trends.consistencyStack.reduce(
                  (sum, w) => sum + w.dry,
                  0,
                ),
                pct: 0,
              },
            }}
            weekly={weekRollupData}
          />
        </div>

        {/* Content Signals */}
        <div id="content-signals">
          <ContentSignals
            signals={wellnessData.trends.signalSparklines}
            weekly={wellnessData.weekly}
          />
        </div>

        {/* Frequency Analysis */}
        <div id="frequency-analysis">
          <FrequencyAnalysis weeklyData={weekRollupData} dogCount={2} />
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
              <div className="font-semibold mb-2">
                Important Medical Disclaimer
              </div>
              <div className="space-y-1 text-blue-700">
                <div>
                  • This waste monitoring system is{" "}
                  <strong>
                    not a substitute for professional veterinary care
                  </strong>
                </div>
                <div>
                  • Waste quality scores and alerts are monitoring tools only -
                  they do not constitute medical diagnosis
                </div>
                <div>
                  • Always consult your veterinarian for any health concerns or
                  changes in your pet's waste patterns
                </div>
                <div>
                  • Regular veterinary check-ups are essential for your pet's
                  overall health and wellness
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Overlay */}
      {showOverlay && (
        <ComingSoonOverlay
          onJoinWaitlist={handleJoinWaitlist}
          closable={false}
        />
      )}
    </div>
  );
};
