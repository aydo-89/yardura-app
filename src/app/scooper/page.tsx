import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, Clock, MapPin, Calendar, Shield, Sparkles, 
  CheckCircle2, ArrowRight, Car, Heart 
} from "lucide-react";
import { brandColors, withAlpha } from "@/shared/brand";

export const metadata = {
  title: "Become a Scooper | InsightScoop",
  description: "Earn $20-30/hour scooping yards in your neighborhood. Flexible schedule, no experience needed. Join the InsightScoop team.",
};

export default function ScooperLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#040a07]">
      <AnimatedHeader />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
          {/* Background Image - Light Mode */}
          <div className="absolute inset-0 dark:hidden">
            <Image
              src="/hero_backgrounds/shepherd_orange_right_light.jpeg"
              alt="Scooper at work"
              fill
              className="object-cover"
              style={{ objectPosition: "70% center" }}
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/60 to-slate-900/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-slate-900/30" />
          </div>
          {/* Background Image - Dark Mode */}
          <div className="absolute inset-0 hidden dark:block">
            <Image
              src="/hero_backgrounds/shepherd_orange_right_dark.jpeg"
              alt="Scooper at work"
              fill
              className="object-cover"
              style={{ objectPosition: "70% center" }}
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40" />
          </div>

          <div className="relative z-10 container mx-auto px-6 py-20 text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold backdrop-blur">
              <DollarSign className="size-4" />
              Earn $20-30/hour*
            </div>
            
            <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              Scoop yards.<br />
              <span className="text-brand-gold">Make great money.</span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg text-white/90 leading-relaxed">
              Join the InsightScoop team. Set your own hours, work outdoors, and earn competitive pay 
              helping pet families in your neighborhood.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button asChild size="lg" className="h-14 px-8 rounded-xl bg-brand-coral hover:bg-brand-coral-ink text-white font-semibold shadow-lg shadow-brand-coral/25 text-lg">
                <Link href="/field-tech/apply">
                  Apply now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-xl border-2 border-white/30 bg-white/10 backdrop-blur text-white hover:bg-white/20 font-semibold text-lg">
                <Link href="/city">
                  View open cities
                </Link>
              </Button>
            </div>
            <p className="text-xs text-white/60 max-w-md mx-auto">
              *Pay is per completed yard. Most scoopers average $20-30/hour based on the number of yards they complete.
            </p>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-white dark:bg-[#060e0a] border-y border-slate-200 dark:border-white/10 py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
                Why scoop with InsightScoop?
              </h2>
              <p className="mt-3 text-slate-600 dark:text-white/70 max-w-2xl mx-auto">
                We're not just another gig. We're building a community of pet-loving professionals who take pride in their work.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {[
                {
                  icon: DollarSign,
                  title: "$20-30/hour*",
                  description: "Pay per completed yard. Most scoopers average $20-30/hr based on yards completed. Top performers earn more.",
                  accent: brandColors.gold,
                },
                {
                  icon: Clock,
                  title: "Flexible schedule",
                  description: "Choose your days and windows. Morning person? Afternoon free? You decide.",
                  accent: brandColors.coral,
                },
                {
                  icon: MapPin,
                  title: "Local routes",
                  description: "Work close to home. We optimize routes to minimize driving and maximize efficiency.",
                  accent: brandColors.mint,
                },
                {
                  icon: Calendar,
                  title: "Consistent work",
                  description: "Regular customers mean steady income. Build relationships in your community.",
                  accent: brandColors.sunset,
                },
                {
                  icon: Shield,
                  title: "Full support",
                  description: "Training, equipment guidance, and a team that has your back. Never feel alone.",
                  accent: brandColors.coral,
                },
                {
                  icon: Heart,
                  title: "Help pets",
                  description: "Our AI monitoring catches health issues early. You're part of pet wellness, not just cleanup.",
                  accent: brandColors.gold,
                },
              ].map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-2xl border bg-slate-50 dark:bg-white/5 p-6 hover:shadow-lg transition-shadow"
                  style={{ borderColor: withAlpha(benefit.accent, 0.25) }}
                >
                  <div 
                    className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: withAlpha(benefit.accent, 0.15) }}
                  >
                    <benefit.icon className="h-6 w-6" style={{ color: benefit.accent }} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-white/70">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-slate-50 dark:bg-[#040a07] py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
                Getting started is easy
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-4 max-w-4xl mx-auto">
              {[
                { step: 1, title: "Apply online", description: "5-minute application. Tell us about yourself and where you can scoop." },
                { step: 2, title: "Quick review", description: "We'll verify your info and run a background check (we cover the cost)." },
                { step: 3, title: "Get trained", description: "Short online training on our AI tools, safety protocols, and best practices." },
                { step: 4, title: "Start earning", description: "Accept route offers and start scooping. Get paid weekly via direct deposit." },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-brand-coral/15 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-brand-coral">{item.step}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-white/70">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="bg-white dark:bg-[#060e0a] border-y border-slate-200 dark:border-white/10 py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white text-center mb-8">
                What you need
              </h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  "Reliable vehicle (car, truck, or SUV)",
                  "Valid driver's license & insurance",
                  "Smartphone for our app",
                  "Ability to lift 30 lbs",
                  "Clean background check",
                  "Love for dogs (not required, but it helps!)",
                ].map((req) => (
                  <div key={req} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-slate-700 dark:text-white/90">{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Earnings Calculator Preview */}
        <section className="bg-slate-50 dark:bg-[#040a07] py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white mb-4">
                See what you could earn*
              </h2>
              <p className="text-slate-600 dark:text-white/70 mb-8">
                Most scoopers work 15-25 hours per week and earn $400-$750 weekly. 
                Full-time scoopers can earn $1,000+ per week.
              </p>

              <div className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 to-brand-gold/5 dark:from-brand-gold/20 dark:to-brand-gold/5 p-8">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-white/60 mb-1">Part-time (~10 hrs/wk)</p>
                    <p className="text-3xl font-bold text-brand-gold">$200-300</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">per week</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-white/60 mb-1">Regular (~20 hrs/wk)</p>
                    <p className="text-3xl font-bold text-brand-gold">$400-600</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">per week</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-white/60 mb-1">Full-time (~35 hrs/wk)</p>
                    <p className="text-3xl font-bold text-brand-gold">$700-1050</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">per week</p>
                  </div>
                </div>
                <p className="mt-6 text-xs text-slate-500 dark:text-white/50">
                  *Estimates based on average yards completed per hour. Actual earnings vary based on route efficiency, location, and number of accepted jobs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-brand-coral/10 to-brand-gold/10 dark:from-brand-coral/20 dark:to-brand-gold/10 py-20">
          <div className="container mx-auto px-6 text-center">
            <h2 className="font-serif text-4xl font-semibold text-slate-900 dark:text-white mb-4">
              Ready to start earning?
            </h2>
            <p className="text-lg text-slate-600 dark:text-white/80 mb-8 max-w-xl mx-auto">
              Join the growing team of InsightScoop professionals. We're expanding fast and looking for great people like you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="h-14 px-10 rounded-xl bg-brand-coral hover:bg-brand-coral-ink text-white font-semibold shadow-lg shadow-brand-coral/25 text-lg">
                <Link href="/field-tech/apply">
                  Apply now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-xl border-2 border-slate-300 dark:border-white/25 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-semibold">
                <a href="mailto:scoopers@insightscoop.com">
                  Questions? Email us
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

