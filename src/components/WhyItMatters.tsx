'use client';

import { motion } from 'framer-motion';

const MotionDiv = motion.div;
const MotionButton = motion.button;
import {
  Activity,
  Droplet,
  Bone,
  Bug,
  Stethoscope,
  Eye,
  Heart,
  Shield,
  TrendingUp,
  Target,
  AlertTriangle,
  // CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useInViewCountUp } from '../hooks/useInViewCountUp';
import Reveal from '@/components/Reveal';

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
  const { ref: insightRef, count: insightCount } = useInViewCountUp({ end: 24, duration: 2000 });

  const handleGetQuote = () => {
    if (onGetQuoteClick) {
      onGetQuoteClick();
    } else {
      window.location.href = '/quote?businessId=yardura';
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
      className="section-modern relative overflow-hidden gradient-section-warm"
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

      <div className="container relative z-10">
        {/* Modern Section Header */}
        <MotionDiv
          variants={itemVariants}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <div className="relative">
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
              Beyond Clean{' '}
              <span className="relative">
                Yards
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-teal-700 via-teal-600 to-white rounded-full"></div>
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Smart technology that helps you stay ahead of potential health issues
            </p>
          </div>
        </MotionDiv>

        {/* Hero Visual */}
        <Reveal delay={0.2}>
          <div className="relative rounded-3xl overflow-hidden mb-16 shadow-2xl max-w-4xl mx-auto">
            <img
              src="/sections/peace-of-mind.webp"
              alt="Peace of mind with health monitoring"
              className="w-full h-64 md:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-start pl-8 md:pl-16">
              <div className="text-white max-w-lg">
                <h3 className="text-2xl md:text-3xl font-bold mb-3">Peace of Mind Technology</h3>
                <p className="text-lg opacity-90">Stay informed, stay ahead of potential health issues</p>
              </div>
            </div>
          </div>
        </Reveal>

        <MotionDiv
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Left Column - Content */}
          <div className="space-y-8">
            <MotionDiv variants={itemVariants} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100/50 rounded-2xl border border-green-700/20 mb-6 shadow-sm">
                <div className="w-2 h-2 bg-green-700 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-600">Health insights coming soon</span>
              </div>

              <h2
                id="why-matters-heading"
                className="text-responsive-3xl font-bold text-slate-900 leading-tight text-balance"
              >
                A clean yard is just the{' '}
                <span className="bg-gradient-to-r from-green-800 to-green-600 bg-clip-text text-transparent">beginning</span>
              </h2>

              <p className="mt-10 text-responsive-lg text-slate-600 leading-relaxed text-balance">
                Your dog's health tells a story through their waste. Small changes in color, consistency, or frequency can be early indicators that help you stay ahead of potential issues. Our smart monitoring gives you insights that busy pet parents might otherwise miss.
              </p>

              {/* Enhanced Value Proposition - Made it stand out */}
              <MotionDiv
                variants={itemVariants}
                className="mt-10 p-8 bg-gradient-to-br from-green-700/10 via-green-600/15 to-green-700/10 rounded-3xl border border-green-700/20 shadow-card backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-green-700 rounded-2xl flex-shrink-0 shadow-sm">
                      <Heart className="size-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-black text-green-600">Yeller's Smart Approach</h3>
                  </div>
                  <p className="text-slate-700 font-medium text-lg leading-relaxed">
                    We combine reliable yard cleaning with optional health insights, giving you peace of mind and valuable information to share with your vet during regular checkups.
                  </p>
                </div>
              </MotionDiv>
            </MotionDiv>
          </div>

          {/* Right Column - Insight Preview Card */}
          <MotionDiv
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            <MotionDiv
              ref={insightRef}
              variants={cardHoverVariants}
              whileHover="hover"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="card-modern p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-green-600" />
                  <span className="text-sm font-medium text-ink">Last 30 Days</span>
                </div>
                <div className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full">
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
                          <title>Weekly deposits data point</title>
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
                    <div className="text-lg font-bold text-green-600">70%</div>
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
            </MotionDiv>

            {/* Callout Box - Moved from left column */}
            <MotionDiv
              variants={itemVariants}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="p-6 rounded-2xl bg-gradient-to-r from-green-700/8 to-green-600/12 border border-green-700/20 shadow-sm mt-6"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-700/20 rounded-lg flex-shrink-0 mt-1">
                  <Eye className="size-4 text-green-700" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-green-800 font-medium">The Hidden Health Signals</p>
                  <p className="text-sm text-green-700 leading-relaxed">
                    Most pet owners don't inspect every stool—it's understandable! But small changes
                    can signal bigger issues. We capture the details you might miss, so you get
                    peace of mind without the hassle.
                  </p>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        </MotionDiv>

        {/* Three Pillars - Enhanced */}
        <MotionDiv
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-20"
        >
          <MotionDiv
            variants={itemVariants}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center mb-12"
          >
          </MotionDiv>

          <div className="grid md:grid-cols-3 gap-8">
            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="card-modern p-8 bg-gradient-to-br from-emerald-50/90 via-green-50/50 to-emerald-100/70 border-emerald-200/30"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-2xl shadow-sm">
                  <Heart className="size-7 text-emerald-700" />
                </div>
                <h3 className="text-xl font-bold text-green-800">Early Detection</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Spot parasites and digestive issues before symptoms show</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Track changes in stool color, consistency, and patterns</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Get alerts about concerning trends in your dog's health</span>
                </div>
              </div>

              <div className="mt-6 p-3 bg-green-700/10 rounded-xl border border-green-700/20">
                <p className="text-sm text-green-800 font-semibold">Prevention is better than cure</p>
              </div>
            </MotionDiv>

            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="card-modern p-8 bg-gradient-to-br from-teal-50/90 via-green-100/40 to-teal-100/70 border-teal-200/30"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-teal-500/30 to-teal-600/20 rounded-2xl shadow-sm">
                  <Droplet className="size-7 text-teal-700" />
                </div>
                <h3 className="text-xl font-bold text-green-800">Health Indicators</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Bright red blood: Usually from lower digestive tract</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Dark/black blood: May indicate upper digestive issues</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Early warning signs help prevent serious complications</span>
                </div>
              </div>

              <div className="mt-6 p-3 bg-green-700/10 rounded-xl border border-green-700/20">
                <p className="text-sm text-green-800 font-semibold">Knowledge is power</p>
              </div>
            </MotionDiv>

            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="card-modern p-8 bg-gradient-to-br from-cyan-50/90 via-green-50/60 to-cyan-100/70 border-cyan-200/30"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 rounded-2xl shadow-sm">
                  <Shield className="size-7 text-cyan-700" />
                </div>
                <h3 className="text-xl font-bold text-green-800">Peace of Mind</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Professional monitoring without you having to look</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Smart alerts that learn your dog's normal patterns</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-700 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-green-700 font-medium">Your privacy protected with opt-in, secure data handling</span>
                </div>
              </div>

              <div className="mt-6 p-3 bg-green-700/10 rounded-xl border border-green-700/20">
                <p className="text-sm text-green-800 font-semibold">Rest easy knowing we're watching</p>
              </div>
            </MotionDiv>
          </div>

          {/* Right Column - Empty for balance */}
          <div></div>
        </MotionDiv>

        {/* CTA - Matching Other Sections */}
        <MotionDiv
          variants={itemVariants}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-br from-white via-green-50/20 to-green-100/30 rounded-3xl p-8 max-w-2xl mx-auto shadow-floating border border-green-700/10">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              Ready to Get Started?
            </h3>
            <p className="text-slate-600 mb-8 text-lg leading-relaxed">
              Join Twin Cities families who trust us with their yard care and peace of mind
            </p>
            
            <button
              onClick={handleGetQuote}
              className="btn-cta-primary"
            >
              Get My Quote
            </button>
            
            {/* Clean Disclaimer */}
            <p className="text-slate-500 mt-6 text-sm">
              Health insights are informational only. Always consult your vet for medical concerns.
            </p>
          </div>
        </MotionDiv>

        {/* Professional Legal Disclaimer - Bottom of Section */}
        <MotionDiv
          variants={itemVariants}
          className="mt-16 border-t border-slate-200 pt-8"
        >
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Medical Disclaimer</h4>
              <div className="text-xs text-slate-600 leading-relaxed space-y-2 max-w-3xl mx-auto">
                <p>
                  <strong>Health insights provided by Yeller are for informational purposes only</strong> and do not constitute veterinary advice, diagnosis, or treatment recommendations. 
                  Our monitoring technology helps identify patterns that may warrant professional veterinary attention.
                </p>
                <p>
                  Yeller does not diagnose, treat, cure, or prevent any medical conditions. All health-related decisions should be made in consultation with a qualified veterinarian. 
                  If you have concerns about your pet's health, please contact your veterinarian immediately.
                </p>
              </div>
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
