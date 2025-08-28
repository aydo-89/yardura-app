import SiteHeader from "@/components/site-header";
import Hero from "@/components/hero";
import Services from "@/components/services";
import Insights from "@/components/insights";
import Eco from "@/components/eco";
import QuoteForm from "@/components/quote-form";
import Footer from "@/components/footer";
import FAQ from "@/components/faq";
import Testimonials from "@/components/testimonials";
import QuoteCalculator from "@/components/quote-calculator";
import StickyCTA from "@/components/sticky-cta";
import YardCarousel from "@/components/yard-carousel";
import Community from "@/components/community";

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Yardura",
    image: "https://www.yardura.com/og-image.jpg",
    url: "https://www.yardura.com",
    telephone: "+16125819812",
    address: { "@type": "PostalAddress", addressLocality: "Minneapolis", addressRegion: "MN", postalCode: "55417", addressCountry: "US" },
    areaServed: ["South Minneapolis","Richfield","Edina","Bloomington"],
    description: "Tech-enabled, eco-friendly dog waste removal with smart health insights.",
    openingHours: "Mo-Fr 08:00-18:00",
  } as const;

  return (
    <>
      <SiteHeader/>
      <main>
        <Hero/>

        {/* Conversion section: Instant quote + short form */}
        <section id="quote" className="py-16">
          <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-ink mb-3">Get Your Instant Quote</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Fill out the form below. Your price updates live based on dogs, yard size, frequency, and add‑ons.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card-modern p-6">
              <QuoteForm/>
            </div>
            <div className="card-modern p-6 flex flex-col items-center justify-center text-center">
              <img src="/text_alert.png" alt="Text alert example" className="w-full max-w-sm mx-auto rounded-xl border mb-4" />
              <h3 className="text-xl font-bold text-ink mb-2">Text & Email Updates</h3>
              <p className="text-slate-600 text-sm max-w-sm">We’ll confirm your schedule and send day‑of arrival texts. You’ll always know when we’re on the way and when your yard is clean.</p>
            </div>
          </div>
          </div>
        </section>

                  <section id="how" className="container py-16">
          <h2 className="text-3xl font-extrabold text-ink">How it works</h2>
          <ol className="mt-4 grid md:grid-cols-3 gap-6 text-slate-700">
            <li className="p-6 rounded-2xl border bg-white shadow-soft">
              <div className="font-bold">1) Get a quote</div>
              Tell us about your pups, schedule, and add-ons. No contracts.
            </li>
            <li className="p-6 rounded-2xl border bg-white shadow-soft">
              <div className="font-bold">2) We scoop (rain/snow)</div>
              Corner-to-corner scan, photo-log pickups for insights, sanitize tools, secure gates.
            </li>
            <li className="p-6 rounded-2xl border bg-white shadow-soft">
              <div className="font-bold">3) See your impact</div>
              Clean yard every week. Coming soon: your dog’s stool trends + methane saved.
            </li>
          </ol>
        </section>

        <Services/>
        {/* Clean yard carousel */}
        <section className="container py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-ink mb-2">Picture‑Perfect Yards</h2>
            <p className="text-slate-600">Results you’ll see after every visit.</p>
          </div>
          <YardCarousel/>
        </section>
        <section id="pricing" className="container py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-ink mb-4">Transparent Pricing</h2>
            <p className="text-slate-700 max-w-2xl mx-auto">
              We price comparably to other Twin Cities services and deliver more value.
              Final quote confirmed after first visit with no hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative p-8 rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-brand-600 text-white px-4 py-1 rounded-full text-sm font-bold">Most Popular</span>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-ink mb-2">1 dog</div>
                <div className="text-5xl font-extrabold text-brand-600 mb-2">$20</div>
                <div className="text-lg text-slate-600 mb-4">per visit (weekly)</div>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> No contract required</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Text alerts & updates</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Opt-in health insights</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 100% satisfaction guarantee</li>
                </ul>
              </div>
            </div>

            <div className="relative p-8 rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="text-center">
                <div className="text-xl font-bold text-ink mb-2">2 dogs</div>
                <div className="text-5xl font-extrabold text-brand-600 mb-2">$24</div>
                <div className="text-lg text-slate-600 mb-4">per visit (weekly)</div>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> All 1-dog benefits</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Deodorize add-on available</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Litter box service option</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Family-friendly service</li>
                </ul>
              </div>
            </div>

            <div className="relative p-8 rounded-2xl border border-brand-200 bg-white shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-brand-100 text-brand-800 px-4 py-1 rounded-full text-sm font-bold">Seasonal</span>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-ink mb-2">One-time clean</div>
                <div className="text-5xl font-extrabold text-brand-600 mb-2">$89</div>
                <div className="text-lg text-slate-600 mb-4">starting at</div>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Perfect for move-ins</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Seasonal cleanup</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Custom quotes by yard size</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Deodorize add-on available</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to action */}
          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-4">Questions about pricing? We offer flexible scheduling and custom quotes.</p>
            <a href="#quote" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-semibold shadow-soft">
              Get Your Custom Quote
            </a>
          </div>
        </section>

        <Eco/>
        <Community/>
        <Insights/>
        <FAQ/>
        <Testimonials/>
      </main>
      <Footer/>
      <StickyCTA/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
