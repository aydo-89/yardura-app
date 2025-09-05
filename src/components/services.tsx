import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, SprayCan, PawPrint, Recycle, Shield, Clock } from 'lucide-react';
import Reveal from '@/components/Reveal';

export default function Services() {
  return (
    <section id="services" className="container py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-ink mb-4">Our Services</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Residential weekly/bi-weekly scooping, one-time cleans, and add-ons. Commercial / HOA on
          request.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Reveal delay={0.1}>
          <Card className="rounded-2xl border border-accent/20 bg-gradient-to-br from-white to-accent-soft/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <CardHeader className="pb-4">
              <div className="size-12 bg-accent-soft rounded-xl flex items-center justify-center mb-3">
                <PawPrint className="size-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Weekly Scoop</CardTitle>
            </CardHeader>
            <CardContent className="text-muted">
              <p className="mb-3">
                Scheduled cleanup 1x/week (or 2x). Thorough corner-to-corner scan, double-bagging,
                gate-check, photo-logged pick-ups (for insights).
              </p>
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <Shield className="size-4" />
                <span>Most Popular</span>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.2}>
          <Card className="rounded-2xl border border-accent/20 bg-gradient-to-br from-white to-accent-soft/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <CardHeader className="pb-4">
              <div className="size-12 bg-accent-soft rounded-xl flex items-center justify-center mb-3">
                <SprayCan className="size-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Deodorize & Sanitize</CardTitle>
            </CardHeader>
            <CardContent className="text-muted">
              <p className="mb-3">
                Professional-grade deodorizing treatment. Choose frequency: first visit only ($25),
                each visit ($25), or every other visit ($12.50).
              </p>
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <Clock className="size-4" />
                <span>Add-on service: $12.50-$25</span>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.3}>
          <Card className="rounded-2xl border border-accent/20 bg-gradient-to-br from-white to-accent-soft/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <CardHeader className="pb-4">
              <div className="size-12 bg-accent-soft rounded-xl flex items-center justify-center mb-3">
                <Recycle className="size-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Premium Waste Diversion</CardTitle>
            </CardHeader>
            <CardContent className="text-muted">
              <p className="mb-3">
                Go beyond basic eco-friendly disposal. Choose 25% (+$4/visit), 50% (+$6/visit), or
                100% (+$10/visit) landfill diversion with dashboard impact tracking.
              </p>
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <Leaf className="size-4" />
                <span>Add-on service: $4-$10</span>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.4}>
          <Card className="rounded-2xl border border-accent/20 bg-gradient-to-br from-white to-accent-soft/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <CardHeader className="pb-4">
              <div className="size-12 bg-accent-soft rounded-xl flex items-center justify-center mb-3">
                <SprayCan className="size-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Spray Deck/Patio</CardTitle>
            </CardHeader>
            <CardContent className="text-muted">
              <p className="mb-3">
                Spray deck/patio with eco-friendly deodorizer for complete odor elimination. Choose
                frequency options for comprehensive odor control.
              </p>
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <Clock className="size-4" />
                <span>Add-on service: $12</span>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Removed single showcase; moved images to carousel section */}

      {/* Service guarantees */}
      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <Reveal delay={0.5}>
          <div className="bg-gradient-to-br from-white to-accent-soft/20 rounded-2xl border border-accent/20 p-6 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-accent-soft rounded-xl flex items-center justify-center">
                <Shield className="size-5 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-ink">100% Satisfaction Guaranteed</h3>
            </div>
            <p className="text-muted text-sm">
              Not happy with your first service? We'll make it right or you don't pay. No questions
              asked.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.6}>
          <div className="bg-gradient-to-br from-white to-accent-soft/20 rounded-2xl border border-accent/20 p-6 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 bg-accent-soft rounded-xl flex items-center justify-center">
                <Clock className="size-5 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-ink">Reliable Scheduling</h3>
            </div>
            <p className="text-muted text-sm">
              We arrive on time, every time. Weather delays are rare, but you'll get text updates
              and rescheduling priority.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
