"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, MessageCircle } from "lucide-react";
import Image from "next/image";
import { motion } from "@/lib/framermotion";
import Reveal from "@/components/Reveal";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";

const useFaqBackground = () => {
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
        ? { desktop: "/hero_backgrounds/husky_black_right_dark.jpeg", mobile: "/hero_backgrounds/husky_black_right_dark.jpeg" }
        : { desktop: "/hero_backgrounds/husky_white_right_light.jpeg", mobile: "/hero_backgrounds/husky_white_right_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(8,16,12,0.5) 0%, rgba(8,20,14,0.42) 50%, rgba(12,26,18,0.34) 100%)";
    }
    return "linear-gradient(155deg, rgba(8,16,12,0.34) 0%, rgba(8,20,14,0.32) 50%, rgba(12,22,16,0.3) 100%)";
  }, [theme]);

  const backgroundColor = theme === "dark" ? "#0a100c" : "#f8f5ee";

  return { backgroundSrc, overlayStyle, backgroundColor };
};

// FAQ Schema for structured data
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What areas do you serve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We're expanding fast through our scooper marketplace. See all live and upcoming cities at insightscoop.com/city. Once an area hits minimum viable density (local scoopers + customer demand), it goes live. Join the waitlist to help your city launch sooner.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to sign a contract?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No contracts. You can pause, skip, or cancel anytime. We just ask for a quick heads up so we can update your route.",
      },
    },
    {
      "@type": "Question",
      name: "How does pricing work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pricing is based on dogs, yard size, and service cadence. Every plan includes consistent scooping plus a recap link with stool health notes.",
      },
    },
    {
      "@type": "Question",
      name: "Why is every-other-week service more expensive per visit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every-other-week service is usually more per visit because there’s more buildup to clear each time. Your monthly total can still be lower because there are fewer visits.",
      },
    },
    {
      "@type": "Question",
      name: "What are the disposal / eco options?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Standard disposal is included (sealed bagging, left tidy in your bin). Optional upgrades include haul-away and compost routing via our small in-house composter when capacity allows.",
      },
    },
    {
      "@type": "Question",
      name: "What are the stool health notes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "They’re simple, calm notes in your recap link: Color, Content, and Consistency. It’s meant to help you spot changes over time without inspecting.",
      },
    },
    {
      "@type": "Question",
      name: "What if my dog is in the yard?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We're pet-friendly. If your dog is comfortable with visitors, we'll proceed. Otherwise, you can secure your pup or we'll coordinate a revisit.",
      },
    },
    {
      "@type": "Question",
      name: "How does this work with multiple dogs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The recap is yard-based, not per-dog. With multiple dogs, we can’t reliably attribute a specific note to a specific dog—but you still get a simple record of what was seen that week.",
      },
    },
    {
      "@type": "Question",
      name: "Do you send constant alerts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. You get a recap link after service. It’s designed to be low-noise—check it when you want.",
      },
    },
    {
      "@type": "Question",
      name: "What if there's snow or bad weather?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We scoop in most weather. In heavy snowfall or unsafe conditions, we'll reschedule and catch up on the next visit.",
      },
    },
    {
      "@type": "Question",
      name: "How do I get started?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Click 'Get my quote', choose your cadence, and we’ll confirm availability and next steps.",
      },
    },
  ],
};

const faqStats = [
  { value: "62", label: "families enrolled so far" },
  { value: "24/7", label: "dispatch monitoring + weather reroutes" },
  { value: "$0", label: "contracts, deposits, or cancellation fees" },
];

export default function FAQ() {
  const { backgroundSrc, overlayStyle, backgroundColor } = useFaqBackground();

  const faqItems = [
    {
      id: "item-1",
      icon: "",
      question: "What areas do you serve?",
      answer:
        "We're expanding fast through our scooper marketplace. Check /city to see all live and upcoming cities. Once an area hits minimum viable density (local scoopers + customer demand), it goes live. Join the waitlist to help your city launch sooner!",
      category: "service",
      link: "/city",
    },
    {
      id: "item-2",
      icon: "",
      question: "Do I need to sign a contract?",
      answer:
        "No contracts. You can pause, skip, or cancel anytime. We just ask for a quick heads up so we can update your route.",
      category: "service",
    },
    {
      id: "item-3",
      icon: "",
      question: "How does pricing work?",
      answer:
        "Pricing is based on dogs, yard size, and cadence. Every plan includes consistent scooping plus a recap link with stool health notes.",
      category: "pricing",
    },
    {
      id: "item-4",
      icon: "",
      question: "What if my dog is in the yard?",
      answer:
        "We're pet-friendly. If your dog is comfortable with visitors, we'll proceed. Otherwise, you can secure your pup or we'll coordinate a revisit.",
      category: "service",
    },
    {
      id: "item-4a",
      icon: "",
      question: "How does this work with multiple dogs?",
      answer:
        "The recap is yard-based, not per-dog. With multiple dogs, we can’t reliably attribute a specific note to a specific dog—but you still get a simple record of what was seen that week.",
      category: "service",
    },
    {
      id: "item-5",
      icon: "",
      question: "What are the stool health notes?",
      answer:
        "Simple notes in your recap link covering color, consistency, and content. It helps you spot changes over time without inspecting anything yourself.",
      category: "insights",
    },
    {
      id: "item-6",
      icon: "",
      question: "Why is every-other-week service more expensive per visit?",
      answer:
        "Every-other-week service is usually more per visit because there’s more buildup to clear each time. Your monthly total can still be lower because there are fewer visits.",
      category: "pricing",
    },
    {
      id: "item-7",
      icon: "",
      question: "What are the disposal / eco options?",
      answer:
        "Standard disposal is included (sealed bagging, left tidy in your bin). Optional upgrades include haul-away and compost routing via our small in-house composter when capacity allows.",
      category: "eco",
    },
    {
      id: "item-8",
      icon: "",
      question: "Do you send constant alerts?",
      answer:
        "No. You get a recap link after service. It’s designed to be low-noise—check it when you want.",
      category: "insights",
    },
    {
      id: "item-9",
      icon: "",
      question: "Is compost partner-based?",
      answer:
        "Not right now. Compost routing runs through our small in-house composter while we scale, and it’s capacity-dependent.",
      category: "eco",
    },
    {
      id: "item-10",
      icon: "",
      question: "Can I pause or cancel anytime?",
      answer:
        "Yes—no contracts. You can pause, skip, or cancel anytime. Just give us a quick heads up so we can update your route.",
      category: "eco",
    },
    {
      id: "item-11",
      icon: "",
      question: "What if there's snow or bad weather?",
      answer:
        "We scoop in most weather. In heavy snowfall or unsafe conditions, we'll reschedule and catch up on the next visit.",
      category: "service",
    },
    {
      id: "item-11a",
      icon: "",
      question: "Does weather affect the recap?",
      answer:
        "Sometimes. Extreme conditions can reduce visibility, but you’ll still get a clean yard and a recap of what was seen during service.",
      category: "service",
    },
    {
      id: "item-12",
      icon: "",
      question: "How do I get started?",
      answer:
        "Click “Get my quote”, choose your cadence, and we’ll confirm availability and next steps.",
      category: "service",
    },
  ];

  const renderAccordionItems = () =>
    faqItems.map((faq) => (
      <AccordionItem
        key={faq.id}
        value={faq.id}
        className="rounded-[28px] border border-white/12 bg-white/5 shadow-[0_20px_42px_rgba(3,7,6,0.55)] transition-all duration-300"
      >
        <AccordionTrigger className="px-6 py-5 text-left text-lg font-serif font-semibold text-white hover:no-underline group data-[state=open]:text-brand-gold">
          {faq.question}
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-5 text-white/80 leading-relaxed text-left">
          {faq.answer}
          {"link" in faq && faq.link && (
            <a
              href={faq.link}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-brand-coral/30 bg-brand-coral/10 px-4 py-2 text-sm font-semibold text-brand-coral transition-all hover:bg-brand-coral/20"
            >
              View all cities
              <span className="text-base">→</span>
            </a>
          )}
        </AccordionContent>
      </AccordionItem>
    ));
  return (
    <section
      id="faq"
      className="landing-section section-modern relative overflow-hidden"
      style={{ backgroundColor: backgroundColor }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Customer discussing pet care questions outdoors"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "55% center" }}
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
        <Reveal>
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
              <HelpCircle className="size-4 text-brand-mint" />
              Clarity beats fine print
            </div>
            <h2 className="mt-6 text-5xl font-serif leading-tight md:text-6xl">
              Ask anything. Get a straight answer.
            </h2>
            <p className="mt-4 text-lg text-white/85">
              Pricing, scheduling, recaps, eco options, weather plans — it’s all transparent. No contracts, no surprise fees.
            </p>
          </div>
        </Reveal>

        <div className="max-w-5xl mx-auto">
          <Reveal delay={0.2}>
            <Accordion type="single" collapsible className="w-full space-y-4 mb-12">
              {renderAccordionItems()}
            </Accordion>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/18 bg-[rgba(12,24,18,0.78)] p-5 shadow-[0_24px_48px_rgba(3,7,6,0.5)]">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-brand-gold" />
                  <span className="text-sm font-serif font-semibold text-white">Need a snow-day scoop?</span>
                </div>
                <p className="mt-3 text-sm text-white/78 leading-relaxed">
                  We work through most weather, but on heavy snow days we reschedule and return as soon as it’s safe. Your billing stays synced with your service cadence.
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/8 border border-white/15 p-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-xl">
                    <Image
                      src="/dog_images2/snow_dog.jpg"
                      alt="Dog bundled up for winter"
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="text-xs text-white/70">
                    Tip: Leave a path to your yard gate and we’ll handle the rest - even after a blizzard.
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/18 bg-[rgba(12,24,18,0.78)] p-5 shadow-[0_24px_48px_rgba(3,7,6,0.5)]">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-brand-coral" />
                  <span className="text-sm font-serif font-semibold text-white">Still curious?</span>
                </div>
                <p className="mt-3 text-sm text-white/78 leading-relaxed">
                  Drop us a line at <a className="font-semibold text-brand-gold" href="mailto:hello@yardura.com">hello@yardura.com</a> or text <span className="font-semibold text-white">1-877-417-YARD</span>. We're happy to help tailor the perfect plan for your dogs.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Help Section CTA */}
        <Reveal delay={0.4}>
          <div className="text-center mt-20">
            <div className="rounded-3xl p-10 max-w-4xl mx-auto border border-white/18 bg-[rgba(12,24,18,0.8)] shadow-[0_32px_72px_rgba(3,7,6,0.6)]">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: withAlpha(brandColors.gold, 0.22), color: brandColors.coral }}>
                  <MessageCircle className="size-8" />
                </div>
              <h3 className="text-3xl font-serif font-semibold text-white">
                Still have questions?
              </h3>
              </div>
              <p className="text-white/78 text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
                Can't find what you're looking for? Our team is here to help you
                choose the perfect service for your needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <a
                  href="/quote?businessId=yardura"
                  className="btn-cta-primary group"
                >
                  <span className="flex items-center gap-2 text-white">
                    Get my quote
                    <span className="text-xl group-hover:translate-x-1 transition-transform duration-200">
                      →
                    </span>
                  </span>
                </a>
                <a
                  href="tel:+18774179273"
                  className="px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-white/25 bg-brand-accent text-white"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">📞</span>
                    <span>Call Us: 1-877-417-YARD</span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </Reveal>

        {/* FAQ Schema for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </div>
    </section>
  );
}
