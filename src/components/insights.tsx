'use client';

import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  TrendingUp,
  Activity,
  Droplet,
  Heart,
  Shield,
  Eye,
  CheckCircle,
  Target,
  Bug,
} from 'lucide-react';
import { useInViewCountUp } from '@/hooks/useInViewCountUp';
import { useRef, useState } from 'react';
import Reveal from '@/components/Reveal';
import { liftHover, spring } from '@/lib/motion/presets';
import { track } from '@/lib/analytics';

export default function Insights() {
  const [activeMetric, setActiveMetric] = useState('color');
  const insightsRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const accuracyRef = useRef<HTMLDivElement>(null);

  const insightsCount = useInViewCountUp(insightsRef, { end: 24, duration: 2000 });
  const alertsCount = useInViewCountUp(alertsRef, { end: 3, duration: 2000 });
  const accuracyCount = useInViewCountUp(accuracyRef, { end: 95, duration: 2000 });

  const metrics = [
    {
      id: 'color',
      label: 'Color Analysis',
      icon: Droplet,
      color: 'emerald',
      status: '96% Normal',
      details: { normal: 96, yellow: 3, red: 1 }
    },
    {
      id: 'consistency',
      label: 'Consistency',
      icon: Activity,
      color: 'amber',
      status: 'Mostly Normal',
      details: { normal: 70, soft: 20, dry: 10 }
    },
    {
      id: 'content',
      label: 'Content Signals',
      icon: Target,
      color: 'orange',
      status: 'No Issues',
      details: { mucous: 0, greasy: 0, dry: 0 }
    },
    {
      id: 'frequency',
      label: 'Deposit Frequency',
      icon: TrendingUp,
      color: 'sky',
      status: '12-16 per week',
      details: { avg: 14, min: 12, max: 16 }
    },
  ];

  const alerts = [
    {
      type: 'info',
      title: 'Softer than usual',
      message: "Week 2 showed softer consistency. This is usually normal but we'll monitor.",
      time: '2 days ago',
      color: 'amber',
    },
    {
      type: 'success',
      title: 'Baseline established',
      message: "Great! We've analyzed 4 weeks of data and established your dog's normal patterns.",
      time: '1 week ago',
      color: 'emerald',
    },
  ];

  return (
    <section
      id="insights"
      className="relative bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20 border-t border-accent/10 overflow-hidden"
    >
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
              <span className="text-sm font-semibold text-accent">GI Health Insights Dashboard</span>
              <span className="px-2 py-1 text-xs font-bold bg-accent text-white rounded-full">
                Coming Soon
              </span>
                </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-ink mb-6">
              Your Dog's GI Health, <br />
              <span className="bg-gradient-to-r from-accent to-accent/80 bg-clip-text text-transparent">
                Visualized
              </span>
            </h2>
            <p className="text-lg text-muted max-w-3xl mx-auto leading-relaxed">
              Opt in now for anonymized stool monitoring. Get gentle alerts, trend charts, and peace
              of mind about your dog's digestive health through our AI-powered weekly{' '}
              <strong>3 C's analysis</strong>.
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
                        <div className="text-sm text-muted">
                          Controlled photos & weights during weekly pickup
                        </div>
                      </div>
                  </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-ink">AI Analysis</div>
                        <div className="text-sm text-muted">
                          Compares to your dog's baseline patterns
                  </div>
                </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="size-5 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-ink">Gentle Alerts</div>
                        <div className="text-sm text-muted">
                          Only when patterns change significantly
                    </div>
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
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-l-4 ${
                          alert.color === 'amber'
                            ? 'border-amber-400 bg-amber-50/50'
                            : 'border-emerald-400 bg-emerald-50/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`size-2 rounded-full mt-2 ${
                              alert.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          ></div>
                          <div className="flex-1">
                            <div
                              className={`text-sm font-medium ${
                                alert.color === 'amber' ? 'text-amber-800' : 'text-emerald-800'
                              }`}
                            >
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
                    <h3 className="text-xl font-bold text-ink mb-1">GI Health Dashboard</h3>
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
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`size-8 bg-${metric.color}-100 rounded-lg flex items-center justify-center`}
                          >
                            <Icon className={`size-4 text-${metric.color}-600`} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-ink">{metric.label}</div>
                            <div className={`text-xs text-${metric.color}-600 font-medium`}>
                              {metric.status}
                            </div>
                          </div>
                        </div>

                        {/* Metric-specific visualizations */}
                        {metric.id === 'color' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Normal</span>
                              <span className="text-sm font-bold text-green-600">{metric.details.normal}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Alerts</span>
                              <span className="text-sm font-bold text-amber-600">{(metric.details.yellow || 0) + (metric.details.red || 0)}%</span>
                            </div>
                          </div>
                        )}

                        {metric.id === 'consistency' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Normal</span>
                              <span className="text-sm font-bold text-green-600">{metric.details.normal}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Soft</span>
                              <span className="text-sm font-bold text-amber-600">{metric.details.soft}%</span>
                            </div>
                          </div>
                        )}

                        {metric.id === 'content' && (
                          <div className="space-y-2">
                            <div className="flex justify-center gap-2">
                              <div className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                                Mucous: 0
                              </div>
                              <div className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                                Greasy: 0
                              </div>
                              <div className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                                Dry: 0
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-slate-600">All clear this week</div>
                            </div>
                          </div>
                        )}

                        {metric.id === 'frequency' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Average</span>
                              <span className="text-sm font-bold text-sky-600">{metric.details.avg}/week</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Range</span>
                              <span className="text-sm font-bold text-sky-600">{metric.details.min}-{metric.details.max}</span>
                            </div>
                            {/* Mini deposit pattern */}
                            <div className="flex items-end justify-center gap-1 h-6 mt-2">
                              {[13, 15, 12, 16, 14, 13].map((count, i) => (
                                <div
                                  key={i}
                                  className="w-2 bg-sky-400 rounded-sm"
                                  style={{ height: `${(count / 16) * 100}%` }}
                                  title={`${count} deposits`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Weekly Timeline Chart (like wellness tab) */}
                <div className="bg-gradient-to-r from-gray-50 to-accent-soft/30 rounded-xl p-6 border border-accent/10">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="size-5 text-accent" />
                    <span className="font-medium text-ink">Weekly Timeline</span>
                  </div>
                  <div className="h-32">
                    <svg viewBox="0 0 400 120" className="w-full h-full">
                      {/* Weekly data points - realistic deposit counts */}
                      {[
                        { week: 'Aug 4', deposits: 14, status: 'normal' },
                        { week: 'Aug 11', deposits: 13, status: 'monitor' },
                        { week: 'Aug 18', deposits: 15, status: 'normal' },
                        { week: 'Aug 25', deposits: 12, status: 'attention' },
                        { week: 'Sep 1', deposits: 16, status: 'normal' },
                        { week: 'Sep 8', deposits: 14, status: 'normal' },
                      ].map((point, index) => {
                        const x = 50 + (index * 55);
                        const maxDeposits = 16;
                        const y = 90 - ((point.deposits / maxDeposits) * 60);

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
                            x2={50 + ((index + 1) * 55)}
                            y2={90 - (([
                              { deposits: 14 }, { deposits: 13 }, { deposits: 15 },
                              { deposits: 12 }, { deposits: 16 }, { deposits: 14 }
                            ][index + 1].deposits / maxDeposits) * 60)}
                                stroke="#10b981"
                                strokeWidth="2"
                                opacity="0.7"
                              />
                            )}

                            {/* Data point */}
                            <circle
                              cx={x}
                              cy={y}
                              r="5"
                              fill={color}
                              className="drop-shadow-sm"
                            >
                              <title>{point.week}: {point.deposits} deposits</title>
                            </circle>

                            {/* Week label */}
                            <text
                              x={x}
                              y="110"
                              textAnchor="middle"
                              className="fill-slate-500"
                              fontSize="10"
                            >
                              {point.week}
                            </text>
                          </g>
                        );
                      })}

                      {/* Y-axis labels */}
                      <text x="15" y="30" textAnchor="middle" className="fill-slate-400" fontSize="9">16</text>
                      <text x="15" y="50" textAnchor="middle" className="fill-slate-400" fontSize="9">8</text>
                      <text x="15" y="70" textAnchor="middle" className="fill-slate-400" fontSize="9">0</text>
                    </svg>
                  </div>
                </div>

                {/* Dashboard-matched mini visuals: Color tile + Consistency strip */}
                <div className="mt-6 grid sm:grid-cols-2 gap-6">
                  {/* Color Analysis (matches wellness tab exactly) */}
                  <div className="p-4 rounded-xl border bg-white/70">
                    <div className="text-sm font-medium text-ink mb-3">Color Analysis</div>

                    {/* Overview Cards */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-green-50 rounded border">
                        <div className="text-lg font-bold text-green-700">96%</div>
                        <div className="text-xs text-green-600">Normal</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded border">
                        <div className="text-lg font-bold text-yellow-700">3%</div>
                        <div className="text-xs text-yellow-600">Yellow</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded border">
                        <div className="text-lg font-bold text-red-700">1%</div>
                        <div className="text-xs text-red-600">Red</div>
                      </div>
                    </div>

                    {/* Donut Chart - Rebuilt from scratch */}
                    <div className="flex justify-center mb-3">
                      <svg viewBox="0 0 120 120" className="w-28 h-28">
                        {(() => {
                          const radius = 45;
                          const circumference = 2 * Math.PI * radius;
                          const center = 60;

                          // Percentages: Normal 96%, Yellow 3%, Red 1%
                          const normalPercent = 96;
                          const yellowPercent = 3;
                          const redPercent = 1;

                          // Calculate dash lengths
                          const normalLength = (normalPercent / 100) * circumference;
                          const yellowLength = (yellowPercent / 100) * circumference;
                          const redLength = (redPercent / 100) * circumference;

                          return (
                            <>
                              {/* Background circle for reference */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth="12"
                              />

                              {/* Normal segment (96%) - Green */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="12"
                                strokeDasharray={`${normalLength} ${circumference - normalLength}`}
                                strokeLinecap="round"
                              />

                              {/* Yellow segment (3%) */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="12"
                                strokeDasharray={`${yellowLength} ${circumference - yellowLength}`}
                                strokeLinecap="round"
                                transform={`rotate(${(normalPercent / 100) * 360} ${center} ${center})`}
                              />

                              {/* Red segment (1%) */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="12"
                                strokeDasharray={`${redLength} ${circumference - redLength}`}
                                strokeLinecap="round"
                                transform={`rotate(${((normalPercent + yellowPercent) / 100) * 360} ${center} ${center})`}
                              />

                              {/* Center circle */}
                              <circle cx={center} cy={center} r="28" fill="white" stroke="#e5e7eb" strokeWidth="1" />
                              <text x={center} y="52" textAnchor="middle" className="text-xl font-bold fill-slate-800">96%</text>
                              <text x={center} y="68" textAnchor="middle" className="text-sm font-medium fill-slate-600">Normal</text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Normal</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>Yellow/Gray</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Red</span>
                      </div>
                    </div>
                  </div>

                  {/* Consistency Analysis (like wellness tab) */}
                  <div className="p-4 rounded-xl border bg-white/70">
                    <div className="text-sm font-medium text-ink mb-3">Consistency Analysis</div>

                    {/* Bristol Scale Visual */}
                    <div className="space-y-2 mb-4">
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
                      <div className="text-center p-2 bg-green-50 rounded border">
                        <div className="text-lg font-bold text-green-700">70%</div>
                        <div className="text-xs text-green-600">Normal</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded border">
                        <div className="text-lg font-bold text-yellow-700">20%</div>
                        <div className="text-xs text-yellow-600">Soft</div>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded border">
                        <div className="text-lg font-bold text-orange-700">10%</div>
                        <div className="text-xs text-orange-600">Dry</div>
                      </div>
                    </div>
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
                    📊 Insights based on weekly pickups. These are informational only and not
                    veterinary advice. Always consult your vet for health concerns.
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
                  description:
                    'Detects blood, unusual colors, or bile indicators that may signal health issues.',
                  color: 'emerald',
                  examples: [
                    'Black/tarry (upper GI)',
                    'Bright red (lower GI)',
                    'Yellow/gray (bile)',
                  ],
                },
                {
                  icon: Activity,
                  title: 'Consistency Shifts',
                  description:
                    'Monitors texture changes from firm to soft, liquid, greasy, or mucousy stools.',
                  color: 'amber',
                  examples: ['Soft/liquid changes', 'Greasy texture', 'Mucous coating'],
                },
                {
                  icon: Target,
                  title: 'Content Anomalies',
                  description:
                    'Identifies parasites, undigested food, foreign objects, or other concerning content.',
                  color: 'orange',
                  examples: ['Parasites visible', 'Undigested objects', 'Blood streaks'],
                },
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
                    <div
                      className={`size-12 bg-${alertType.color}-100 rounded-xl flex items-center justify-center mb-4`}
                    >
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
              <p className="text-muted mb-6">
                Join our opt-in program and get gentle, science-backed insights about your dog's
                health.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/quote"
                  data-analytics="cta_quote"
                  className="px-6 py-3 bg-accent text-white rounded-xl font-semibold shadow-soft hover:bg-accent/90 transition-all duration-200 hover:scale-105"
                  onClick={() => track('cta_insights_get_quote')}
                >
                  Get My Quote
                </a>
                <a
                  href="#why-matters"
                  className="px-6 py-3 border border-accent text-accent rounded-xl font-semibold hover:bg-accent-soft transition-all duration-200"
                  onClick={() => track('cta_insights_learn_more')}
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
