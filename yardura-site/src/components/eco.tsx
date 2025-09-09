'use client';

import { Leaf, Recycle, Wind, TrendingUp } from 'lucide-react';

export default function Eco() {

  return (
    <section id="eco" className="bg-gradient-to-b from-accent-soft/30 to-white border-t border-b">
      <div className="container py-20 md:py-32">
        {/* Large Section Label */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-4 tracking-tight">
            SERVICE OPTIONS
          </h1>
          <div className="w-24 h-1 bg-accent mx-auto rounded-full mb-8"></div>
          <div className="text-slate-700 max-w-3xl mx-auto text-lg leading-relaxed space-y-4">
            <p>
              Every dog produces about 250 lbs of waste per year. Our standard service uses
              biodegradable bags to collect and handle waste responsibly, keeping your yard clean
              while maintaining efficient collection routes.
            </p>
            <p>
              We also offer optional eco-friendly deodorizing treatment to help neutralize odors
              naturally without harsh chemicals.
            </p>
          </div>

          {/* Expandable Eco Impact Section */}
          <div className="mt-12">
            <details className="group">
              <summary className="flex items-center justify-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors max-w-md mx-auto">
                <Leaf className="size-5 text-slate-600 group-open:text-accent transition-colors" />
                <span className="text-slate-700 font-medium group-open:text-accent">
                  Learn about our environmental impact
                </span>
                <svg
                  className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="mt-6 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200/50 rounded-2xl p-8 shadow-soft">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-emerald-800 mb-2">
                      Supporting Local Sustainability
                    </h3>
                    <p className="text-emerald-700">
                      Premium diversion options help fund local composting programs and reduce landfill waste
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl mb-3">
                        <Recycle className="size-6 text-emerald-600" />
                      </div>
                      <div className="text-lg font-bold text-emerald-800">847 lbs</div>
                      <div className="text-sm text-emerald-700">Waste diverted from landfills</div>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-100 rounded-xl mb-3">
                        <Wind className="size-6 text-sky-600" />
                      </div>
                      <div className="text-lg font-bold text-sky-800">403 ft³</div>
                      <div className="text-sm text-sky-700">Methane emissions avoided</div>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-xl mb-3">
                        <TrendingUp className="size-6 text-amber-600" />
                      </div>
                      <div className="text-lg font-bold text-amber-800">592 lbs</div>
                      <div className="text-sm text-amber-700">Nutrient-rich compost created</div>
                    </div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4 border border-emerald-200/30">
                    <p className="text-sm text-emerald-800 text-center leading-relaxed">
                      <strong>Premium Options:</strong> Choose 25%, 50%, or 100% diversion to support
                      local composting initiatives. These options help fund program expansion while
                      providing enhanced environmental impact tracking through your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Service Area Coverage */}
        <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl border border-slate-200/50 p-8 shadow-soft">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-800 mb-3">
              Service Area Coverage
            </h3>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Professional service across key Twin Cities communities
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-3">
                <span className="text-2xl">🏠</span>
              </div>
              <h4 className="font-bold text-slate-800">Minneapolis</h4>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-3">
                <span className="text-2xl">🏘️</span>
              </div>
              <h4 className="font-bold text-slate-800">Richfield</h4>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-3">
                <span className="text-2xl">🌳</span>
              </div>
              <h4 className="font-bold text-slate-800">Edina</h4>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-3">
                <span className="text-2xl">🏙️</span>
              </div>
              <h4 className="font-bold text-slate-800">Bloomington</h4>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-3">
                <span className="text-2xl">🌾</span>
              </div>
              <h4 className="font-bold text-slate-800">St. Cloud</h4>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/50">
            <div className="text-center">
              <p className="text-sm text-slate-600">
                <strong>Service Options:</strong> Weekly, bi-weekly, or twice-weekly pickup with biodegradable bags included.
                Eco-friendly deodorizing available as an optional add-on.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
