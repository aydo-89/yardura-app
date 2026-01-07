import { getPublicCities, type CityStatus } from "@/lib/cityData";
import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { brandColors, withAlpha } from "@/shared/brand";
import { Zap, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import CitySearch from "./CitySearch";
import ZipChecker from "./ZipChecker";
import { getCityTileAggregations, mergeCityWithTileData } from "@/lib/tiles/city-aggregation";
import { prisma } from "@/lib/prisma";

export default async function CityListPage() {
  // Get static city data (includes zipCodes for each city)
  const staticCities = getPublicCities();
  
  // Fetch real tile aggregations from PostGIS
  const tileAggregations = await getCityTileAggregations("yardura");
  
  // Merge static data with live tile data
  // This checks both direct tile matches AND ZIP coverage from other tiles
  const citiesWithStatus = await mergeCityWithTileData(staticCities, tileAggregations);
  
  // Categorize cities by status for stats
  const liveCities = citiesWithStatus.filter((c) => c.liveStatus === "LIVE");
  const waitlistCities = citiesWithStatus.filter((c) => c.liveStatus === "WAITLIST");
  const comingSoonCities = citiesWithStatus.filter((c) => c.liveStatus === "COMING_SOON");
  
  // Calculate totals
  const totalZips = citiesWithStatus.reduce((sum, c) => sum + c.zipCount, 0);
  const totalScoopers = citiesWithStatus.reduce((sum, c) => sum + c.activeScoopers, 0);
  
  // Get total waitlist signups directly from database (more accurate)
  let totalWaitlistSignups = 0;
  let citiesWithWaitlistInterest = 0;
  try {
    totalWaitlistSignups = await prisma.cityWaitlist.count();
    const uniqueCities = await prisma.cityWaitlist.groupBy({
      by: ["cityName"],
      _count: { id: true },
    });
    citiesWithWaitlistInterest = uniqueCities.length;
  } catch (error) {
    console.warn("[city-page] Could not fetch waitlist counts:", error);
    // Fallback to aggregated data
    totalWaitlistSignups = citiesWithStatus.reduce((sum, c) => sum + c.waitlistSignups, 0);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#040a07]">
      <AnimatedHeader />

      <main>
        {/* Hero Section with Dog Background - contained like individual city pages */}
        <section className="relative min-h-[65vh] flex items-center justify-center overflow-hidden">
          {/* Background Image - Light Mode */}
          <div className="absolute inset-0 dark:hidden">
            <Image
              src="/hero_backgrounds/arlo_coral_left_light.jpeg"
              alt="Arlo in service area"
              fill
              className="object-cover object-center"
              priority
              sizes="100vw"
            />
            {/* Dark gradient overlay for white text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-slate-900/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/40" />
          </div>
          {/* Background Image - Dark Mode */}
          <div className="absolute inset-0 hidden dark:block">
            <Image
              src="/hero_backgrounds/arlo_coral_left_dark.jpeg"
              alt="Arlo in service area"
              fill
              className="object-cover object-center"
              priority
              sizes="100vw"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 container mx-auto px-6 py-16 text-center space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/90 backdrop-blur">
              <Zap className="size-4 text-brand-gold" />
              Expanding rapidly
            </div>
            <h1 className="font-serif text-[clamp(2.8rem,5vw,4.5rem)] leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              Help us launch in your city
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/90 leading-relaxed">
              We expand to cities with the most demand. Sign up for the waitlist to help bring InsightScoop to your neighborhood!
            </p>
            
            {/* Prominent ZIP Check */}
            <div className="pt-4">
              <ZipChecker />
            </div>
          </div>
        </section>

        {/* Waitlist Emphasis Banner */}
        <section className="bg-gradient-to-r from-brand-gold/20 via-amber-500/15 to-brand-gold/20 dark:from-brand-gold/10 dark:via-amber-900/20 dark:to-brand-gold/10 border-y border-brand-gold/30 dark:border-brand-gold/20">
          <div className="container mx-auto px-6 py-8">
            <div className="mx-auto max-w-4xl text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-brand-gold" />
                <h2 className="text-xl font-serif font-semibold text-slate-900 dark:text-white">
                  Your signup matters!
                </h2>
                <Sparkles className="h-6 w-6 text-brand-gold" />
              </div>
              <p className="text-slate-700 dark:text-white/80 max-w-2xl mx-auto">
                We prioritize activating cities with the most interest. The more neighbors who sign up, the faster we can bring clean yards and wellness insights to your area.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link 
                  href="#search"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-6 py-3 shadow-lg shadow-amber-500/40 border border-amber-500 transition-all"
                >
                  <Sparkles className="h-5 w-5" />
                  Find my city & join waitlist
                </Link>
                <span className="text-slate-600 dark:text-white/60 text-sm">or</span>
                <Link 
                  href="/scooper"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-mint text-brand-mint hover:bg-brand-mint/10 font-semibold px-6 py-3 transition-all"
                >
                  <Users className="h-5 w-5" />
                  Become a scooper — $20-30/hr*
                </Link>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50">
                *Pay is per completed yard. Most scoopers average $20-30/hr based on yards completed.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-white dark:bg-[#060e0a] border-y border-slate-200 dark:border-white/10">
          <div className="container mx-auto px-6 py-10">
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {[
                {
                  value: `${liveCities.length}`,
                  label: "Cities live",
                  detail: "Active service areas",
                  accent: brandColors.mint,
                },
                {
                  value: `${totalWaitlistSignups}`,
                  label: "Waitlist signups",
                  detail: citiesWithWaitlistInterest > 0 ? `Across ${citiesWithWaitlistInterest} cities` : "Join to help launch",
                  accent: brandColors.gold,
                },
                {
                  value: totalZips > 0 ? `${totalZips}` : "50+",
                  label: "ZIP codes",
                  detail: "Covered areas",
                  accent: brandColors.coral,
                },
                {
                  value: totalScoopers > 0 ? `${totalScoopers}` : "Open",
                  label: totalScoopers > 0 ? "Active scoopers" : "Scooper marketplace",
                  detail: totalScoopers > 0 ? "Serving customers" : "Earn on your schedule",
                  accent: brandColors.sunset,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border bg-white dark:bg-white/5 p-5 text-center shadow-sm"
                  style={{ borderColor: withAlpha(stat.accent, 0.25) }}
                >
                  <p className="text-2xl font-black text-slate-900 dark:text-white md:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-white/90 md:text-sm">{stat.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/70 md:text-xs">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* City Search & Cards Section */}
        <section id="search" className="bg-slate-50 dark:bg-[#040a07] py-16 scroll-mt-20">
          <div className="container mx-auto px-6">
            <CitySearch cities={citiesWithStatus} />
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-white dark:bg-[#060e0a] border-t border-slate-200 dark:border-white/10 py-16">
          <div className="container mx-auto px-6">
            {/* Main waitlist CTA */}
            <div className="mx-auto max-w-4xl text-center">
              <div className="rounded-[32px] border border-brand-gold/30 dark:border-brand-gold/20 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 dark:from-[rgba(18,16,10,0.8)] dark:via-[rgba(12,14,10,0.7)] dark:to-[rgba(18,16,10,0.6)] p-10 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold mb-4">
                  <Sparkles className="h-4 w-4" />
                  Be part of our expansion
                </div>
                <h3 className="text-3xl font-serif font-semibold text-slate-900 dark:text-white">
                  Don't see your city live yet?
                </h3>
                <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-white/80 leading-relaxed">
                  Join the waitlist! We prioritize launching in cities with the most demand. Your signup directly influences where we expand next.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link 
                    href="#search"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-7 py-4 text-base shadow-lg shadow-amber-500/40 border border-amber-500 transition-all"
                  >
                    <Sparkles className="h-5 w-5" />
                    Search & join waitlist
                  </Link>
                  <Button asChild variant="outline" className="border-2 border-brand-coral text-brand-coral hover:bg-brand-coral/10 px-7 py-5 text-base rounded-xl">
                    <Link href="/quote">Get my quote anyway</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Scooper CTA */}
            <div className="mx-auto mt-8 max-w-4xl text-center">
              <div className="rounded-[32px] border border-brand-mint/30 dark:border-brand-mint/20 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-[rgba(10,18,14,0.8)] dark:via-[rgba(10,14,12,0.7)] dark:to-[rgba(10,18,14,0.6)] p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-left">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-mint/15 px-4 py-2 text-sm font-semibold text-brand-mint mb-3">
                      <Users className="h-4 w-4" />
                      Join our team
                    </div>
                    <h3 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
                      Want to earn $20-30/hour?*
                    </h3>
                    <p className="mt-2 text-slate-600 dark:text-white/80 max-w-md">
                      Become an InsightScoop scooper! Flexible hours, great pay, and help grow our service in your area.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
                      *Pay is per completed yard. Most scoopers average $20-30/hr.
                    </p>
                  </div>
                  <Button asChild className="shrink-0 h-14 px-8 rounded-xl bg-brand-mint hover:bg-brand-mint-ink text-white font-bold text-lg shadow-lg shadow-brand-mint/20">
                    <Link href="/scooper">
                      <Users className="mr-2 h-5 w-5" />
                      Apply now
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
