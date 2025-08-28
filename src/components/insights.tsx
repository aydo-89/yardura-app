import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BarChart3, Brain, Camera } from "lucide-react";

export default function Insights() {
  return (
    <section id="insights" className="bg-gradient-to-b from-[#F3FAF4] via-white to-[#EAF6ED] border-t border-b">
      <div className="container py-16">
        <div className="flex items-start justify-between gap-8 flex-col md:flex-row">
          <div className="md:w-1/2">
            <h2 className="text-3xl font-extrabold text-brand-800">Smart Health Insights <span className="align-middle ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800 border border-brand-300">Coming soon</span></h2>
            <p className="text-slate-700 mt-2">Opt in now so we can collect anonymized stool photos during service. Down the road, your dashboard will unlock trend charts, baselines, and gentle alerts on changes in the <b>3 C’s</b> (Color, Content, Consistency).</p>
            <ul className="mt-4 space-y-2 text-slate-700">
              <li className="flex gap-2"><Camera className="mt-1 size-4"/> Controlled photos & weights captured during pickup</li>
              <li className="flex gap-2"><Brain className="mt-1 size-4"/> AI compares against your dog’s normal to reduce false alarms</li>
              <li className="flex gap-2"><BarChart3 className="mt-1 size-4"/> Frequency tracking – sudden drops flagged</li>
              <li className="flex gap-2"><AlertTriangle className="mt-1 size-4"/> Informational only – not veterinary advice</li>
            </ul>

            {/* Alert types explanation */}
            <div className="mt-6 bg-white rounded-xl border border-brand-200 p-4 shadow-soft">
              <h3 className="text-sm font-semibold text-ink mb-2">What alerts can I expect?</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-[#F1F8E9] rounded-lg p-3 border border-emerald-200">
                  <div className="font-medium text-emerald-800 mb-1">Color</div>
                  <p className="text-slate-700">Flags unusual colors like black (possible blood), bright red (fresh blood), yellow/gray (bile or fat), or white streaks (calcium).</p>
                </div>
                <div className="bg-[#FFF8E1] rounded-lg p-3 border border-amber-200">
                  <div className="font-medium text-amber-800 mb-1">Consistency</div>
                  <p className="text-slate-700">Highlights changes from firm to soft/liquid, pellet-like, greasy, or mucousy textures that persist.</p>
                </div>
                <div className="bg-[#FFF0E6] rounded-lg p-3 border border-orange-200">
                  <div className="font-medium text-orange-800 mb-1">Content</div>
                  <p className="text-slate-700">Looks for visible blood, mucus, worms/parasites, undigested objects (toys, grass, plastic), or foreign material.</p>
                </div>
                <div className="bg-[#E8F5E9] rounded-lg p-3 border border-emerald-200">
                  <div className="font-medium text-emerald-800 mb-1">Frequency</div>
                  <p className="text-slate-700">Notices sudden spikes/drops in daily output relative to your dog’s baseline routine.</p>
                </div>
                <div className="bg-[#E3F2FD] rounded-lg p-3 border border-sky-200">
                  <div className="font-medium text-sky-800 mb-1">Hydration</div>
                  <p className="text-slate-700">Suggests possible dehydration when stools trend dry/chalky or overhydration when persistently loose.</p>
                </div>
                <div className="bg-[#FFF5F5] rounded-lg p-3 border border-rose-200">
                  <div className="font-medium text-rose-800 mb-1">GI Flags</div>
                  <p className="text-slate-700">Clusters of alerts (e.g., soft + mucus + reduced frequency) prompt a gentle “watch closely” suggestion.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">These insights are informational only and not veterinary advice. We’ll always encourage you to consult your vet for concerning patterns.</p>
            </div>
          </div>
          <Card className="md:w-1/2 rounded-2xl border border-brand-200 shadow-soft animate-fade-in">
            <CardHeader>
              <CardTitle>Preview: Your Pup’s Poop Trends</CardTitle>
              <CardDescription>Weekly timeline with color/consistency markers & notes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Mock timeline */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Week 1</span>
                    <span>Week 4</span>
                  </div>
                  <div className="relative h-24 bg-gradient-to-r from-[#F1F8E9] via-white to-[#FFF8E1] rounded-xl p-3 border border-brand-200">
                    {/* Timeline dots */}
                    <div className="absolute top-1/2 left-3 w-3 h-3 bg-green-500 rounded-full -translate-y-1/2 shadow-elevated" title="Normal - Brown, Firm, Mixed"></div>
                    <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-yellow-500 rounded-full shadow-elevated" title="Yellow, Soft, High Plant Matter"></div>
                    <div className="absolute top-2/3 left-2/3 w-3 h-3 bg-green-600 rounded-full -translate-y-1/2 shadow-elevated" title="Normal - Brown, Firm, Mixed"></div>
                    <div className="absolute top-1/2 right-3 w-3 h-3 bg-green-500 rounded-full -translate-y-1/2 shadow-elevated" title="Normal - Brown, Firm, Mixed"></div>
                  </div>
                  {/* Inline badges to show detected flags */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-700">
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-soft">Grass-heavy (Wk 2)</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-soft">Normal baseline</span>
                    <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 shadow-soft">Softer than usual (Wk 2)</span>
                  </div>
                </div>

                {/* Mock health indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-[#F1F8E9] p-3 rounded-xl border border-emerald-200 shadow-soft">
                    <div className="text-xs text-slate-600">Color</div>
                    <div className="text-sm font-semibold text-emerald-700">Normal</div>
                    <div className="w-full bg-emerald-200/70 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                  <div className="bg-[#FFF8E1] p-3 rounded-xl border border-amber-200 shadow-soft">
                    <div className="text-xs text-slate-600">Consistency</div>
                    <div className="text-sm font-semibold text-amber-700">Good</div>
                    <div className="w-full bg-amber-200/70 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full" style={{width: '90%'}}></div>
                    </div>
                  </div>
                  <div className="bg-[#FFF0E6] p-3 rounded-xl border border-orange-200 shadow-soft">
                    <div className="text-xs text-slate-600">Content Flags</div>
                    <div className="text-sm font-semibold text-orange-700">None detected</div>
                    <div className="w-full bg-orange-200/70 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full" style={{width: '5%'}}></div>
                    </div>
                  </div>
                  <div className="bg-[#E3F2FD] p-3 rounded-xl border border-sky-200 shadow-soft">
                    <div className="text-xs text-slate-600">Frequency</div>
                    <div className="text-sm font-semibold text-sky-700">Stable</div>
                    <div className="w-full bg-sky-200/70 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-500 to-sky-600 h-2 rounded-full" style={{width: '80%'}}></div>
                    </div>
                  </div>
                </div>

                {/* Recent alerts */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-amber-800">Alert: Softer than usual</div>
                      <div className="text-xs text-amber-700">Week 2 showed softer consistency. This is usually normal but we'll monitor.</div>
                    </div>
                  </div>
                </div>

                {/* Legend (unified brand tones) */}
                <div className="text-[11px] text-slate-600 text-center">
                  Legend: <span className="text-emerald-700">Color</span>, <span className="text-amber-700">Consistency</span>, <span className="text-orange-700">Content</span>, <span className="text-sky-700">Frequency</span>
                </div>

                <div className="text-xs text-slate-500 text-center">
                  📊 Real-time data from your pup's daily routine
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

