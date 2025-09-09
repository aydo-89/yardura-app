'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
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
  // CheckCircle,
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
        {/* Large Section Label */}
        <motion.div
          variants={itemVariants}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-black text-accent mb-4 tracking-tight">
            WHY IT MATTERS
          </h1>
          <div className="w-24 h-1 bg-accent mx-auto rounded-full"></div>
        </motion.div>

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
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-soft/50 rounded-full border border-accent/20 mb-4">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-accent">Health insights coming soon</span>
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
                malabsorption, and lead to anemia or weight loss—often without a dog looking "sick."
                Blood in stool can be subtle (or hidden in dark, tarry stools), and most owners
                don't examine every pickup—especially when a service does it for them.
              </p>

              {/* Enhanced Value Proposition - Made it stand out */}
              <motion.div
                variants={itemVariants}
                className="mt-8 p-6 bg-gradient-to-r from-accent-soft/30 via-accent-soft/20 to-accent-soft/30 rounded-2xl border border-accent/20 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent rounded-xl flex-shrink-0 mt-1">
                    <Heart className="size-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-accent mb-3">Yardura's Unique Promise</h3>
                    <p className="text-ink font-medium text-lg leading-relaxed">
                      Yardura pairs a clean yard with opt-in stool monitoring
                      (non-diagnostic) so you can spot concerning changes early and talk to your vet
                      sooner.
                    </p>
                  </div>
                </div>
              </motion.div>
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
                  <span className="text-sm font-medium text-ink">Last 30 Days</span>
                </div>
                <div className="px-2 py-1 bg-accent-soft text-accent text-xs font-medium rounded-full">
                  Black/tarry? Possible upper GI blood
                </div>
              </div>

              {/* Weekly Timeline Chart (like wellness tab) */}
              <div className="mb-4 h-24 relative">
                <svg viewBox="0 0 300 80" className="w-full h-full" aria-labelledby="timeline-desc">
                  <defs>
                    <linearGradient id="timelineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Weekly data points - Realistic numbers: ~14 per dog (2/day) */}
                  {[
                    { week: 'Aug 4', deposits: 14, status: 'normal' },
                    { week: 'Aug 11', deposits: 13, status: 'monitor' },
                    { week: 'Aug 18', deposits: 15, status: 'normal' },
                    { week: 'Aug 25', deposits: 12, status: 'attention' },
                    { week: 'Sep 1', deposits: 16, status: 'normal' },
                    { week: 'Sep 8', deposits: 14, status: 'normal' },
                  ].map((point, index) => {
                    const x = 40 + index * 45;
                    const maxDeposits = 16; // Realistic for 1 dog: ~14-16 per week
                    const y = 60 - (point.deposits / maxDeposits) * 40;

                    let color = '#10b981'; // normal
                    if (point.status === 'monitor') color = '#f59e0b';
                    if (point.status === 'attention') color = '#ef4444';

                    return (
                      <g key={index}>
                        {/* Line to next point */}
                        {index < 5 && (
                          <line
                            x1={x}
                            y1={y}
                            x2={40 + (index + 1) * 45}
                            y2={
                              60 -
                              ([
                                { deposits: 14 },
                                { deposits: 13 },
                                { deposits: 15 },
                                { deposits: 12 },
                                { deposits: 16 },
                                { deposits: 14 },
                              ][index + 1].deposits /
                                maxDeposits) *
                                40
                            }
                            stroke="#10b981"
                            strokeWidth="2"
                            opacity="0.6"
                          />
                        )}

                        {/* Data point */}
                        <circle cx={x} cy={y} r="4" fill={color} className="drop-shadow-sm">
                          <title>
                            {point.week}: {point.deposits} deposits
                          </title>
                        </circle>

                        {/* Week label */}
                        <text
                          x={x}
                          y="75"
                          textAnchor="middle"
                          className="fill-slate-500"
                          fontSize="9"
                        >
                          {point.week}
                        </text>
                      </g>
                    );
                  })}

                  {/* Y-axis labels */}
                  <text x="10" y="20" textAnchor="middle" className="fill-slate-400" fontSize="9">
                    16
                  </text>
                  <text x="10" y="35" textAnchor="middle" className="fill-slate-400" fontSize="9">
                    8
                  </text>
                  <text x="10" y="50" textAnchor="middle" className="fill-slate-400" fontSize="9">
                    0
                  </text>
                </svg>
              </div>

              {/* Bristol Scale & Consistency (like wellness tab) */}
              <div className="mt-4 space-y-3">
                <div className="text-xs text-muted mb-2">Consistency Analysis</div>

                {/* Bristol Scale Visual */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Hard</span>
                    <span>Normal</span>
                    <span>Soft</span>
                  </div>
                  <div className="relative h-3 bg-gradient-to-r from-red-200 via-green-200 to-yellow-200 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-1/3 right-1/3 bg-green-400 bg-opacity-60 rounded-full"></div>
                    <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700 rounded-full transform -translate-x-0.5 left-3/4"></div>
                  </div>
                  <div className="text-center text-xs text-slate-600">Mostly Normal</div>
                </div>

                {/* Consistency Distribution */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-700">70%</div>
                    <div className="text-xs text-green-600">Normal</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <div className="text-lg font-bold text-yellow-700">20%</div>
                    <div className="text-xs text-yellow-600">Soft</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <div className="text-lg font-bold text-orange-700">10%</div>
                    <div className="text-xs text-orange-600">Dry</div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-ink">{insightCount}</div>
                <div className="text-sm text-muted">Insights this week</div>
              </div>
            </motion.div>

            {/* Callout Box - Moved from left column */}
            <motion.div
              variants={itemVariants}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-sm mt-6"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0 mt-1">
                  <Eye className="size-4 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-blue-800 font-medium">
                    The Hidden Health Signals
                  </p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    Most pet owners don't inspect every stool—it's understandable! But small changes
                    can signal bigger issues. We capture the details you might miss,
                    so you get peace of mind without the hassle.
                  </p>
                </div>
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
              <h3 className="font-semibold text-ink">Early Detection</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Spot parasites and digestive issues before symptoms show</li>
              <li>• Track changes in stool color, consistency, and patterns</li>
              <li>• Get alerts about concerning trends in your dog's health</li>
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
              <h3 className="font-semibold text-ink">Blood in Stool</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Bright red blood: Usually from lower digestive tract</li>
              <li>• Dark/black blood: May indicate upper digestive issues</li>
              <li>• Any blood requires prompt veterinary attention</li>
            </ul>
          </motion.div>

          <motion.div
            variants={cardHoverVariants}
            whileHover="hover"
            className="p-6 rounded-2xl bg-white border border-slate-200/60 shadow-soft"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-soft rounded-xl">
                <Eye className="size-5 text-accent" />
              </div>
              <h3 className="font-semibold text-ink">Peace of Mind</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Professional monitoring without you having to look</li>
              <li>• Smart alerts that learn your dog's normal patterns</li>
              <li>• Your privacy protected with opt-in, secure data handling</li>
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
              What We Can Help Detect
            </h3>
            <p className="text-muted">Early awareness through pattern recognition</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Health Insights Card */}
            <motion.div
              variants={itemVariants}
              className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50 shadow-soft"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Heart className="size-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-emerald-800">Health Patterns</h4>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-emerald-700">
                  • Changes in color, consistency, or frequency
                </div>
                <div className="text-sm text-emerald-700">
                  • Trend analysis vs. your dog's normal
                </div>
                <div className="text-sm text-emerald-700">
                  • Monthly wellness summaries
                </div>
              </div>
            </motion.div>

            {/* Content Analysis Card */}
            <motion.div
              variants={itemVariants}
              className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50 shadow-soft"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Eye className="size-6 text-amber-600" />
                </div>
                <h4 className="font-semibold text-amber-800">Content Analysis</h4>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-amber-700">
                  • Visible worms or parasites
                </div>
                <div className="text-sm text-amber-700">
                  • Foreign objects or unusual items
                </div>
                <div className="text-sm text-amber-700">
                  • Mucus, grease, or abnormal textures
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Blood Signals Card */}
            <motion.div
              variants={itemVariants}
              className="p-6 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200/50 shadow-soft"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <Droplet className="size-6 text-red-600" />
                </div>
                <h4 className="font-semibold text-red-800">Blood Detection</h4>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-red-700">
                  • Bright red blood: Lower GI concerns
                </div>
                <div className="text-sm text-red-700">
                  • Black/tarry stools: Upper GI concerns
                </div>
                <div className="text-sm text-red-700">
                  • Both warrant timely veterinary care
                </div>
              </div>
            </motion.div>

            {/* Privacy & Control Card */}
            <motion.div
              variants={itemVariants}
              className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 shadow-soft"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Shield className="size-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-blue-800">Privacy First</h4>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-blue-700">
                  • Opt-in wellness monitoring
                </div>
                <div className="text-sm text-blue-700">
                  • Non-diagnostic insights only
                </div>
                <div className="text-sm text-blue-700">
                  • You control your data
                </div>
              </div>
            </motion.div>
          </div>

          {/* Collapsible Common Conditions */}
          <motion.div
            variants={itemVariants}
            className="mt-12"
          >
            <details className="group">
              <summary className="flex items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                <span className="text-lg font-medium text-slate-700">
                  Learn about common conditions we can help detect
                </span>
                <svg
                  className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {[
                  {
                    icon: Bug,
                    title: 'Parasites',
                    description: 'Hookworms, whipworms, giardia, coccidia',
                    signs: 'Blood in stool, mucus, pale/foul odor, diarrhea',
                    impact: 'Nutrient loss, anemia, weight loss',
                  },
                  {
                    icon: Stethoscope,
                    title: 'GI Inflammation',
                    description: 'Colitis, inflammatory bowel disease',
                    signs: 'Mucus, blood, frequent small stools, urgency',
                    impact: 'Chronic discomfort, potential progression',
                  },
                  {
                    icon: Activity,
                    title: 'Infectious Disease',
                    description: 'Parvovirus, hemorrhagic gastroenteritis',
                    signs: 'Bloody diarrhea, vomiting, lethargy',
                    impact: 'Rapid progression, can be life-threatening',
                  },
                  {
                    icon: Bone,
                    title: 'Digestive Disorders',
                    description: 'Pancreatic insufficiency, malabsorption',
                    signs: 'Greasy stools, weight loss, pale/tan color',
                    impact: 'Chronic malnutrition, poor condition',
                  },
                ].map((condition, index) => (
                  <motion.div
                    key={condition.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <condition.icon className="size-5 text-slate-600" />
                      <h4 className="font-semibold text-slate-800">{condition.title}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="text-slate-600">{condition.description}</div>
                      <div>
                        <span className="font-medium text-slate-700">May show:</span> {condition.signs}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Impact:</span> {condition.impact}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </details>
          </motion.div>
        </motion.div>

        {/* When to Contact Vet */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-16"
        >
          <motion.div
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center mb-8"
          >
            <h3 className="text-xl font-bold text-ink mb-2">When to Contact Your Vet</h3>
            <p className="text-slate-600 text-sm">Seek professional care for these concerning signs</p>
          </motion.div>

          <div className="max-w-2xl mx-auto">
            <div className="grid md:grid-cols-2 gap-3">
              {[
                'Black/tarry stools',
                'Bright red blood >24 hours',
                'Diarrhea with lethargy or fever',
                'Repeated vomiting',
                'Rapid weight loss',
                'Pale gums',
                'Greasy gray/tan stools',
                'Sudden changes >48 hours',
              ].map((item, index) => (
                <motion.div
                  key={item}
                  variants={itemVariants}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-red-50 text-red-800 rounded-lg border border-red-200/50"
                >
                  <AlertTriangle className="size-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </motion.div>
              ))}
            </div>
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
