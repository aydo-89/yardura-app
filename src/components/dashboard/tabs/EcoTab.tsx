// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React from 'react';
import { Leaf, Recycle, Wind, TrendingUp, Award, Heart, TreePine, Zap } from 'lucide-react';

interface EcoTabProps {
  gramsThisMonth: number;
  methaneThisMonthLbsEq: number;
  totalGrams: number;
}

export default function EcoTab({ gramsThisMonth, methaneThisMonthLbsEq, totalGrams }: EcoTabProps) {
  const poundsThisMonth = gramsThisMonth * 0.00220462;
  const totalPounds = totalGrams * 0.00220462;

  // Calculate equivalent environmental impact
  const treesEquivalent = Math.round(totalPounds / 48); // 1 tree absorbs ~48 lbs CO2 per year
  const carMilesEquivalent = Math.round(totalPounds / 0.9); // 1 gallon gas = ~0.9 lbs CO2
  const homesEquivalent = Math.round(totalPounds / 12000); // Average home emits ~12,000 lbs CO2 per year

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
          <Leaf className="size-8 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Environmental Impact</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Track your positive environmental contribution through waste diversion and reduced
          emissions
        </p>
      </div>

      {/* Key Impact Metrics */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Recycle className="size-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{poundsThisMonth.toFixed(1)}</div>
              <div className="text-sm text-slate-600">lbs diverted this month</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Waste kept out of landfills</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wind className="size-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {methaneThisMonthLbsEq.toFixed(1)}
              </div>
              <div className="text-sm text-slate-600">ft³ methane avoided</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Reduced greenhouse gas emissions</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="size-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{totalPounds.toFixed(1)}</div>
              <div className="text-sm text-slate-600">lbs total diverted</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Cumulative environmental impact</div>
        </div>
      </div>

      {/* Environmental Equivalents */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Award className="size-6 text-green-600" />
          <h3 className="text-lg font-semibold text-slate-900">Your Impact in Perspective</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
              <TreePine className="size-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">{treesEquivalent}</div>
            <div className="text-sm text-slate-600">Trees worth of CO₂ absorbed</div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
              <Zap className="size-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {carMilesEquivalent.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Miles driven by car</div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-3">
              <Heart className="size-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">{homesEquivalent}</div>
            <div className="text-sm text-slate-600">Days of home energy use</div>
          </div>
        </div>
      </div>

      {/* Monthly Progress */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Monthly Progress</h3>
          <p className="text-slate-600 text-sm">Your environmental impact this month</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-900">Waste Diverted</span>
              <span className="text-sm text-slate-600">{poundsThisMonth.toFixed(1)} lbs</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((poundsThisMonth / 50) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-900">Methane Reduced</span>
              <span className="text-sm text-slate-600">{methaneThisMonthLbsEq.toFixed(1)} ft³</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((methaneThisMonthLbsEq / 100) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sustainability Tips */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Sustainability Tips</h3>
          <p className="text-slate-600 text-sm">Ways to maximize your environmental impact</p>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg flex-shrink-0 mt-1">
                <Recycle className="size-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm mb-1">Premium Diversion</div>
                <div className="text-xs text-slate-600">
                  Upgrade to composting or other diversion options for maximum impact
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0 mt-1">
                <Leaf className="size-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm mb-1">Eco-Friendly Products</div>
                <div className="text-xs text-slate-600">
                  Use biodegradable bags and natural cleaning products
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0 mt-1">
                <Heart className="size-4 text-orange-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm mb-1">Community Impact</div>
                <div className="text-xs text-slate-600">
                  Share your impact story to inspire others
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0 mt-1">
                <TrendingUp className="size-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm mb-1">Track Progress</div>
                <div className="text-xs text-slate-600">
                  Monitor your dashboard to see growing impact over time
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="bg-gradient-to-r from-accent/5 to-accent-soft/5 rounded-xl border border-accent/20 p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-4">
            <Award className="size-6 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Thank You for Making a Difference
          </h3>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            Your commitment to waste diversion helps create a cleaner, greener community. Together,
            we're building a more sustainable future for our neighborhoods.
          </p>
        </div>
      </div>
    </div>
  );
}
