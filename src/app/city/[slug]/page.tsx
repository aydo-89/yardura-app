import { getCityData, getCitySlugs } from '@/lib/cityData';
import AnimatedHeader from '@/components/site/AnimatedHeader';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Users, 
  Star, 
  ArrowRight, 
  CheckCircle, 
  Shield, 
  Leaf, 
  Phone,
  Clock,
  Award
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface CityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const citySlugs = getCitySlugs();
  return citySlugs.map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({ params }: CityPageProps) {
  const { slug } = await params;
  const city = getCityData(slug);
  
  if (!city) {
    return {
      title: 'City Not Found | Yardura',
      description: 'The requested city page could not be found.',
    };
  }

  return {
    title: city.seo.title,
    description: city.seo.description,
    keywords: city.seo.keywords.join(', '),
    openGraph: {
      title: city.seo.title,
      description: city.seo.description,
      type: 'website',
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params;
  const city = getCityData(slug);

  if (!city) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
      <AnimatedHeader />
      
      <main className="py-24">
        <div className="container mx-auto px-6">
          {/* Enhanced city header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl shadow-xl">
                <MapPin className="size-10 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-4">
              {city.displayName}, Minnesota
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-6">
              {city.description}
            </p>
            
            {/* City stats */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-full">
                <Users className="size-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">
                  {city.population.toLocaleString()} residents
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-full">
                <MapPin className="size-4 text-green-600" />
                <span className="text-sm font-medium text-slate-700">
                  {city.zipCodes.length} ZIP codes served
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-full">
                <Star className="size-4 text-yellow-600" />
                <span className="text-sm font-medium text-slate-700">Premium service area</span>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/quote?businessId=yardura">
                <Button className="px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  Get Free Quote for {city.displayName}
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </Link>
              <a
                href="tel:1-888-915-YARD"
                className="px-8 py-4 border-2 border-slate-300 hover:border-brand-300 hover:bg-brand-50 rounded-2xl font-bold text-lg text-slate-700 transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
              >
                <Phone className="size-5" />
                Call 1-888-915-YARD
              </a>
            </div>
          </div>

          {/* Service features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-green-100/0 group-hover:from-green-50/50 group-hover:to-green-100/30 transition-all duration-300"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl group-hover:scale-110 transition-all duration-300">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-lg font-bold text-slate-900">Licensed & Insured</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-600 leading-relaxed">
                  Fully licensed and insured for your peace of mind. Professional service you can trust.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/50 group-hover:to-emerald-100/30 transition-all duration-300"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl group-hover:scale-110 transition-all duration-300">
                    <Leaf className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-slate-900">Eco-Friendly</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-600 leading-relaxed">
                  Sustainable waste diversion options to keep waste out of landfills. Join our eco mission!
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-100/0 group-hover:from-purple-50/50 group-hover:to-purple-100/30 transition-all duration-300"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl group-hover:scale-110 transition-all duration-300">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-lg font-bold text-slate-900">Wellness Insights</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-600 leading-relaxed">
                  Smart health tracking and insights to help spark better conversations with your vet.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service areas and ZIP codes */}
          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            {/* ZIP Codes */}
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">ZIP Codes Served</div>
                    <div className="text-sm text-slate-600">We serve these areas in {city.displayName}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-3">
                  {city.zipCodes.map((zip) => (
                    <Badge 
                      key={zip}
                      className="px-4 py-2 bg-gradient-to-r from-brand-100 to-brand-200 text-brand-800 border border-brand-300 rounded-2xl font-semibold hover:from-brand-200 hover:to-brand-300 transition-all duration-200 hover:scale-105"
                    >
                      {zip}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Neighborhoods */}
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Neighborhoods</div>
                    <div className="text-sm text-slate-600">Areas we proudly serve</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {city.neighborhoods.map((neighborhood) => (
                    <div key={neighborhood} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="font-medium text-slate-900">{neighborhood}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service information */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden mb-16">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-brand-100 to-brand-200 rounded-2xl">
                  <Clock className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">Service Information</div>
                  <div className="text-sm text-slate-600">Everything you need to know about our {city.displayName} service</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Service Hours</h3>
                  <div className="space-y-2 text-slate-600">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span>Monday - Friday</span>
                      <span className="font-semibold">8:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span>Saturday</span>
                      <span className="font-semibold">10:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span>Sunday</span>
                      <span className="font-semibold text-slate-500">Closed</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 rounded-2xl">
                      <Phone className="size-5 text-brand-600" />
                      <div>
                        <div className="font-semibold text-slate-900">{city.localBusiness.phone}</div>
                        <div className="text-sm text-slate-600">Call for immediate service</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                      <MapPin className="size-5 text-slate-600" />
                      <div>
                        <div className="font-semibold text-slate-900">{city.localBusiness.address}</div>
                        <div className="text-sm text-slate-600">Local service area</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service areas */}
          {city.serviceAreas.length > 1 && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden mb-16">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Extended Service Areas</div>
                    <div className="text-sm text-slate-600">We also serve these nearby communities</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {city.serviceAreas.map((area) => (
                    <div key={area} className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl">
                      <CheckCircle className="size-4 text-green-600" />
                      <span className="font-medium text-slate-900">{area}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Final CTA */}
          <div className="text-center">
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-3xl p-12 shadow-2xl text-white">
              <h2 className="text-3xl font-black mb-4">
                Ready to Get Started in {city.displayName}?
              </h2>
              <p className="text-xl text-brand-100 mb-8 max-w-2xl mx-auto">
                Join hundreds of satisfied customers enjoying clean yards and smart wellness insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/quote?businessId=yardura">
                  <Button className="px-8 py-4 bg-white text-brand-700 hover:bg-slate-100 font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    Get Your Free Quote
                    <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
                <a
                  href="tel:1-888-915-YARD"
                  className="px-8 py-4 border-2 border-white/30 hover:border-white/60 hover:bg-white/10 rounded-2xl font-bold text-lg text-white transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
                >
                  <Phone className="size-5" />
                  Call Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
