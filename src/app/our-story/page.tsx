import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Leaf, ShieldCheck, Sparkles } from "lucide-react";

import Footer from "@/components/footer";
import { DEFAULT_IMAGE, SITE_DOMAIN } from "@/lib/seo/config";
import { brandColors, brandGradients, withAlpha } from "@/shared/brand";

export const metadata: Metadata = {
  title: "Our Story | InsightScoop",
  description:
    "The story behind InsightScoop - how Ludo and Pixel inspired a mission to catch pet health issues earlier and keep yards cleaner with smarter insights.",
  alternates: {
    canonical: `${SITE_DOMAIN}/our-story`,
  },
  openGraph: {
    title: "Our Story | InsightScoop",
    description:
      "How Ludo and Pixel inspired InsightScoop: a mission to help pet parents catch health changes earlier and keep yards cleaner.",
    url: `${SITE_DOMAIN}/our-story`,
    type: "website",
    siteName: "InsightScoop",
    images: [
      {
        url: DEFAULT_IMAGE,
        width: 1200,
        height: 630,
        alt: "InsightScoop - Our Story",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Story | InsightScoop",
    description:
      "From Ludo and Pixel to InsightScoop - a mission to spot pet health changes earlier and keep yards cleaner.",
    images: [DEFAULT_IMAGE],
  },
};

const STORY_MILESTONES = [
  {
    title: "Two border collies, two personalities",
    copy:
      "Ludo (mostly border collie with a splash of lab) was goofy, clumsy, brilliant, and obsessed with food. Pixel, a rescue, is gentle, toy-driven, and very picky - always ready to work or play.",
  },
  {
    title: "The morning everything changed",
    copy:
      "Ludo skipped breakfast. He moved slowly, looked lethargic, and his gums turned pale. We rushed him to the emergency vet and learned he had masses on his liver and spleen - one had ruptured. It was an aggressive cancer, often called a silent killer because symptoms appear too late.",
  },
  {
    title: "The rabbit hole",
    copy:
      "We read story after story about missed ulcers, tapeworms, parvo, and even dogs swallowing sharp objects. Over and over, the signs showed up in stool or subtle behavior changes long before the crisis moment.",
  },
  {
    title: "A new lens on prevention",
    copy:
      "Research kept circling back to gut health and how much of the immune system is tied to it. We wanted a simple, daily way to notice changes sooner - with less guesswork for pet parents.",
  },
];

const VALUES = [
  {
    icon: Heart,
    title: "Protect their healthspan",
    copy:
      "We focus on early signals and gentle nudges so pet parents can act sooner, not later.",
  },
  {
    icon: ShieldCheck,
    title: "Respectful, human-centered care",
    copy:
      "Clear guidance, not alarmism. Wellness data that is private, portable, and easy to share.",
  },
  {
    icon: Leaf,
    title: "Cleaner yards, lighter footprint",
    copy:
      "We reduce waste where we can and promote responsible disposal that protects water and soil.",
  },
];

const RESEARCH_TAKEAWAYS = [
  "Blood streaks, mucus, or pale stool can surface before outward symptoms.",
  "White fragments can signal worms long before they cause a crisis.",
  "Yard hazards and hidden parasites often show up first in the poop.",
  "Gut changes are often the earliest clue that something is off.",
];

export default function OurStoryPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-graphite dark:bg-slate-950 dark:text-slate-50">
      <main id="main-content" className="pt-24">
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: brandGradients.heroBackdrop }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                "linear-gradient(135deg, rgba(6,10,8,0.98) 0%, rgba(12,22,17,0.95) 52%, rgba(18,32,24,0.9) 100%)",
            }}
          />
          <div
            className="absolute -top-32 right-10 h-72 w-72 rounded-full blur-3xl"
            style={{ background: withAlpha(brandColors.coral, 0.25) }}
          />
          <div
            className="absolute bottom-10 left-8 h-64 w-64 rounded-full blur-3xl"
            style={{ background: withAlpha(brandColors.mint, 0.22) }}
          />
          <div className="container relative z-10 grid gap-12 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-graphite/80 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-white/70">
                Our Story
              </span>
              <h1 className="text-4xl font-serif font-semibold leading-tight md:text-5xl">
                The morning Ludo skipped breakfast changed everything.
              </h1>
              <p className="text-lg text-graphite/70 dark:text-slate-300">
                InsightScoop started with two border collies, a sudden loss, and
                a question we could not shake: how do we help pet parents catch
                the quiet warning signs while there is still time to act?
              </p>
              <div className="rounded-3xl border border-amber-200/70 bg-white/80 p-6 shadow-[0_24px_60px_rgba(31,41,55,0.12)] dark:border-white/10 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
                    Our mission
                  </p>
                </div>
                <p className="mt-3 text-lg font-semibold text-graphite dark:text-white">
                  Help pet parents notice health changes earlier, reduce
                  preventable emergencies, and keep yards cleaner with better
                  data - without adding stress.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/wellness"
                  className="btn-cta-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
                >
                  Explore the wellness app
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/quote?businessId=yardura"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-graphite shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/15 dark:bg-slate-900 dark:text-white"
                >
                  Get a scooping quote
                </Link>
              </div>
            </div>
            <div className="grid gap-6">
              <div className="relative overflow-hidden rounded-[32px] border border-white/40 bg-white/80 shadow-[0_28px_70px_rgba(15,23,42,0.15)] backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                <div className="grid grid-cols-2 gap-2 p-3">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl">
                    <Image
                      src="/our_story/Ludo_withfrisbee.png"
                      alt="Ludo with his frisbee"
                      width={520}
                      height={640}
                      className="h-full w-full object-cover"
                      priority
                    />
                  </div>
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl">
                    <Image
                      src="/our_story/Ludo_happyboy.png"
                      alt="Ludo smiling up close"
                      width={520}
                      height={640}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="px-4 pb-4 pt-2">
                  <p className="text-sm uppercase tracking-[0.28em] text-graphite/60 dark:text-white/60">
                    Ludo
                  </p>
                  <p className="mt-2 text-base text-graphite/80 dark:text-slate-200">
                    Goofy, clumsy, and brilliant. Ludo was the dog who never
                    missed a meal.
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[32px] border border-white/40 bg-white/80 shadow-[0_28px_70px_rgba(15,23,42,0.15)] backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                <div className="grid grid-cols-2 gap-2 p-3">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl">
                    <Image
                      src="/our_story/Pixel_bypond.png"
                      alt="Pixel by the koi pond"
                      width={520}
                      height={640}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl">
                    <Image
                      src="/our_story/Pixel_fixatedontoy.png"
                      alt="Pixel focused on a toy"
                      width={520}
                      height={640}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="px-4 pb-4 pt-2">
                  <p className="text-sm uppercase tracking-[0.28em] text-graphite/60 dark:text-white/60">
                    Pixel
                  </p>
                  <p className="mt-2 text-base text-graphite/80 dark:text-slate-200">
                    A rescue who found his forever home. Timid but fearless at
                    play, picky about food, laser focused on work, and still
                    with us today.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <h2 className="text-3xl font-serif font-semibold">
                The moment we realized we needed a better system
              </h2>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                Ludo had been to the vet not long before. He was not showing
                obvious symptoms. That is what made the news so devastating.
                An aggressive cancer had been growing quietly, and by the time
                we saw the warning signs, it was too late. We lost him soon
                after.
              </p>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                Looking back, there were signs we did not fully connect - he
                was drinking more than normal, eating grass, and chewing on his
                feet. He also had behavior quirks we were working to correct,
                like eating poop. It made us realize how easy it is to miss
                early changes when daily life moves fast.
              </p>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                We kept thinking: if the early changes had been easier to spot,
                would we have had more time? Would other families? That question
                became the foundation of InsightScoop.
              </p>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                We started researching how to prevent surprises like this and
                fell down a rabbit hole of stories: ulcers missed for months,
                tapeworms and parvo not caught early, and even dogs swallowing
                sharp objects. The pattern was consistent - the early clues
                were often there, just easy to overlook.
              </p>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900">
                <h3 className="text-lg font-semibold">What the stories had in common</h3>
                <ul className="mt-4 grid gap-3 text-sm text-graphite/70 dark:text-slate-300">
                  {RESEARCH_TAKEAWAYS.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span
                        className="mt-1 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: brandColors.coral }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900">
              <div className="mb-5 overflow-hidden rounded-2xl">
                <Image
                  src="/our_story/Ludo_staringatpond.png"
                  alt="Ludo staring at the koi pond"
                  width={600}
                  height={400}
                  className="h-64 w-full object-cover object-center"
                />
              </div>
              <h3 className="text-lg font-semibold">The koi pond reminder</h3>
              <p className="mt-4 text-sm text-graphite/70 dark:text-slate-300">
                Around the same time, we built a koi pond. Pixel started
                drinking from it daily - and still does. Suddenly we were
                thinking about parasites, standing water, and how easy it is
                to miss a risk hiding in plain sight.
              </p>
              <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                Prevention starts with visibility
              </div>
              <p className="mt-4 text-sm text-graphite/70 dark:text-slate-300">
                We wanted a low effort way to notice changes in real time -
                before a subtle pattern turns into an emergency.
              </p>
            </div>
          </div>
        </section>

        <section className="container pb-16">
          <div className="grid gap-8 rounded-[36px] border border-slate-200 bg-white px-8 py-12 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <h2 className="text-3xl font-serif font-semibold">
                Why InsightScoop exists
              </h2>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                We built InsightScoop to make gut health, stool patterns, and
                symptom changes visible - without forcing pet parents to become
                clinicians. A single tap can log a scan, a check-in, or a note.
                That trail becomes a clear story you can share with your vet
                when it matters.
              </p>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                We also learned how much pet waste ends up in landfills, how
                much plastic is used for bags, how methane builds in landfills,
                and how runoff can affect local water. Cleaner yards and smarter
                disposal are part of the same promise.
              </p>
              <p className="text-sm text-graphite/60 dark:text-slate-400">
                InsightScoop does not diagnose. We help you spot patterns so you
                can decide when to watch, monitor, or call your vet.
              </p>
            </div>
            <div className="space-y-5">
              {VALUES.map((value) => (
                <div
                  key={value.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ background: withAlpha(brandColors.mint, 0.18) }}
                    >
                      <value.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    </span>
                    <h3 className="text-base font-semibold">{value.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-graphite/70 dark:text-slate-300">
                    {value.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container pb-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-serif font-semibold">
                The story we want for every pet parent
              </h2>
              <p className="text-base text-graphite/70 dark:text-slate-300">
                We want to turn "I had no idea" into "I saw it early." That
                means a clean yard, a calmer mind, and a wellness trail you can
                trust.
              </p>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900">
                <div className="overflow-hidden rounded-2xl">
                  <Image
                    src="/our_story/Ludo_goofy.png"
                    alt="Ludo being his goofy, happy self"
                    width={760}
                    height={760}
                    className="w-full object-contain"
                  />
                </div>
                <p className="mt-4 text-sm uppercase tracking-[0.28em] text-graphite/60 dark:text-white/60">
                  In memory of Ludo
                </p>
                <p className="mt-3 text-base text-graphite/80 dark:text-slate-200">
                  Ludo&apos;s story is why InsightScoop exists. Every scan, note, and
                  reminder is built so fewer families are caught off guard.
                </p>
              </div>
              <div className="mt-6 rounded-3xl border border-emerald-200/60 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-900/20">
                <p className="text-sm uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
                  Still with us
                </p>
                <p className="mt-2 text-base text-graphite/80 dark:text-slate-200">
                  Pixel carries the mission forward. He&apos;s our daily reminder
                  to stay curious, watch for the quiet changes, and never stop
                  learning.
                </p>
              </div>
            </div>
            <div className="rounded-[36px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-xl font-semibold">The moments that shaped InsightScoop</h3>
              <p className="mt-3 text-sm text-graphite/70 dark:text-slate-300">
                Every feature we build is anchored to a moment that taught us
                how quickly things can change - and how much earlier signals
                matter.
              </p>
              <div className="mt-6 grid gap-4 text-sm text-graphite/70 dark:text-slate-300">
                {STORY_MILESTONES.map((milestone) => (
                  <div key={milestone.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                    <p className="font-semibold text-graphite dark:text-white">
                      {milestone.title}
                    </p>
                    <p className="mt-2 text-sm text-graphite/70 dark:text-slate-300">
                      {milestone.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="rounded-[36px] border border-slate-200 bg-gradient-to-br from-white via-white to-amber-50 p-10 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-graphite/60 dark:text-white/60">
                  Join the mission
                </p>
                <h2 className="mt-3 text-3xl font-serif font-semibold">
                  Let&apos;s help pets live longer, healthier lives.
                </h2>
                <p className="mt-3 text-sm text-graphite/70 dark:text-slate-300">
                  Download the free app, or add pro assisted scooping when you
                  want effortless consistency.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/wellness"
                  className="btn-cta-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
                >
                  Download the app
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-graphite shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/15 dark:bg-slate-900 dark:text-white"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
