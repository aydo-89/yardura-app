export interface InsightArticle {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  readingTime: string;
  heroImage?: string;
  tags: string[];
  sections: Array<{
    heading: string;
    body: string[];
    outboundLinks?: Array<{ label: string; url: string }>;
  }>;
  takeaway: string;
}

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    slug: "dog-stool-color-cheat-sheet",
    title: "Dog stool color cheat sheet: when to call the vet",
    excerpt:
      "Use InsightScoop's 3C framework—color, consistency, content—to interpret stool color changes and understand when a vet consult is smart.",
    author: "InsightScoop Wellness Team",
    publishedAt: "2024-09-18",
    readingTime: "6 min read",
    heroImage: "/insights/stool-color-guide.png",
    tags: ["Wellness", "AI Insights", "Veterinary Guidance"],
    sections: [
      {
        heading: "Why stool color matters",
        body: [
          "Our AI InsightCamera flags color deviations so you can react before a small change becomes a vet emergency. A healthy stool typically runs chocolate brown thanks to bile pigments.",
          "When color shifts, it's often tied to diet, hydration, gastrointestinal bleeding, or even medication side effects. Logging stool color weekly creates a reliable health baseline.",
        ],
        outboundLinks: [
          {
            label: "American Kennel Club stool color breakdown",
            url: "https://www.akc.org/expert-advice/health/dog-poop-color-chart/",
          },
          {
            label: "University of Minnesota Veterinary Diagnostics",
            url: "https://vetmed.umn.edu/centers-programs/diagnostic-laboratory",
          },
        ],
      },
      {
        heading: "InsightScoop quick reference",
        body: [
          "Green or grassy stools typically follow heavy lawn grazing—monitor for 24 hours. Persistent green may signal bile issues.",
          "Black or tarry stools indicate digested blood in the upper GI. InsightScoop flags this as urgent; contact your veterinarian immediately.",
          "Clay or grey stools suggest bile duct blockage. Combine our AI flag with a same-day vet appointment.",
          "Bright red streaks often come from lower GI irritation or anal glands. Keep the sample and consult your vet, especially if it persists beyond 12 hours.",
        ],
      },
      {
        heading: "How InsightScoop alerts you",
        body: [
          "Technicians capture a minimum of three AI-ready samples during each InsightCamera session.",
          "Our algorithm scores each sample. If color falls outside of baseline tolerance, you receive an InsightSummary with next-step guidance.",
          "We never diagnose—your veterinarian remains the decision-maker. InsightScoop simply gives you objective, time-stamped data to share.",
        ],
      },
    ],
    takeaway:
      "Trust your instincts. If stool color changes alongside lethargy, appetite loss, or vomiting, book a vet visit. InsightScoop's AI reporting makes that conversation faster and clearer.",
  },
  {
    slug: "sanitize-dog-gear-without-hurting-lawns",
    title: "How to sanitize dog gear without ruining your lawn",
    excerpt:
      "Learn InsightScoop's sanitation protocol—approved for Minnesota lawns and lakefront decks—to keep pathogens away without scorching turf.",
    author: "Field Ops Lead, InsightScoop",
    publishedAt: "2024-08-07",
    readingTime: "5 min read",
    heroImage: "/insights/sanitation-gear.png",
    tags: ["Operations", "Eco Practices"],
    sections: [
      {
        heading: "The InsightScoop sanitation stack",
        body: [
          "We disinfect in three steps: pre-rinse, pet-safe enzymatic cleaner, then a final isopropyl wipe on high-touch surfaces like scoops and Bluetooth remotes.",
          "Our enzymatic blend neutralizes pathogens including giardia, parvo, and roundworm eggs while remaining safe for turf, decks, and composite surfaces.",
        ],
        outboundLinks: [
          {
            label: "EPA list of disinfectants for canine pathogens",
            url: "https://www.epa.gov/pesticide-registration/list-g-disinfectants",
          },
        ],
      },
      {
        heading: "DIY sanitation checklist",
        body: [
          "Use a dedicated rinse bucket so contaminants never flow into storm drains.",
          "Scrub tools with a stiff brush, apply enzyme solution for at least 60 seconds, then rinse with low-pressure water.",
          "Finish with a 70% isopropyl wipe on handles, Bluetooth shutters, and phone mounts.",
        ],
      },
      {
        heading: "When to escalate",
        body: [
          "If a household experiences parvo, coccidia, or giardia, request InsightScoop's high-temp sanitization add-on and consult your vet for yard-safe disinfectant guidance.",
          "Wait 48 hours before reintroducing dogs after a confirmed contagion. InsightScoop logs sanitation photos so you have proof of compliance.",
        ],
      },
    ],
    takeaway:
      "Consistent sanitation protects pets, techs, and the next yard on the route. Copy our protocol or add InsightScoop's sanitation service to your weekly plan.",
  },
];

export const getInsightArticle = (slug: string) =>
  INSIGHT_ARTICLES.find((article) => article.slug === slug) ?? null;
