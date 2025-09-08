import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, Bug, Droplets, Waves } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from './Disclosure';
import { wellnessTheme, type WellnessComputed } from '@/shared/wellness';

interface ContentSignalsProps {
  signals: WellnessComputed['trends']['signalSparklines'];
}

const signalConfig = {
  mucous: {
    label: 'Mucous',
    icon: Waves,
    color: wellnessTheme.teal,
    bgColor: wellnessTheme.slate100,
    borderColor: wellnessTheme.slate200,
    description: 'Potential irritation',
  },
  greasy: {
    label: 'Greasy',
    icon: Droplets,
    color: wellnessTheme.orange,
    bgColor: wellnessTheme.slate100,
    borderColor: wellnessTheme.slate200,
    description: 'Possible malabsorption',
  },
  dry: {
    label: 'Dry',
    icon: Droplets,
    color: wellnessTheme.blue,
    bgColor: wellnessTheme.slate100,
    borderColor: wellnessTheme.slate200,
    description: 'Potential dehydration',
  },
};

export const ContentSignals: React.FC<ContentSignalsProps> = ({ signals }) => {
  // Filter out signals with no data (all zeros)
  const activeSignals = signals.filter(signal => {
    const maxValue = Math.max(...signal.series.map(d => d.y));
    return maxValue > 0;
  });

  // Show only if we have active signals
  if (activeSignals.length === 0) {
    return (
      <Disclosure title="Content Signals" defaultOpen={false}>
        <Card
          style={{
            backgroundColor: wellnessTheme.slate50,
            boxShadow: wellnessTheme.cardShadow,
            borderRadius: wellnessTheme.radiusLg,
          }}
        >
          <CardContent className="p-6">
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No concerning content signals detected</p>
              <p className="text-sm">Your pet's stool content appears normal across all recent readings.</p>
            </div>
          </CardContent>
        </Card>
      </Disclosure>
    );
  }

  // Check for parasite indicators (mucous or greasy in recent weeks)
  const recentWeeks = 2; // Check last 2 weeks
  const hasParasites = activeSignals.some(signal => {
    const recentData = signal.series.slice(0, recentWeeks);
    const maxRecent = Math.max(...recentData.map(d => d.y));
    return maxRecent > 0 && (signal.key === 'mucous' || signal.key === 'greasy');
  });

  return (
    <Disclosure title="Content Signals" defaultOpen={false}>
      <Card
        style={{
          backgroundColor: wellnessTheme.slate50,
          boxShadow: wellnessTheme.cardShadow,
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Content Signals
          </h3>

        {/* Parasite Warning */}
        {hasParasites && (
          <div
            className="p-4 rounded-lg mb-6 border-2"
            style={{
              backgroundColor: wellnessTheme.yellow + '20',
              borderColor: wellnessTheme.yellow + '40',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-lg">🐛</div>
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: wellnessTheme.slate800 }}
                >
                  Possible Parasite Indicators
                </div>
                <div
                  className="text-xs"
                  style={{ color: wellnessTheme.slate600 }}
                >
                  Mucous or greasy content detected recently
                </div>
              </div>
            </div>
            <div
              className="text-sm"
              style={{ color: wellnessTheme.slate700 }}
            >
              This may indicate parasitic infection. Consult your veterinarian for proper testing.
            </div>
          </div>
        )}

        {/* Signal Chips with Sparklines */}
        <div className="space-y-4">
          {activeSignals.map((signal) => {
            const config = signalConfig[signal.key as keyof typeof signalConfig];
            const maxValue = Math.max(...signal.series.map(d => d.y));
            const totalWeeks = signal.series.filter(d => d.y > 0).length;

            return (
              <div
                key={signal.key}
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: config.bgColor,
                  borderColor: config.borderColor,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: config.color }}
                    />
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: wellnessTheme.slate800 }}
                      >
                        {config.label} Content
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: wellnessTheme.slate600 }}
                      >
                        {config.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: config.color }}
                    >
                      {totalWeeks}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: wellnessTheme.slate600 }}
                    >
                      week{totalWeeks !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Mini Sparkline */}
                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={signal.series}>
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke={config.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: config.color }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: wellnessTheme.slate800,
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '12px',
                        }}
                        labelFormatter={(label) => `${label}`}
                        formatter={(value) => [value, 'occurrences']}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* Veterinary Recommendations */}
        <div
          className="mt-6 p-4 rounded-lg"
          style={{
            backgroundColor: wellnessTheme.blue + '20',
            border: `1px solid ${wellnessTheme.blue}40`,
          }}
        >
          <h4
            className="text-sm font-semibold mb-3 flex items-center gap-2"
            style={{ color: wellnessTheme.slate800 }}
          >
            <span className="text-lg">🏥</span>
            Veterinary Recommendations
          </h4>
          <div
            className="text-sm space-y-2"
            style={{ color: wellnessTheme.slate700 }}
          >
            {activeSignals.some(s => s.key === 'mucous') && (
              <div>• Consult vet about potential intestinal parasites or infections</div>
            )}
            {activeSignals.some(s => s.key === 'greasy') && (
              <div>• Discuss possible pancreatic or liver issues with your veterinarian</div>
            )}
            {activeSignals.some(s => s.key === 'dry') && (
              <div>• Ensure adequate water intake and consider dietary adjustments</div>
            )}
            <div>• Keep detailed records of these observations for your vet visit</div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Disclosure>
  );
};
