import { Leaf, Recycle, Wind, TrendingUp } from "lucide-react";

export default function Eco() {
  return (
    <section id="eco" className="bg-gradient-to-b from-brand-50 to-white border-t border-b">
      <div className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-ink flex items-center justify-center gap-2 mb-4">
            <Leaf className="text-brand-600 size-8"/>
            Our Eco Impact
          </h2>
          <p className="text-slate-700 max-w-3xl mx-auto">
            Every dog produces ~250+ lbs of waste per year. Instead of landfills, we're pioneering eco-friendly disposal
            that reduces methane emissions and creates nutrient-rich compost. Join us in making a difference!
          </p>
        </div>

        {/* Removed eco bin showcase per branding direction */}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Waste Diverted: subtle sage gradient */}
          <div className="relative p-8 rounded-3xl border bg-gradient-to-br from-[#F6F7EC] to-[#EFF4DB] shadow-soft border-[#DDE5C2]">
            <div className="absolute top-4 right-4">
              <Recycle className="size-6 text-lime-700"/>
            </div>
            <div className="text-2xl font-extrabold text-brand-800">Waste Diverted</div>
            <div className="text-5xl font-extrabold mt-2 text-brand-700">847 lb</div>
            <p className="text-sm text-brand-700 mt-3 font-medium">🌱 From landfills to compost</p>
            <div className="mt-4 bg-[#EAD9B6] rounded-full h-2">
              <div className="bg-[#8AA648] h-2 rounded-full" style={{width: '32%'}}></div>
            </div>
          </div>

          {/* Methane Avoided: cool slate → pale teal gradient */}
          <div className="relative p-8 rounded-3xl border bg-gradient-to-br from-[#EFF3F6] to-[#E6F6F6] shadow-soft border-[#C9D6E2]">
            <div className="absolute top-4 right-4">
              <Wind className="size-6 text-cyan-700"/>
            </div>
            <div className="text-2xl font-extrabold text-brand-800">Methane Avoided</div>
            <div className="text-5xl font-extrabold mt-2 text-brand-700">403 ft³</div>
            <p className="text-sm text-brand-700 mt-3 font-medium">💨 Reduced greenhouse gas</p>
            <div className="mt-4 bg-[#D9E7EE] rounded-full h-2">
              <div className="bg-[#0EA5A4] h-2 rounded-full" style={{width: '28%'}}></div>
            </div>
          </div>

          <div className="relative p-8 rounded-3xl border bg-gradient-to-br from-[#F6F2EB] to-[#FDF8F4] shadow-soft border-brand-200">
            <div className="absolute top-4 right-4">
              <TrendingUp className="size-6 text-amber-600"/>
            </div>
            <div className="text-2xl font-extrabold text-brand-800">Compost Created</div>
            <div className="text-5xl font-extrabold mt-2 text-brand-700">592 lb</div>
            <p className="text-sm text-brand-700 mt-3 font-medium">🌿 Nutrient-rich soil amendment</p>
            <div className="mt-4 bg-amber-200 rounded-full h-2">
              <div className="bg-amber-600 h-2 rounded-full" style={{width: '24%'}}></div>
            </div>
          </div>
        </div>

        {/* Community impact section */}
        <div className="bg-white rounded-3xl border border-brand-200 p-8 shadow-soft">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-extrabold text-ink mb-2">Join Our Growing Community Impact</h3>
            <p className="text-slate-600">Together, we're building a cleaner, greener Twin Cities</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-2">🌳</div>
              <div className="text-2xl font-bold text-brand-800 mb-2">4 Service Areas</div>
              <p className="text-slate-600">South Minneapolis, Richfield, Edina, Bloomington</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🏘️</div>
              <div className="text-2xl font-bold text-brand-800 mb-2">Early Adopters</div>
              <p className="text-slate-600">Families ready to join our eco-friendly mission</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

