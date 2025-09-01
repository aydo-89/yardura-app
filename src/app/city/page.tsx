import { Metadata } from 'next';
import { getAllCities } from '@/lib/cityData';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dog Waste Removal Services by City | Yardura',
  description: 'Find professional dog poop cleanup services in your Twin Cities area. Serving Minneapolis, St. Paul, Bloomington, and surrounding communities.',
  keywords: ['dog waste removal Twin Cities', 'poop scooping services', 'dog cleanup Minneapolis', 'pet waste removal St. Paul'],
};

export default function CitiesPage() {
  const cities = getAllCities();

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-accent-soft/20 to-accent/10">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Reveal>
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                Dog Waste Removal Services
                <span className="block text-accent">Across the Twin Cities</span>
              </h1>
              <p className="text-xl text-muted max-w-3xl mx-auto">
                Professional, eco-friendly dog poop cleanup services in your neighborhood.
                Find the perfect service for your Minneapolis, St. Paul, or surrounding area.
              </p>
            </div>
          </Reveal>

          {/* Cities Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cities.map((city, index) => (
              <Reveal key={city.name} delay={index * 0.1}>
                <div className="bg-white rounded-2xl p-8 shadow-soft hover:shadow-xl transition-all duration-300 hover:scale-105 border border-white/50">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPin className="size-6 text-accent" />
                    <h2 className="text-2xl font-bold">{city.displayName}</h2>
                  </div>

                  <p className="text-muted mb-6">{city.description}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="size-4 text-accent" />
                      <span>{city.population.toLocaleString()} residents</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Star className="size-4 text-accent" />
                      <span>{city.localBusiness.rating} stars ({city.localBusiness.reviewCount} reviews)</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">Service Areas:</h3>
                    <div className="flex flex-wrap gap-2">
                      {city.serviceAreas.slice(0, 4).map((area) => (
                        <span
                          key={area}
                          className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium"
                        >
                          {area}
                        </span>
                      ))}
                      {city.serviceAreas.length > 4 && (
                        <span className="px-3 py-1 bg-muted text-muted rounded-full text-xs font-medium">
                          +{city.serviceAreas.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <Link href={`/city/${city.name}`}>
                    <Button className="w-full group">
                      View {city.displayName} Services
                      <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas Overview */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Comprehensive Twin Cities Coverage
              </h2>
              <p className="text-xl text-muted max-w-2xl mx-auto">
                We serve all major Twin Cities communities with reliable, eco-friendly dog waste removal services.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-12">
            <Reveal>
              <div className="space-y-6">
                <h3 className="text-2xl font-bold">Why Choose Local Service?</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="size-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Local Expertise</h4>
                      <p className="text-muted">Our teams know your neighborhood and understand local regulations.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="size-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Quick Response</h4>
                      <p className="text-muted">Same-day service available in most areas with flexible scheduling.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="size-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Community Focused</h4>
                      <p className="text-muted">Supporting local pet owners and keeping our communities clean.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="bg-white rounded-2xl p-8 shadow-soft">
                <h3 className="text-2xl font-bold mb-6">Ready to Get Started?</h3>
                <p className="text-muted mb-6">
                  Get a free quote for dog waste removal services in your area.
                  Choose your city above or contact us directly.
                </p>

                <div className="space-y-4">
                  <Button className="w-full" size="lg" asChild>
                    <Link href="/quote">
                      Get Free Quote
                    </Link>
                  </Button>

                  <Button variant="outline" className="w-full" size="lg" asChild>
                    <Link href="tel:(888) 915-9273">
                      Call (888) 915-YARD
                    </Link>
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-accent/10 rounded-xl">
                  <p className="text-sm text-center">
                    <strong>Serving:</strong> Minneapolis, St. Paul, Bloomington, Eden Prairie, Plymouth, Woodbury & surrounding areas
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
