"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "@/lib/framermotion";
import { Star, Quote, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Reveal from "@/components/Reveal";
import { useTheme } from "./theme/ThemeProvider";

const testimonials = [
  {
    name: "Sarah M.",
    location: "Richfield",
    audience: "Health-first",
    text: "We mainly signed up for the clean yard, but the recap link has been unexpectedly useful. One week the notes mentioned “white specks,” and having it written down made it easy to describe to our vet without guessing.",
    rating: 5,
    dogs: "2 dogs",
    highlight: "Simple record to share",
    badge: "Recap link included",
  },
  {
    name: "Mike R.",
    location: "South Minneapolis",
    audience: "Scoop-first",
    text: "I used to spend my weekends doing the yard. Now it’s just… handled. The recap link is quick, and the gate photo is oddly reassuring when I’m not home.",
    rating: 5,
    dogs: "1 dog",
    highlight: "Weekends back",
  },
  {
    name: "Jennifer L.",
    location: "Edina",
    audience: "Scoop-first",
    text: "Three big dogs used to turn the yard into a minefield. Now it’s consistently clean and the kids actually play outside again. It’s the easiest “quality of life” upgrade we’ve made.",
    rating: 5,
    dogs: "3 dogs",
    highlight: "Kid-ready yard",
  },
  {
    name: "Alex T.",
    location: "St. Louis Park",
    audience: "Health-first",
    text: "I'm pretty health-focused, so I love having a low-noise log. The wellness notes don't feel alarmist—just a clear recap of what was seen that week.",
    rating: 5,
    dogs: "1 dog",
    highlight: "Low-noise tracking",
    badge: "Stool health notes",
  },
  {
    name: "Priya S.",
    location: "Linden Hills",
    audience: "Health-first",
    text: "Multi-dog homes are hard to keep straight. The recap link gives me a simple baseline over time, and it’s easy to pull up if I need to reference a past week.",
    rating: 5,
    dogs: "2 dogs",
    highlight: "Baseline over time",
    badge: "Easy to reference",
  },
  {
    name: "Danielle K.",
    location: "Highland Park",
    audience: "Scoop-first",
    text: "I didn’t want another app or constant notifications—I just wanted a clean yard. This is exactly that, with a quick recap when I’m curious. Perfect balance.",
    rating: 5,
    dogs: "1 dog",
    highlight: "No extra noise",
  },
];

export default function Testimonials() {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const backgroundSrc = useMemo(() => {
    const mode = theme === "dark" ? "dark" : "light";
    const base =
      mode === "dark"
        ? { desktop: "/hero_backgrounds/beagle_orange_left_dark.jpeg", mobile: "/hero_backgrounds/beagle_orange_left_dark.jpeg" }
        : { desktop: "/hero_backgrounds/beagle_orange_left_light.jpeg", mobile: "/hero_backgrounds/beagle_orange_left_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(8,16,12,0.56) 0%, rgba(10,18,14,0.48) 50%, rgba(12,22,16,0.42) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.18) 0%, rgba(8,16,12,0.16) 50%, rgba(10,18,12,0.14) 100%)";
  }, [theme]);

  // Dark fallback ensures white text is always readable if image fails to load
  const fallbackBackground = "linear-gradient(135deg, #1a2820 0%, #0d1a14 50%, #0a100c 100%)";

  return (
    <section className="landing-section relative overflow-hidden" style={{ background: fallbackBackground }}>
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Happy customers enjoying clean yards with their dogs"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "45% center" }}
          unoptimized
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: overlayStyle }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-full h-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.9)] via-[rgba(var(--mint-rgb-commas),0.38)] to-transparent" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 -bottom-12 h-16 z-[1]"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="w-full h-full bg-gradient-to-t from-[rgba(var(--vanilla-rgb-commas),0.82)] via-[rgba(var(--gold-rgb-commas),0.3)] to-transparent" />
      </motion.div>

      <div className="container relative z-10 py-20 text-white">
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
            <Star className="size-4 text-brand-gold fill-current" />
            Loved by scoop-first & health-first owners
          </div>
          <h2 className="mt-6 text-5xl font-serif leading-tight md:text-6xl">
            The “finally handled” feeling.
          </h2>

          <p className="mt-4 text-lg text-white/85 max-w-3xl mx-auto">
            Real words from local dog homes: consistent scooping, a simple recap link, and stool health notes that stay calm and useful.
          </p>
        </div>

        <Reveal delay={0.1}>
          <div className="mx-auto mb-14 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[32px] border border-white/15 bg-white/5 p-6 shadow-[0_28px_60px_rgba(3,7,6,0.55)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
                Your local scoopers
              </div>
              <h3 className="mt-4 text-2xl font-serif text-white">
                Real people, every visit.
              </h3>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">
                Our scoopers are background checked, trained on safe entry, and
                coached on the same visit flow every time. We prioritize
                continuity when possible and keep you updated with clear
                arrival windows and visit notes.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  Continuity when possible
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  Gate safety trained
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  Wellness notes captured
                </span>
              </div>
            </div>

            <div className="relative min-h-[320px] overflow-hidden rounded-[32px] border border-white/15 bg-black/30 shadow-[0_28px_60px_rgba(3,7,6,0.55)]">
              <Image
                src="/employee/group_scoopers.jpeg"
                alt="InsightScoop scooper team"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85">
                Meet the scoopers
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Reveal key={index} delay={index * 0.1}>
              <Card className="relative overflow-hidden rounded-[32px] border border-white/14 bg-[rgba(8,18,14,0.52)] shadow-[0_32px_68px_rgba(3,7,6,0.62)] backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:bg-[rgba(8,18,14,0.6)] hover:shadow-[0_44px_92px_rgba(3,7,6,0.7)]">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/18 via-black/10 to-transparent" />
                <CardContent className="relative z-10 p-8 space-y-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 text-brand-gold">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="size-5 fill-current"
                        />
                      ))}
                    </div>
                    <div className="px-3 py-1 rounded-full bg-brand-mint/15 border border-brand-mint/30 text-xs font-semibold text-brand-mint">
                      ✓ Verified
                    </div>
                  </div>

                  <div className="relative space-y-3">
                    {"audience" in testimonial && (
                      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
                        {testimonial.audience}
                      </span>
                    )}
                    <Quote className="pointer-events-none size-7 absolute -top-1 right-0 text-brand-gold/35" />
                    <p className="text-white/90 leading-relaxed pl-6 text-base font-medium">
                      "{testimonial.text}"
                    </p>
                    {testimonial.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-gold">
                        <ShieldCheck className="size-3" />
                        {testimonial.badge}
                      </span>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <div>
                        <p className="font-bold text-white text-base">
                          {testimonial.name}
                        </p>
                        <p className="text-white/70 text-sm">{testimonial.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/80 font-semibold text-sm">
                          {testimonial.dogs}
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1">
                      <span className="text-xs font-semibold text-white">
                        💡 {testimonial.highlight}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* Call to action after testimonials */}
        <div className="mt-20 text-center">
          <Reveal delay={0.4}>
            <div className="bg-gradient-to-br from-[rgba(143,244,195,0.15)] via-[rgba(12,24,18,0.88)] to-[rgba(255,194,77,0.1)] border-2 border-white/25 rounded-3xl p-10 shadow-[0_36px_72px_rgba(4,10,8,0.6)] max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-mint animate-pulse"></div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                  Join local dog homes
                </span>
              </div>
              <h3 className="text-3xl md:text-4xl font-serif text-white leading-tight text-balance mb-6 drop-shadow-[0_16px_36px_rgba(2,6,4,0.65)]">
                Ready for a clean yard + a simple recap?
              </h3>
              <p className="text-lg text-white/90 max-w-2xl mx-auto leading-relaxed mb-8">
                Check availability and get your quote in under a minute. Pause anytime.
              </p>
              <a
                href="/quote?businessId=yardura"
                data-analytics="cta_quote_testimonials"
                className="btn-cta-primary text-lg px-8 py-4 inline-block"
              >
                Get my quote
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
