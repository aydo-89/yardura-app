'use client';

import { Star, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Reveal from '@/components/Reveal';

const testimonials = [
  {
    name: 'Sarah M.',
    location: 'Richfield',
    text: 'The mission of using data and insights to help dog owners is really cool. Clean yard every week and I love supporting an eco-friendly service that keeps waste out of landfills.',
    rating: 5,
    dogs: '2 dogs',
  },
  {
    name: 'Mike R.',
    location: 'South Minneapolis',
    text: 'The eco program is amazing. Knowing exactly how much waste is being kept out of landfills makes me feel great about the service.',
    rating: 5,
    dogs: '1 dog',
  },
  {
    name: 'Jennifer L.',
    location: 'Edina',
    text: 'No more stepping in poop! The text alerts are perfect and the service is incredibly reliable. Worth every penny.',
    rating: 5,
    dogs: '3 dogs',
  },
];

export default function Testimonials() {
  return (
    <section className="gradient-section-warm border-t border-green-700/10 border-b border-green-700/10">
      <div className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-ink mb-4">Happy Customers, Happy Dogs</h2>
          
          {/* Happy Customers Visual */}
          <Reveal delay={0.1}>
            <div className="relative rounded-2xl overflow-hidden mb-8 shadow-xl max-w-3xl mx-auto">
              <img
                src="/sections/section-happy-customers-2025-09-17T23-34-44-113Z.webp"
                alt="Real families enjoying clean yards with their dogs"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-6 text-white">
                <h4 className="font-bold">Real Families, Real Results</h4>
                <p className="text-sm opacity-90">Join our community of satisfied customers</p>
              </div>
            </div>
          </Reveal>
          
          <p className="text-slate-600 max-w-2xl mx-auto">
            Here's what families are saying about our professional dog waste removal service.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Reveal key={index} delay={index * 0.1}>
              <Card className="rounded-2xl border border-green-700/20 bg-white shadow-soft hover:shadow-lg transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="size-4 fill-green-500 text-green-600" />
                    ))}
                  </div>

                  <div className="relative mb-4">
                    <Quote className="size-6 text-green-200 absolute -top-1 -left-1" />
                    <p className="text-muted italic pl-6">"{testimonial.text}"</p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-ink">{testimonial.name}</p>
                      <p className="text-muted">{testimonial.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-600 font-medium">{testimonial.dogs}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* Call to action after testimonials */}
        <div className="mt-12 text-center">
          <Reveal delay={0.3}>
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-2xl border border-green-700/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105">
              <span className="text-sm text-muted font-medium">Ready to join them?</span>
              <a
                href="/quote?businessId=yardura"
                data-analytics="cta_quote"
                className="px-6 py-2 bg-gradient-to-r from-green-700 to-green-600 text-white rounded-xl hover:from-green-700 hover:to-green-600 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105"
              >
                Get My Quote
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
