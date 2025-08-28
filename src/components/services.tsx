import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, SprayCan, PawPrint, Recycle, Shield, Clock } from "lucide-react";

export default function Services() {
  return (
    <section id="services" className="container py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-ink mb-4">Our Services</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Residential weekly/bi-weekly scooping, one-time cleans, and add-ons. Commercial / HOA on request.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
          <CardHeader className="pb-4">
            <div className="size-12 bg-brand-100 rounded-xl flex items-center justify-center mb-3">
              <PawPrint className="size-6 text-brand-600" />
            </div>
            <CardTitle className="text-xl">Weekly Scoop</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-600">
            <p className="mb-3">Scheduled cleanup 1x/week (or 2x). Thorough corner-to-corner scan, double-bagging, gate-check, photo-logged pick-ups (for insights).</p>
            <div className="flex items-center gap-2 text-sm text-brand-600 font-medium">
              <Shield className="size-4" />
              <span>Most Popular</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
          <CardHeader className="pb-4">
            <div className="size-12 bg-brand-100 rounded-xl flex items-center justify-center mb-3">
              <SprayCan className="size-6 text-brand-600" />
            </div>
            <CardTitle className="text-xl">Deodorize & Sanitize</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-600">
            <p className="mb-3">Pet-safe enzymatic spray to neutralize odors and reduce pathogens. Great for families with kids or after GI upset.</p>
            <div className="flex items-center gap-2 text-sm text-brand-600 font-medium">
              <Clock className="size-4" />
              <span>Add-on service</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
          <CardHeader className="pb-4">
            <div className="size-12 bg-brand-100 rounded-xl flex items-center justify-center mb-3">
              <Recycle className="size-6 text-brand-600" />
            </div>
            <CardTitle className="text-xl">Eco Compost Pilot</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-600">
            <p className="mb-3">We divert waste from landfills whenever possible via composting/conditioning pilots and track your methane offset.</p>
            <div className="flex items-center gap-2 text-sm text-brand-600 font-medium">
              <Leaf className="size-4" />
              <span>Eco-friendly</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Removed single showcase; moved images to carousel section */}

      {/* Service guarantees */}
      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-brand-200 p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="size-6 text-brand-600" />
            <h3 className="text-lg font-bold text-ink">100% Satisfaction Guaranteed</h3>
          </div>
          <p className="text-slate-600 text-sm">
            Not happy with your first service? We'll make it right or you don't pay. No questions asked.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-200 p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="size-6 text-brand-600" />
            <h3 className="text-lg font-bold text-ink">Reliable Scheduling</h3>
          </div>
          <p className="text-slate-600 text-sm">
            We arrive on time, every time. Weather delays are rare, but you'll get text updates and rescheduling priority.
          </p>
        </div>
      </div>
    </section>
  );
}

