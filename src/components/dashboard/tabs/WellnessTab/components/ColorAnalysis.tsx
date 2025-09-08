import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, BarChart3 } from 'lucide-react';
import { Disclosure } from './Disclosure';
import { COLOR_HEX, type ColorStatsWindow, type WeekRollup } from '@/shared/wellness';

interface ColorAnalysisProps {
  colorStats: ColorStatsWindow;
  weekly: WeekRollup[];
}

export const ColorAnalysis: React.FC<ColorAnalysisProps> = ({ colorStats, weekly }) => {
  const colorConfig = {
    normal: { label: 'Normal', description: 'Healthy brown/tan colors', color: COLOR_HEX.normal },
    yellow: { label: 'Yellow/Gray', description: 'May indicate liver issues', color: COLOR_HEX.yellow },
    red: { label: 'Red', description: 'Possible blood in stool', color: COLOR_HEX.red },
    black: { label: 'Black/Tarry', description: 'Possible digested blood', color: COLOR_HEX.black },
  };

  const colorEntries = Object.entries(colorStats);

  return (
    <Disclosure title="Color Analysis" defaultOpen={false}>
      <div className="space-y-6">
        {/* Color Overview Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {colorEntries.map(([key, stat]) => {
            const config = colorConfig[key as keyof typeof colorConfig];
            const isConcerning = key === 'red' || key === 'black';

            return (
              <div
                key={key}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  isConcerning && stat.count > 0
                    ? 'border-red-200 bg-red-50'
                    : stat.count === Math.max(...colorEntries.map(([, s]) => s.count)) && stat.count > 0
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: config.color }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{config.label}</div>
                    <div className="text-xs text-slate-500">{stat.pct}%</div>
                  </div>
                </div>

                <div className="text-2xl font-bold mb-1" style={{ color: config.color }}>
                  {stat.count}
                </div>

                <div className="text-xs text-slate-600 leading-tight mb-2">
                  {config.description}
                </div>

                {isConcerning && stat.count > 0 && (
                  <div className="text-xs text-red-600 font-medium">
                    ⚠️ Requires attention
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Weekly Color Timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="size-4" />
            Weekly Color Patterns
          </h4>

          <div className="grid grid-cols-8 gap-3">
            {weekly.map((week, i) => (
              <div key={i} className="text-center">
                <div className="relative h-20 bg-slate-100 rounded-lg overflow-hidden mb-2">
                  {/* Stacked bars for each color */}
                  {week.deposits > 0 && (
                    <>
                      {/* Normal (bottom layer) */}
                      <div
                        className="absolute bottom-0 w-full transition-all duration-300"
                        style={{
                          height: `${(week.colors.normal / week.deposits) * 100}%`,
                          backgroundColor: COLOR_HEX.normal
                        }}
                      />

                      {/* Yellow (middle layer) */}
                      {week.colors.yellow > 0 && (
                        <div
                          className="absolute w-full transition-all duration-300"
                          style={{
                            bottom: `${(week.colors.normal / week.deposits) * 100}%`,
                            height: `${(week.colors.yellow / week.deposits) * 100}%`,
                            backgroundColor: COLOR_HEX.yellow
                          }}
                        />
                      )}

                      {/* Red (top layer) */}
                      {week.colors.red > 0 && (
                        <div
                          className="absolute w-full transition-all duration-300 border-2 border-white"
                          style={{
                            bottom: `${((week.colors.normal + week.colors.yellow) / week.deposits) * 100}%`,
                            height: `${(week.colors.red / week.deposits) * 100}%`,
                            backgroundColor: COLOR_HEX.red
                          }}
                        />
                      )}

                      {/* Black (top layer with higher priority) */}
                      {week.colors.black > 0 && (
                        <div
                          className="absolute w-full transition-all duration-300 border-2 border-white"
                          style={{
                            bottom: `${((week.colors.normal + week.colors.yellow + week.colors.red) / week.deposits) * 100}%`,
                            height: `${(week.colors.black / week.deposits) * 100}%`,
                            backgroundColor: COLOR_HEX.black
                          }}
                        />
                      )}
                    </>
                  )}

                  {/* Alert indicator */}
                  {(week.colors.red > 0 || week.colors.black > 0) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
                  )}
                </div>

                <div className="text-xs text-slate-600">{week.label.split(' ')[0]} {week.label.split(' ')[1]}</div>
                <div className="text-xs text-slate-500">{week.deposits} readings</div>
              </div>
            ))}
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          {colorEntries.map(([key, stat]) => {
            const config = colorConfig[key as keyof typeof colorConfig];
            return (
              <div key={config.label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-slate-600">{config.label}</span>
              </div>
            );
          })}
        </div>

        {/* Health Insights */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Waste Color Insights
          </h4>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-slate-900 mb-2">Normal Range</div>
              <div className="text-slate-600 space-y-1">
                <div>• Brown/tan colors are typical and healthy</div>
                <div>• Slight variations are usually normal</div>
                <div>• {colorStats.normal.count} normal readings ({colorStats.normal.pct}%)</div>
              </div>
            </div>

            <div>
              <div className="font-medium text-slate-900 mb-2">Concerning Signs</div>
              <div className="text-slate-600 space-y-1">
                {colorStats.red.count > 0 && (
                  <div className="text-red-600">• Red color may indicate fresh blood</div>
                )}
                {colorStats.black.count > 0 && (
                  <div className="text-red-600">• Black/tarry may indicate digested blood</div>
                )}
                {colorStats.red.count === 0 && colorStats.black.count === 0 && (
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
