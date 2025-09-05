'use client';

import { Leaf, Recycle, Wind, TrendingUp } from 'lucide-react';
import { useInViewCountUp } from '@/hooks/useInViewCountUp';
import { useRef } from 'react';

export default function Eco() {
  const wasteRef = useRef<HTMLDivElement>(null);
  const methaneRef = useRef<HTMLDivElement>(null);
  const compostRef = useRef<HTMLDivElement>(null);

  const wasteCount = useInViewCountUp(wasteRef, { end: 847, duration: 2000 });
  const methaneCount = useInViewCountUp(methaneRef, { end: 403, duration: 2000 });
  const compostCount = useInViewCountUp(compostRef, { end: 592, duration: 2000 });

  return (
    <section id="eco" className="bg-gradient-to-b from-accent-soft/30 to-white border-t border-b">
      <div className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-ink flex items-center justify-center gap-2 mb-4">
            <Leaf className="text-brand-600 size-8" />
            Our Eco Impact
          </h2>
          <p className="text-slate-700 max-w-3xl mx-auto">
            Every dog produces ~250+ lbs of waste per year. By default, we leave waste in your bin
            using biodegradable plastic bags and eco-friendly deodorizing practices. Premium
            diversion options (25%, 50%, or 100%) help fund expansion of our eco-program while
            providing maximum environmental impact.
          </p>
        </div>

        {/* Removed eco bin showcase per branding direction */}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Waste Diverted: emerald/sage theme */}
          <div
            ref={wasteRef}
            className="relative p-8 rounded-3xl border bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-white shadow-soft border-emerald-200/50 hover:shadow-lg transition-all duration-500 hover:scale-[1.02]"
          >
            <div className="absolute top-4 right-4">
              <Recycle className="size-6 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-ink">Waste Diverted</div>
            <div className="text-5xl font-extrabold mt-2 text-emerald-700">{wasteCount} lb</div>
            <p className="text-sm text-emerald-700 mt-3 font-medium">
              🌱 From landfills to compost
            </p>
            <div className="mt-4 bg-emerald-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full transition-all duration-2000 ease-out"
                style={{ width: '32%' }}
              ></div>
            </div>
          </div>

          {/* Methane Avoided: sky blue theme */}
          <div
            ref={methaneRef}
            className="relative p-8 rounded-3xl border bg-gradient-to-br from-sky-50 via-sky-50/80 to-white shadow-soft border-sky-200/50 hover:shadow-lg transition-all duration-500 hover:scale-[1.02]"
          >
            <div className="absolute top-4 right-4">
              <Wind className="size-6 text-sky-600" />
            </div>
            <div className="text-2xl font-extrabold text-ink">Methane Avoided</div>
            <div className="text-5xl font-extrabold mt-2 text-sky-700">{methaneCount} ft³</div>
            <p className="text-sm text-sky-700 mt-3 font-medium">💨 Reduced greenhouse gas</p>
            <div className="mt-4 bg-sky-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-400 to-sky-600 h-2 rounded-full transition-all duration-2000 ease-out"
                style={{ width: '28%' }}
              ></div>
            </div>
          </div>

          {/* Compost Created: amber/orange theme */}
          <div
            ref={compostRef}
            className="relative p-8 rounded-3xl border bg-gradient-to-br from-amber-50 via-amber-50/80 to-white shadow-soft border-amber-200/50 hover:shadow-lg transition-all duration-500 hover:scale-[1.02]"
          >
            <div className="absolute top-4 right-4">
              <TrendingUp className="size-6 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-ink">Compost Created</div>
            <div className="text-5xl font-extrabold mt-2 text-amber-700">{compostCount} lb</div>
            <p className="text-sm text-amber-700 mt-3 font-medium">
              🌿 Nutrient-rich soil amendment
            </p>
            <div className="mt-4 bg-amber-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full transition-all duration-2000 ease-out"
                style={{ width: '24%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Community impact section */}
        <div className="bg-white rounded-3xl border border-accent/20 p-8 shadow-soft">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-extrabold text-ink mb-2">
              Join Our Growing Community Impact
            </h3>
            <p className="text-muted">Together, we're building a cleaner, greener Twin Cities</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-2">🌳</div>
              <div className="text-2xl font-bold text-accent mb-2">5 Service Areas</div>
              <p className="text-muted">
                South Minneapolis, Richfield, Edina, Bloomington, St. Cloud
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🏘️</div>
              <div className="text-2xl font-bold text-accent mb-2">Early Adopters</div>
              <p className="text-muted">Families ready to join our eco-friendly mission</p>
            </div>
          </div>

          {/* Fine print */}
          <div className="mt-6 pt-6 border-t border-accent/10">
            <p className="text-xs text-muted text-center mb-2">
              Diversion where permitted; pilots and conditioning methods vary by jurisdiction.
            </p>
            <p className="text-xs text-muted text-center">
              💚 Our core service always includes biodegradable bags and eco-friendly deodorizing.
              Premium diversion options (+$4-$10/visit for 25%, 50%, or 100%) fund expansion of our
              eco-program. All diversion options provide dashboard tracking of your environmental
              impact.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
