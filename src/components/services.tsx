import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, SprayCan, PawPrint, Recycle, Shield, Clock } from 'lucide-react';
import Reveal from '@/components/Reveal';

export default function Services() {
  return (
    <section id="services" className="section-modern gradient-section-cool">
      <div className="container">
        <div className="text-center mb-16">
          <Reveal>
            <div className="relative">
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                Our{' '}
                <span className="relative">
                  Services
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-700 via-green-600 to-white rounded-full"></div>
                </span>
              </h2>
            </div>
            <p className="text-responsive-lg text-slate-600 max-w-3xl mx-auto leading-relaxed text-balance">
              Residential weekly/bi-weekly scooping, one-time cleans, and premium add-ons.
              Commercial / HOA services available upon request.
            </p>
          </Reveal>
          
          {/* Service Visual */}
          <Reveal delay={0.2}>
            <div className="relative rounded-2xl overflow-hidden mt-16 shadow-xl max-w-2xl mx-auto">
              <img
                src="/reliable_service1.png"
                alt="Professional service arrival"
                className="w-full h-56 object-cover"
                style={{ objectPosition: '70% center' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 text-white">
                <h4 className="font-semibold">Professional Service</h4>
                <p className="text-sm opacity-90">Reliable, friendly, dependable</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="grid-cards">
          <Reveal delay={0.1}>
            <Card className="card-modern interactive-hover h-full">
              <CardHeader className="pb-6">
                <div className="size-16 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <PawPrint className="size-8 text-green-700" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Weekly Scoop</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-600">
                <p className="mb-4 text-sm leading-relaxed">
                  Scheduled cleanup 1x/week (or 2x). Thorough corner-to-corner scan, double-bagging,
                  gate-check, photo-logged pick-ups (for insights).
                </p>
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100/50 border border-green-700/20 rounded-xl">
                  <Shield className="size-4 text-green-700" />
                  <span className="text-sm font-semibold text-green-700">Most Popular</span>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.2}>
            <Card className="card-modern interactive-hover h-full">
              <CardHeader className="pb-6">
                <div className="size-16 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <SprayCan className="size-8 text-green-700" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Deodorize & Sanitize</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-600">
                <p className="mb-4 text-sm leading-relaxed">
                  Professional-grade deodorizing treatment. Choose frequency: first visit only ($25),
                  each visit ($25), or every other visit ($12.50).
                </p>
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-100/50 to-green-200/30 border border-green-700/20 rounded-xl">
                  <Clock className="size-4 text-green-700" />
                  <span className="text-sm font-semibold text-green-700">Add-on service: $12.50-$25</span>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.3}>
            <Card className="card-modern interactive-hover h-full">
              <CardHeader className="pb-6">
                <div className="size-16 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <Recycle className="size-8 text-green-700" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Premium Waste Diversion</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-600">
                <p className="mb-4 text-sm leading-relaxed">
                  Go beyond basic eco-friendly disposal. Choose 25% (+$4/visit), 50% (+$6/visit), or
                  100% (+$10/visit) landfill diversion with dashboard impact tracking.
                </p>
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-100/50 to-green-200/30 border border-green-700/20 rounded-xl">
                  <Leaf className="size-4 text-green-700" />
                  <span className="text-sm font-semibold text-green-700">Add-on service: $4-$10</span>
                </div>
              </CardContent>
            </Card>
          </Reveal>

      </div>

      {/* Removed single showcase; moved images to carousel section */}

        {/* Service guarantees */}
        <div className="mt-20 grid md:grid-cols-2 gap-8">
          <Reveal delay={0.5}>
            <div className="card-modern interactive-hover p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-14 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl flex items-center justify-center shadow-sm">
                  <Shield className="size-7 text-green-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">100% Satisfaction Guaranteed</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Not happy with your first service? We'll make it right or you don't pay. No questions
                asked. Your satisfaction is our top priority.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.6}>
            <div className="card-modern interactive-hover p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-14 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl flex items-center justify-center shadow-sm">
                  <Clock className="size-7 text-green-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Reliable Scheduling</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                We arrive on time, every time. Weather delays are rare, but you'll get text updates
                and rescheduling priority when needed.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
