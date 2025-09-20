'use client';

import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  TrendingUp,
  Activity,
  Droplet,
  Heart,
  Shield,
  Eye,
  CheckCircle,
  Target,
} from 'lucide-react';
import { useInViewCountUp } from '@/hooks/useInViewCountUp';
import { useRef, useState, useEffect } from 'react';
import Reveal from '@/components/Reveal';
import { liftHover, spring } from '@/lib/motion/presets';
import { track } from '@/lib/analytics';
import { WellnessHeader } from './dashboard/tabs/WellnessTab/components/WellnessHeader';
import { useWellnessData } from './dashboard/tabs/WellnessTab/hooks/useWellnessData';
import type { DataReading, ServiceVisit } from '@/shared/wellness';

interface InsightsProps {
  dataReadings?: DataReading[];
  serviceVisits?: ServiceVisit[];
}

export default function Insights({ dataReadings = [], serviceVisits = [] }: InsightsProps = {}) {
  const [activeMetric, setActiveMetric] = useState('color');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get wellness data if available, otherwise use sample data for demo
  const sampleDataReadings: DataReading[] = [
    // Sample data for demonstration - use static timestamps to avoid hydration mismatch
    {
      id: 'sample-1',
      timestamp: new Date('2024-08-15T10:00:00Z').toISOString(),
      colors: { normal: 15, yellow: 2, red: 0, black: 1, total: 18 },
      consistency: { normal: 12, soft: 4, dry: 2, total: 18 },
      issues: [],
      color: 'brown',
      weight: 45,
    },
    {
      id: 'sample-2',
      timestamp: new Date('2024-08-22T10:00:00Z').toISOString(),
      colors: { normal: 16, yellow: 1, red: 1, black: 0, total: 18 },
      consistency: { normal: 14, soft: 3, dry: 1, total: 18 },
      issues: ['Yellow stool detected'],
      color: 'brown',
      weight: 42,
    },
    {
      id: 'sample-3',
      timestamp: new Date('2024-08-29T10:00:00Z').toISOString(),
      colors: { normal: 13, yellow: 3, red: 1, black: 1, total: 18 },
      consistency: { normal: 13, soft: 4, dry: 1, total: 18 },
      issues: [],
      color: 'brown',
      weight: 48,
    },
  ];

  const wellnessData = useWellnessData(
    dataReadings.length > 0
      ? dataReadings
      : sampleDataReadings,
    serviceVisits.length > 0 ? serviceVisits : []
  );

  const { ref: insightsRef, count: insightsCount } = useInViewCountUp({ end: 24, duration: 2000 });
  const { ref: alertsRef, count: alertsCount } = useInViewCountUp({ end: 3, duration: 2000 });
  const { ref: accuracyRef, count: accuracyCount } = useInViewCountUp({ end: 95, duration: 2000 });

  const handleExport = () => {
    // Navigate to reports page
    window.location.href = '/reports';
  };

  const metrics = [
    {
      id: 'color',
      label: 'Color Analysis',
      icon: Droplet,
      color: 'green',
      status: '96% Normal',
      details: { normal: 96, yellow: 3, red: 1 },
    },
    {
      id: 'consistency',
      label: 'Consistency',
      icon: Activity,
      color: 'emerald',
      status: 'Mostly Normal',
      details: { normal: 70, soft: 20, hard: 10 },
    },
    {
      id: 'content',
      label: 'Content Signals',
      icon: Target,
      color: 'teal',
      status: 'No Issues',
      details: { mucous: 0, greasy: 0, parasites: 0 },
    },
    {
      id: 'frequency',
      label: 'Deposit Frequency',
      icon: TrendingUp,
      color: 'green',
      status: '12-16 per week',
      details: { avg: 14, min: 12, max: 16 },
    },
  ];

  const alerts = [
    {
      type: 'warning',
      title: 'Red color detected',
      message:
        'Possible fresh blood detected in stool. This requires immediate veterinary attention.',
      time: '1 day ago',
      color: 'red',
    },
    {
      type: 'info',
      title: 'Softer than usual',
      message: "Week 2 showed softer consistency. This is usually normal but we'll monitor.",
      time: '2 days ago',
      color: 'amber',
    },
    {
      type: 'warning',
      title: 'Color change detected',
      message: 'Stool appeared slightly yellow this week. Could be dietary or require monitoring.',
      time: '3 days ago',
      color: 'amber',
    },
    {
      type: 'success',
      title: 'Frequency normal',
      message: "Deposit frequency is within normal range for your dog's size and age.",
      time: '5 days ago',
      color: 'emerald',
    },
    {
      type: 'info',
      title: 'Mild dehydration signs',
      message:
        'Stool consistency suggests mild dehydration. Ensure fresh water is always available.',
      time: '1 week ago',
      color: 'blue',
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
      className="section-modern relative overflow-hidden gradient-section-accent"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-64 h-64 bg-green-700/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-green-100/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-700/5 rounded-full blur-2xl"></div>
      </div>

      <div className="container relative z-10">
        {/* Modern Section Header */}
        <Reveal>
          <div className="text-center mb-16">
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                Smart Health{' '}
                <span className="relative">
                  Monitoring
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-emerald-700 via-emerald-600 to-white rounded-full"></div>
                </span>
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Advanced wellness insights to help you stay ahead of potential health issues
              </p>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - How It Works & Recent Alerts */}
          <div className="lg:col-span-1 space-y-6">
            <Reveal delay={0.4}>
              <motion.div
                className="card-modern p-8 bg-white"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl shadow-sm">
                    <Brain className="size-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">How It Works</h3>
                </div>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100/50 rounded-xl mt-0.5">
                      <CheckCircle className="size-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-base">Smart Capture</div>
                      <div className="text-sm text-slate-600 leading-relaxed">
                        Controlled photos & weights during weekly pickup
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100/50 rounded-xl mt-0.5">
                      <CheckCircle className="size-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-base">AI Analysis</div>
                      <div className="text-sm text-slate-600 leading-relaxed">
                        Compares to your dog's baseline patterns
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100/50 rounded-xl mt-0.5">
                      <CheckCircle className="size-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-base">Gentle Alerts</div>
                      <div className="text-sm text-slate-600 leading-relaxed">
                        Only when patterns change significantly
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Reveal>

            {/* Recent Alerts */}
            <Reveal delay={0.5}>
              <motion.div
                className="card-modern p-8 bg-white"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-green-100/50 to-green-200/30 rounded-2xl shadow-sm">
                    <AlertTriangle className="size-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Recent Alerts</h3>
                </div>
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <motion.div
                      key={index}
                      className={`p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:shadow-sm ${
                        alert.color === 'amber'
                          ? 'border-amber-400 bg-amber-50/70'
                          : alert.color === 'blue'
                            ? 'border-blue-400 bg-blue-50/70'
                            : alert.color === 'red'
                              ? 'border-red-400 bg-red-50/70'
                              : 'border-emerald-400 bg-emerald-50/70'
                      }`}
                      whileHover={{ scale: 1.02, x: 2 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`size-3 rounded-full mt-1.5 flex-shrink-0 ${
                            alert.color === 'amber'
                              ? 'bg-amber-500'
                              : alert.color === 'blue'
                                ? 'bg-blue-500'
                                : alert.color === 'red'
                                  ? 'bg-red-500'
                                  : 'bg-emerald-500'
                          }`}
                        ></div>
                        <div className="flex-1">
                          <div
                            className={`text-sm font-semibold ${
                              alert.color === 'amber'
                                ? 'text-amber-800'
                                : alert.color === 'blue'
                                  ? 'text-blue-800'
                                  : alert.color === 'red'
                                  ? 'text-red-800'
                                  : 'text-emerald-800'
                            }`}
                          >
                            {alert.title}
                          </div>
                          <div className="text-sm text-slate-600 mt-1 leading-relaxed">{alert.message}</div>
                          <div className="text-xs text-slate-500 mt-2 font-medium">{alert.time}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </Reveal>
          </div>

          {/* Right Column - Interactive Dashboard */}
          <div className="lg:col-span-2">
            {/* Wellness Header - Show alerts and export functionality */}
            <Reveal delay={0.3}>
              <div className="mb-8">
                <WellnessHeader wellnessData={wellnessData} onExport={handleExport} />
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <motion.div
                className="card-modern p-10 bg-white shadow-floating border border-green-700/20"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">GI Health Dashboard</h3>
                    <p className="text-slate-600 text-sm">Last 4 weeks • Bella (Golden Retriever)</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-green-700/10 rounded-2xl border border-green-700/20">
                    <div className="size-3 bg-green-700 rounded-full animate-pulse shadow-sm"></div>
                    <span className="text-sm text-green-800 font-semibold">All Normal</span>
                  </div>
                </div>

                {/* Interactive Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <motion.div
                        key={metric.id}
                        onClick={() => setActiveMetric(metric.id)}
                        className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                          activeMetric === metric.id
                            ? metric.color === 'emerald'
                              ? `bg-gradient-to-br from-emerald-50/90 via-green-50/50 to-emerald-100/70 border-emerald-200/30 shadow-floating scale-105`
                              : metric.color === 'teal'
                                ? `bg-gradient-to-br from-teal-50/90 via-green-100/40 to-teal-100/70 border-teal-200/30 shadow-floating scale-105`
                                : `bg-gradient-to-br from-cyan-50/90 via-green-50/60 to-cyan-100/70 border-cyan-200/30 shadow-floating scale-105`
                            : 'bg-white/70 border-slate-200/60 hover:bg-white/90 hover:shadow-card hover:scale-102'
                        } border`}
                        whileHover={{ scale: activeMetric === metric.id ? 1.05 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`p-3 rounded-xl shadow-sm ${
                            metric.color === 'emerald'
                              ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20'
                              : metric.color === 'teal'
                                ? 'bg-gradient-to-br from-teal-500/30 to-teal-600/20'
                                : 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/20'
                          }`}>
                            <Icon className={`size-5 ${
                              metric.color === 'emerald'
                                ? 'text-emerald-700'
                                : metric.color === 'teal'
                                  ? 'text-teal-700'
                                  : 'text-cyan-700'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="text-base font-semibold text-slate-900">{metric.label}</div>
                            <div className="text-sm text-green-700 font-medium">
                              {metric.status}
                            </div>
                          </div>
                        </div>

                        {/* Metric-specific visualizations */}
                        {metric.id === 'color' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Normal</span>
                              <span className="text-sm font-bold text-green-600">
                                {metric.details.normal}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Alerts</span>
                              <span className="text-sm font-bold text-amber-600">
                                {(metric.details.yellow || 0) + (metric.details.red || 0)}%
                              </span>
                            </div>
                          </div>
                        )}

                        {metric.id === 'consistency' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Normal</span>
                              <span className="text-sm font-bold text-green-600">
                                {metric.details.normal}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Soft</span>
                              <span className="text-sm font-bold text-amber-600">
                                {metric.details.soft}%
                              </span>
                            </div>
                          </div>
                        )}

                        {metric.id === 'content' && (
                          <div className="space-y-2">
                            <div className="flex justify-center gap-2">
                              <div className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full border border-green-200">
                                Mucous: 0
                              </div>
                              <div className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full border border-green-200">
                                Greasy: 0
                              </div>
                              <div className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                                Parasites: 0
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
                              <span className="text-sm font-bold text-green-700">
                                {metric.details.avg}/week
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">Range</span>
                              <span className="text-sm font-bold text-green-700">
                                {metric.details.min}-{metric.details.max}
                              </span>
                            </div>
                            {/* Mini deposit pattern */}
                            <div className="flex items-end justify-center gap-1 h-6 mt-2">
                              {[13, 15, 12, 16, 14, 13].map((count, i) => (
                                <div
                                  key={i}
                                  className="w-2 bg-green-600 rounded-sm"
                                  style={{ height: `${(count / 16) * 100}%` }}
                                  title={`${count} deposits`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Weekly Timeline Chart (like wellness tab) */}
                <div className="bg-white rounded-2xl p-8 border border-green-700/20 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100/50 rounded-xl">
                      <TrendingUp className="size-5 text-green-600" />
                    </div>
                    <span className="font-semibold text-slate-900 text-lg">Weekly Timeline</span>
                  </div>
                  <div className="h-32 overflow-x-auto">
                    {!mounted ? (
                      <div className="w-full h-full min-w-[300px] flex items-center justify-center">
                        <div className="animate-pulse bg-gray-200 rounded w-full h-full"></div>
                      </div>
                    ) : (
                      <svg viewBox="0 0 400 120" className="w-full h-full min-w-[300px]">
                      {/* Weekly data points - realistic deposit counts */}
                      {[
                        { week: 'Aug 4', deposits: 14, status: 'normal' },
                        { week: 'Aug 11', deposits: 13, status: 'monitor' },
                        { week: 'Aug 18', deposits: 15, status: 'normal' },
                        { week: 'Aug 25', deposits: 12, status: 'attention' },
                        { week: 'Sep 1', deposits: 16, status: 'normal' },
                        { week: 'Sep 8', deposits: 14, status: 'normal' },
                      ].map((point, index) => {
                        const x = 50 + index * 55;
                        const maxDeposits = 16;
                        const y = 90 - (point.deposits / maxDeposits) * 60;

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
                                x2={50 + (index + 1) * 55}
                                y2={
                                  90 -
                                  ([
                                    { deposits: 14 },
                                    { deposits: 13 },
                                    { deposits: 15 },
                                    { deposits: 12 },
                                    { deposits: 16 },
                                    { deposits: 14 },
                                  ][index + 1].deposits /
                                    maxDeposits) *
                                    60
                                }
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
                            />

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
                      <text
                        x="15"
                        y="30"
                        textAnchor="middle"
                        className="fill-slate-400"
                        fontSize="9"
                      >
                        16
                      </text>
                      <text
                        x="15"
                        y="50"
                        textAnchor="middle"
                        className="fill-slate-400"
                        fontSize="9"
                      >
                        8
                      </text>
                      <text
                        x="15"
                        y="70"
                        textAnchor="middle"
                        className="fill-slate-400"
                        fontSize="9"
                      >
                        0
                      </text>
                    </svg>
                    )}
                  </div>
                </div>

                {/* Dashboard-matched mini visuals: Color tile + Consistency strip */}
                <div className="mt-8 grid sm:grid-cols-2 gap-8">
                  {/* Color Analysis (matches wellness tab exactly) */}
                  <motion.div
                    className="p-6 rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-card"
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={spring.snappy}
                  >
                    <div className="text-base font-semibold text-slate-900 mb-4">Color Analysis</div>

                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-green-50 rounded border">
                        <div className="text-lg font-bold text-green-600">96%</div>
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
                              <circle
                                cx={center}
                                cy={center}
                                r="28"
                                fill="white"
                                stroke="#e5e7eb"
                                strokeWidth="1"
                              />
                              <text
                                x={center}
                                y="52"
                                textAnchor="middle"
                                className="text-xl font-bold fill-slate-800"
                              >
                                96%
                              </text>
                              <text
                                x={center}
                                y="68"
                                textAnchor="middle"
                                className="text-sm font-medium fill-slate-600"
                              >
                                Normal
                              </text>
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
                  </motion.div>

                  {/* Consistency Analysis (like wellness tab) */}
                  <motion.div
                    className="p-6 rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-card"
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={spring.snappy}
                  >
                    <div className="text-base font-semibold text-slate-900 mb-4">Consistency Analysis</div>

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-green-50 rounded border">
                        <div className="text-lg font-bold text-green-600">70%</div>
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
                  </motion.div>
                </div>

                {/* Insights Legend */}
                <div className="mt-8 p-6 bg-white rounded-2xl border border-green-700/20 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100/50 rounded-xl">
                      <Shield className="size-5 text-green-600" />
                    </div>
                    <span className="text-lg font-semibold text-slate-900">What We Monitor</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted">
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


        {/* CTA Section */}
        <Reveal delay={0.7}>
          <div className="mt-16 text-center">
            <motion.div
              className="bg-white border-green-700/20 shadow-xl max-w-2xl mx-auto z-surface overflow-hidden rounded-xl border p-8"
              whileHover={liftHover.hover}
              whileTap={liftHover.tap}
              transition={spring.snappy}
            >
              <Heart className="size-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-ink mb-2">
                Join the Waitlist for Wellness Insights
              </h3>
              <p className="text-muted mb-6">
                Sign up to Yardura now and be the first to receive advanced wellness insights once
                we launch them. Get notified when AI-powered health monitoring becomes available for
                your dog.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/quote?businessId=yardura"
                  data-analytics="cta_quote"
                  className="px-6 py-3 bg-gradient-to-r from-green-700 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  onClick={() => track('cta_insights_get_quote')}
                >
                  Sign Up to Yardura Now
                </a>
                <a
                  href="#why-matters"
                  className="px-6 py-3 border border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  onClick={() => track('cta_insights_learn_more')}
                >
                  Learn About Wellness Insights
                </a>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
