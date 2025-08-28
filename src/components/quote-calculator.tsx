"use client";

import { useState, useEffect } from "react";
import { Calculator, Info } from "lucide-react";
import { calcInstantQuote, Frequency, YardSize } from "@/lib/pricing";

export default function QuoteCalculator() {
  const [dogs, setDogs] = useState(1);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [yardSize, setYardSize] = useState<YardSize>("medium");
  const [deodorize, setDeodorize] = useState(false);
  const [litter, setLitter] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);

  // Calculate estimate whenever inputs change
  useEffect(() => {
    const calculatedEstimate = calcInstantQuote(dogs, frequency, yardSize, { deodorize, litter });
    setEstimate(calculatedEstimate);
  }, [dogs, frequency, yardSize, deodorize, litter]);

  return (
    <div className="bg-white rounded-2xl border border-brand-200 p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="size-5 text-brand-600" />
        <h3 className="text-lg font-bold text-ink">Instant Quote Calculator</h3>
        <div className="group relative">
          <Info className="size-4 text-brand-600 cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Get an instant estimate based on your needs
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Number of Dogs</label>
          <select
            value={dogs}
            onChange={(e) => setDogs(Number(e.target.value))}
            className="w-full border border-brand-300 rounded-xl p-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            {[1,2,3,4,5,6,7,8].map(num => (
              <option key={num} value={num}>{num} dog{num > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Service Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="w-full border border-brand-300 rounded-xl p-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="weekly">Weekly</option>
            <option value="twice-weekly">Twice Weekly</option>
            <option value="bi-weekly">Bi-Weekly</option>
            <option value="one-time">One-Time</option>
          </select>
        </div>
      </div>

      <div className="mb-4 p-4 bg-brand-50 rounded-lg border border-brand-200">
        <label className="block text-sm font-medium mb-2 text-brand-800">Yard Size</label>
        <select
          value={yardSize}
          onChange={(e) => setYardSize(e.target.value as YardSize)}
          className="w-full border border-brand-300 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-lg font-medium"
        >
          <option value="small">Small (&lt; 1/4 acre)</option>
          <option value="medium">Medium (1/4 - 1/2 acre)</option>
          <option value="large">Large (1/2 - 1 acre)</option>
          <option value="xlarge">Extra Large (&gt; 1 acre)</option>
        </select>
        <p className="text-xs text-brand-600 mt-1">This affects your base service price</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Add-on Services</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deodorize}
              onChange={(e) => setDeodorize(e.target.checked)}
              className="rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">Yard Deodorizing (+$5/week or +$15 one-time)</span>
          </label>
          {frequency !== 'one-time' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={litter}
                onChange={(e) => setLitter(e.target.checked)}
                className="rounded border-brand-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">Litter Box Service (+$5/week)</span>
            </label>
          )}
        </div>
      </div>

      {estimate !== null && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <div className="text-center">
            <div className="text-sm text-slate-600 mb-1">Estimated {frequency === 'one-time' ? 'cost' : 'weekly cost'}</div>
            <div className="text-3xl font-extrabold text-brand-600 mb-2">${estimate}</div>
            {frequency !== 'one-time' && (
              <div className="text-xs text-slate-500 mb-2">
                That's only ${(estimate * (frequency === 'twice-weekly' ? 2 : frequency === 'bi-weekly' ? 0.5 : 1)).toFixed(2)} per month!
              </div>
            )}
            <div className="text-xs text-slate-600">
              No contracts • 100% satisfaction guarantee • Free quote consultation
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-brand-200">
        <a
          href="#quote"
          className="block w-full text-center px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-semibold shadow-soft"
        >
          Get Your Custom Quote
        </a>
        <p className="text-xs text-center text-slate-500 mt-2">
          Or call/text us at (612) 581-9812 for immediate assistance
        </p>
      </div>
    </div>
  );
}
