import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// FAQ Schema for structured data
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What areas do you serve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We currently serve South Minneapolis, Richfield, Edina, and Bloomington. Nearby areas may be available as we expand—ask when you request a quote."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need to sign a contract?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No contracts. You can pause, skip, or cancel anytime. We just ask for a quick heads up so we can update your route."
      }
    },
    {
      "@type": "Question",
      "name": "How does pricing work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We match local market pricing and show example rates in the calculator. Final price is confirmed after the first visit or initial clean if needed."
      }
    },
    {
      "@type": "Question",
      "name": "What if my dog is in the yard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We're pet-friendly. If your dog is comfortable with visitors, we'll proceed. Otherwise, you can secure your pup or we'll coordinate a revisit."
      }
    },
    {
      "@type": "Question",
      "name": "What are the 'health insights' and data opt-in?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If you opt in, we collect anonymized stool photos and notes to build baselines for the 3 C's (Color, Content, Consistency). Alerts are informational only and not veterinary advice."
      }
    },
    {
      "@type": "Question",
      "name": "How does the eco program work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We're piloting composting/conditioning routes to keep waste out of landfills and reduce methane. Your dashboard will estimate impact as the program expands."
      }
    },
    {
      "@type": "Question",
      "name": "What if there's snow or bad weather?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We scoop in most weather. In heavy snowfall or unsafe conditions, we'll reschedule and catch up on the next visit."
      }
    },
    {
      "@type": "Question",
      "name": "How do I get started?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Click 'Get My Quote', fill in your details and preferences, and we'll confirm schedule and price by text/email."
      }
    }
  ]
};

export default function FAQ() {
  return (
    <section id="faq" className="container py-16">
      
      
      
      <h2 className="text-3xl font-extrabold text-ink">FAQ</h2>
      <p className="text-slate-700 mt-2">Answers to common questions about Yardura’s service, pricing, and upcoming insights features.</p>

      <div className="mt-6">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>What areas do you serve?</AccordionTrigger>
            <AccordionContent>
              We currently serve South Minneapolis, Richfield, Edina, and Bloomington. Nearby areas may be available as we expand—ask when you request a quote.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Do I need to sign a contract?</AccordionTrigger>
            <AccordionContent>
              No contracts. You can pause, skip, or cancel anytime. We just ask for a quick heads up so we can update your route.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>How does pricing work?</AccordionTrigger>
            <AccordionContent>
              We match local market pricing and show example rates in the calculator. Final price is confirmed after the first visit or initial clean if needed.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>What if my dog is in the yard?</AccordionTrigger>
            <AccordionContent>
              We’re pet-friendly. If your dog is comfortable with visitors, we’ll proceed. Otherwise, you can secure your pup or we’ll coordinate a revisit.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-5">
            <AccordionTrigger>What are the “health insights” and data opt-in?</AccordionTrigger>
            <AccordionContent>
              If you opt in, we collect anonymized stool photos and notes to build baselines for the 3 C’s (Color, Content, Consistency). Alerts are informational only and not veterinary advice.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-6">
            <AccordionTrigger>How does the eco program work?</AccordionTrigger>
            <AccordionContent>
              We’re piloting composting/conditioning routes to keep waste out of landfills and reduce methane. Your dashboard will estimate impact as the program expands.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-7">
            <AccordionTrigger>What if there’s snow or bad weather?</AccordionTrigger>
            <AccordionContent>
              We scoop in most weather. In heavy snowfall or unsafe conditions, we’ll reschedule and catch up on the next visit.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-8">
            <AccordionTrigger>How do I get started?</AccordionTrigger>
            <AccordionContent>
              Click “Get My Quote”, fill in your details and preferences, and we’ll confirm schedule and price by text/email.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* FAQ Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  );
}


