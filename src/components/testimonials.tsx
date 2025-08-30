import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import Reveal from "@/components/Reveal";

const testimonials = [
  {
    name: "Sarah M.",
    location: "Richfield",
    text: "The mission of using data and insights to help dog owners is really cool. Clean yard every week and I love supporting an eco-friendly service that keeps waste out of landfills.",
    rating: 5,
    dogs: "2 dogs"
  },
  {
    name: "Mike R.",
    location: "South Minneapolis",
    text: "The eco program is amazing. Knowing exactly how much waste is being kept out of landfills makes me feel great about the service.",
    rating: 5,
    dogs: "1 dog"
  },
  {
    name: "Jennifer L.",
    location: "Edina",
    text: "No more stepping in poop! The text alerts are perfect and the service is incredibly reliable. Worth every penny.",
    rating: 5,
    dogs: "3 dogs"
  }
];

export default function Testimonials() {
  return (
    <section className="bg-brand-50/60 border-t border-b">
      <div className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-ink mb-4">Why Choose Yardura?</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Here's what early supporters are saying about our mission and eco-friendly dog waste removal service.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Reveal key={index} delay={index * 0.1}>
              <Card className="rounded-2xl border border-accent/20 bg-gradient-to-br from-white to-accent-soft/30 shadow-soft hover:shadow-lg transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1">
                <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="size-4 fill-accent text-accent" />
                  ))}
                </div>

                <div className="relative mb-4">
                  <Quote className="size-6 text-accent-soft absolute -top-1 -left-1" />
                  <p className="text-muted italic pl-6">
                    "{testimonial.text}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-ink">{testimonial.name}</p>
                    <p className="text-muted">{testimonial.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-accent font-medium">{testimonial.dogs}</p>
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
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-white to-accent-soft/30 rounded-2xl border border-accent/20 shadow-soft hover:shadow-lg transition-all duration-300 hover:scale-105">
              <span className="text-sm text-muted font-medium">Ready to join them?</span>
              <a
                href="/quote" data-analytics="cta_quote"
                data-analytics="testimonials_get_quote"
                className="px-6 py-2 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all duration-200 font-semibold text-sm shadow-soft hover:shadow-md hover:scale-105"
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
