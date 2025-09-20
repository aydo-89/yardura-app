import { Shield, Fingerprint, Database, FlaskConical, Camera, TrendingUp } from 'lucide-react';

export default function Community() {
  return (
    <section id="community" className="border-t bg-gradient-to-b from-white to-brand-50/50">
      <div className="container py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold text-ink">Community‑Backed Science (Opt‑In)</h2>
          <p className="text-slate-700 mt-2">
            Opt‑in to help improve our non‑diagnostic GI trend insights so owners get clearer
            awareness and better vet conversations.
          </p>
        </div>

        {/* Icon row */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <Shield className="text-brand-700" />
              <div className="font-semibold text-ink">Privacy‑first</div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              De‑identified, encrypted, delete‑on‑request.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <Camera className="text-brand-700" />
              <div className="font-semibold text-ink">Secure capture</div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Anonymized stool photos + moisture/weight during service.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-brand-700" />
              <div className="font-semibold text-ink">Trend insights</div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              3 C’s (Color, Content, Consistency) + Moisture, Weight & Frequency.
            </p>
          </div>
        </div>

        {/* Visual panel */}
        <div className="mt-8 rounded-3xl border border-brand-200 bg-white/70 backdrop-blur p-6 shadow-soft">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
                <FlaskConical className="size-4" /> Community research
              </div>
              <h3 className="text-xl font-bold text-ink mt-1">
                Help build safer, clearer, non‑diagnostic models
              </h3>
              <p className="text-slate-700 text-sm mt-3">
                Participation is optional. You can opt out anytime. Insights are informational only
                — not veterinary advice.
              </p>
              <ul className="text-sm text-slate-700 mt-4 space-y-2">
                <li className="flex items-start gap-2">
                  <Fingerprint className="size-4 text-brand-700 mt-1" /> De‑identified IDs & secure
                  storage
                </li>
                <li className="flex items-start gap-2">
                  <Database className="size-4 text-brand-700 mt-1" /> Delete‑on‑request &
                  transparent controls
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="size-4 text-brand-700 mt-1" /> Vet partners & external
                  reviewers
                </li>
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-brand-200 p-1">
                <img
                  src="/yeller_icon_centered.png"
                  alt="Yeller logo"
                  className="w-full h-full object-contain transform scale-125"
                />
              </div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-brand-200 p-1">
                <img
                  src="/yeller_icon_centered.png"
                  alt="Yeller logo"
                  className="w-full h-full object-contain transform scale-125"
                />
              </div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-brand-200 p-1">
                <img
                  src="/yeller_icon_centered.png"
                  alt="Yeller logo"
                  className="w-full h-full object-contain transform scale-125"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
