import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const posts: Record<string, {
  title: string;
  description: string;
  date: string;
  content: string;
}> = {
  "spring-dog-poop-cleanup": {
    title: "Spring Dog Waste Cleanup: How to Handle the Winter Poop Pile-Up",
    description: "The spring thaw reveals months of frozen dog waste. Learn why professional cleanup matters and what your dog's winter stool reveals about their health.",
    date: "February 8, 2026",
    content: `Every dog owner in the Midwest knows the ritual. November hits, the snow starts falling, and somewhere around the third blizzard, you stop going out to pick up after your dog.

It's buried. It's frozen. It's fine.

Then March arrives. The temperatures creep above freezing. And suddenly, your backyard looks like an archaeological dig site of everything your dog ate since Thanksgiving.

Welcome to the Great Thaw.

## The Winter Accumulation Problem

Let's be honest about what happens between November and March in places like Minneapolis, Indianapolis, Salt Lake City, and other cold-weather cities.

**Average accumulation for a medium-sized dog over 4 months:**
- 3-4 deposits per day × 120 days = 360-480 piles
- Approximately 45-60 pounds of waste

That's not a typo. Your 50-pound Lab produces roughly their own body weight in waste over a single winter.

Most of it is buried under snow. Some of it got picked up when the weather was nice. But a significant portion is frozen in place, waiting for the spring thaw to release it back into your yard—and your life.

## Why the Spring Thaw Is Actually Dangerous

Here's what most dog owners don't realize: frozen dog waste isn't just gross. It's a health hazard that gets worse the longer it sits.

### Parasites Survive the Cold

Many intestinal parasites—including roundworms, hookworms, and giardia—can survive freezing temperatures. Their eggs or cysts remain dormant in frozen feces, waiting for warmer temperatures to become active again.

When spring hits:
- Parasites reactivate
- Your dog sniffs and investigates their old deposits
- Reinfection becomes possible
- Children playing in the yard face exposure risk

### Bacterial Bloom

As temperatures rise, bacteria that were dormant in frozen waste begin multiplying rapidly. The combination of warmth and moisture creates ideal conditions for pathogens like E. coli and Salmonella.

### Lawn Damage Compounds

Dog waste is highly acidic and nitrogen-rich. Frozen waste that sits all winter creates concentrated "burn spots" that kill grass in patches. By the time you clean up in spring, the damage is already done.

## The Hidden Health Data in Winter Stool

Here's something interesting that most people miss: the poop that accumulates over winter tells a story about your dog's health through the cold months.

At InsightScoop, when we do spring cleanups, we're not just removing waste. We're looking for patterns.

### What Winter Stool Reveals

**Dietary changes:** Holiday table scraps, different treats, new food brands—they all show up in stool consistency and color.

**Seasonal stress:** Holidays, houseguests, schedule changes, and reduced exercise affect digestion. Loose stool or mucus can indicate stress.

**Indoor air quality:** Dogs spend more time inside during winter. Dehydration (harder, drier stool) is common when indoor heating reduces humidity.

**Weight fluctuations:** Less exercise plus more treats equals digestive changes. We often see consistency shifts that correlate with winter weight gain.

**Hidden illnesses:** Some dogs develop issues during winter that go unnoticed because owners aren't inspecting stool as closely. Parasites, infections, and dietary sensitivities can accumulate.

## DIY Spring Cleanup: What You're Getting Into

If you're going to tackle the spring thaw yourself, here's what you're facing:

### Equipment Needed
- Heavy-duty bags (not the flimsy ones—they'll tear)
- A flat-edged shovel (better than a pooper scooper for frozen/thawed waste)
- Gloves (plural—you'll go through several pairs)
- A mask (the smell is concentrated after months of freeze-thaw)
- Enzyme-based yard treatment for the grass

### Time Investment
For a medium-sized yard with one dog:
- Initial cleanup: 2-4 hours
- Follow-up (stuff you missed): 1-2 hours
- Lawn treatment: 1 hour

For multiple dogs, multiply accordingly.

### The Texture Problem

Freshly thawed dog waste has a unique and unpleasant texture. It's not frozen solid. It's not fresh and formed. It's somewhere in between—soft, fragmented, and often mixed with dead grass and leaves.

Some of it will crumble. Some will smear. None of it is pleasant to handle.

## When to Start Spring Cleanup

**Too early:** Ground still frozen, waste still embedded in ice. You'll tear up grass trying to remove it.

**Too late:** Everything has fully thawed and begun decomposing. The smell is worse, parasites are active, and lawn damage is locked in.

**Just right:** First consistent week of above-freezing temperatures. Waste has softened but hasn't started breaking down. Usually late February to mid-March in most Midwest cities.

## What Professional Cleanup Looks Like

A professional spring cleanup service does several things you probably won't do yourself:

### Systematic Coverage
We grid the yard and work section by section. Nothing gets missed because we're not relying on visual scanning alone.

### Health Assessment
At InsightScoop, we use our 3C Framework—Color, Consistency, and Contents—to assess what we find. If we spot anything concerning (unusual colors, parasites, blood), we alert you immediately.

### Proper Disposal
Dog waste is classified as a pollutant by the EPA. We bag and remove it properly, taking it off your property entirely.

### Volume Tracking
We track how much we remove. For regular customers, this helps establish a baseline for monitoring changes in your dog's health and output.

## The Real Cost Calculation

Let's do the math on spring cleanup:

**DIY Approach:**
- 4-6 hours of unpleasant work
- $30-50 in supplies
- Missed spots that continue causing problems
- No health insights
- Your Saturday is gone

**Professional Cleanup:**
- $50-100 depending on yard size and accumulation
- 30-45 minutes of professional work
- Comprehensive coverage
- Health monitoring included (with InsightScoop)
- Your Saturday is yours

For most people, the time-value equation favors professional service. But beyond time, the health monitoring aspect is what actually matters.

## Setting Up for Next Winter

The best time to start regular service is right after spring cleanup. Here's why:

**Baseline establishment:** We learn what normal looks like for your dog.

**Weekly maintenance:** Waste never accumulates. Problems get caught early.

**Winter continuation:** Unlike DIY, professional service continues through winter. We come weekly even when there's snow, so spring never becomes a crisis.

**Health tracking:** Over months, we build a picture of your dog's digestive patterns. Seasonal changes, dietary impacts, stress responses—we see it all.

## Cities We Serve

InsightScoop currently operates in the Twin Cities (Minneapolis-St. Paul) and is expanding to:

- **Indianapolis** — Launching spring 2026
- **Salt Lake City** — Coming soon
- **Raleigh-Durham** — Coming soon
- **Austin** — Coming soon
- **Tampa** — Coming soon

If you're in one of these areas and want to get on the early access list, reach out through our contact page.

## The Bottom Line

The spring thaw reveals more than just accumulated waste. It reveals how your dog's health has been tracking through the winter—and whether there are issues you've missed.

You can spend a Saturday afternoon in the muck, or you can let professionals handle it while gaining actual health insights about your dog.

The choice is yours. But spring is coming, and so is everything your dog left behind since November.`,
  },
  "dog-poop-color-guide": {
    title: "What Your Dog's Poop Color Means: A Complete Health Guide",
    description: "Learn what your dog's poop color reveals about their health.",
    date: "February 5, 2026",
    content: `Your dog can't tell you when something's wrong—but their poop can.

It's not glamorous, but stool is one of the most reliable windows into your dog's digestive health. Changes in color, consistency, or contents often show up before any other symptoms appear.

## What Does Normal Dog Poop Look Like?

**Healthy dog poop is chocolate brown.** The shade can vary slightly—anywhere from medium brown to a richer, darker brown is typically normal.

The brown color comes from **bile**, a digestive fluid produced by the liver and stored in the gallbladder.

## Warning Colors and What They Mean

### Black or Tarry Stool

This is potentially serious. Black, tarry poop often indicates digested blood from the upper gastrointestinal tract.

**Possible causes:** Ulcers, internal bleeding, tumors, or certain medications.

**Action:** Contact your vet promptly.

### Bright Red Blood

Fresh red blood indicates bleeding in the lower GI tract—the colon, rectum, or anal area.

**Possible causes:** Colitis, parasites, anal gland issues, parvovirus.

**Action:** See your vet, especially if it happens repeatedly.

### Yellow or Orange Stool

Can indicate bile duct issues or liver problems.

**Action:** Monitor for a day. If it persists, consult your vet.

### Green Stool

Most commonly from eating grass. But can also indicate parasites or gallbladder issues.

**Warning:** Rat poison ingestion can cause green stool—this is urgent.

### White, Gray, or Chalky Stool

Indicates a lack of bile, pointing to pancreatic or bile duct problems.

**Action:** Contact your vet within 24-48 hours.

### White Specks in Stool

Rice-like specks are typically **tapeworm segments**. Spaghetti-like strands indicate **roundworms**.

**Action:** See your vet for deworming medication.

## When to Call the Vet

Call your vet **immediately** if you see:
- Black, tarry stool
- Large amounts of fresh blood
- Stool accompanied by vomiting, lethargy, or loss of appetite

## How InsightScoop Helps

At InsightScoop, we're in your backyard 1-4 times per week. Every visit, our trained technicians assess your dog's stool using the 3C Framework—Color, Consistency, and Contents.

When we spot something concerning, we alert you immediately. Many of our customers have caught health issues early because we noticed changes they would have missed.`,
  },
  "twin-cities-dog-waste-removal": {
    title: "Dog Waste Removal Services in Minneapolis-St. Paul",
    description: "Professional pooper scooper service for the Twin Cities with health monitoring.",
    date: "February 5, 2026",
    content: `Minnesota winters are brutal. You know what's worse? The spring thaw that reveals four months of frozen dog poop scattered across your yard.

If you're a Twin Cities dog owner, you've lived this reality. That's where professional dog waste removal comes in.

But here's the thing most Twin Cities pet owners don't realize: **not all pooper scooper services are the same.** Some just clean. We clean *and* watch out for your dog's health.

## Why Minneapolis-St. Paul Dog Owners Need Professional Waste Removal

### The Winter Accumulation Problem

Between November and March, most of us let it pile up. The snow covers it. Out of sight, out of mind.

Then April hits. Suddenly you've got months of accumulated waste thawing into your lawn. It's not just gross—it's harmful:

- **Lawn damage:** Dog waste burns grass and creates dead spots
- **Health risks:** Parasites survive Minnesota winters
- **Water contamination:** Dog waste is classified as a pollutant by the EPA

## Areas We Serve

### Minneapolis Neighborhoods
Northeast Minneapolis, Uptown, Southwest Minneapolis, North Loop, Longfellow, Nokomis, South Minneapolis, Kenny, Armatage, Windom

### St. Paul Neighborhoods
Highland Park, Mac-Groveland, Summit Hill, Como, Merriam Park, St. Anthony Park, Cathedral Hill

### Suburbs
**West Metro:** Edina, Eden Prairie, Minnetonka, Plymouth, Maple Grove, St. Louis Park

**South Metro:** Bloomington, Burnsville, Eagan, Apple Valley, Lakeville

**East Metro:** Woodbury, Oakdale, Maplewood, Cottage Grove

**North Metro:** Brooklyn Park, Roseville, White Bear Lake, Shoreview

## Our Services

### Weekly Cleanup (Most Popular)
We clean your entire yard, assess stool health, and notify you when complete. $15-25 per visit for most households.

### The 3C Health Monitoring (Included)
Every visit, our technicians assess what they find using our 3C Framework—Color, Consistency, and Contents. If we spot a concern, you get an immediate alert.

### No Contracts
Sign up, try us out, cancel anytime.`,
  },
  "3c-framework-dog-health": {
    title: "The 3C Framework: How We Monitor Your Dog's Health",
    description: "Most dog waste removal services just see poop. We see data.",
    date: "February 5, 2026",
    content: `Here's a question most dog owners don't think about: When was the last time you really looked at your dog's poop?

For most people, the answer is "never" or "only when something was obviously wrong."

But here's what veterinarians know: **stool is one of the earliest and most reliable indicators of your dog's health.** Changes in poop often appear days or weeks before other symptoms.

This is why we created the 3C Framework.

## The First C: Color

### Healthy Baseline: Chocolate Brown

The brown color comes from bile, a digestive fluid produced by the liver. Healthy digestion produces consistent brown stool.

### Warning Colors

- **Black or Tarry:** Potentially serious—digested blood from upper GI
- **Bright Red Blood:** Lower GI bleeding
- **Yellow or Orange:** Bile duct or liver issues
- **Green:** Often grass, but can indicate parasites
- **White/Gray:** Lack of bile—pancreatic problems

## The Second C: Consistency

### The Scale

1. Hard, dry pellets — Constipation
2. Firm, segmented — Ideal
3. Log-shaped, moist — Ideal
4. Soft, loses shape — Monitor
5. Very soft — Concern
6. Watery — Needs attention
7. Liquid — Urgent

### What Consistency Tells Us

- Hydration levels
- Digestive efficiency
- Potential infections
- Food intolerances
- Stress

## The Third C: Contents

### What We Look For

- **Mucus:** Can indicate colitis or infections
- **Blood:** Fresh or digested
- **Parasites:** Tapeworm segments, roundworms
- **Foreign Objects:** Sock fragments, plastic, hair ties
- **Undigested Food:** Eating too fast or pancreatic issues

## Why Other Services Don't Do This

Most waste removal services optimize for speed. Health monitoring requires training, time, systems, and intentionality.

We built InsightScoop specifically to include health monitoring from day one.

## We're Not Veterinarians

We're trained observers who flag concerns. We see things. We note things. We alert you when something seems off. Then you and your vet decide what to do.

**Color. Consistency. Contents.** Three simple categories that reveal more about your dog's health than most pet owners realize.`,
  },
};

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) return { title: "Not Found" };
  
  return {
    title: `${post.title} | InsightScoop Blog`,
    description: post.description,
  };
}

function formatContent(content: string): string {
  return content
    .split('\n\n')
    .map(para => {
      if (para.startsWith('## ')) {
        return `<h2 class="text-2xl font-bold mt-8 mb-4">${para.slice(3)}</h2>`;
      }
      if (para.startsWith('### ')) {
        return `<h3 class="text-xl font-semibold mt-6 mb-3">${para.slice(4)}</h3>`;
      }
      if (para.startsWith('- ')) {
        const items = para.split('\n').map(line => 
          `<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`
        ).join('');
        return `<ul class="list-disc pl-6 my-4 space-y-2">${items}</ul>`;
      }
      const formatted = para
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      return `<p class="my-4 text-gray-700 leading-relaxed">${formatted}</p>`;
    })
    .join('');
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
  
  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/blog" className="text-emerald-600 hover:text-emerald-700 mb-8 inline-block">
          &larr; Back to Blog
        </Link>
        
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          <p className="text-gray-500">{post.date}</p>
        </header>
        
        <div 
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: formatContent(post.content) }}
        />
        
        <div className="mt-16 p-8 bg-emerald-50 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ready for a cleaner yard and healthier dog?
          </h2>
          <p className="text-gray-600 mb-4">
            InsightScoop provides dog waste removal with health monitoring in the Twin Cities.
          </p>
          <Link 
            href="/quote" 
            className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </article>
    </main>
  );
}
