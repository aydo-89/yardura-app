import Link from 'next/link';
import useSWR from 'swr';

type PublicEcoStats = {
  totalWasteDiverted: number; // lbs
  totalMethaneAvoided: number; // ft^3 or lbs eq
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Proof() {
  const { data } = useSWR<PublicEcoStats>('/api/stats', fetcher, { refreshInterval: 60000 });
  const waste = data?.totalWasteDiverted ?? 250;
  const methane = data?.totalMethaneAvoided ?? 400;
  return (
    <section id="proof" className="bg-gradient-to-br from-accent-soft/20 via-white to-accent-soft/10 border-t border-b">
      <div className="container py-16">
        <div className="grid lg:grid-cols-3 gap-8 items-stretch">
          {/* Eco KPIs (condensed) */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-accent/20 shadow-soft">
              <div className="text-xs font-semibold text-muted mb-1">Monthly impact</div>
              <div className="text-2xl font-extrabold text-ink">Methane avoided</div>
              <div className="text-3xl font-extrabold text-accent mt-2">{Math.round(methane)} ft³</div>
              <div className="text-xs text-muted mt-2">Pilot routes expanding</div>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-accent/20 shadow-soft">
              <div className="text-xs font-semibold text-muted mb-1">Per dog (annual)</div>
              <div className="text-2xl font-extrabold text-ink">Waste diverted</div>
              <div className="text-3xl font-extrabold text-accent mt-2">{Math.round(waste)} lbs</div>
              <div className="text-xs text-muted mt-2">From landfill to better outcomes</div>
            </div>
          </div>

          {/* Testimonial (single, strong) */}
          <div className="p-6 rounded-2xl bg-white border border-accent/20 shadow-soft flex flex-col justify-between">
            <div>
              <div className="text-sm text-muted mb-2">What customers say</div>
              <blockquote className="text-ink">
                <p className="text-lg leading-relaxed">
                  "Clean yard every week and I love supporting an eco-friendly service that keeps
                  waste out of landfills. The health insights idea is genuinely helpful."
                </p>
                <footer className="mt-3 text-sm text-muted">— Sarah M., Richfield</footer>
              </blockquote>
            </div>
            <div className="mt-6">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-accent text-white font-semibold shadow-soft hover:bg-accent/90 transition"
              >
                Get My Quote
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

