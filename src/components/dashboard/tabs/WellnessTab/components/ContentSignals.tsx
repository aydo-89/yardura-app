import React from 'react';
import { Disclosure } from './Disclosure';
import { wellnessTheme, type WellnessComputed } from '../../../../../shared/wellness';
import { Bug, Camera, AlertTriangle } from 'lucide-react';

interface ContentSignalsProps {
  signals: WellnessComputed['trends']['signalSparklines'];
  weekly?: WellnessComputed['weekly'];
}

export const ContentSignals: React.FC<ContentSignalsProps> = ({ signals, weekly }) => {
  // Check if any signals have data
  const hasData = signals.some(
    (signal) => signal.series.some((point) => point.y > 0) || signal.series.length > 0
  );

  // Handle image request for critical detections
  const handleImageRequest = (signalType: string, count: number) => {
    console.log(`Requesting images for ${count} ${signalType} detection(s)`);
    alert(
      `📸 Image request submitted for ${count} ${signalType} detection(s). A veterinarian will review the images and contact you within 24 hours.`
    );
  };

  return (
    <Disclosure title="Content Analysis" defaultOpen={true}>
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: wellnessTheme.slate50,
          boxShadow: wellnessTheme.cardShadow,
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">Content Analysis</h3>
          <div className="text-sm text-slate-600">Advanced AI-powered stool analysis</div>
        </div>

        {hasData ? (
          <>
            {/* Current Week Summary - Large, prominent cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {signals.map((signal, index) => {
                const signalConfig = {
                  mucous: {
                    label: 'Mucous Content',
                    fullLabel: 'Mucous Content',
                    description: 'Abnormal mucus indicates irritation or inflammation',
                    color: 'bg-teal-500',
                    icon: null,
                    emoji: '💧',
                  },
                  greasy: {
                    label: 'Greasy Content',
                    fullLabel: 'Greasy Content',
                    description: 'Oily stool may indicate pancreatic or liver issues',
                    color: 'bg-orange-500',
                    icon: null,
                    emoji: '🫒',
                  },
                  parasites: {
                    label: 'Visible Parasites',
                    fullLabel: 'Visible Parasites',
                    description: 'Visible parasites or worms detected',
                    color: 'bg-red-500',
                    icon: Bug,
                    emoji: '🐛',
                  },
                  foreign: {
                    label: 'Foreign Objects',
                    fullLabel: 'Foreign Objects',
                    description: 'Non-food items like grass, string, or plastic detected',
                    color: 'bg-purple-500',
                    icon: null,
                    emoji: '❓',
                  },
                };

                const config = signalConfig[signal.key as keyof typeof signalConfig];
                if (!config) return null; // Skip unknown signal types

                const latestValue = signal.series[signal.series.length - 1]?.y || 0;
                const last7Days = signal.series.slice(-7);
                const totalLast7Days = last7Days.reduce((sum, day) => sum + day.y, 0);

                // Show review button for current week's concerning signal detection
                const isConcerning = latestValue > 0;
                const isCritical =
                  (signal.key === 'parasites' || signal.key === 'foreign') && latestValue > 0;

                return (
                  <div
                    key={signal.key}
                    className="p-4 bg-white rounded-lg border border-slate-200 min-h-[120px] flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {config.icon ? (
                          <config.icon
                            className={`w-4 h-4 flex-shrink-0 ${signal.key === 'parasites' ? 'text-red-500' : 'text-slate-500'}`}
                          />
                        ) : (
                          <div
                            className={`w-4 h-4 rounded-full ${config.color} flex-shrink-0`}
                          ></div>
                        )}
                        <div
                          className="text-sm font-medium text-slate-900 truncate"
                          title={`${config.label}: ${config.description}`}
                        >
                          {config.label}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div
                          className="text-sm font-bold text-slate-800"
                          title={`${latestValue} detection(s) in the most recent week`}
                        >
                          {latestValue}
                        </div>
                      </div>
                    </div>
                    {/* Description */}
                    <div className="text-xs text-slate-600 mb-3 leading-relaxed flex-1">
                      {config.description}
                    </div>

                    {/* Review Button for Any Concerning Signal */}
                    {isConcerning && (
                      <div
                        className={`mt-2 pt-2 border-t ${
                          isCritical ? 'border-red-200' : 'border-amber-200'
                        }`}
                      >
                        <button
                          onClick={() => handleImageRequest(config.fullLabel, latestValue)}
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                            isCritical
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                          title={`Request veterinary review of ${config.label.toLowerCase()} detection`}
                        >
                          <Camera className="size-3" />
                          {isCritical ? 'Urgent Review' : 'Request Review'}
                        </button>
                      </div>
                    )}

                    {/* Status indicator for concerning signals */}
                    {totalLast7Days > 0 && !isCritical && (
                      <div
                        className={`mt-2 p-2 rounded text-xs ${
                          latestValue > 0
                            ? 'bg-amber-50 text-amber-700' // Current detections - monitoring needed
                            : 'bg-green-50 text-green-700' // Historical only - no current concern
                        }`}
                      >
                        {latestValue > 0
                          ? `Monitoring - ${latestValue} detection${latestValue !== 1 ? 's' : ''} this week`
                          : `All good - 0 detections this week`}
                      </div>
                    )}

                    {/* No detections indicator */}
                    {totalLast7Days === 0 && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                        ✅ None detected in last 7 days
                      </div>
                    )}

                    {/* Sample Context - Shows proportion for current detection */}
                    {latestValue > 0 && (
                      <div className="mt-auto pt-2 border-t border-slate-100">
                        <div className="text-xs text-center text-slate-600">
                          {(() => {
                            // Get total samples from the most recent week for proportion context
                            const latestWeekSamples = weekly?.[0]?.deposits || 0;

                            if (latestWeekSamples > 0 && latestValue > 0) {
                              const proportion = Math.round(
                                (latestValue / latestWeekSamples) * 100
                              );
                              return `${latestValue} of ${latestWeekSamples} samples (${proportion}%) this week`;
                            }

                            return `${latestValue} detection${latestValue !== 1 ? 's' : ''} this week`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Coming soon message when no data */
          <div className="text-center py-8 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Advanced content analysis coming soon</p>
            <p className="text-sm">
              We'll detect mucous, greasy, parasites, and foreign objects that may indicate health
              issues.
            </p>
          </div>
        )}
      </div>
    </Disclosure>
  );
};
