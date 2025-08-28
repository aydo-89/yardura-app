"use client";

import { Leaf, Shield, ShieldCheck, Sparkles, Star, MapPin, Users } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-brand-50 via-white to-brand-100 border-b relative overflow-hidden">
      {/* Enhanced background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%237BB369%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M20%2020c0-5.5-4.5-10-10-10s-10%204.5-10%2010%204.5%2010%2010%2010%2010-4.5%2010-10zm-2%200c0%204.4-3.6%208-8%208s-8-3.6-8-8%203.6-8%208-8%208%203.6%208%208z%22/%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>

      {/* Branded background overlay */}
      {/* Branded background moved to quote section */}

      {/* Floating elements for visual interest */}
      <div className="absolute top-10 right-10 w-20 h-20 bg-brand-200 rounded-full opacity-30 animate-pulse"></div>
      <div className="absolute bottom-20 left-10 w-16 h-16 bg-brand-300 rounded-full opacity-20 animate-bounce" style={{animationDuration: '3s'}}></div>

      <div className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center relative z-10">
        <div>
          {/* Trust signals - realistic messaging */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 text-brand-600">
              <Shield className="size-4" />
            </div>
            <span className="text-sm text-slate-600">Licensed • Insured • Eco-friendly • Twin Cities Local</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight md:leading-[1.25] text-ink">
            Poop-free yard.{' '}
            <span className="inline-flex items-center gap-2 align-middle">
              <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent pb-1">Smarter Insights</span>
            </span>
            . Less landfill.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Yardura is the Twin Cities' tech-enabled, eco-friendly dog waste removal service.
            Weekly scooping at market pricing — plus smart trend alerts on your pup's poop health:
            <span className="text-brand-700 font-medium"> Color, Consistency, Content (3 C's) and more.</span>  <span className="inline-flex items-center whitespace-nowrap align-middle px-2 py-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800 border border-brand-300">Coming soon</span>
          </p>

          {/* Service area highlight */}
          <div className="mt-4 flex items-center gap-2 text-brand-700">
            <MapPin className="size-4" />
            <span className="text-sm font-medium">Serving South Minneapolis, Richfield, Edina, Bloomington. Coming soon to St. Cloud!</span>
          </div>

          {/* Enhanced CTAs with urgency */}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#quote" className="px-6 py-3 rounded-xl bg-ink text-white shadow-soft hover:bg-brand-800 font-semibold transition-all duration-200 hover:scale-105">
              Get My Quote
            </a>
            <a href="#how" className="px-6 py-3 rounded-xl border border-brand-300 hover:bg-brand-100 font-semibold transition-all duration-200">
              How it works
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-600"/>
              <span>No contracts</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600"/>
              <span>Text alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="size-4 text-brand-600"/>
              <span>Eco composting</span>
            </div>
          </div>

          {/* Customer testimonial preview */}
          <div className="mt-6 p-4 bg-white/70 rounded-xl border border-brand-200">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-brand-100 rounded-full flex items-center justify-center">
                <Users className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-sm text-slate-700 italic">
                  "The mission of using data and insights to help dog owners is really cool. Clean yard every week and I love supporting an eco-friendly service that keeps waste out of landfills."
                </p>
                <p className="text-xs text-slate-500 mt-1">- Sarah M., Richfield</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border shadow-soft p-4 bg-white relative overflow-hidden">
            <img
              src="/modern_yard.png"
              alt="Modern clean yard with lush green grass and beautiful landscaping"
              className="rounded-xl w-full h-auto object-cover"
              style={{ maxHeight: '400px' }}
            />
          </div>

          {/* Enhanced stats card */}
          <div className="absolute -bottom-5 -left-5 bg-white rounded-xl border shadow-soft p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-800">250+ lbs</div>
              <div className="text-xs text-slate-600">kept out of landfill per dog per year</div>
              <div className="mt-2 text-xs text-brand-600 font-medium">Join our eco mission! 🌱</div>
            </div>
          </div>

          {/* Service guarantee badge */}
          <div className="absolute -top-3 -right-3 bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            100% Satisfaction Guaranteed
          </div>
        </div>
      </div>

                        {/* Bottom trust bar */}
                  <div className="bg-white/80 border-t">
                    <div className="container py-4">
                      <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                        <span>🛡️ Licensed & insured</span>
                        <span>•</span>
                        <span>💚 Eco-friendly service</span>
                        <span>•</span>
                        <span>📱 Smart health insights (coming soon)</span>
                        <span>•</span>
                        <span>🏠 Twin Cities local</span>
                      </div>
                    </div>
                  </div>
    </section>
  );
}

