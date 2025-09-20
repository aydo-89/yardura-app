import { getPublicCities } from '@/lib/cityData';
import AnimatedHeader from '@/components/site/AnimatedHeader';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CityListPage() {
  const cities = getPublicCities();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
      <AnimatedHeader />
      
      <main className="py-24">
        <div className="container mx-auto px-6">
          {/* Enhanced header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl shadow-xl">
                <MapPin className="size-8 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
              Service Areas
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Professional dog waste removal services across the Twin Cities. 
              Find your city and discover our comprehensive coverage areas.
            </p>
          </div>

          {/* Service stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl shadow-xl">
              <div className="text-3xl font-black text-brand-600 mb-2">{cities.length}+</div>
              <div className="text-sm font-semibold text-slate-900">Cities Served</div>
              <div className="text-xs text-slate-600">Across Twin Cities metro</div>
            </div>
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl shadow-xl">
              <div className="text-3xl font-black text-emerald-600 mb-2">100%</div>
              <div className="text-sm font-semibold text-slate-900">Satisfaction</div>
              <div className="text-xs text-slate-600">Guaranteed service</div>
            </div>
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl shadow-xl">
              <div className="text-3xl font-black text-blue-600 mb-2">24/7</div>
              <div className="text-sm font-semibold text-slate-900">Support</div>
              <div className="text-xs text-slate-600">Customer service</div>
            </div>
          </div>

          {/* Cities grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cities.map((city, index) => (
              <Card 
                key={city.name}
                className="group overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200/60 hover:border-brand-300/60 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-3xl"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-100/0 group-hover:from-brand-50/50 group-hover:to-brand-100/30 transition-all duration-300"></div>
                
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl shadow-lg transition-all duration-300 group-hover:scale-110 ${
                      index % 4 === 0 ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600' :
                      index % 4 === 1 ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-600' :
                      index % 4 === 2 ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600' :
                      'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600'
                    }`}>
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-slate-900">{city.displayName}</div>
                      <div className="text-sm text-slate-600">Minnesota</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="relative z-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="size-4" />
                      <span>Residential & Commercial Service</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Star className="size-4 text-yellow-500" />
                      <span>Premium Service Area</span>
                    </div>
                    
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Professional dog waste removal with wellness insights and eco-friendly practices.
                    </p>
                  </div>
                  
                  <div className="mt-6 space-y-3">
                    <Link href={`/city/${city.name}`}>
                      <Button className="w-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                        View {city.displayName} Details
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </Link>
                    
                    <Link href="/quote?businessId=yardura">
                      <Button 
                        variant="outline" 
                        className="w-full border-2 border-slate-300 hover:border-brand-300 hover:bg-brand-50 rounded-2xl font-semibold transition-all duration-200"
                      >
                        Get Quote for {city.displayName}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA section */}
          <div className="mt-20 text-center">
            <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-3xl p-12 shadow-xl">
              <h2 className="text-3xl font-black text-slate-900 mb-4">
                Don't See Your City?
              </h2>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
                We're expanding across the Twin Cities metro area. Get in touch to see if we can serve your location.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:1-888-915-YARD"
                  className="px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  📞 Call 1-888-915-YARD
                </a>
                <Link href="/quote?businessId=yardura">
                  <Button 
                    variant="outline" 
                    className="px-8 py-4 border-2 border-slate-300 hover:border-brand-300 hover:bg-brand-50 rounded-2xl font-bold text-lg"
                  >
                    Request Service Quote
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
