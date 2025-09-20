"use client";

import { Leaf, Recycle, Wind, TrendingUp, MapPin } from "lucide-react";

export default function Eco() {
  return (
    <section id="eco" className="section-modern gradient-section-warm">
      <div className="container">
        {/* Modern Section Header */}
        <div className="text-center mb-20">
          <div className="relative">
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
              Smart &{" "}
              <span className="relative">
                Responsible
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-700 via-green-600 to-white rounded-full"></div>
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Efficient waste management that's good for your yard and the
              environment
            </p>
          </div>

          {/* Environmental Impact Visual */}
          <div className="relative rounded-2xl overflow-hidden mt-16 mb-12 shadow-xl max-w-4xl mx-auto">
            <img
              src="/enviroment.png"
              alt="Small-scale composting operation transforming pet waste into nutrient-rich compost"
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-6 text-white">
              <h3 className="font-bold text-lg">Eco-Friendly Impact</h3>
              <p className="text-sm opacity-90">
                Sustainable practices for a cleaner environment
              </p>
            </div>
          </div>
          {/* Enhanced Service Description */}
          <div className="grid md:grid-cols-2 gap-16 mt-16">
            {/* Left Column - Service Details */}
            <div className="space-y-8">
              <div className="text-slate-700 max-w-xl text-responsive-lg leading-relaxed space-y-6">
                <p className="text-balance">
                  Your dog's waste doesn't have to be a neighborhood problem. We
                  transform that{" "}
                  <span className="font-bold text-gradient">
                    250 lbs per year
                  </span>{" "}
                  into nutrient-rich compost—keeping your yard pristine while
                  contributing to a cleaner environment and supporting local
                  sustainable initiatives.
                </p>
                <p className="text-balance">
                  Add our natural deodorizing treatment to eliminate odors and
                  create a fresher, more enjoyable outdoor space for your entire
                  family to relax and play.
                </p>
              </div>

              {/* Service Frequency Options */}
              <div className="card-modern p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-xl">
                    <span className="text-xl">📅</span>
                  </div>
                  Service Frequency Options
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl border border-green-700/20 shadow-sm">
                    <div className="font-bold text-green-700 text-lg mb-2">
                      Weekly
                    </div>
                    <div className="text-sm text-slate-600 font-medium">
                      Most popular
                    </div>
                  </div>
                  <div className="text-center p-4 bg-white/80 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="font-bold text-slate-800 text-lg mb-2">
                      Bi-weekly
                    </div>
                    <div className="text-sm text-slate-600 font-medium">
                      Every 2 weeks
                    </div>
                  </div>
                  <div className="text-center p-4 bg-white/80 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="font-bold text-slate-800 text-lg mb-2">
                      2x Weekly
                    </div>
                    <div className="text-sm text-slate-600 font-medium">
                      2x per week
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Environmental Impact */}
            <div className="space-y-6">
              {/* Header Card */}
              <div className="card-modern p-6 bg-gradient-to-br from-emerald-50/80 via-white/90 to-emerald-50/60">
                <div className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl shadow-sm flex-shrink-0">
                    <Leaf className="size-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-emerald-800 mb-2">
                      Supporting Local Sustainability
                    </h3>
                    <p className="text-emerald-700 text-sm leading-relaxed">
                      Premium diversion options help fund local composting
                      programs and reduce landfill waste
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-emerald-200/30 shadow-card interactive-hover">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl mb-2 shadow-sm">
                    <Recycle className="size-5 text-emerald-600" />
                  </div>
                  <div className="text-gradient text-lg font-black mb-1">
                    847 lbs
                  </div>
                  <div className="text-xs text-emerald-700 font-medium">
                    Diverted
                  </div>
                </div>

                <div className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-teal-200/30 shadow-card interactive-hover">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-teal-100/40 to-teal-200/30 rounded-xl mb-2 shadow-sm">
                    <Wind className="size-5 text-teal-700" />
                  </div>
                  <div className="text-gradient text-lg font-black mb-1">
                    403 ft³
                  </div>
                  <div className="text-xs text-teal-700 font-medium">
                    Emissions avoided
                  </div>
                </div>

                <div className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-cyan-200/30 shadow-card interactive-hover">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-cyan-100/40 to-cyan-200/30 rounded-xl mb-2 shadow-sm">
                    <TrendingUp className="size-5 text-cyan-700" />
                  </div>
                  <div className="text-gradient text-lg font-black mb-1">
                    592 lbs
                  </div>
                  <div className="text-xs text-cyan-700 font-medium">
                    Compost created
                  </div>
                </div>
              </div>

              {/* Premium Options */}
              <div className="card-modern p-6 bg-gradient-to-br from-emerald-50/90 via-green-50/50 to-emerald-100/70 border-emerald-200/30">
                <h4 className="text-lg font-bold text-emerald-800 mb-3">
                  Premium Diversion Options
                </h4>
                <p className="text-sm text-emerald-700 leading-relaxed">
                  Choose 25%, 50%, or 100% diversion to support local composting
                  initiatives and track your environmental impact.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Area Coverage */}
        <div className="card-modern p-10 mt-16">
          <div className="text-center mb-12">
            <div className="relative">
              <h3 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                Twin Cities{" "}
                <span className="relative">
                  Coverage
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-700 via-green-600 to-white rounded-full"></div>
                </span>
              </h3>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Professional service across key Minneapolis metro communities
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="text-center p-4 rounded-2xl hover:bg-green-50/80 transition-all duration-300 interactive-hover">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-2xl mb-4 shadow-sm">
                <MapPin className="w-8 h-8 text-emerald-700" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">Minneapolis</h4>
            </div>
            <div className="text-center p-4 rounded-2xl hover:bg-green-50/80 transition-all duration-300 interactive-hover">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-700/20 to-green-600/15 rounded-2xl mb-4 shadow-sm">
                <MapPin className="w-8 h-8 text-green-700" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">Richfield</h4>
            </div>
            <div className="text-center p-4 rounded-2xl hover:bg-green-50/80 transition-all duration-300 interactive-hover">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500/30 to-teal-600/20 rounded-2xl mb-4 shadow-sm">
                <MapPin className="w-8 h-8 text-teal-700" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">Edina</h4>
            </div>
            <div className="text-center p-4 rounded-2xl hover:bg-green-50/80 transition-all duration-300 interactive-hover">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 rounded-2xl mb-4 shadow-sm">
                <MapPin className="w-8 h-8 text-cyan-700" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">Bloomington</h4>
            </div>
            <div className="text-center p-4 rounded-2xl hover:bg-green-50/80 transition-all duration-300 interactive-hover">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-700/20 to-green-600/15 rounded-2xl mb-4 shadow-sm">
                <MapPin className="w-8 h-8 text-green-700" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">St. Cloud</h4>
            </div>
          </div>

          {/* Enhanced Add-on Options */}
          <div className="mt-12 pt-8 border-t border-green-700/20">
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-br from-teal-50/90 via-green-100/40 to-teal-100/70 rounded-2xl border border-teal-200/30 mb-6 shadow-sm">
                <span className="text-lg">✨</span>
                <span className="text-lg font-bold text-teal-800">
                  Optional Add-ons
                </span>
              </div>
              <p className="text-slate-600 text-lg leading-relaxed max-w-4xl mx-auto text-balance">
                Enhance your service with eco-friendly deodorizing treatment to
                naturally neutralize odors without harsh chemicals. Track your
                environmental impact through your personalized dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
