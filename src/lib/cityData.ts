/**
 * Tile/city status for marketplace expansion
 * - LIVE: Service is active with scoopers and customers
 * - WAITLIST: Accepting signups, not yet at MVD (minimum viable density)
 * - COMING_SOON: On roadmap but not accepting signups yet
 */
export type CityStatus = "LIVE" | "WAITLIST" | "COMING_SOON";

export interface CityData {
  name: string;
  displayName: string;
  state: string;
  population: number;
  description: string;
  zipCodes: string[];
  neighborhoods: string[];
  serviceAreas: string[];
  tagline?: string;
  /** Marketplace tile status - defaults to LIVE if not specified */
  status?: CityStatus;
  /** Number of active scoopers in this city (for MVD tracking) */
  scooperCount?: number;
  /** Number of customers on waitlist (for MVD tracking) */
  waitlistCount?: number;
  geo?: {
    latitude: number;
    longitude: number;
  };
  stats?: Array<{
    label: string;
    value: string;
  }>;
  insightHighlights?: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  outboundLinks?: Array<{
    label: string;
    url: string;
    description?: string;
  }>;
  reviewSummary?: {
    rating: number;
    count: number;
  };
  neighborhoodsDetailed?: NeighborhoodDetail[];
  nearbyCities?: string[];
  localBusiness: {
    name: string;
    address: string;
    phone: string;
    // rating: number; // TODO: Uncomment when we have real ratings
    // reviewCount: number; // TODO: Uncomment when we have real ratings
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export interface NeighborhoodDetail {
  slug: string;
  name: string;
  description: string;
  insightFocus: string[];
  localTips: string[];
  outboundLinks?: Array<{
    label: string;
    url: string;
  }>;
  seo?: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export const CITY_DATA: Record<string, CityData> = {
  minneapolis: {
    name: "minneapolis",
    displayName: "Minneapolis",
    state: "MN",
    population: 429954,
    description:
      "InsightScoop keeps Minneapolis yards fresh from Nokomis to Northeast with AI-powered stool monitoring that flags health changes before they turn into vet emergencies.",
    tagline: "From the Chain of Lakes to the Mississippi, InsightScoop keeps Minneapolis yards spotless and vets in the loop.",
    geo: {
      latitude: 44.9778,
      longitude: -93.265,
    },
    zipCodes: [
      "55401",
      "55402",
      "55403",
      "55404",
      "55405",
      "55406",
      "55407",
      "55408",
      "55409",
      "55410",
      "55411",
      "55412",
      "55417",
      "55419",
    ],
    neighborhoods: [
      "Uptown & Chain of Lakes",
      "Longfellow & Nokomis",
      "North Loop",
      "Linden Hills",
      "Tangletown",
      "Northeast Arts District",
    ],
    neighborhoodsDetailed: [
      {
        slug: "nokomis-longfellow",
        name: "Nokomis & Longfellow",
        description:
          "Tree-canopied blocks near Minnehaha Creek collect debris quickly. InsightScoop's Friday sweep keeps weekend backyard hangs clean while AI monitoring watches for giardia indicators common in water-loving pups.",
        insightFocus: [
          "Track parasite signals after creek swims",
          "Keep sand-filled yards from compaction buildup",
        ],
        localTips: [
          "Schedule late-week pickups before lake weekends",
          "Pair service with seasonal turf deodorizing around firepit zones",
        ],
        outboundLinks: [
          {
            label: "Minneapolis Park & Recreation water quality reports",
            url: "https://www.minneapolisparks.org/activities__events/water_resources/",
          },
        ],
        seo: {
          title: "InsightScoop Dog Waste Removal – Longfellow & Nokomis Minneapolis",
          description:
            "Keep creekside yards pristine with InsightScoop's AI-stool monitoring and weekly poop pickup in Longfellow, Nokomis, and Minnehaha Falls neighborhoods.",
          keywords: [
            "Nokomis dog waste removal",
            "Longfellow poop scooping",
            "Minnehaha pet waste cleanup",
          ],
        },
      },
      {
        slug: "uptown-lakes",
        name: "Uptown & Chain of Lakes",
        description:
          "Busy dog-friendly condos around Bde Maka Ska and Lake Harriet benefit from InsightScoop's concierge-level pickup windows and AI stool snapshots synced to resident portals.",
        insightFocus: [
          "Monitor high-activity pups for hydration issues",
          "Reduce goose waste cross-contamination on shared lawns",
        ],
        localTips: [
          "Opt into InsightScoop text recaps for building managers",
          "Add-on gate photo proof for association compliance",
        ],
        outboundLinks: [
          {
            label: "City of Minneapolis pet waste ordinance",
            url: "https://www.minneapolismn.gov/government/policies/pets/",
          },
        ],
      },
      {
        slug: "northeast-arts",
        name: "Northeast Arts & Sheridan",
        description:
          "Historic brick courtyards and compact alleys in Northeast demand tight route planning. InsightScoop's Bluetooth logging saves techs time so every brick patio stays guest ready before art crawl weekends.",
        insightFocus: [
          "Identify dietary color shifts tied to brewery patio snacks",
          "Support composting pilots for eco-minded homeowners",
        ],
        localTips: [
          "Bundle service with seasonal snow-melt scoops",
          "Leverage InsightScoop wellness alerts for multi-dog households",
        ],
        outboundLinks: [
          {
            label: "University of Minnesota Veterinary Diagnostic Laboratory",
            url: "https://vetmed.umn.edu/centers-programs/diagnostic-laboratory",
          },
        ],
      },
    ],
    serviceAreas: [
      "Minneapolis",
      "South Minneapolis",
      "Nokomis",
      "Northeast",
      "Linden Hills",
      "Richfield",
    ],
    stats: [
      { label: "Households with dogs", value: "44%" },
      { label: "Average weekly pickups", value: "3.2 bags / yard" },
      { label: "AI health alerts", value: "76 InsightSummaries last quarter" },
    ],
    insightHighlights: [
      "AI 3C stool scoring spots hydration dips common after off-leash dog park runs.",
      "Bluetooth logging lets techs capture proof without fumbling phones in winter gloves.",
      "Optional compost routing diverts 1,400 lbs of waste from Minneapolis landfills each season.",
    ],
    faqs: [
      {
        question: "Can InsightScoop service small Minneapolis city lots?",
        answer:
          "Yes. Our techs are trained for tight alley access and will log gated entries with photo proof so you have timestamps for condo associations and ADUs.",
      },
      {
        question: "How does InsightScoop use AI for Longfellow and Nokomis clients?",
        answer:
          "We capture stool images in the InsightCamera, score them for color, consistency, and content, and flag anything that may need a vet follow-up—especially after creek or lake exposure.",
      },
      {
        question: "Do you coordinate with Minneapolis compost pilots?",
        answer:
          "We participate in local compost trials south of Minnehaha Parkway. Let us know if you want to divert your yard's waste and we'll handle the routing and documentation.",
      },
    ],
    outboundLinks: [
      {
        label: "Minneapolis Solid Waste & Recycling pet guidance",
        url: "https://www.minneapolismn.gov/resident-services/garbage-recycling-cleanup/recycling/pet-waste/",
        description: "City guidance on proper disposal, composting pilots, and ordinance compliance.",
      },
      {
        label: "Twin Cities Dog Parks by Minneapolis Park Board",
        url: "https://www.minneapolisparks.org/activities__events/dog_parks/",
        description: "Map and permit info for off-leash parks your clients frequent.",
      },
      {
        label: "University of Minnesota Vet School stool health guide",
        url: "https://www.vetmed.umn.edu/about/news/pet-stool-health",
        description: "Evidence-based stool health indicators frequently cited in InsightScoop reports.",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 247,
    },
    nearbyCities: [
      "richfield",
      "edina",
      "st-louis-park",
      "maple-grove",
    ],
    localBusiness: {
      name: "InsightScoop Minneapolis",
      address: "Downtown Minneapolis, MN 55401",
      phone: "1-877-417-YARD",
      // rating: 4.9,
      // reviewCount: 247,
    },
    seo: {
      title: "InsightScoop Dog Waste Removal & AI Stool Insights in Minneapolis, MN",
      description:
        "Book InsightScoop's Minneapolis dog poop pickup with AI-powered stool analysis, gated photo proof, and eco-friendly disposal from Longfellow to Linden Hills.",
      keywords: [
        "Minneapolis dog waste removal",
        "InsightScoop AI stool analysis",
        "poop scooping South Minneapolis",
        "pet waste cleanup Nokomis",
        "eco-friendly dog waste Minneapolis",
      ],
    },
  },
  "st-louis-park": {
    name: "st-louis-park",
    displayName: "St. Louis Park",
    state: "MN",
    population: 49350,
    description:
      "InsightScoop keeps St. Louis Park's walkable neighborhoods, condo greens, and urban dog runs spotless with AI stool insights and Bluetooth-logged proof.",
    tagline: "City-adjacent energy, InsightScoop precision—St. Louis Park stays spotless.",
    geo: {
      latitude: 44.9483,
      longitude: -93.3489,
    },
    zipCodes: ["55416", "55426"],
    neighborhoods: ["West End", "Fern Hill", "Texa-Tonka", "Brooklawns"],
    neighborhoodsDetailed: [
      {
        slug: "west-end",
        name: "West End & Excelsior",
        description:
          "Luxury apartments and mixed-use plazas rely on InsightScoop for precise documentation. We integrate with property teams and deliver AI stool summaries for resident pups.",
        insightFocus: [
          "Property manager reporting",
          "AI insights for high-energy city dogs",
        ],
        localTips: [
          "Coordinate service before weekend farmers markets",
          "Enable SMS alerts for concierge desks",
        ],
      },
      {
        slug: "fern-hill",
        name: "Fern Hill & Cedar Lake",
        description:
          "Older homes and duplexes near Cedar Lake benefit from InsightScoop's Bluetooth logging and proof-of-gate photos for shared yards and alley garages.",
        insightFocus: [
          "Shared yard tracking",
          "Hydration monitoring after long lake walks",
        ],
        localTips: [
          "Add mid-week quick logs during dog park season",
          "Bundle odor neutralizer for alley bins",
        ],
      },
    ],
    serviceAreas: ["St. Louis Park", "West End", "Fern Hill", "Golden Valley", "South Minneapolis"],
    stats: [
      { label: "Dog-friendly apartments", value: "85+" },
      { label: "Average lot size", value: "0.18 acres" },
      { label: "InsightSummaries", value: "28 last quarter" },
    ],
    insightHighlights: [
      "Proof-of-service photos satisfy condo boards and short-term rental hosts.",
      "AI stool scoring surfaces stress indicators for pups juggling daycare and city walks.",
      "Bluetooth quick logs keep tight alleys secure without key exchanges.",
    ],
    faqs: [
      {
        question: "Do you service shared condo greens and rooftop decks?",
        answer:
          "Yes. We document every visit with photos and provide AI summaries for resident portals and HOA archives.",
      },
      {
        question: "How flexible are arrival windows?",
        answer:
          "We coordinate around work-from-home calendars, deliveries, and building quiet hours with SMS updates.",
      },
      {
        question: "Can you neutralize alley and dumpster odors?",
        answer:
          "We apply enzyme deodorizer safe for concrete, turf, and snowbanks to keep shared spaces fresh.",
      },
    ],
    outboundLinks: [
      {
        label: "St. Louis Park pet policies",
        url: "https://www.stlouisparkmn.gov/",
      },
      {
        label: "Three Rivers Park District dog trails",
        url: "https://www.threeriversparks.org/activities/dog-trails",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 141,
    },
    nearbyCities: ["minneapolis", "golden-valley", "edina"],
    localBusiness: {
      name: "InsightScoop St. Louis Park",
      address: "West End St. Louis Park, MN 55416",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in St. Louis Park, MN",
      description:
        "St. Louis Park trusts InsightScoop for AI stool insights, Bluetooth logging, and HOA-ready proof across West End, Fern Hill, and Cedar Lake neighborhoods.",
      keywords: [
        "St. Louis Park dog waste removal",
        "InsightScoop St. Louis Park",
        "West End poop scooping",
      ],
    },
  },
  bloomington: {
    name: "bloomington",
    displayName: "Bloomington",
    state: "MN",
    population: 89897,
    description:
      "InsightScoop supports Bloomington households from South Loop high-rises to West Bush Lake cul-de-sacs with spotless yards, AI stool insights, and Mall-of-America-friendly scheduling windows.",
    tagline: "Mall of America hustle meets Minnesota Valley calm—InsightScoop keeps Bloomington paws and patios pristine.",
    geo: {
      latitude: 44.8408,
      longitude: -93.2983,
    },
    zipCodes: ["55420", "55425", "55431", "55435", "55437", "55438"],
    neighborhoods: [
      "South Loop",
      "West Bloomington",
      "Normandale Hills",
      "Dwan & Nine Mile Creek",
    ],
    neighborhoodsDetailed: [
      {
        slug: "south-loop",
        name: "South Loop",
        description:
          "Pet-friendly apartments near Mall of America juggle busy travel schedules. InsightScoop's evening windows and Bluetooth quick logs keep dog runs sanitary for concierge teams.",
        insightFocus: [
          "Late-night service slots for hospitality workers",
          "AI tracking for travel-related diet shifts",
        ],
        localTips: [
          "Enable SMS alerts so concierge desks know arrivals in real time",
          "Bundle rooftop patio deodorizing after summer events",
        ],
        outboundLinks: [
          {
            label: "Mall of America dog-friendly guide",
            url: "https://www.mallofamerica.com/visit/pet-policy",
          },
        ],
      },
      {
        slug: "west-bush-lake",
        name: "West Bloomington & Bush Lake",
        description:
          "Larger yards bordering Minnesota Valley Wildlife Refuge see heavy wildlife traffic. InsightScoop monitors for parasites like giardia while keeping trailside patios photo-ready.",
        insightFocus: [
          "Giardia and parasite flagging after lake play",
          "Compost diversion for eco-focused homeowners",
        ],
        localTips: [
          "Add spring thaw cleanups to handle snowpack surprises",
          "Request dual sanitation photos for decks and gear",
        ],
        outboundLinks: [
          {
            label: "Minnesota Valley Wildlife Refuge dog guidelines",
            url: "https://www.fws.gov/refuge/minnesota-valley",
          },
        ],
      },
      {
        slug: "normandale-hills",
        name: "Normandale Hills",
        description:
          "Steep yards and mature trees make poop spotting tricky. InsightScoop's camera overlays guide techs to capture AI-ready samples even under heavy leaf cover.",
        insightFocus: [
          "Capture stool samples in shaded tree-lawn areas",
          "Monitor joint-health markers for active trail dogs",
        ],
        localTips: [
          "Schedule pre-holiday sweeps before family gatherings",
          "Pair InsightSummaries with annual vet visits",
        ],
      },
    ],
    serviceAreas: ["Bloomington", "South Loop", "West Bloomington", "Edina", "Richfield"],
    stats: [
      { label: "Dog-friendly apartments", value: "75+" },
      { label: "Average yard size", value: "0.28 acres" },
      { label: "AI alerts last quarter", value: "54 health nudges" },
    ],
    insightHighlights: [
      "South Loop customers lean on InsightScoop's double-photo proof for secure high-rise dog runs.",
      "Weekly sanitization shots reassure HOA boards around shared townhouse greens.",
      "AI InsightSummaries flag dietary shifts after travel-heavy weeks for hospitality pros.",
    ],
    faqs: [
      {
        question: "Can InsightScoop access Bloomington yards with underground fences?",
        answer:
          "Yes. Our techs coordinate keypad codes or Bluetooth logging for invisible-fence yards and confirm entry/exit with timestamped photos.",
      },
      {
        question: "Do you service corporate campus dog relief areas near MOA?",
        answer:
          "We clean corporate dog runs and provide compliance reporting that facilities teams can share with risk management and HR.",
      },
      {
        question: "What happens if my household travels frequently?",
        answer:
          "Use the InsightScoop app to pause or add visits. Our Bluetooth quick log option records drop-in sweeps even if you're gone for the week.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Bloomington pet waste ordinance",
        url: "https://www.bloomingtonmn.gov/cs/pet-ownership",
        description: "Local pet policies and licensing requirements for Bloomington residents.",
      },
      {
        label: "Bloomington Parks off-leash dog areas",
        url: "https://www.bloomingtonmn.gov/parks/dog",
        description: "Find nearby off-leash parks your InsightScoop pup may visit between services.",
      },
      {
        label: "MSP Airport animal relief areas",
        url: "https://www.mspairport.com/airport/special-assistance/pet-relief",
        description: "Helpful when frequent travelers return home and schedule a post-trip InsightScoop cleanup.",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 156,
    },
    nearbyCities: ["edina", "richfield", "eagan", "burnsville"],
    localBusiness: {
      name: "InsightScoop Bloomington",
      address: "West Bloomington, MN 55431",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal & AI Stool Monitoring in Bloomington, MN",
      description:
        "Schedule InsightScoop's Bloomington dog poop pickup with AI stool insights, South Loop concierge windows, and eco-friendly disposal along the Minnesota Valley.",
      keywords: [
        "Bloomington dog waste removal",
        "InsightScoop Bloomington",
        "Mall of America dog poop service",
        "Bush Lake pet waste cleanup",
      ],
    },
  },
  edina: {
    name: "edina",
    displayName: "Edina",
    state: "MN",
    population: 53118,
    description:
      "InsightScoop is the white-glove dog waste concierge for Edina—balancing manicured lawns, HOA standards, and AI wellness insights for discerning pet parents.",
    tagline: "Country club lawns. AI-backed health notes. Concierge InsightScoop routes for every Edina block.",
    geo: {
      latitude: 44.8897,
      longitude: -93.3499,
    },
    zipCodes: ["55435", "55436", "55439"],
    neighborhoods: ["Morningside", "50th & France", "Braemar", "Interlachen Park"],
    neighborhoodsDetailed: [
      {
        slug: "morningside",
        name: "Morningside & 50th/France",
        description:
          "Tight urban lots and luxury townhomes appreciate InsightScoop's precise Bluetooth logging and AI documentation that property managers can file alongside landscaping reports.",
        insightFocus: [
          "Track gastrointestinal changes for boutique pet diets",
          "Keep shared courtyards odor-free for patio season",
        ],
        localTips: [
          "Sync InsightScoop visits with lawn crews to avoid overlap",
          "Add pre-event sweeps before garden parties",
        ],
      },
      {
        slug: "braemar",
        name: "Braemar & Nine Mile Creek",
        description:
          "Rolling yards and golf course adjacency demand spotless turf. InsightScoop's AI stool scoring watches for hydration issues after long rounds on the trails.",
        insightFocus: [
          "Monitor hydration and diet for active sporting breeds",
          "Document sanitation for backyard putting greens",
        ],
        localTips: [
          "Opt into InsightScoop's enzyme deodorizer for synthetic turf",
          "Schedule Monday cleanups after weekend gatherings",
        ],
        outboundLinks: [
          {
            label: "Nine Mile Creek watershed pet resources",
            url: "https://www.ninemilecreek.org/learn/yard-care/",
          },
        ],
      },
      {
        slug: "interlachen",
        name: "Interlachen Park",
        description:
          "Historic estates with gated drives rely on InsightScoop's proof-of-entry photos and AI summaries that house managers can forward to families.",
        insightFocus: [
          "Photo documentation for estate management",
          "AI alerts for senior dogs",
        ],
        localTips: [
          "Provide guest gate codes via encrypted note",
          "Bundle seasonal deep clean ahead of graduation parties",
        ],
      },
    ],
    serviceAreas: ["Edina", "Morningside", "Braemar", "Interlachen", "Hopkins", "Bloomington"],
    stats: [
      { label: "Average homeowner tenure", value: "17+ years" },
      { label: "Dogs per household", value: "1.6" },
      { label: "InsightSummaries delivered", value: "38 last quarter" },
    ],
    insightHighlights: [
      "Discreet tech arrivals with InsightScoop uniforms and sanitation protocol impress HOA boards.",
      "AI stool snapshots complement annual vet concierge services and boutique pet nutrition plans.",
      "Luxury patio and pool decks stay event-ready thanks to enforced photo proof and sanitization galleries.",
    ],
    faqs: [
      {
        question: "Will InsightScoop coordinate with my estate manager or landscaping crew?",
        answer:
          "Yes. We share schedules, gate codes, and InsightSummaries with your preferred point of contact and update them after each visit.",
      },
      {
        question: "Do you offer snow melt or spring thaw cleanup add-ons?",
        answer:
          "Every Edina client receives priority booking for spring thaw catch-up visits to keep stone patios and turf flawless.",
      },
      {
        question: "Can InsightScoop integrate with our wellness concierge?",
        answer:
          "We export InsightSummaries and flagged samples so your pet wellness concierge or vet sees the same AI data set.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Edina leash & pet waste ordinance",
        url: "https://www.edinamn.gov/284/Pet-Licenses",
        description: "Understand Edina's expectations for pet parents and waste disposal.",
      },
      {
        label: "50th & France pet-friendly directory",
        url: "https://50thandfrance.com/",
      },
    ],
    reviewSummary: {
      rating: 5.0,
      count: 203,
    },
    nearbyCities: ["minneapolis", "bloomington", "eden-prairie", "hopkins"],
    localBusiness: {
      name: "InsightScoop Edina",
      address: "Southdale Edina, MN 55435",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Concierge Dog Waste Removal in Edina, MN",
      description:
        "Book InsightScoop's Edina dog waste concierge with AI stool insights, gated photo proof, and estate-friendly scheduling across Morningside, Braemar, and Interlachen.",
      keywords: [
        "Edina dog waste removal",
        "InsightScoop Edina",
        "luxury poop scooping Edina",
      "pet waste concierge Edina",
      ],
    },
  },
  "eden-prairie": {
    name: "eden-prairie",
    displayName: "Eden Prairie",
    state: "MN",
    population: 64521,
    description:
      "InsightScoop keeps Eden Prairie's lakefront homes and tech campuses spotless with AI stool insights, photo proof, and concierge scheduling windows.",
    tagline: "From Flying Cloud Airport to Bryant Lake, InsightScoop is Eden Prairie's dog waste mission control.",
    geo: {
      latitude: 44.8547,
      longitude: -93.4708,
    },
    zipCodes: ["55344", "55346", "55347"],
    neighborhoods: ["Bryant Lake", "Bearpath", "Anderson Lakes", "Pioneer Trail"],
    neighborhoodsDetailed: [
      {
        slug: "bearpath",
        name: "Bearpath Golf & Country Club",
        description:
          "Gated estates expect flawless turf and accountability. InsightScoop's AI stool summaries and proof-of-sanitization photos integrate with estate manager logs.",
        insightFocus: [
          "Estate-friendly scheduling",
          "AI stool scoring for senior and designer breeds",
        ],
        localTips: [
          "Sync visits with landscaping, pool, and housekeeping teams",
          "Enable email recaps for household managers",
        ],
      },
      {
        slug: "flying-cloud",
        name: "Flying Cloud & Tech Ridge",
        description:
          "Travel pros and tech workers need flexible windows. InsightScoop's Bluetooth logging and quick InsightCamera passes keep yards ready whenever you're wheels-down.",
        insightFocus: [
          "Quick-turn service before and after flights",
          "Hydration monitoring during heat waves",
        ],
        localTips: [
          "Use SMS alerts so airport crews know when the yard is cleared",
          "Bundle rooftop patio deodorizer after events",
        ],
      },
      {
        slug: "bryant-lake",
        name: "Bryant & Round Lakes",
        description:
          "Lakeside decks host frequent gatherings. InsightScoop diverts waste responsibly and monitors stool changes after heavy outdoor activity.",
        insightFocus: [
          "Compost diversion for zero-waste households",
          "AI alerts for active lake dogs",
        ],
        localTips: [
          "Schedule pre-weekend sweeps before guests arrive",
          "Add enzyme deodorizer for composite docks",
        ],
      },
    ],
    serviceAreas: ["Eden Prairie", "Bearpath", "Flying Cloud", "Bryant Lake", "Chanhassen"],
    stats: [
      { label: "Median household income", value: "$126K" },
      { label: "Miles of trails", value: "60" },
      { label: "InsightSummaries sent", value: "45 last quarter" },
    ],
    insightHighlights: [
      "AI stool analytics integrate with premium vet concierge programs.",
      "Photo proof satisfies HOA and estate requirements across gated communities.",
      "Bluetooth quick logs keep weekly service on track for frequent travelers.",
    ],
    faqs: [
      {
        question: "Can InsightScoop coordinate with my household team?",
        answer:
          "Yes. We share secure access info, recaps, and InsightSummaries with estate managers or personal assistants.",
      },
      {
        question: "Do you offer patio-safe deodorizing for lake homes?",
        answer:
          "We use enzyme formulas safe for lakeshore plantings and composite decking.",
      },
      {
        question: "How often are AI stool insights captured?",
        answer:
          "Every visit includes InsightCamera captures so we can flag changes before symptoms appear.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Eden Prairie pet policies",
        url: "https://www.edenprairie.org/community/pets",
      },
      {
        label: "Bryant Lake Regional Park dog guidelines",
        url: "https://www.threeriversparks.org/location/bryant-lake-regional-park",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 188,
    },
    nearbyCities: ["minnetonka", "edina", "chanhassen"],
    localBusiness: {
      name: "InsightScoop Eden Prairie",
      address: "Bearpath Eden Prairie, MN 55347",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Luxury Dog Waste Removal in Eden Prairie, MN",
      description:
        "Eden Prairie homeowners trust InsightScoop for luxury dog waste removal, AI stool monitoring, and HOA-ready proof from Bearpath to Flying Cloud.",
      keywords: [
        "Eden Prairie dog waste removal",
        "InsightScoop Eden Prairie",
      "Bearpath poop scooping",
      ],
    },
  },
  minnetonka: {
    name: "minnetonka",
    displayName: "Minnetonka",
    state: "MN",
    population: 54426,
    description:
      "InsightScoop keeps Minnetonka's wooded lots and lakeshore decks guest-ready with AI stool monitoring, cedar-safe sanitation, and HOA-proof photos.",
    tagline: "Minnetonka waves, wooded trails, InsightScoop AI—yards that match the lake lifestyle.",
    geo: {
      latitude: 44.9133,
      longitude: -93.5033,
    },
    zipCodes: ["55305", "55343", "55345", "55391"],
    neighborhoods: ["Glen Lake", "Gray's Bay", "Ridgedale", "Williston"],
    neighborhoodsDetailed: [
      {
        slug: "grays-bay",
        name: "Gray's Bay & Libbs Lake",
        description:
          "Shaded lakeshore yards collect debris quickly. InsightScoop distinguishes goose droppings from dog samples and keeps docks ready for sunset cruises.",
        insightFocus: [
          "Differentiate wildlife vs dog waste",
          "Hydration tracking after boat days",
        ],
        localTips: [
          "Schedule pre-weekend sweeps before lake guests",
          "Add enzyme deodorizer for dock paths",
        ],
      },
      {
        slug: "ridgedale",
        name: "Ridgedale & Opus",
        description:
          "Townhomes near Ridgedale rely on InsightScoop's Bluetooth proof and AI reports to satisfy HOA requirements while residents commute to nearby campuses.",
        insightFocus: [
          "HOA compliance",
          "AI diet monitoring for busy professionals",
        ],
        localTips: [
          "Bundle mid-week quick logs during heavy travel seasons",
          "Forward InsightSummaries to your concierge vet",
        ],
      },
    ],
    serviceAreas: ["Minnetonka", "Gray's Bay", "Ridgedale", "Deephaven", "Wayzata"],
    stats: [
      { label: "Lakes & bays served", value: "7" },
      { label: "Heavily wooded lots", value: "62%" },
      { label: "InsightSummaries", value: "31 last quarter" },
    ],
    insightHighlights: [
      "Cedar-safe sanitation protects lakeshore vegetation and docks.",
      "AI stool insights flag stress indicators when routines shift between lake season and winter.",
      "Proof photos integrate with dock association and HOA portals.",
    ],
    faqs: [
      {
        question: "Do you service docks and boathouse paths?",
        answer:
          "Yes. We clear pathways, capture photos, and use lake-safe products to neutralize odors.",
      },
      {
        question: "How does InsightScoop handle dense tree cover?",
        answer:
          "Our techs use InsightCamera overlays to ensure shaded areas get inspected for AI-ready samples.",
      },
      {
        question: "Can you coordinate with snow removal crews?",
        answer:
          "We align routes with plow schedules and perform thaw resets once snowbanks recede.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Minnetonka animal regulations",
        url: "https://www.minnetonkamn.gov/residents/animals",
      },
      {
        label: "Minnehaha Creek Watershed pet waste guidance",
        url: "https://www.minnehahacreek.org/",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 176,
    },
    nearbyCities: ["eden-prairie", "wayzata", "plymouth"],
    localBusiness: {
      name: "InsightScoop Minnetonka",
      address: "Gray's Bay Minnetonka, MN 55345",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal for Minnetonka, MN Lakeshores",
      description:
        "Minnetonka lake homes rely on InsightScoop for AI stool monitoring, cedar-safe sanitization, and HOA proof from Gray's Bay to Ridgedale.",
      keywords: [
        "Minnetonka dog waste removal",
        "InsightScoop Minnetonka",
        "lakefront poop scooping Minnetonka",
      ],
    },
  },
  richfield: {
    name: "richfield",
    displayName: "Richfield",
    state: "MN",
    population: 36994,
    description:
      "InsightScoop keeps Richfield yards spotless for commuters and airport employees with precise schedules, Bluetooth logging, and AI stool insights tailored to compact city lots.",
    tagline: "The heartbeat between Minneapolis and MSP—InsightScoop handles the mess while you handle the hustle.",
    geo: {
      latitude: 44.8833,
      longitude: -93.2833,
    },
    zipCodes: ["55423"],
    neighborhoods: ["Wood Lake", "Penn Avenue", "Lyndale", "Centennial Lakes border"],
    neighborhoodsDetailed: [
      {
        slug: "wood-lake",
        name: "Wood Lake & Veterans Park",
        description:
          "Active families and rescue pups love the wildlife refuge, but it introduces parasites. InsightScoop's AI stool scoring catches anomalies and keeps yards guest ready for quick backyard barbecues.",
        insightFocus: [
          "Flag potential parasites after marsh trail walks",
          "Quick-turn service windows for shift workers",
        ],
        localTips: [
          "Add Wednesday pickups during peak summer park visits",
          "Enable InsightScoop text alerts for gate confirmation",
        ],
      },
      {
        slug: "penn-avenue",
        name: "Penn Avenue",
        description:
          "Mid-century lots with alley access demand efficient routing. InsightScoop's Bluetooth button logging keeps techs moving while collecting AI-ready samples in tight spaces.",
        insightFocus: [
          "Efficient alley access",
          "Monitor diet changes from frequent takeout treats",
        ],
        localTips: [
          "Bundle odor neutralizer for alley garbage zones",
          "Schedule pick-ups before city waste collection days",
        ],
      },
    ],
    serviceAreas: ["Richfield", "MSP employees", "South Minneapolis", "Bloomington"],
    stats: [
      { label: "Average commute", value: "22 minutes" },
      { label: "Multi-dog homes", value: "31%" },
      { label: "AI alerts", value: "29 last quarter" },
    ],
    insightHighlights: [
      "Technicians log entries via Bluetooth so fenced-in yards stay secure without key handoffs.",
      "InsightCamera overlays make sure at least three high-quality stool samples get analyzed per visit.",
      "Gate, gear, and sanitation photos satisfy landlords and duplex partners.",
    ],
    faqs: [
      {
        question: "Can InsightScoop service duplexes and four-plexes with shared yards?",
        answer:
          "Yes. We provide separate Bluetooth logs for each unit and deliver InsightSummaries to the right residents or landlords.",
      },
      {
        question: "What if my schedule changes weekly?",
        answer:
          "Use InsightScoop's scheduling portal to move visits around flight rosters or hospital shifts. We can also add quick logs on short notice.",
      },
      {
        question: "Do you offer winter service in alley-only yards?",
        answer:
          "We switch to compact routes and keep Bluetooth logging active so we never need to wrestle phones with gloves on.",
      },
    ],
    outboundLinks: [
      {
        label: "Richfield pet ordinance & licensing",
        url: "https://www.richfieldmn.gov/departments/public-safety/animal-control",
      },
      {
        label: "Wood Lake Nature Center",
        url: "https://www.woodlakenaturecenter.org/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 167,
    },
    nearbyCities: ["minneapolis", "bloomington", "eagan"],
    localBusiness: {
      name: "InsightScoop Richfield",
      address: "West Richfield, MN 55423",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Richfield, MN",
      description:
        "InsightScoop keeps Richfield yards clean with AI stool insights, Bluetooth quick logging, and proof-of-service photos for duplexes, families, and MSP commuters.",
      keywords: [
        "Richfield dog waste removal",
        "InsightScoop Richfield",
        "poop scooping near MSP",
      ],
    },
  },
  eagan: {
    name: "eagan",
    displayName: "Eagan",
    state: "MN",
    population: 68537,
    description:
      "InsightScoop keeps Eagan's trail-loving dogs healthy with AI stool monitoring, eco-conscious disposal, and concierge scheduling for MSP commuters.",
    tagline: "Trailheads, training camp, and Twin Cities commutes—InsightScoop keeps Eagan yards visitor-ready.",
    geo: {
      latitude: 44.8041,
      longitude: -93.1669,
    },
    zipCodes: ["55120", "55121", "55122", "55123", "55124"],
    neighborhoods: [
      "Cedar Grove",
      "Blackhawk",
      "Lexington-Diffley",
      "Pilot Knob",
    ],
    neighborhoodsDetailed: [
      {
        slug: "cedar-grove",
        name: "Cedar Grove & Viking Lakes",
        description:
          "Townhomes near the Vikings facility juggle HOA rules and travel-heavy lives. InsightScoop's Bluetooth logging and InsightCamera flow slot perfectly between flights and practice schedules.",
        insightFocus: [
          "Concierge scheduling for hospitality and airline crews",
          "AI hydration monitoring during hot training camp weeks",
        ],
        localTips: [
          "Add Monday sweeps after home-game weekends",
          "Forward InsightSummaries to your pet care concierge",
        ],
      },
      {
        slug: "blackhawk",
        name: "Blackhawk & Lebanon Hills",
        description:
          "Large wooded lots invite wildlife visitors. InsightScoop flags parasites after Lebanon Hills adventures and routes waste responsibly away from stormwater basins.",
        insightFocus: [
          "Parasite monitoring post-trail",
          "Compost diversion for eco-minded households",
        ],
        localTips: [
          "Schedule spring thaw deep clean to reset turf",
          "Request dual sanitation photos for patios and gear",
        ],
        outboundLinks: [
          {
            label: "Dakota County pet waste & stormwater guidance",
            url: "https://www.co.dakota.mn.us/Environment/WaterResources/Stormwater/",
          },
        ],
      },
    ],
    serviceAreas: ["Eagan", "Viking Lakes", "Blackhawk", "Inver Grove Heights", "Apple Valley"],
    stats: [
      { label: "Trail miles monitored", value: "55" },
      { label: "Households with dogs", value: "43%" },
      { label: "AI InsightSummaries", value: "42 last quarter" },
    ],
    insightHighlights: [
      "Sanitation protocols documented for daycare pickups and shared townhome greens.",
      "AI InsightCamera ensures at least three premiere stool samples per visit for vet-ready notes.",
      "Bluetooth logging keeps yards secure even when clients are traveling for work.",
    ],
    faqs: [
      {
        question: "Can InsightScoop adjust for my irregular MSP flight schedule?",
        answer:
          "Yes. Move visits in our portal or request quick-log sweeps when you're routed unexpectedly—techs still capture AI samples and proof photos.",
      },
      {
        question: "Do you service Lebanon Hills trailheads in winter?",
        answer:
          "We do. Our crews use Bluetooth logging and insulated sanitation gear to handle long driveways and trail-adjacent yards all winter long.",
      },
      {
        question: "How does InsightScoop help families with active sporting breeds?",
        answer:
          "We track stool color and consistency after intense training sessions and alert you if hydration or diet tweaks are needed.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Eagan pet waste and stormwater",
        url: "https://www.cityofeagan.com/stormwater",
      },
      {
        label: "Lebanon Hills Regional Park trail info",
        url: "https://www.co.dakota.mn.us/parks/parksTrails/LebanonHills",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 124,
    },
    nearbyCities: ["apple-valley", "inver-grove-heights", "burnsville"],
    localBusiness: {
      name: "InsightScoop Eagan",
      address: "Northview Eagan, MN 55121",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal & AI Health Insights in Eagan, MN",
      description:
        "Book InsightScoop in Eagan for AI stool monitoring, Bluetooth quick logs, and eco-smart disposal from Cedar Grove to Lebanon Hills neighborhoods.",
      keywords: [
        "Eagan dog waste removal",
        "InsightScoop Eagan",
      "Lebanon Hills poop pickup",
      ],
    },
  },
  "inver-grove-heights": {
    name: "inver-grove-heights",
    displayName: "Inver Grove Heights",
    state: "MN",
    population: 35654,
    description:
      "InsightScoop protects Inver Grove Heights yards along the Mississippi corridor with AI stool insights, scent-neutral sanitation, and photo proof for HOA boards.",
    tagline: "River bluffs to refinery shifts—InsightScoop keeps Inver Grove yards dialed in.",
    geo: {
      latitude: 44.8447,
      longitude: -93.063,
    },
    zipCodes: ["55076", "55077"],
    neighborhoods: ["Argenta Hills", "South Grove", "Pine Bend", "Salem Hills"],
    neighborhoodsDetailed: [
      {
        slug: "argenta-hills",
        name: "Argenta Hills",
        description:
          "Master-planned communities expect spotless lawns and airtight records. InsightScoop's Bluetooth logging, InsightCamera captures, and sanitation proof slides right into HOA dashboards.",
        insightFocus: [
          "HOA compliance",
          "AI insights for commuting families",
        ],
        localTips: [
          "Coordinate service with lawn crews to reduce wheel tracks",
          "Forward InsightSummaries to your family vet each season",
        ],
      },
      {
        slug: "pine-bend",
        name: "Pine Bend & River Heights",
        description:
          "Homes near the refinery and bluffs balance wildlife and industrial exposure. InsightScoop monitors stool for toxins, neutralizes odors, and keeps decks event-ready.",
        insightFocus: [
          "Odor control for humid river valleys",
          "AI alerts for environmental stress markers",
        ],
        localTips: [
          "Add deodorizer during peak humidity",
          "Schedule dawn visits to beat shift traffic",
        ],
      },
    ],
    serviceAreas: ["Inver Grove Heights", "Argenta Hills", "South Grove", "Mendota Heights", "Eagan"],
    stats: [
      { label: "River bluff homes", value: "3.2k" },
      { label: "Average commute", value: "24 minutes" },
      { label: "InsightSummaries", value: "22 last quarter" },
    ],
    insightHighlights: [
      "Sanitation proof calms nerves for refinery and hospital shift workers returning home.",
      "AI stool scoring watches for parasites and toxins in river-adjacent yards.",
      "Bluetooth quick logs maintain service when clients travel or work overnights.",
    ],
    faqs: [
      {
        question: "Do you service steep river bluff properties?",
        answer:
          "Yes. We map safe routes, capture wide-angle proof photos, and document every sanitation step for elevated decks and terraces.",
      },
      {
        question: "Can InsightScoop handle large-breed households?",
        answer:
          "Absolutely. We adjust schedules and AI sample counts based on waste volume so big dogs stay on track.",
      },
      {
        question: "How flexible are your visit windows?",
        answer:
          "We offer early morning and evening routes plus SMS alerts so shift workers know when the yard is complete.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Inver Grove Heights pet resources",
        url: "https://www.ighmn.gov/",
      },
      {
        label: "Dakota County Parks dog guidelines",
        url: "https://www.co.dakota.mn.us/parks",
      },
    ],
    reviewSummary: {
      rating: 4.7,
      count: 74,
    },
    nearbyCities: ["eagan", "mendota-heights", "cottage-grove"],
    localBusiness: {
      name: "InsightScoop Inver Grove Heights",
      address: "Argenta Hills Inver Grove Heights, MN 55077",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Inver Grove Heights, MN",
      description:
        "Protect Inver Grove Heights river bluff yards with InsightScoop's AI stool monitoring, odor control, and HOA proof from Argenta Hills to Pine Bend.",
      keywords: [
        "Inver Grove Heights dog waste removal",
        "InsightScoop Inver Grove",
        "river bluff poop scooping",
      ],
    },
  },
  "mendota-heights": {
    name: "mendota-heights",
    displayName: "Mendota Heights",
    state: "MN",
    population: 13350,
    description:
      "InsightScoop protects Mendota Heights' Fort Snelling estates and airport-adjacent homes with AI stool insights, photo proof, and concierge sanitation.",
    tagline: "Private drives, VIP travel, InsightScoop AI—Mendota Heights stays pristine.",
    geo: {
      latitude: 44.8836,
      longitude: -93.1399,
    },
    zipCodes: ["55118"],
    neighborhoods: ["Mendakota", "Rogers Lake", "Ivy Falls", "Lexington Heights"],
    neighborhoodsDetailed: [
      {
        slug: "mendakota",
        name: "Mendakota Country Club",
        description:
          "Gated estates expect white-glove coordination. InsightScoop syncs with estate managers, captures InsightCamera data, and keeps greens event-ready.",
        insightFocus: [
          "Estate coordination",
          "AI stool scoring for senior dogs",
        ],
        localTips: [
          "Align service with grounds crews",
          "Export InsightSummaries to your concierge vet",
        ],
      },
      {
        slug: "rogers-lake",
        name: "Rogers Lake",
        description:
          "Lakefront patios stay guest-ready thanks to InsightScoop's lake-safe sanitizers and Bluetooth logs that respect private security systems.",
        insightFocus: [
          "Lake-safe sanitation",
          "Quick logging for frequent travelers",
        ],
        localTips: [
          "Schedule pre-event sweeps before backyard receptions",
          "Use SMS alerts to coordinate with chauffeurs",
        ],
      },
    ],
    serviceAreas: ["Mendota Heights", "Fort Snelling", "Sunfish Lake", "Inver Grove Heights", "Eagan"],
    stats: [
      { label: "Private drive coverage", value: "100%" },
      { label: "Average lot size", value: "0.6 acres" },
      { label: "InsightSummaries", value: "18 last quarter" },
    ],
    insightHighlights: [
      "AI stool insights integrate with premium vet concierge services.",
      "Proof-of-sanitization photos satisfy security-conscious estates and HOA boards.",
      "Bluetooth quick logging allows seamless service for frequent travelers and pilots.",
    ],
    faqs: [
      {
        question: "Can InsightScoop coordinate with private security teams?",
        answer:
          "Yes. We exchange schedules, access codes, and recap messages through your preferred security contact.",
      },
      {
        question: "Do you offer runway-adjacent service windows?",
        answer:
          "We provide early morning/late evening routes for airline crews and frequent flyers residing near MSP.",
      },
      {
        question: "How do you document sanitation for estate management?",
        answer:
          "Each visit ends with photo proof, gate confirmation, and sanitation gallery accessible to estate staff.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Mendota Heights pet ordinances",
        url: "https://mendota-heights.com/",
      },
      {
        label: "Fort Snelling State Park dog info",
        url: "https://www.dnr.state.mn.us/state_parks/fort_snelling/index.html",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 58,
    },
    nearbyCities: ["eagan", "inver-grove-heights", "st-paul"],
    localBusiness: {
      name: "InsightScoop Mendota Heights",
      address: "Mendakota Mendota Heights, MN 55118",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Luxury Dog Waste Removal in Mendota Heights, MN",
      description:
        "Mendota Heights estates trust InsightScoop for AI stool monitoring, concierge sanitation, and proof photos across Fort Snelling and Rogers Lake homes.",
      keywords: [
        "Mendota Heights dog waste removal",
        "InsightScoop Mendota Heights",
        "Fort Snelling poop scooping",
      ],
    },
  },
  "apple-valley": {
    name: "apple-valley",
    displayName: "Apple Valley",
    state: "MN",
    population: 56013,
    description:
      "InsightScoop supports Apple Valley dog parents with weekly poop pickup, AI stool insights, and zoo-adjacent sanitation protocols that keep kids' play areas clean.",
    tagline: "Family-forward yards, zoo adventures, AI-backed wellness—InsightScoop owns Apple Valley.",
    geo: {
      latitude: 44.7319,
      longitude: -93.2177,
    },
    zipCodes: ["55124"],
    neighborhoods: ["Cobblestone Lake", "Downtown Apple Valley", "Galaxie", "Redwood"],
    neighborhoodsDetailed: [
      {
        slug: "cobblestone",
        name: "Cobblestone Lake",
        description:
          "HOA-managed lakeside yards demand consistent proof. InsightScoop's gate, gear, and sanitation photos make board approvals automatic while AI stool scans catch diet shifts.",
        insightFocus: [
          "Proof photos for HOA records",
          "Hydration tracking during summer lake days",
        ],
        localTips: [
          "Schedule mid-week touch-ups before HOA inspections",
          "Bundle deodorizer for shared greenways",
        ],
      },
      {
        slug: "galaxie",
        name: "Galaxie & Kelley Park",
        description:
          "Compact yards around Kelley Park need fast service ahead of community events. InsightScoop locks in quick sweeps and Bluetooth logs even if you're at youth sports all night.",
        insightFocus: [
          "After-hours quick logs for busy families",
          "AI alerts for food-sensitive pups",
        ],
        localTips: [
          "Add Friday sweeps before weekend birthday parties",
          "Sync InsightSummaries with your vet wellness app",
        ],
      },
    ],
    serviceAreas: ["Apple Valley", "Cobblestone Lake", "Galaxie", "Lakeville", "Eagan"],
    stats: [
      { label: "Households with kids", value: "38%" },
      { label: "Dog-centric parks", value: "13" },
      { label: "AI health nudges", value: "27 last quarter" },
    ],
    insightHighlights: [
      "We sanitize twice per visit so zoo-going shoes don't track anything home.",
      "Bluetooth logging keeps detached garages secure without key exchanges.",
      "AI InsightSummaries flag when yard parasites might need vet attention after zoo farm visits.",
    ],
    faqs: [
      {
        question: "Do you service Apple Valley yards year-round?",
        answer:
          "Yes. Our techs maintain winter service with Bluetooth logging and will schedule spring thaw resets once temperatures rise.",
      },
      {
        question: "Can InsightScoop handle shared HOA common areas?",
        answer:
          "We capture proof photos and send recaps to HOA boards or property managers automatically after each visit.",
      },
      {
        question: "How quickly can I adjust service around sports schedules?",
        answer:
          "Use the InsightScoop portal to shift visits or request quick logs. We dispatch techs around evening practices and Saturday tournaments.",
      },
    ],
    outboundLinks: [
      {
        label: "Apple Valley Parks & Recreation pet guidance",
        url: "https://www.cityofapplevalley.org/84/Parks-Recreation",
      },
      {
        label: "Minnesota Zoo conservation & animal care",
        url: "https://mnzoo.org/conservation/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 98,
    },
    nearbyCities: ["eagan", "lakeville", "burnsville"],
    localBusiness: {
      name: "InsightScoop Apple Valley",
      address: "North Apple Valley, MN 55124",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Concierge in Apple Valley, MN",
      description:
        "Apple Valley families trust InsightScoop for weekly dog poop pickup, AI stool insights, and HOA-ready proof photos around Cobblestone Lake and Kelley Park.",
      keywords: [
        "Apple Valley dog waste removal",
        "InsightScoop Apple Valley",
        "Cobblestone Lake poop scooping",
      ],
    },
  },
  "cottage-grove": {
    name: "cottage-grove",
    displayName: "Cottage Grove",
    state: "MN",
    population: 39500,
    description:
      "InsightScoop keeps Cottage Grove's fast-growing subdivisions and Mississippi River estates clean with AI stool monitoring, HOA-ready proof, and compost-friendly disposal.",
    tagline: "New builds + river views + InsightScoop AI = spotless Cottage Grove yards.",
    geo: {
      latitude: 44.8275,
      longitude: -92.9436,
    },
    zipCodes: ["55016"],
    neighborhoods: ["East Ravine", "Pine Hill", "Grey Cloud Island", "River Acres"],
    neighborhoodsDetailed: [
      {
        slug: "east-ravine",
        name: "East Ravine",
        description:
          "Master-planned communities expect impeccable reporting. InsightScoop logs Bluetooth entries, captures InsightCamera samples, and shares proof directly with HOA portals.",
        insightFocus: [
          "HOA/builder compliance",
          "AI stool insights for growing families",
        ],
        localTips: [
          "Align visits with lawn warranty inspections",
          "Enable SMS alerts before backyard parties",
        ],
      },
      {
        slug: "grey-cloud",
        name: "Grey Cloud Island",
        description:
          "Acreage and riverfront properties need odor control and wildlife monitoring. InsightScoop reroutes waste for composting and flags parasites after river adventures.",
        insightFocus: [
          "Wildlife vs dog waste identification",
          "Eco-conscious disposal",
        ],
        localTips: [
          "Add deodorizer for boathouse paths",
          "Schedule Monday sweeps after weekend guests",
        ],
      },
    ],
    serviceAreas: ["Cottage Grove", "Grey Cloud Island", "Newport", "St. Paul Park", "Woodbury"],
    stats: [
      { label: "Homes built since 2020", value: "3,000+" },
      { label: "Dog-owning households", value: "41%" },
      { label: "InsightSummaries", value: "24 last quarter" },
    ],
    insightHighlights: [
      "AI stool scoring keeps expanding families ahead of health surprises.",
      "Sanitation proof reassures HOA boards overseeing new neighborhoods.",
      "Eco routing diverts waste away from sensitive river floodplains on request.",
    ],
    faqs: [
      {
        question: "Do you service acreage on Grey Cloud Island?",
        answer:
          "Yes. We map zones, capture proof photos, and can divert to compost facilities for eco-focused residents.",
      },
      {
        question: "How soon can new builds start InsightScoop service?",
        answer:
          "We begin as soon as sod is installed, keeping lawns warranty-ready with consistent cleanup and AI documentation.",
      },
      {
        question: "Can you coordinate around construction schedules?",
        answer:
          "We adjust routes weekly and communicate via SMS/email so crews know when the yard is cleared.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Cottage Grove pet resources",
        url: "https://www.cottagegrovemn.gov/",
      },
      {
        label: "Washington County parks dog policies",
        url: "https://www.co.washington.mn.us/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 82,
    },
    nearbyCities: ["woodbury", "inver-grove-heights", "hastings"],
    localBusiness: {
      name: "InsightScoop Cottage Grove",
      address: "East Ravine Cottage Grove, MN 55016",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Cottage Grove, MN",
      description:
        "Cottage Grove families trust InsightScoop for AI stool monitoring, HOA-ready proof, and river-safe disposal from East Ravine to Grey Cloud Island.",
      keywords: [
        "Cottage Grove dog waste removal",
        "InsightScoop Cottage Grove",
        "Grey Cloud poop scooping",
      ],
    },
  },
  maplewood: {
    name: "maplewood",
    displayName: "Maplewood",
    state: "MN",
    population: 42188,
    description:
      "InsightScoop handles Maplewood's mix of Legacy Village townhomes and leafy ridge lots with AI stool insights, stormwater-safe sanitation, and HOA-ready proof.",
    tagline: "Maplewood ridgelines, InsightScoop routines—clean yards without the guesswork.",
    geo: {
      latitude: 44.953,
      longitude: -93.0303,
    },
    zipCodes: ["55109", "55117", "55119"],
    neighborhoods: ["Legacy Village", "Battle Creek", "Gladstone", "Frost Lake"],
    neighborhoodsDetailed: [
      {
        slug: "legacy-village",
        name: "Legacy Village",
        description:
          "Townhome associations depend on InsightScoop's Bluetooth logs and InsightCamera images to keep shared greens spotless for board inspections.",
        insightFocus: [
          "HOA compliance",
          "AI insights for commuting families",
        ],
        localTips: [
          "Schedule pre-inspection sweeps",
          "Bundle deodorizer for communal courtyards",
        ],
      },
      {
        slug: "battle-creek",
        name: "Battle Creek & Frost Avenue",
        description:
          "Tree-lined yards near Battle Creek Regional Park accumulate wildlife debris. InsightScoop distinguishes goose waste from dog samples and flags parasites after trail days.",
        insightFocus: [
          "Wildlife vs dog waste identification",
          "Hydration monitoring post-hike",
        ],
        localTips: [
          "Request Monday sweeps after weekend hikes",
          "Opt into compost diversion for eco households",
        ],
      },
    ],
    serviceAreas: ["Maplewood", "Legacy Village", "Battle Creek", "North St. Paul", "Little Canada"],
    stats: [
      { label: "Median household income", value: "$83K" },
      { label: "Park access", value: "35% within 5 min" },
      { label: "InsightSummaries", value: "26 last quarter" },
    ],
    insightHighlights: [
      "Stormwater-safe sanitation protects Ramsey County watersheds.",
      "AI stool analytics help city-to-suburb commuters spot stress indicators quickly.",
      "Photo proof keeps townhome managers confident during rapid development.",
    ],
    faqs: [
      {
        question: "Do you clean steep ridge yards in Maplewood?",
        answer:
          "Yes. We map hillside routes, capture wide-angle proof, and adjust schedules to manage heavy leaf fall.",
      },
      {
        question: "How does InsightScoop help multi-dog households?",
        answer:
          "We increase AI sample counts and recommend frequency adjustments so multiple pups never overwhelm the yard.",
      },
      {
        question: "Can you coordinate with Battle Creek trail days?",
        answer:
          "We monitor stool for parasites or hydration changes after pets explore Battle Creek Regional Park.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Maplewood animal ordinances",
        url: "https://maplewoodmn.gov/",
      },
      {
        label: "Ramsey County pet waste guidance",
        url: "https://www.ramseycounty.us/residents/environment",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 95,
    },
    nearbyCities: ["little-canada", "woodbury", "st-paul"],
    localBusiness: {
      name: "InsightScoop Maplewood",
      address: "Legacy Village Maplewood, MN 55109",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Maplewood, MN",
      description:
        "Maplewood residents rely on InsightScoop for AI stool insights, HOA-ready proof, and watershed-safe disposal from Legacy Village to Battle Creek.",
      keywords: [
        "Maplewood dog waste removal",
        "InsightScoop Maplewood",
        "Battle Creek poop scooping",
      ],
    },
  },
  woodbury: {
    name: "woodbury",
    displayName: "Woodbury",
    state: "MN",
    population: 78000,
    description:
      "InsightScoop supports Woodbury's master-planned communities with AI stool insights, HOA-ready proof, and flexible scheduling for commuting families.",
    tagline: "Lakes, trails, bustling households—InsightScoop keeps Woodbury yards inspection ready.",
    geo: {
      latitude: 44.9239,
      longitude: -92.9594,
    },
    zipCodes: ["55125", "55129"],
    neighborhoods: ["Stonemill Farms", "Dancing Waters", "City Walk", "Eagle Valley"],
    neighborhoodsDetailed: [
      {
        slug: "stonemill-farms",
        name: "Stonemill Farms",
        description:
          "HOA amenities require pristine greens. InsightScoop delivers Bluetooth-logged proof, AI stool summaries, and sanitation galleries after each visit.",
        insightFocus: [
          "HOA compliance",
          "AI wellness for active families",
        ],
        localTips: [
          "Schedule pre-pool-season deep cleans",
          "Share InsightSummaries with your family vet",
        ],
      },
      {
        slug: "dancing-waters",
        name: "Dancing Waters",
        description:
          "Shared splash pads and trail loops demand swift cleanup. InsightScoop routes quick logs and ensures sanitation proof for association boards.",
        insightFocus: [
          "Shared amenity sanitation",
          "Hydration monitoring for high-activity pups",
        ],
        localTips: [
          "Add mid-week quick logs during sports seasons",
          "Bundle odor control for community greens",
        ],
      },
    ],
    serviceAreas: ["Woodbury", "Stonemill Farms", "Dancing Waters", "Oakdale", "Cottage Grove"],
    stats: [
      { label: "HOA communities", value: "40+" },
      { label: "Dog-owning households", value: "44%" },
      { label: "InsightSummaries", value: "38 last quarter" },
    ],
    insightHighlights: [
      "AI stool scoring keeps large suburban families ahead of digestive issues.",
      "Sanitation proof integrates with association dashboards and home warranty portals.",
      "Bluetooth logging lets techs document secure entry/exit without key exchanges.",
    ],
    faqs: [
      {
        question: "Can InsightScoop sync with HOA management software?",
        answer:
          "We share proof photos, sanitation galleries, and InsightSummaries via secure links tailored to your HOA or property manager.",
      },
      {
        question: "Do you offer seasonal deep cleans for sports-heavy families?",
        answer:
          "Yes. We schedule spring thaw resets and pre-summer deep cleans so busy households stay ahead of waste build-up.",
      },
      {
        question: "How flexible are arrival windows around commute schedules?",
        answer:
          "We offer early morning, midday, and evening routes plus SMS updates so you'll know when the yard is clear.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Woodbury pet policies",
        url: "https://www.woodburymn.gov/",
      },
      {
        label: "Washington County off-leash dog park",
        url: "https://www.co.washington.mn.us/",
      },
    ],
    reviewSummary: {
      rating: 4.9,
      count: 165,
    },
    nearbyCities: ["cottage-grove", "oakdale", "maplewood"],
    localBusiness: {
      name: "InsightScoop Woodbury",
      address: "Stonemill Farms Woodbury, MN 55129",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Woodbury, MN",
      description:
        "Woodbury homeowners choose InsightScoop for AI stool monitoring, HOA-ready proof, and concierge scheduling across Stonemill Farms, Dancing Waters, and beyond.",
      keywords: [
        "Woodbury dog waste removal",
        "InsightScoop Woodbury",
        "Stonemill Farms poop scooping",
      ],
    },
  },
  shoreview: {
    name: "shoreview",
    displayName: "Shoreview",
    state: "MN",
    population: 26888,
    description:
      "InsightScoop serves Shoreview's Turtle Lake and Snail Lake neighborhoods with AI stool insights, lake-safe sanitation, and proof photos for Ramsey County shoreland regulations.",
    tagline: "Lake life + AI wellness = Shoreview yards ready for sunset gatherings.",
    geo: {
      latitude: 45.0799,
      longitude: -93.1473,
    },
    zipCodes: ["55126"],
    neighborhoods: ["Turtle Lake", "Snail Lake", "Island Lake", "Lexington"],
    neighborhoodsDetailed: [
      {
        slug: "turtle-lake",
        name: "Turtle Lake",
        description:
          "Lakeshore lots and boat launches benefit from InsightScoop's cedar-safe sanitizer and AI stool tracking for water-loving pups.",
        insightFocus: [
          "Lake-safe sanitation",
          "Hydration monitoring after paddle days",
        ],
        localTips: [
          "Schedule Friday sweeps before weekend guests",
          "Add deodorizer for dock walkways",
        ],
      },
      {
        slug: "island-lake",
        name: "Island Lake & Lexington Park",
        description:
          "Active families use InsightScoop's Bluetooth logging to keep shared parks and trails clean while juggling sports and school.",
        insightFocus: [
          "Shared amenity cleanup",
          "AI insights for busy households",
        ],
        localTips: [
          "Use SMS alerts to line up playdates right after service",
          "Bundle enzyme treatments for playground zones",
        ],
      },
    ],
    serviceAreas: ["Shoreview", "Turtle Lake", "Snail Lake", "Roseville", "Vadnais Heights"],
    stats: [
      { label: "Lakes served", value: "4" },
      { label: "Dog-owning households", value: "46%" },
      { label: "InsightSummaries", value: "18 last quarter" },
    ],
    insightHighlights: [
      "AI stool scoring flags hydration issues during peak boating season.",
      "Lake-safe sanitation protects Ramsey County shorelines.",
      "Bluetooth quick logs keep weekend schedules flexible for active families.",
    ],
    faqs: [
      {
        question: "Do you service boat launches and beach paths?",
        answer:
          "Yes. We clear walkways, capture proof photos, and use lake-safe products to neutralize odors.",
      },
      {
        question: "Can InsightScoop handle winter lake homes?",
        answer:
          "We maintain winter visits and perform thaw resets the moment ice retreats.",
      },
      {
        question: "How do AI insights help shoreland owners?",
        answer:
          "We surface hydration and diet changes quickly so you can adjust routines before symptoms escalate.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Shoreview pet ordinances",
        url: "https://www.shoreviewmn.gov/",
      },
      {
        label: "Rice Creek Watershed stormwater guidance",
        url: "https://www.ricecreek.org/",
      },
    ],
    reviewSummary: {
      rating: 4.7,
      count: 63,
    },
    nearbyCities: ["vadnais-heights", "roseville", "little-canada"],
    localBusiness: {
      name: "InsightScoop Shoreview",
      address: "Turtle Lake Shoreview, MN 55126",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Shoreview, MN",
      description:
        "Shoreview lake homes trust InsightScoop for AI stool monitoring, lake-safe sanitation, and flexible scheduling from Turtle Lake to Snail Lake.",
      keywords: [
        "Shoreview dog waste removal",
        "InsightScoop Shoreview",
        "Turtle Lake poop scooping",
      ],
    },
  },
  "maple-grove": {
    name: "maple-grove",
    displayName: "Maple Grove",
    state: "MN",
    population: 73400,
    description:
      "InsightScoop powers Maple Grove's Arbor Lakes lifestyle with AI stool insights, HOA-ready proof, and compost diversion for eco-minded neighborhoods.",
    tagline: "Arbor Lakes, Rush Creek trails, InsightScoop AI—Maple Grove stays weekend-ready.",
    geo: {
      latitude: 45.0725,
      longitude: -93.4553,
    },
    zipCodes: ["55311", "55369"],
    neighborhoods: ["Arbor Lakes", "Rush Creek", "Weaver Lake", "Highwoods"],
    neighborhoodsDetailed: [
      {
        slug: "arbor-lakes",
        name: "Arbor Lakes & Main Street",
        description:
          "Townhomes above Main Street shops rely on InsightScoop's Bluetooth logging and AI stool reports to keep courtyard greens tidy.",
        insightFocus: [
          "HOA compliance",
          "AI insights for active city-suburb households",
        ],
        localTips: [
          "Schedule service before weekend restaurant traffic",
          "Bundle deodorizer for communal courtyards",
        ],
      },
      {
        slug: "rush-creek",
        name: "Rush Creek & Weaver Lake",
        description:
          "Trail-loving families benefit from InsightScoop's AI stool scoring and proof-of-sanitization to keep decks and docks visitor-ready.",
        insightFocus: [
          "Trailhead hydration monitoring",
          "Lake-safe sanitation",
        ],
        localTips: [
          "Add mid-week quick logs during sports seasons",
          "Request compost diversion for eco households",
        ],
      },
    ],
    serviceAreas: ["Maple Grove", "Arbor Lakes", "Rush Creek", "Osseo", "Plymouth"],
    stats: [
      { label: "Dog-friendly patios", value: "30+" },
      { label: "Dog-owning households", value: "45%" },
      { label: "InsightSummaries", value: "36 last quarter" },
    ],
    insightHighlights: [
      "AI stool analytics spot hydration issues during long trail sessions.",
      "Proof-of-service photos integrate with HOA and property management tools.",
      "Bluetooth logging streamlines service for busy commuting families.",
    ],
    faqs: [
      {
        question: "Do you service commercial dog relief areas at Arbor Lakes?",
        answer:
          "Yes. We partner with property managers to deliver proof photos, AI insights, and sanitation logs for retail dog relief zones.",
      },
      {
        question: "Can InsightScoop adjust to youth sports schedules?",
        answer:
          "We offer flexible windows and quick logs so active families always return to clean yards.",
      },
      {
        question: "Do you provide composting options?",
        answer:
          "Maple Grove clients can opt into compost diversion; we handle routing and documentation.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Maple Grove pet regulations",
        url: "https://www.maplegrovemn.gov/",
      },
      {
        label: "Three Rivers Elm Creek dog park",
        url: "https://www.threeriversparks.org/location/elm-creek-park-reserve",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 152,
    },
    nearbyCities: ["plymouth", "brooklyn-park", "osseo"],
    localBusiness: {
      name: "InsightScoop Maple Grove",
      address: "Arbor Lakes Maple Grove, MN 55369",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Maple Grove, MN",
      description:
        "Maple Grove trusts InsightScoop for AI stool monitoring, HOA-ready proof, and eco-friendly disposal across Arbor Lakes, Rush Creek, and Weaver Lake neighborhoods.",
      keywords: [
        "Maple Grove dog waste removal",
        "InsightScoop Maple Grove",
        "Arbor Lakes poop scooping",
      ],
    },
  },
  lakeville: {
    name: "lakeville",
    displayName: "Lakeville",
    state: "MN",
    population: 68738,
    description:
      "InsightScoop handles Lakeville's sprawling yards, hobby farms, and fast-growing neighborhoods with reliable pickup, AI stool insights, and compost-friendly disposal.",
    tagline: "Bigger yards. Bigger dogs. InsightScoop keeps Lakeville spotless from Marion Lake to Cedar Avenue.",
    geo: {
      latitude: 44.6497,
      longitude: -93.2427,
    },
    zipCodes: ["55044"],
    neighborhoods: ["Cedar Highlands", "Marion Lake", "Downtown Lakeville", "Heritage Estates"],
    neighborhoodsDetailed: [
      {
        slug: "marion-lake",
        name: "Marion & Orchard Lake",
        description:
          "Lakeside yards attract geese deposits. InsightScoop's AI stool scoring differentiates dog waste from wildlife so we focus on true health signals.",
        insightFocus: [
          "Goose vs. dog waste identification",
          "Hydration monitoring after boat days",
        ],
        localTips: [
          "Add algae-safe deodorizer for docks",
          "Schedule Monday sweeps after weekend guests",
        ],
      },
      {
        slug: "cedar-highlands",
        name: "Cedar Highlands & Spirit of Brandtjen",
        description:
          "New builds with smart-home tech appreciate InsightScoop's digital logs, AI reports, and turf-safe sanitation routines.",
        insightFocus: [
          "Proof-of-service for HOA portals",
          "AI stool summaries synced to homeowner dashboards",
        ],
        localTips: [
          "Bundle turf enzyme treatments each quarter",
          "Provide keypad codes through encrypted notes",
        ],
      },
    ],
    serviceAreas: ["Lakeville", "Marion Lake", "Cedar Highlands", "Farmington", "Rosemount"],
    stats: [
      { label: "Average lot size", value: "0.32 acres" },
      { label: "Dog parks & trails", value: "18" },
      { label: "InsightSummaries delivered", value: "34 last quarter" },
    ],
    insightHighlights: [
      "We capture wide-stitch proof photos so acreage owners see coverage across their property.",
      "AI InsightCamera helps monitor working and sporting breeds that train on farmland.",
      "Optional compost routes available for zero-waste households.",
    ],
    faqs: [
      {
        question: "Do you service acreage and hobby farms?",
        answer:
          "Yes. We map zones, capture AI samples, and can service multi-acre paddocks with advanced scheduling.",
      },
      {
        question: "How does InsightScoop manage large snowbanks?",
        answer:
          "We maintain winter visits and return for spring thaw resets to remove anything hidden under snow and ice.",
      },
      {
        question: "Can you coordinate with landscaping crews?",
        answer:
          "We'll share routes and proof photos so landscaping teams know when the yard is clean and ready for mowing.",
      },
    ],
    outboundLinks: [
      {
        label: "City of Lakeville pet ordinance",
        url: "https://www.lakevillemn.gov/371/Animal-Control",
      },
      {
        label: "Marion Lake Association",
        url: "https://marionlake.org/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 112,
    },
    nearbyCities: ["apple-valley", "farmington", "rosemount"],
    localBusiness: {
      name: "InsightScoop Lakeville",
      address: "North Lakeville, MN 55044",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal for Lakeville, MN Acreage",
      description:
        "Lakeville families rely on InsightScoop for acreage-friendly dog waste pickup, AI stool insights, and lakeside sanitation from Marion to Brandtjen Farms.",
      keywords: [
        "Lakeville dog waste removal",
        "InsightScoop Lakeville",
        "poop scooping acreage Lakeville",
      ],
    },
  },
  burnsville: {
    name: "burnsville",
    displayName: "Burnsville",
    state: "MN",
    population: 63743,
    description:
      "InsightScoop supports Burnsville's hillside neighborhoods with reliable poop pickup, AI stool monitoring, and quick-turn visits before Grand Rios, Buck Hill, or Vikings events.",
    tagline: "River bluffs, ski hills, and festival lawns—InsightScoop keeps Burnsville yards ready for guests.",
    geo: {
      latitude: 44.7677,
      longitude: -93.2777,
    },
    zipCodes: ["55306", "55337"],
    neighborhoods: ["Nicollet Commons", "Heart of the City", "Birnamwood", "Buck Hill"],
    neighborhoodsDetailed: [
      {
        slug: "heart-of-city",
        name: "Heart of the City",
        description:
          "Townhomes near Nicollet Commons crave zero-interruption service. InsightScoop's Bluetooth logging and AI recaps keep shared courtyards sparkling for concerts and markets.",
        insightFocus: [
          "AI stool insights for busy families",
          "Photo proof for HOA and property managers",
        ],
        localTips: [
          "Schedule pre-event sweeps ahead of summer concerts",
          "Bundle turf deodorizing for splash pad adjacent units",
        ],
      },
      {
        slug: "buck-hill",
        name: "Buck Hill & Crystal Lake",
        description:
          "Ski-season households rely on InsightScoop to maintain clean yards when daylight is short. AI scoring also tracks diet changes for athletic pups.",
        insightFocus: [
          "Winter quick logs during ski season",
          "Hydration monitoring after cold training days",
        ],
        localTips: [
          "Add spring thaw catch-up the moment snow melts",
          "Use InsightSummaries to update your vet before agility season",
        ],
      },
    ],
    serviceAreas: ["Burnsville", "Heart of the City", "Buck Hill", "Savage", "Lakeville"],
    stats: [
      { label: "Concert nights covered", value: "30+/yr" },
      { label: "Average yard", value: "0.25 acres" },
      { label: "AI alerts", value: "31 last quarter" },
    ],
    insightHighlights: [
      "We tackle steep hillside yards with route-optimized workflows and capture wide-angle proof shots.",
      "AI stool insights flag stress indicators during busy tournament seasons.",
      "Sanitation proof ensures daycare pickups and ride-share vehicles stay clean.",
    ],
    faqs: [
      {
        question: "Can InsightScoop handle hillside yards with retaining walls?",
        answer:
          "Yes. Our techs use harnessed routes, Bluetooth logging, and proof photos to confirm coverage on multi-tier lawns.",
      },
      {
        question: "Do you work around voice lessons, daycare pickups, and busy households?",
        answer:
          "We set predictable arrival windows and send SMS updates so you know when the yard is spotless for the next activity.",
      },
      {
        question: "How does AI help Burnsville pet parents?",
        answer:
          "InsightCamera captures stool changes tied to seasonal allergies, diet updates, or high-activity weeks so you can adjust quickly.",
      },
    ],
    outboundLinks: [
      {
        label: "Burnsville Parks pet rules",
        url: "https://burnsvillemn.gov/parks",
      },
      {
        label: "Buck Hill ski & snowboard area",
        url: "https://www.buckhill.com/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 134,
    },
    nearbyCities: ["apple-valley", "savage", "eagan"],
    localBusiness: {
      name: "InsightScoop Burnsville",
      address: "North Burnsville, MN 55337",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal in Burnsville, MN",
      description:
        "Burnsville homeowners trust InsightScoop for hillside-safe dog waste pickup, AI stool monitoring, and concert-ready sanitation from Heart of the City to Buck Hill.",
      keywords: [
        "Burnsville dog waste removal",
        "InsightScoop Burnsville",
        "poop scooping Buck Hill",
      ],
    },
  },
  "st-cloud": {
    name: "st-cloud",
    displayName: "St. Cloud",
    state: "MN",
    population: 68506,
    description:
      "InsightScoop combines university-town reliability with AI stool insights to keep St. Cloud homes, rentals, and riverfront patios spotless year-round.",
    tagline: "Granite City yards, campus dogs, AI-driven wellness—InsightScoop anchors St. Cloud.",
    geo: {
      latitude: 45.5579,
      longitude: -94.1632,
    },
    zipCodes: ["56301", "56302", "56303", "56304", "56387"],
    neighborhoods: [
      "Northside",
      "Pantown",
      "Lake George",
      "University-SCSU",
    ],
    neighborhoodsDetailed: [
      {
        slug: "university",
        name: "SCSU & University Neighborhood",
        description:
          "Student rentals and faculty homes need reliable proof and sanitation. InsightScoop's photo logs and AI stool insights simplify move-in/move-out inspections.",
        insightFocus: [
          "Proof photos for property managers",
          "AI flags for diet changes in multi-dog rentals",
        ],
        localTips: [
          "Coordinate with turnover crews in August and May",
          "Enable SMS alerts so tenants know when yards are clean",
        ],
      },
      {
        slug: "lake-george",
        name: "Lake George & Riverside",
        description:
          "Riverfront humidity invites odors fast. InsightScoop adds deodorizing passes and watches for parasites after dogs swim in the Mississippi.",
        insightFocus: [
          "Parasite monitoring post-swim",
          "Odor neutralizing for patio events",
        ],
        localTips: [
          "Book pre-holiday sweeps before lake festivals",
          "Request compost diversion for eco households",
        ],
      },
      {
        slug: "sartell",
        name: "Sartell & Tech Hub",
        description:
          "Commuters in Sartell rely on early-morning routes. InsightScoop's Bluetooth logging keeps garages secure while you head to the office.",
        insightFocus: [
          "Early morning scheduling",
          "AI hydration tracking for active trail dogs",
        ],
        localTips: [
          "Add second weekly visit during peak training seasons",
          "Share gate codes securely via InsightScoop portal",
        ],
      },
    ],
    serviceAreas: [
      "St. Cloud",
      "Sartell",
      "Sauk Rapids",
      "Waite Park",
      "St. Joseph",
      "Cold Spring",
    ],
    stats: [
      { label: "Student/tenant mix", value: "37% rentals" },
      { label: "Snow months serviced", value: "6+" },
      { label: "AI alerts last quarter", value: "48" },
    ],
    insightHighlights: [
      "Techs capture proof photos for property managers and HOA portals.",
      "AI stool scoring helps college pet parents monitor diet when schedules fluctuate.",
      "Compost routing reduces landfill impact for eco-minded riverfront residents.",
    ],
    faqs: [
      {
        question: "Do you service campus rentals and student housing?",
        answer:
          "Yes. We provide compliance documentation, InsightSummaries, and sanitation proof that property managers can file instantly.",
      },
      {
        question: "How does InsightScoop handle harsh winters?",
        answer:
          "We maintain weekly visits, use Bluetooth logging, and schedule early spring catch-ups to remove anything hidden by snow.",
      },
      {
        question: "Can you clean commercial dog relief areas downtown?",
        answer:
          "Absolutely. We service businesses, apartments, and mixed-use properties with tailored schedules and AI reporting.",
      },
    ],
    outboundLinks: [
      {
        label: "City of St. Cloud animal ordinances",
        url: "https://www.ci.stcloud.mn.us/",
      },
      {
        label: "SCSU Veterinary Technology program",
        url: "https://www.stcloudstate.edu/academics/programs/veterinary-technology/",
      },
    ],
    reviewSummary: {
      rating: 4.8,
      count: 89,
    },
    nearbyCities: ["sartell", "sauk-rapids", "waite-park"],
    localBusiness: {
      name: "InsightScoop St. Cloud",
      address: "Downtown St. Cloud, MN 56301",
      phone: "1-877-417-YARD",
    },
    seo: {
      title: "InsightScoop Dog Waste Removal & AI Insights in St. Cloud, MN",
      description:
        "Keep St. Cloud yards, rentals, and riverfront patios clean with InsightScoop's AI stool monitoring, Bluetooth logging, and sanitation proof across Central Minnesota.",
      keywords: [
        "St. Cloud dog waste removal",
        "InsightScoop St. Cloud",
        "Sartell poop scooping",
      ],
    },
  },
};

export const getCityData = (citySlug: string): CityData | null => {
  return CITY_DATA[citySlug] || null;
};

export const getAllCities = (): CityData[] => {
  return Object.values(CITY_DATA);
};

export const getCitySlugs = (): string[] => {
  return Object.keys(CITY_DATA);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const FALLBACK_NEIGHBORHOOD_INSIGHT = [
  "Weekly poop pickup",
  "AI stool scoring",
];

const FALLBACK_NEIGHBORHOOD_TIPS = [
  "Schedule pre-weekend scoop",
  "Enable gate photo proof",
];

const ensureNeighborhoodDetail = (detail: NeighborhoodDetail): NeighborhoodDetail => ({
  ...detail,
  slug: detail.slug ?? slugify(detail.name),
  insightFocus: detail.insightFocus.length ? detail.insightFocus : FALLBACK_NEIGHBORHOOD_INSIGHT,
  localTips: detail.localTips.length ? detail.localTips : FALLBACK_NEIGHBORHOOD_TIPS,
});

export const getNeighborhoodDetails = (city: CityData): NeighborhoodDetail[] => {
  if (city.neighborhoodsDetailed?.length) {
    return city.neighborhoodsDetailed.map(ensureNeighborhoodDetail);
  }

  return city.neighborhoods.map((name) => ({
    slug: slugify(name),
    name,
    description: `InsightScoop keeps ${name} yards spotless with AI monitored poop pickup and detailed service proof.`,
    insightFocus: FALLBACK_NEIGHBORHOOD_INSIGHT,
    localTips: FALLBACK_NEIGHBORHOOD_TIPS,
  }));
};

export const getNeighborhoodBySlug = (
  citySlug: string,
  neighborhoodSlug: string,
): { city: CityData; neighborhood: NeighborhoodDetail } | null => {
  const city = getCityData(citySlug);
  if (!city) return null;

  const details = getNeighborhoodDetails(city);
  const neighborhood = details.find((item) => item.slug === neighborhoodSlug);
  if (!neighborhood) return null;

  return { city, neighborhood };
};

// Public facing cities to display in nav/footer and /city index
// Temporarily hide certain cities while keeping their pages available
const HIDDEN_CITY_SLUGS = new Set<string>();

export const getPublicCities = (): CityData[] => {
  return Object.values(CITY_DATA).filter((c) => !HIDDEN_CITY_SLUGS.has(c.name));
};

export const getPublicCitySlugs = (): string[] => {
  return Object.keys(CITY_DATA).filter((slug) => !HIDDEN_CITY_SLUGS.has(slug));
};
