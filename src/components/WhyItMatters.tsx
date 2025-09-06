'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Activity,
  Biohazard,
  Droplet,
  Bone,
  Bug,
  Stethoscope,
  Eye,
  Heart,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useInViewCountUp } from '../hooks/useInViewCountUp';

type WhyItMattersProps = {
  onGetQuoteClick?: () => void;
  onInsightsClick?: () => void;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const cardHoverVariants = {
  hover: {
    y: -2,
  },
};

export default function WhyItMatters({ onGetQuoteClick, onInsightsClick }: WhyItMattersProps) {
  const insightRef = useRef<HTMLDivElement>(null);
  const insightCount = useInViewCountUp(insightRef, { end: 24, duration: 2000 });

  const handleGetQuote = () => {
    if (onGetQuoteClick) {
      onGetQuoteClick();
    } else {
      window.location.href = '/quote';
    }
  };

  const handleInsights = () => {
    if (onInsightsClick) {
      onInsightsClick();
    } else {
      window.location.href = '#insights';
    }
  };

  return (
    <section
      id="why-matters"
      aria-labelledby="why-matters-heading"
      className="relative overflow-hidden bg-gradient-radial from-white via-slate-50/30 to-white"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--accent)) 2px, transparent 2px),
                           radial-gradient(circle at 75% 75%, hsl(var(--accent)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px, 40px 40px',
            backgroundPosition: '0 0, 30px 30px',
          }}
        />
      </div>

      <div className="container max-w-7xl py-24 md:py-32 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-2 gap-12 lg:gap-16 items-start"
        >
          {/* Left Column - Header Content */}
          <div className="space-y-8">
            <motion.div variants={itemVariants} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft text-accent font-medium text-sm mb-4">
                <Eye className="size-4" />
                Why it matters
              </div>

              <h2
                id="why-matters-heading"
                className="text-3xl md:text-4xl font-bold text-ink leading-tight"
              >
                Outsourcing scooping shouldn't mean{' '}
                <span className="text-accent">outsourcing awareness</span>
              </h2>

              <p className="mt-6 text-lg text-muted leading-relaxed">
                Parasites and GI disease can be quiet at first. They can steal nutrients, cause
                malabsorption, and lead to anemia or weight loss—often before a dog looks "sick."
                Blood in stool can be subtle (or hidden in dark, tarry stools), and most owners
                don't examine every pickup—especially when a service does it for them.{' '}
                <span className="font-medium text-ink">
                  Yardura pairs a clean yard with opt-in, privacy-first stool monitoring
                  (non-diagnostic) so you can spot concerning changes early and talk to your vet
                  sooner.
                </span>
              </p>
            </motion.div>

            {/* Callout Box */}
            <motion.div
              variants={itemVariants}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="p-6 rounded-2xl bg-panel border border-slate-200/60 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-muted font-medium">
                    Most people don't inspect every stool.
                  </p>
                  <p className="text-sm text-muted leading-relaxed">
                    With a service, it's even easier to miss the quiet warnings. We log controlled
                    photos and basics (time, weight, moisture) so you don't have to look—but you
                    still get the signal.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Insight Preview Card */}
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            <motion.div
              ref={insightRef}
              variants={cardHoverVariants}
              whileHover="hover"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-accent" />
                  <span className="text-sm font-medium text-ink">Last 7 Days</span>
                </div>
                <div className="px-2 py-1 bg-accent-soft text-accent text-xs font-medium rounded-full">
                  Black/tarry? Possible upper GI blood
                </div>
              </div>

              {/* Sparkline Chart */}
              <div className="mb-4 h-20 relative">
                <svg
                  viewBox="0 0 200 60"
                  className="w-full h-full"
                  aria-labelledby="sparkline-desc"
                >
                  <defs>
                    <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Background grid */}
                  <g stroke="hsl(var(--muted))" strokeWidth="0.5" opacity="0.3">
                    <line x1="0" y1="15" x2="200" y2="15" />
                    <line x1="0" y1="30" x2="200" y2="30" />
                    <line x1="0" y1="45" x2="200" y2="45" />
                  </g>

                  {/* Sparkline path */}
                  <path
                    d="M10 35 L30 32 L50 28 L70 35 L90 25 L110 30 L130 22 L150 28 L170 25 L190 20"
                    fill="none"
                    stroke="hsl(var(--accent))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Area fill */}
                  <path
                    d="M10 35 L30 32 L50 28 L70 35 L90 25 L110 30 L130 22 L150 28 L170 25 L190 20 L190 60 L10 60 Z"
                    fill="url(#sparklineGradient)"
                  />

                  {/* Data points with tooltips */}
                  <circle
                    cx="50"
                    cy="28"
                    r="3"
                    fill="hsl(var(--accent))"
                    className="drop-shadow-sm"
                  >
                    <title>Softer than usual</title>
                  </circle>
                  <circle
                    cx="90"
                    cy="25"
                    r="3"
                    fill="hsl(var(--accent))"
                    className="drop-shadow-sm"
                  >
                    <title>Red streaks</title>
                  </circle>
                  <circle
                    cx="130"
                    cy="22"
                    r="3"
                    fill="hsl(var(--warning))"
                    className="drop-shadow-sm"
                  >
                    <title>Black/tarry</title>
                  </circle>
                  <circle
                    cx="170"
                    cy="25"
                    r="3"
                    fill="hsl(var(--accent))"
                    className="drop-shadow-sm"
                  >
                    <title>Normal</title>
                  </circle>
                </svg>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-ink">{insightCount}</div>
                <div className="text-sm text-muted">Insights this week</div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Three Pillars */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid md:grid-cols-3 gap-6 mt-20"
        >
          <motion.div
            variants={cardHoverVariants}
            whileHover="hover"
            className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-soft rounded-xl">
                <Heart className="size-5 text-accent" />
              </div>
              <h3 className="font-semibold text-ink">Health (non-diagnostic)</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Parasites can steal calories and micronutrients → malnutrition/anemia risk</li>
              <li>• Trend changes (color, consistency, content, frequency) vs your dog's normal</li>
              <li>• Informational only — always consult your vet for concerns</li>
            </ul>
          </motion.div>

          <motion.div
            variants={cardHoverVariants}
            whileHover="hover"
            className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-soft rounded-xl">
                <Droplet className="size-5 text-accent" />
              </div>
              <h3 className="font-semibold text-ink">Blood Signals</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Bright red (hematochezia): usually lower GI/colon</li>
              <li>• Black/tarry (melena): digested blood → often upper GI</li>
              <li>• Both warrant extra caution and timely vet guidance</li>
            </ul>
          </motion.div>

          <motion.div
            variants={cardHoverVariants}
            whileHover="hover"
            className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-soft rounded-xl">
                <Shield className="size-5 text-accent" />
              </div>
              <h3 className="font-semibold text-ink">Awareness Without the Ick</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• You outsource the mess — we surface the patterns</li>
              <li>• Gentle alerts; fewer false alarms by comparing to baseline</li>
              <li>• Opt-in, de-identified, delete-on-request</li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Conditions Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-20"
        >
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center mb-12"
          >
            <h3 className="text-2xl font-bold text-ink mb-2">
              Common Conditions & What to Watch For
            </h3>
            <p className="text-muted">Early detection through pattern recognition</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Bug,
                condition: 'Hookworms & Whipworms',
                whatShows: 'dark/tarry or fresh red blood, mucus; sometimes none',
                whyMatters:
                  'Blood loss + nutrient theft → anemia, poor growth, weight loss if untreated',
                color: 'text-red-500',
              },
              {
                icon: Biohazard,
                condition: 'Giardia & Coccidia',
                whatShows: 'soft/pale, foul; intermittent diarrhea; steatorrhea possible',
                whyMatters: 'Malabsorption → chronic weight loss and poor condition if missed',
                color: 'text-orange-500',
              },
              {
                icon: Stethoscope,
                condition: 'Colitis / Large-bowel inflammation',
                whatShows: 'urgency, mucus, bright red blood, small frequent stools',
                whyMatters: 'Often episodic; can progress or mimic other serious disease',
                color: 'text-blue-500',
              },
              {
                icon: Activity,
                condition: 'Parvovirus / Acute hemorrhagic diarrhea',
                whatShows: 'bloody, hemorrhagic diarrhea ± vomiting, lethargy',
                whyMatters: 'Rapidly progressive, potentially life-threatening — time is critical',
                color: 'text-purple-500',
              },
              {
                icon: Bone,
                condition: 'Exocrine Pancreatic Insufficiency',
                whatShows: 'large-volume loose/greasy stools; weight loss despite eating',
                whyMatters:
                  'Chronic maldigestion; earlier recognition shortens the road to treatment',
                color: 'text-green-500',
              },
              {
                icon: Droplet,
                condition: 'Foreign body / Ulcer / Upper-GI bleed',
                whatShows: 'black/tarry (melena)',
                whyMatters: 'Indicates digested blood — needs timely evaluation',
                color: 'text-red-600',
              },
            ].map((item, index) => (
              <motion.div
                key={item.condition}
                variants={itemVariants}
                className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 bg-slate-100 rounded-xl ${item.color}`}>
                    <item.icon className="size-5" />
                  </div>
                  <h4 className="font-semibold text-ink text-sm">{item.condition}</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted mb-1">What stool may show</div>
                    <div className="text-sm text-ink">{item.whatShows}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-accent mb-1">Why it matters</div>
                    <div className="text-sm text-ink">{item.whyMatters}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* When to Contact Vet */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-20"
        >
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center mb-8"
          >
            <h3 className="text-xl font-bold text-ink mb-2">When to contact your vet</h3>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              'Black/tarry stools (melena)',
              'Bright red blood that persists >24 hours',
              'Diarrhea with lethargy, fever, repeated vomiting',
              'Rapid weight loss or pale gums',
              'Greasy, gray/tan stools with increased volume',
              'Any sudden change that lasts >48 hours',
            ].map((item, index) => (
              <motion.div
                key={item}
                variants={itemVariants}
                className="px-4 py-2 bg-accent-soft text-accent rounded-full text-sm font-medium border border-accent/20 hover:bg-accent hover:text-white transition-colors duration-200"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Trust & CTA Strip */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-20 p-8 rounded-2xl bg-gradient-to-r from-accent-soft to-accent-soft/60 border border-accent/20"
        >
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">
                Privacy-first. Science-backed. Non-diagnostic.
              </h3>
              <p className="text-sm text-muted max-w-2xl mx-auto">
                Insights are informational only and not veterinary advice. Yardura does not diagnose
                or treat disease. We simply help you spot patterns that might warrant professional
                attention.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGetQuote}
                className="px-6 py-3 bg-ink text-white rounded-xl font-semibold shadow-soft hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
              >
                Get My Quote
                <ArrowRight className="size-4" />
              </motion.button>

              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInsights}
                className="px-6 py-3 border-2 border-accent text-accent rounded-xl font-semibold hover:bg-accent hover:text-white transition-all duration-200"
              >
                How Insights Work
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
