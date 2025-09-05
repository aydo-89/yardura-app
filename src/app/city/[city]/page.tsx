import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityData } from '@/lib/cityData';
import Hero from '@/components/hero';
import Services from '@/components/services';
import WhyItMatters from '@/components/WhyItMatters';
import Insights from '@/components/insights';
import Testimonials from '@/components/testimonials';
import Pricing from '@/components/pricing';
import Footer from '@/components/footer';
import StructuredData from '@/components/seo/StructuredData';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Star, CheckCircle } from 'lucide-react';

interface CityPageProps {
  params: Promise<{
    city: string;
  }>;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityData = getCityData(city);

  if (!cityData) {
    return {
      title: 'City Not Found | Yardura',
      description: 'The requested city page could not be found.',
    };
  }

  return {
    title: cityData.seo.title,
    description: cityData.seo.description,
    keywords: cityData.seo.keywords,
    openGraph: {
      title: cityData.seo.title,
      description: cityData.seo.description,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: cityData.seo.title,
      description: cityData.seo.description,
    },
  };
}

export async function generateStaticParams() {
  const citySlugs = [
    'minneapolis',
    'st-paul',
    'bloomington',
    'eden-prairie',
    'plymouth',
    'woodbury',
    'edina',
    'richfield',
  ];

  return citySlugs.map((city) => ({
    city: city,
  }));
}

export default async function CityPage({ params }: CityPageProps) {
  const { city } = await params;
  const cityData = getCityData(city);

  if (!cityData) {
    notFound();
  }

  // Create local business structured data
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: cityData.localBusiness.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: cityData.localBusiness.address,
      addressLocality: cityData.displayName,
      addressRegion: cityData.state,
      postalCode: cityData.zipCodes[0],
      addressCountry: 'US',
    },
    telephone: cityData.localBusiness.phone,
    url: `https://yardura.dev/city/${cityData.name}`,
    // TODO: Uncomment when we have real ratings
    // aggregateRating: {
    //   '@type': 'AggregateRating',
    //   ratingValue: cityData.localBusiness.rating,
    //   reviewCount: cityData.localBusiness.reviewCount,
    // },
    areaServed: cityData.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
      addressRegion: 'MN',
      addressCountry: 'US',
    })),
    serviceType: 'Dog Waste Removal',
    priceRange: '$$',
  };

  return (
    <>
      <StructuredData data={localBusinessSchema} />

      {/* Custom Hero Section for City */}
      <section className="relative min-h-screen bg-gradient-to-br from-accent-soft via-white to-accent/5 flex items-center">
        <div className="container mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted font-medium">
                  <MapPin className="size-4" />
                  Serving {cityData.displayName}, MN
                </div>

                <h1 className="text-4xl md:text-6xl font-bold text-foreground">
                  Professional Dog Waste
                  <span className="block text-accent">Removal in {cityData.displayName}</span>
                </h1>

                <p className="text-xl text-muted max-w-lg">
                  {cityData.description} Keep your yard clean and healthy with our eco-friendly dog
                  waste removal services.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="px-8 py-4 text-lg font-semibold" asChild>
                    <a href="/quote" data-analytics="cta_city_quote">
                      Get Your Free Quote
                    </a>
                  </Button>

                  <Button variant="outline" size="lg" className="px-8 py-4 text-lg" asChild>
                    <a href={`tel:${cityData.localBusiness.phone}`} data-analytics="cta_city_call">
                      <Phone className="size-5 mr-2" />
                      Call {cityData.localBusiness.phone.replace('-YARD', '-9273')}
                    </a>
                  </Button>
                </div>

                {/* TODO: Uncomment when we have real ratings
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`size-5 ${
                          i < Math.floor(cityData.localBusiness.rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">
                      {cityData.localBusiness.rating} ({cityData.localBusiness.reviewCount} reviews)
                    </span>
                  </div>
                </div>
                */}
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="relative">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
                  <h3 className="text-2xl font-bold mb-6 text-center">
                    Why Choose Yardura in {cityData.displayName}?
                  </h3>

                  <div className="space-y-4">
                    {[
                      'Eco-friendly waste disposal',
                      'Flexible scheduling',
                      'Licensed and insured',
                      'Satisfaction guaranteed',
                      'Serving your neighborhood',
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="size-5 text-accent flex-shrink-0" />
                        <span className="text-muted">{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-4 bg-accent/10 rounded-xl">
                    <h4 className="font-semibold mb-2">Service Areas Include:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {cityData.serviceAreas.slice(0, 6).map((area) => (
                        <div key={area} className="flex items-center gap-2">
                          <MapPin className="size-3 text-accent" />
                          {area}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Service Areas Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Serving {cityData.displayName} & Surrounding Areas
              </h2>
              <p className="text-xl text-muted max-w-2xl mx-auto">
                We provide reliable dog waste removal services throughout {cityData.displayName} and
                the surrounding communities.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {cityData.serviceAreas.map((area, index) => (
              <Reveal key={area} delay={index * 0.1}>
                <div className="bg-white rounded-xl p-6 shadow-soft hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className="size-5 text-accent" />
                    <h3 className="font-semibold">{area}</h3>
                  </div>
                  <p className="text-muted text-sm">
                    Professional dog waste removal services available in {area}, {cityData.state}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Reusable Sections */}
      <Services />
      <WhyItMatters />
      <Insights />
      <Testimonials />
      <Pricing />

      {/* City-Specific CTA Section */}
      <section className="py-20 bg-accent text-white">
        <div className="container mx-auto px-4 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Get Started in {cityData.displayName}?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Join hundreds of {cityData.displayName} pet owners who trust Yardura for clean,
              healthy yards.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="px-8 py-4 text-lg font-semibold bg-white text-accent hover:bg-white/90"
                asChild
              >
                <a href="/quote" data-analytics="cta_city_final_quote">
                  Get Your Free Quote
                </a>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="px-8 py-4 text-lg border-white text-white hover:bg-white hover:text-accent"
                asChild
              >
                <a
                  href={`tel:${cityData.localBusiness.phone}`}
                  data-analytics="cta_city_final_call"
                >
                  <Phone className="size-5 mr-2" />
                  Call Now
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </>
  );
}
