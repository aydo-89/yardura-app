import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, ChevronDown, MessageCircle } from "lucide-react";
import Reveal from "@/components/Reveal";

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
        text: "We currently serve South Minneapolis, Richfield, Edina, and Bloomington. Nearby areas may be available as we expand—ask when you request a quote.",
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
        text: "We use a transparent pricing matrix starting at $20/weekly for 1 dog (medium yard). Price increases with dog count ($4 each additional dog) and yard size. Basic health insights are included at no extra cost. Premium eco diversion options are available as add-ons.",
      },
    },
    {
      "@type": "Question",
      name: "Why is every-other-week service more expensive per visit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "EOW service costs 25% more per visit because two weeks of waste accumulation requires longer service time and creates less route efficiency. However, your monthly total is lower due to fewer visits.",
      },
    },
    {
      "@type": "Question",
      name: "Is eco diversion an extra fee?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Basic eco-friendly disposal is included in our core service at no extra cost - we always use biodegradable plastic bags and eco-friendly deodorizing practices, leaving waste in your bin. Premium take away options (25%, 50%, or 100% diversion) are available for +$4-$10 per visit to fund expansion of our eco-program.",
      },
    },
    {
      "@type": "Question",
      name: "Are health insights extra?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Basic health insights (3 C's monitoring) are included at no extra cost. A premium Insights Plus tier may be available later for advanced analytics, export features, and priority support.",
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
      name: "What are the 'health insights' and data opt-in?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If you opt in, we collect anonymized stool photos and notes to build baselines for the 3 C's (Color, Content, Consistency). Alerts are informational only and not veterinary advice.",
      },
    },
    {
      "@type": "Question",
      name: "How does the eco program work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We’re piloting composting/conditioning routes to keep waste out of landfills and reduce methane. Your dashboard will estimate impact as the program expands.",
      },
    },
    {
      "@type": "Question",
      name: "Why do you charge for premium diversion options?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Premium diversion options (25%, 50%, or 100% diversion) require additional processing, transportation, and infrastructure. These charges help fund expansion of our eco-program while keeping our core service affordable. All diversion levels provide dashboard tracking of your environmental impact.",
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
        text: "Click 'Get My Quote', fill in your details and preferences, and we'll confirm schedule and price by text/email.",
      },
    },
  ],
};

export default function FAQ() {
  return (
    <section id="faq" className="section-modern gradient-section-warm">
      <div className="container">
        <Reveal>
          <div className="text-center mb-16">
            <div className="relative">
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                Got{" "}
                <span className="relative">
                  Questions?
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-cyan-700 via-cyan-600 to-white rounded-full"></div>
                </span>
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Everything you need to know about our service
              </p>
            </div>
          </div>
        </Reveal>

        <div className="max-w-4xl mx-auto">
          <Reveal delay={0.2}>
            <Accordion type="single" collapsible className="w-full space-y-4">
              {[
                {
                  id: "item-1",
                  icon: "",
                  question: "What areas do you serve?",
                  answer:
                    "We currently serve South Minneapolis, Richfield, Edina, and Bloomington. Nearby areas may be available as we expand—ask when you request a quote.",
                  category: "service",
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
                    "We use a transparent pricing matrix starting at $20/weekly for 1 dog (medium yard). Price increases with dog count ($4 each additional dog) and yard size. Basic health insights are included at no extra cost. Premium eco diversion options are available as add-ons.",
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
                  id: "item-5",
                  icon: "",
                  question: "What are the 'health insights' and data opt-in?",
                  answer:
                    "If you opt in, we collect anonymized stool photos and notes to build baselines for the 3 C's (Color, Content, Consistency). Alerts are informational only and not veterinary advice.",
                  category: "insights",
                },
                {
                  id: "item-6",
                  icon: "",
                  question:
                    "Why is every-other-week service more expensive per visit?",
                  answer:
                    "EOW service costs 25% more per visit because two weeks of waste accumulation requires longer service time and creates less route efficiency. However, your monthly total is lower due to fewer visits.",
                  category: "pricing",
                },
                {
                  id: "item-7",
                  icon: "",
                  question: "Is eco diversion an extra fee?",
                  answer:
                    "Basic eco-friendly disposal is included in our core service at no extra cost - we always use biodegradable plastic bags and eco-friendly deodorizing practices, leaving waste in your bin. Premium diversion options (25%, 50%, or 100% diversion) are available for +$4-$10 per visit to fund expansion of our eco-program.",
                  category: "eco",
                },
                {
                  id: "item-8",
                  icon: "",
                  question: "Are health insights extra?",
                  answer:
                    "Basic health insights (3 C's monitoring) are included at no extra cost. A premium Insights Plus tier may be available later for advanced analytics, export features, and priority support.",
                  category: "insights",
                },
                {
                  id: "item-9",
                  icon: "",
                  question: "How does the eco program work?",
                  answer:
                    "We're piloting composting/conditioning routes to keep waste out of landfills and reduce methane. Your dashboard will estimate impact as the program expands.",
                  category: "eco",
                },
                {
                  id: "item-9.5",
                  icon: "",
                  question: "Why do you charge for premium diversion options?",
                  answer:
                    "Premium diversion options (25%, 50%, or 100% diversion) require additional processing, transportation, and infrastructure. These charges help fund expansion of our eco-program while keeping our core service affordable. All diversion levels provide dashboard tracking of your environmental impact.",
                  category: "eco",
                },
                {
                  id: "item-10",
                  icon: "",
                  question: "What if there's snow or bad weather?",
                  answer:
                    "We scoop in most weather. In heavy snowfall or unsafe conditions, we'll reschedule and catch up on the next visit.",
                  category: "service",
                },
                {
                  id: "item-11",
                  icon: "",
                  question: "How do I get started?",
                  answer:
                    "Click 'Get My Quote', fill in your details and preferences, and we'll confirm schedule and price by text/email.",
                  category: "service",
                },
              ].map((faq, index) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="card-modern border-0 shadow-card hover:shadow-floating transition-all duration-300"
                >
                  <AccordionTrigger className="px-8 py-6 hover:no-underline group">
                    <div className="flex items-center gap-4 text-left">
                      <div className="text-2xl">{faq.icon}</div>
                      <span className="text-lg font-semibold text-slate-900 group-hover:text-green-700 transition-colors duration-200">
                        {faq.question}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6">
                    <div className="flex gap-4">
                      <div className="w-8 flex-shrink-0"></div>
                      <p className="text-slate-600 leading-relaxed text-balance">
                        {faq.answer}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>

        {/* Help Section CTA */}
        <Reveal delay={0.4}>
          <div className="text-center mt-20">
            <div className="bg-gradient-to-br from-emerald-50/90 via-green-50/50 to-emerald-100/70 border border-emerald-200/30 rounded-3xl p-10 shadow-card max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-2xl shadow-sm">
                  <MessageCircle className="size-8 text-emerald-700" />
                </div>
                <h3 className="text-3xl font-black text-slate-900">
                  Still have questions?
                </h3>
              </div>
              <p className="text-slate-600 text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
                Can't find what you're looking for? Our team is here to help you
                choose the perfect service for your needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <a
                  href="/quote?businessId=yardura"
                  className="btn-cta-primary group"
                >
                  <span className="flex items-center gap-2">
                    Get Your Quote
                    <span className="text-xl group-hover:translate-x-1 transition-transform duration-200">
                      →
                    </span>
                  </span>
                </a>
                <a
                  href="tel:+18889159273"
                  className="px-6 py-3 border border-emerald-600 text-emerald-600 rounded-xl font-semibold hover:bg-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">📞</span>
                    <span>Call Us: 1-888-915-YARD</span>
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
