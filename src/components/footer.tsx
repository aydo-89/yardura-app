import { getPublicCities } from '@/lib/cityData';
import { ArrowRight } from 'lucide-react';

export default function Footer() {
  const cities = getPublicCities();
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50 mt-24 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%237BB369%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M0%200h80v80H0V0zm20%2020v40h40V20H20zm20%2035a15%2015%200%201%201%200-30%2015%2015%200%200%201%200%2030z%22/%3E%3C/g%3E%3C/svg%3E')]" />
      </div>
      <div className="container py-16 text-slate-300 relative z-10">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <img
                src="/yeller_icon_centered.png"
                alt="Yeller logo"
                className="h-12 w-12 rounded-xl shadow-lg object-cover bg-white transform scale-125"
              />
              <div>
                <div className="font-black text-3xl text-white">Yeller</div>
                <div className="text-slate-400 flex items-center gap-2">
                  <span>by Yardura</span>
                  <img
                    src="/yardura-logo.png"
                    alt="Yardura"
                    className="h-5 w-5 rounded-sm object-contain bg-white/10 p-0.5"
                  />
                </div>
              </div>
            </div>
            <div className="mb-6 max-w-md">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/60 border border-slate-700/40 shadow-sm backdrop-blur-sm">
                <span className="text-slate-300">Achieve</span>
                <span className="text-green-400 font-bold">Lawn<span className="text-slate-200 font-semibold">gevity</span></span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-200 font-semibold">Clean Yards</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-200 font-semibold">Healthy Pets</span>
              </div>
              <p className="mt-3 text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-200">Yeller's mission:</span>{' '}
                Deliver spotless yards and actionable pet wellness insights through premium, eco‑friendly service—making outdoor life cleaner, healthier, and effortless. The world's first pet waste monitoring service.
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
              <div className="w-3 h-3 bg-green-700 rounded-full animate-pulse shadow-sm"></div>
              <span className="font-medium text-slate-300">Mon–Fri 8am–6pm • Sat 10am–4pm</span>
            </div>
          </div>

          <div>
            <div className="font-bold text-white mb-6 text-lg">Twin Cities Coverage</div>
            <div className="space-y-3">
              {cities.slice(0, 5).map((city) => (
                <p key={city.name}>
                  <a
                    href={`/city/${city.name}`}
                    className="text-slate-400 hover:text-green-700 transition-all duration-300 hover:translate-x-1 inline-block font-medium"
                  >
                    {city.displayName}
                  </a>
                </p>
              ))}
              <p className="mt-4 pt-2 border-t border-slate-700/50">
                <a
                  href="/city"
                  className="text-teal-700 hover:text-teal-700/80 transition-all duration-300 font-bold inline-flex items-center gap-2 hover:translate-x-1"
                >
                  View All Cities
                  <ArrowRight className="size-4" />
                </a>
              </p>
            </div>
          </div>

          <div>
            <div className="font-bold text-white mb-6 text-lg">Services</div>
            <div className="space-y-3">
              <p>
                <a href="#services" className="text-slate-400 hover:text-teal-700 transition-all duration-300 hover:translate-x-1 inline-block font-medium">
                  Dog Waste Removal
                </a>
              </p>
              <p>
                <a href="#pricing" className="text-slate-400 hover:text-teal-700 transition-all duration-300 hover:translate-x-1 inline-block font-medium">
                  Pricing Plans
                </a>
              </p>
              <p>
                <a href="#insights" className="text-slate-400 hover:text-teal-700 transition-all duration-300 hover:translate-x-1 inline-block font-medium">
                  Health Insights
                </a>
              </p>
              <p>
                <a href="#eco" className="text-slate-400 hover:text-teal-700 transition-all duration-300 hover:translate-x-1 inline-block font-medium">
                  Eco Impact
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-700/50 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-sm text-slate-400">
              <span className="font-medium">© {new Date().getFullYear()} Yardura. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <a href="/privacy" className="hover:text-teal-700 transition-colors font-medium">Privacy Policy</a>
                <a href="/terms" className="hover:text-teal-700 transition-colors font-medium">Terms of Service</a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:+18889159273"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-700 hover:to-green-600 text-white rounded-2xl font-bold transition-all duration-300 hover:scale-105 shadow-lg"
              >
                📞 1-888-915-YARD
              </a>
              <a
                href="/quote?businessId=yardura"
                className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Get Quote
              </a>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 pt-6 border-t border-slate-700/30">
            <p className="text-xs text-slate-500 text-center max-w-2xl mx-auto leading-relaxed">
              Insights are informational only and not veterinary advice. Yardura does not diagnose or treat disease.
              Always consult with your veterinarian for professional medical advice regarding your pet's health.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
