'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, CheckCircle } from 'lucide-react';
import Reveal from './Reveal';

interface PricingPreview {
  dogs: number;
  frequency: 'weekly' | 'biweekly';
  estimate: string;
}

const pricingPreviews: PricingPreview[] = [
  { dogs: 1, frequency: 'weekly', estimate: '$25-35/visit' },
  { dogs: 2, frequency: 'weekly', estimate: '$30-45/visit' },
  { dogs: 1, frequency: 'biweekly', estimate: '$28-40/visit' },
];

export default function QuoteTeaser() {
  const [selectedPreview, setSelectedPreview] = useState(0);

  return (
    <section className="py-24 bg-white">
      <div className="container">
        <Reveal>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-6">
                Ready for Professional Minneapolis Dog Waste Removal?
              </h2>
              <p className="text-lg text-muted max-w-2xl mx-auto">
                Get started with eco-friendly weekly service. See pricing instantly and book your
                first visit today.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Pricing Preview */}
              <Reveal delay={0.1}>
                <div className="bg-gradient-to-br from-accent-soft/30 to-accent-soft/10 rounded-2xl p-8 border border-accent/10">
                  <div className="flex items-center gap-3 mb-6">
                    <Calculator className="size-6 text-accent" />
                    <h3 className="text-xl font-bold text-ink">Instant Pricing Preview</h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    {pricingPreviews.map((preview, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPreview(index)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                          selectedPreview === index
                            ? 'border-accent bg-accent-soft/20 shadow-soft'
                            : 'border-accent/20 hover:border-accent/40'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-ink">
                            {preview.dogs} dog{preview.dogs > 1 ? 's' : ''}, {preview.frequency}
                          </span>
                          <span className="font-semibold text-accent">{preview.estimate}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted mb-4">
                      Starting at {pricingPreviews[selectedPreview].estimate} • Final quote
                      confirmed after first visit
                    </p>
                  </div>
                </div>
              </Reveal>

              {/* Benefits & CTA */}
              <Reveal delay={0.2}>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-ink">Eco-Friendly Disposal</h4>
                        <p className="text-sm text-muted">
                          Landfill diversion through composting programs
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-ink">Health Insights Included</h4>
                        <p className="text-sm text-muted">
                          Optional AI stool analysis (non-diagnostic)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-ink">Licensed & Insured</h4>
                        <p className="text-sm text-muted">
                          Professional service with satisfaction guarantee
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-ink">Same-Day Service</h4>
                        <p className="text-sm text-muted">
                          Available in Minneapolis, Richfield, Edina & Bloomington
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link href="/quote" data-analytics="cta_quote_teaser">
                    <button className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-soft hover:shadow-lg flex items-center justify-center gap-2 group">
                      Get Your Free Minneapolis Quote
                      <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>

                  <p className="text-xs text-center text-muted">
                    No contracts • Cancel anytime • Satisfaction guaranteed
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
