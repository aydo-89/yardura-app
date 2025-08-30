"use client";

import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Camera,
  TrendingUp,
  Activity,
  Droplet,
  Zap,
  Heart,
  Shield,
  Eye,
  CheckCircle,
  Clock,
  Target
} from "lucide-react";
import { useInViewCountUp } from "@/hooks/useInViewCountUp";
import { useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import { liftHover, spring } from "@/lib/motion/presets";

export default function Insights() {
  const [activeMetric, setActiveMetric] = useState('color');
  const insightsRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const accuracyRef = useRef<HTMLDivElement>(null);

  const insightsCount = useInViewCountUp(insightsRef, { end: 24, duration: 2000 });
  const alertsCount = useInViewCountUp(alertsRef, { end: 3, duration: 2000 });
  const accuracyCount = useInViewCountUp(accuracyRef, { end: 95, duration: 2000 });

  const metrics = [
    { id: 'color', label: 'Color', icon: Droplet, color: 'emerald', value: 85, status: 'Normal' },
    { id: 'consistency', label: 'Consistency', icon: Activity, color: 'amber', value: 90, status: 'Good' },
    { id: 'content', label: 'Content', icon: Target, color: 'orange', value: 5, status: 'None detected' },
    { id: 'frequency', label: 'Frequency', icon: TrendingUp, color: 'sky', value: 80, status: 'Stable' },
  ];

  const alerts = [
    {
      type: 'info',
      title: 'Softer than usual',
      message: 'Week 2 showed softer consistency. This is usually normal but we\'ll monitor.',
      time: '2 days ago',
      color: 'amber'
    },
    {
      type: 'success',
      title: 'Baseline established',
      message: 'Great! We\'ve analyzed 4 weeks of data and established your dog\'s normal patterns.',
      time: '1 week ago',
      color: 'emerald'
    }
  ];

  return (
    <section id="insights" className="relative bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20 border-t border-accent/10 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-accent-soft/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-accent/5 rounded-full blur-2xl"></div>
      </div>

      <div className="container py-20 md:py-32 relative z-10">
        {/* Hero Header */}
        <Reveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-accent-soft/50 rounded-full border border-accent/20 mb-6">
              <Eye className="size-5 text-accent" />
              <span className="text-sm font-semibold text-accent">Health Insights Dashboard</span>
              <span className="px-2 py-1 text-xs font-bold bg-accent text-white rounded-full">Coming Soon</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-ink mb-6">
              Your Dog's Health, <br />
              <span className="bg-gradient-to-r from-accent to-accent/80 bg-clip-text text-transparent">
                Visualized
              </span>
            </h2>
            <p className="text-lg text-muted max-w-3xl mx-auto leading-relaxed">
              Opt in now for anonymized stool monitoring. Get gentle alerts, trend charts, and peace of mind
              about your dog's digestive health through our AI-powered weekly <strong>3 C's analysis</strong>.
            </p>
          </div>
        </Reveal>

        {/* Key Stats Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Reveal delay={0.1}>
            <motion.div
              className="bg-gradient-to-br from-white to-accent-soft/30 border-accent/20 shadow-lg z-surface overflow-hidden rounded-xl border p-6 text-center"
              whileHover={liftHover.hover}
              whileTap={liftHover.tap}
              transition={spring.snappy}
            >
                              <div ref={insightsRef} className="text-4xl font-extrabold text-accent mb-2">
                  {insightsCount}+
                </div>
                <div className="text-muted font-medium">Insights Tracked</div>
                <div className="text-sm text-muted mt-1">This month</div>
            </motion.div>
          </Reveal>

          <Reveal delay={0.2}>
            <motion.div
              className="bg-gradient-to-br from-white to-accent-soft/30 border-accent/20 shadow-lg z-surface overflow-hidden rounded-xl border p-6 text-center"
              whileHover={liftHover.hover}
              whileTap={liftHover.tap}
              transition={spring.snappy}
            >
              <div ref={alertsRef} className="text-4xl font-extrabold text-accent mb-2">
                {alertsCount}
              </div>
              <div className="text-muted font-medium">Active Alerts</div>
              <div className="text-sm text-muted mt-1">All normal range</div>
            </motion.div>
          </Reveal>

          <Reveal delay={0.3}>
            <motion.div
              className="bg-gradient-to-br from-white to-accent-soft/30 border-accent/20 shadow-lg z-surface overflow-hidden rounded-xl border p-6 text-center"
              whileHover={liftHover.hover}
              whileTap={liftHover.tap}
              transition={spring.snappy}
            >
              <div ref={accuracyRef} className="text-4xl font-extrabold text-accent mb-2">
                {accuracyCount}%
              </div>
              <div className="text-muted font-medium">AI Accuracy</div>
              <div className="text-sm text-muted mt-1">Reducing false alarms</div>
            </motion.div>
          </Reveal>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - How It Works */}
          <div className="lg:col-span-1 space-y-6">
            <Reveal delay={0.4}>
              <Card className="bg-gradient-to-br from-white to-accent-soft/20 border-accent/10 shadow-soft">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 bg-accent-soft rounded-xl flex items-center justify-center">
                      <Brain className="size-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-bold text-ink">How It Works</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-ink">Smart Capture</div>
                        <div className="text-sm text-muted">Controlled photos & weights during weekly pickup</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-ink">AI Analysis</div>
                        <div className="text-sm text-muted">Compares to your dog's baseline patterns</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-ink">Gentle Alerts</div>
                        <div className="text-sm text-muted">Only when patterns change significantly</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            {/* Recent Alerts */}
            <Reveal delay={0.5}>
              <Card className="bg-gradient-to-br from-white to-accent-soft/20 border-accent/10 shadow-soft">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 bg-accent-soft rounded-xl flex items-center justify-center">
                      <AlertTriangle className="size-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-bold text-ink">Recent Alerts</h3>
                  </div>
                  <div className="space-y-3">
                    {alerts.map((alert, index) => (
                      <div key={index} className={`p-3 rounded-lg border-l-4 ${
                        alert.color === 'amber' ? 'border-amber-400 bg-amber-50/50' :
                        'border-emerald-400 bg-emerald-50/50'
                      }`}>
                        <div className="flex items-start gap-2">
                          <div className={`size-2 rounded-full mt-2 ${
                            alert.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></div>
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${
                              alert.color === 'amber' ? 'text-amber-800' : 'text-emerald-800'
                            }`}>
                              {alert.title}
                            </div>
                            <div className="text-xs text-muted mt-1">{alert.message}</div>
                            <div className="text-xs text-muted/70 mt-1">{alert.time}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          </div>

          {/* Right Column - Interactive Dashboard */}
          <div className="lg:col-span-2">
            <Reveal delay={0.3}>
              <motion.div
                className="bg-gradient-to-br from-white to-accent-soft/10 border-accent/20 shadow-xl z-surface overflow-hidden rounded-xl border p-8"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-ink mb-1">Health Dashboard</h3>
                      <p className="text-muted text-sm">Last 4 weeks • Bella (Golden Retriever)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-3 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-emerald-700 font-medium">All Normal</span>
                    </div>
                  </div>

                  {/* Interactive Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {metrics.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div
                          key={metric.id}
                          onClick={() => setActiveMetric(metric.id)}
                          className={`p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                            activeMetric === metric.id
                              ? `bg-${metric.color}-50 border-${metric.color}-200 shadow-lg scale-105`
                              : 'bg-gray-50/50 border-gray-200 hover:bg-gray-100/70'
                          } border`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`size-8 bg-${metric.color}-100 rounded-lg flex items-center justify-center`}>
                              <Icon className={`size-4 text-${metric.color}-600`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-ink">{metric.label}</div>
                              <div className={`text-xs text-${metric.color}-600`}>{metric.status}</div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`bg-gradient-to-r from-${metric.color}-400 to-${metric.color}-600 h-2 rounded-full transition-all duration-1000 ease-out`}
                              style={{width: `${metric.value}%`}}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend Visualization */}
                  <div className="bg-gradient-to-r from-gray-50 to-accent-soft/30 rounded-xl p-6 border border-accent/10">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="size-5 text-accent" />
                      <span className="font-medium text-ink">4-Week Trend Overview</span>
                    </div>

                    {/* Simple trend line */}
                    <div className="relative h-20 mb-4">
                      <svg viewBox="0 0 280 60" className="w-full h-full">
                        <defs>
                          <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        <g stroke="hsl(var(--muted))" strokeWidth="0.5" opacity="0.3">
                          <line x1="0" y1="15" x2="280" y2="15" />
                          <line x1="0" y1="30" x2="280" y2="30" />
                          <line x1="0" y1="45" x2="280" y2="45" />
                        </g>

                        {/* Trend line */}
                        <path
                          d="M40 35 L100 32 L180 38 L240 28"
                          fill="none"
                          stroke="hsl(var(--accent))"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Area fill */}
                        <path
                          d="M40 35 L100 32 L180 38 L240 28 L240 60 L40 60 Z"
                          fill="url(#trendGradient)"
                        />

                        {/* Data points */}
                        <circle cx="100" cy="32" r="4" fill="hsl(var(--accent))" className="drop-shadow-sm">
                          <title>Week 1: Slightly softer</title>
                        </circle>
                        <circle cx="180" cy="38" r="4" fill="hsl(var(--accent))" className="drop-shadow-sm">
                          <title>Week 2: Normal consistency</title>
                        </circle>
                        <circle cx="240" cy="28" r="4" fill="hsl(var(--accent))" className="drop-shadow-sm">
                          <title>Week 3: Firmer than usual</title>
                        </circle>
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Week 1</span>
                      <span>Week 2</span>
                      <span>Week 3</span>
                      <span>Week 4</span>
                    </div>
                  </div>

                  {/* Insights Legend */}
                  <div className="mt-6 p-4 bg-accent-soft/20 rounded-lg border border-accent/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="size-4 text-accent" />
                      <span className="text-sm font-medium text-ink">What We Monitor</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted">
                      <span>• Color changes</span>
                      <span>• Texture variations</span>
                      <span>• Content anomalies</span>
                      <span>• Frequency patterns</span>
                      <span>• Hydration indicators</span>
                      <span>• GI health flags</span>
                    </div>
                    <div className="mt-3 text-xs text-muted/70">
                      📊 Insights based on weekly pickups. These are informational only and not veterinary advice.
                      Always consult your vet for health concerns.
                    </div>
                  </div>
              </motion.div>
            </Reveal>
          </div>
        </div>

        {/* Alert Types Grid */}
        <Reveal delay={0.6}>
          <div className="mt-16">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-ink mb-2">Smart Alert System</h3>
              <p className="text-muted">We only notify you when patterns change significantly</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Droplet,
                  title: 'Color Changes',
                  description: 'Detects blood, unusual colors, or bile indicators that may signal health issues.',
                  color: 'emerald',
                  examples: ['Black/tarry (upper GI)', 'Bright red (lower GI)', 'Yellow/gray (bile)']
                },
                {
                  icon: Activity,
                  title: 'Consistency Shifts',
                  description: 'Monitors texture changes from firm to soft, liquid, greasy, or mucousy stools.',
                  color: 'amber',
                  examples: ['Soft/liquid changes', 'Greasy texture', 'Mucous coating']
                },
                {
                  icon: Target,
                  title: 'Content Anomalies',
                  description: 'Identifies parasites, undigested food, foreign objects, or other concerning content.',
                  color: 'orange',
                  examples: ['Parasites visible', 'Undigested objects', 'Blood streaks']
                }
              ].map((alertType, index) => {
                const Icon = alertType.icon;
                return (
                  <motion.div
                    key={index}
                    className={`bg-gradient-to-br from-white to-${alertType.color}-50/30 border-${alertType.color}-200/50 shadow-soft z-surface overflow-hidden rounded-xl border p-6`}
                    whileHover={liftHover.hover}
                    whileTap={liftHover.tap}
                    transition={spring.snappy}
                  >
                      <div className={`size-12 bg-${alertType.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                        <Icon className={`size-6 text-${alertType.color}-600`} />
                      </div>
                      <h4 className="text-lg font-bold text-ink mb-2">{alertType.title}</h4>
                      <p className="text-muted text-sm mb-4">{alertType.description}</p>
                      <div className="space-y-1">
                        {alertType.examples.map((example, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted">
                            <div className={`size-1.5 bg-${alertType.color}-500 rounded-full`}></div>
                            {example}
                          </div>
                        ))}
                      </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* CTA Section */}
        <Reveal delay={0.7}>
          <div className="mt-16 text-center">
            <motion.div
              className="bg-gradient-to-r from-accent-soft/30 via-white to-accent-soft/30 border-accent/20 shadow-xl max-w-2xl mx-auto z-surface overflow-hidden rounded-xl border p-8"
              whileHover={liftHover.hover}
              whileTap={liftHover.tap}
              transition={spring.snappy}
            >
                <Heart className="size-12 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-bold text-ink mb-2">Ready for Peace of Mind?</h3>
                <p className="text-muted mb-6">Join our opt-in program and get gentle, science-backed insights about your dog's health.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="/quote" data-analytics="cta_quote"
                    className="px-6 py-3 bg-accent text-white rounded-xl font-semibold shadow-soft hover:bg-accent/90 transition-all duration-200 hover:scale-105"
                  >
                    Get My Quote
                  </a>
                  <a
                    href="#why-matters"
                    className="px-6 py-3 border border-accent text-accent rounded-xl font-semibold hover:bg-accent-soft transition-all duration-200"
                  >
                    Learn More
                  </a>
                </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

