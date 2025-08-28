import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
            <Card key={index} className="rounded-2xl border border-brand-200 bg-white shadow-soft">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="size-4 fill-brand-500 text-brand-500" />
                  ))}
                </div>

                <div className="relative mb-4">
                  <Quote className="size-6 text-brand-200 absolute -top-1 -left-1" />
                  <p className="text-slate-700 italic pl-6">
                    "{testimonial.text}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-ink">{testimonial.name}</p>
                    <p className="text-slate-500">{testimonial.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand-600 font-medium">{testimonial.dogs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to action after testimonials */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-brand-200 shadow-soft">
            <span className="text-sm text-slate-600">Ready to join them?</span>
            <a href="#quote" className="px-4 py-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition font-semibold text-sm">
              Get My Quote
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
