'use client';
import { useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Heart,
  Leaf,
  PawPrint,
  Plus,
  Recycle,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  Sparkles,
  Shield,
  Droplets,
  Zap as Lightning,
  Crown,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

// Advanced visual effects and animations
const advancedStyles = `
  :root {
    --dashboard-gradient: linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--accent)) 100%);
    --glass-bg: rgba(255, 255, 255, 0.1);
    --glass-border: rgba(255, 255, 255, 0.15);
    --shadow-soft: 0 8px 32px rgba(0, 0, 0, 0.1);
    --shadow-glow: 0 0 20px hsl(var(--accent) / 0.3);
    --animation-bounce-in: cubic-bezier(0.68, -0.55, 0.265, 1.55);
    --animation-float: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --animation-slide-in-up: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px hsl(var(--accent) / 0.4); }
    50% { box-shadow: 0 0 30px hsl(var(--accent) / 0.8); }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes bounceIn {
    0% { opacity: 0; transform: scale(0.3); }
    50% { opacity: 1; transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1); }
  }

  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    background-size: 200px 100%;
    animation: shimmer 2s infinite;
  }

  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  .animate-slide-in-up {
    animation: slideInUp 0.6s ease-out;
  }

  .animate-bounce-in {
    animation: bounceIn 0.8s ease-out;
  }

  .animate-gradient-shift {
    background-size: 200% 200%;
    animation: gradientShift 3s ease infinite;
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }

  .glass-card:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  .gradient-text {
    background: linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--accent)) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hover-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .hover-lift:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  }

  .metric-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(15px);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .metric-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    transition: left 0.8s;
  }

  .metric-card:hover::before {
    left: 100%;
  }

  .metric-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
  }

  .floating-particles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }

  .particle {
    position: absolute;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    animation: float 6s ease-in-out infinite;
  }

  .particle:nth-child(1) { top: 10%; left: 20%; animation-delay: 0s; width: 4px; height: 4px; }
  .particle:nth-child(2) { top: 30%; left: 70%; animation-delay: 2s; width: 2px; height: 2px; }
  .particle:nth-child(3) { top: 60%; left: 40%; animation-delay: 4s; width: 3px; height: 3px; }
  .particle:nth-child(4) { top: 80%; left: 90%; animation-delay: 1s; width: 2px; height: 2px; }
  .particle:nth-child(5) { top: 20%; left: 80%; animation-delay: 3s; width: 3px; height: 3px; }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring circle {
    transition: stroke-dasharray 0.3s ease;
  }

  .data-viz {
    filter: drop-shadow(0 4px 20px hsl(var(--accent) / 0.3));
  }

  .service-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(15px);
    transition: all 0.3s ease;
  }

  .service-card:hover {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }

  .pack-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(10px);
  }

  @media (max-width: 768px) {
    .mobile-stack { flex-direction: column; }
  }
`;

interface DashboardClientProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    dogs: any[];
    serviceVisits: any[];
    dataReadings: any[];
  };
  totalWaste: number;
  avgHealthScore: number;
  recentVisits: any[];
  totalSamples: number;
  ecoImpact: number;
}

export default function DashboardClient({
  user,
  totalWaste,
  avgHealthScore,
  recentVisits,
  totalSamples,
  ecoImpact,
}: DashboardClientProps) {
  const [activeMetric, setActiveMetric] = useState('consistency');

  return (
    <section className="min-h-screen bg-gradient-to-br from-white via-accent-soft/20 to-white relative overflow-hidden">
      <style jsx global>{advancedStyles}</style>

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

      <div className="relative z-10 container max-w-7xl py-8 px-4">
        {/* Header Section */}
        <div className="mb-12 animate-slide-in-up">
          <div className="relative">
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
              <div className="floating-particles">
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <Eye className="size-6 text-accent animate-float" />
                  <div className="absolute -inset-2 bg-accent/20 rounded-full blur-lg animate-pulse-glow"></div>
                </div>
                <span className="text-sm font-semibold text-accent uppercase tracking-wide">Wellness Dashboard</span>
                <span className="px-3 py-1 bg-gradient-to-r from-accent to-accent/80 text-white text-xs font-bold rounded-full animate-gradient-shift">
                  3 C's Analysis
                </span>
              </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="flex-1">
              <h1 className="text-4xl lg:text-5xl font-bold text-ink mb-4">
                Welcome back, {user.name}
              </h1>
              <p className="text-lg text-muted leading-relaxed max-w-2xl mb-4">
                Your {user.dogs.length === 1 ? "dog's" : "pack's"} wellness insights through our AI-powered 3 C's analysis:
                <strong className="text-accent"> Color, Consistency, Content</strong>
              </p>
              {user.dogs.length > 1 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                  <Users className="size-4" />
                  {user.dogs.length} dogs • Combined insights
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button className="px-6 py-3 bg-accent text-white rounded-xl font-semibold shadow-soft hover:bg-accent/90 transition-all duration-200 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                View Trends
              </button>
              <button className="px-6 py-3 border-2 border-accent text-accent rounded-xl font-semibold hover:bg-accent-soft transition-all duration-200 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule Service
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>

        {/* Key Stats Row */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="metric-card rounded-2xl p-6 text-center animate-bounce-in" style={{ animationDelay: '0.1s' }}>
            <div className="text-3xl font-bold text-accent mb-2">{recentVisits.length}</div>
            <div className="text-ink font-medium">Services Completed</div>
            <div className="text-sm text-muted mt-1">This month</div>
          </div>

          <div className="metric-card rounded-2xl p-6 text-center animate-bounce-in" style={{ animationDelay: '0.2s' }}>
            <div className="text-3xl font-bold gradient-text mb-2">{totalSamples}</div>
            <div className="text-ink font-medium">Wellness Samples</div>
            <div className="text-sm text-muted mt-1">Analyzed</div>
          </div>

          <div className="metric-card rounded-2xl p-6 text-center animate-bounce-in" style={{ animationDelay: '0.3s' }}>
            <div className="text-3xl font-bold gradient-text mb-2">{avgHealthScore}%</div>
            <div className="text-ink font-medium">Wellness Score</div>
            <div className="text-sm text-muted mt-1">Combined insights</div>
          </div>

          <div className="metric-card rounded-2xl p-6 text-center animate-bounce-in" style={{ animationDelay: '0.4s' }}>
            <div className="text-3xl font-bold gradient-text mb-2">{ecoImpact.toFixed(1)}</div>
            <div className="text-ink font-medium">lbs Diverted</div>
            <div className="text-sm text-muted mt-1">Environmental impact</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Service Overview */}
            <div className="service-card rounded-2xl p-8 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-ink mb-1">Service Overview</h2>
                  <p className="text-muted text-sm">Your waste removal service summary</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-700 font-medium">Active Service</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Calendar className="size-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-blue-800">Next Service</div>
                      <div className="text-xs text-blue-600">Scheduled pickup</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-800 mb-2">
                    {recentVisits[0]?.scheduledDate ?
                      new Date(recentVisits[0].scheduledDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      }) :
                      'Schedule'
                    }
                  </div>
                  <div className="text-sm text-blue-600">Weekly maintenance</div>
                </div>

                <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Activity className="size-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-purple-800">Service History</div>
                      <div className="text-xs text-purple-600">Completed pickups</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-purple-800 mb-2">{recentVisits.length}</div>
                  <div className="text-sm text-purple-600">This month</div>
                </div>
              </div>

              {/* Service Status */}
              <div className="p-4 bg-accent-soft/20 rounded-lg border border-accent/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="size-5 text-accent" />
                    <span className="text-sm font-medium text-ink">Service Status</span>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    ACTIVE
                  </span>
                </div>
                <div className="mt-2 text-sm text-muted">
                  Regular weekly service • Eco-friendly disposal • Wellness monitoring included
                </div>
              </div>
            </div>

            {/* 3 C's Analysis Dashboard */}
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-ink mb-1">3 C's Wellness Analysis</h2>
                  <p className="text-muted text-sm">Color • Consistency • Content</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-700 font-medium">All Normal</span>
                </div>
              </div>

              {/* Interactive Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div
                  onClick={() => setActiveMetric('consistency')}
                  className={`p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                    activeMetric === 'consistency'
                      ? 'bg-accent-soft border-accent-200 shadow-lg scale-105'
                      : 'bg-white/60 border-slate-200 hover:bg-white/80'
                  } border`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-10 bg-slate-100 rounded-xl flex items-center justify-center ${activeMetric === 'consistency' ? 'bg-accent-soft' : ''}`}>
                      <Activity className={`size-5 ${activeMetric === 'consistency' ? 'text-accent' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">Consistency</div>
                      <div className={`text-xs ${activeMetric === 'consistency' ? 'text-accent' : 'text-slate-500'}`}>
                        Normal range
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r from-accent to-accent/80 h-2 rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: '85%' }}
                    ></div>
                  </div>
                </div>

                <div
                  onClick={() => setActiveMetric('color')}
                  className={`p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                    activeMetric === 'color'
                      ? 'bg-accent-soft border-accent-200 shadow-lg scale-105'
                      : 'bg-white/60 border-slate-200 hover:bg-white/80'
                  } border`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-10 bg-slate-100 rounded-xl flex items-center justify-center ${activeMetric === 'color' ? 'bg-accent-soft' : ''}`}>
                      <Droplets className={`size-5 ${activeMetric === 'color' ? 'text-accent' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">Color</div>
                      <div className={`text-xs ${activeMetric === 'color' ? 'text-accent' : 'text-slate-500'}`}>
                        Normal
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r from-accent to-accent/80 h-2 rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: '90%' }}
                    ></div>
                  </div>
                </div>

                <div
                  onClick={() => setActiveMetric('content')}
                  className={`p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                    activeMetric === 'content'
                      ? 'bg-accent-soft border-accent-200 shadow-lg scale-105'
                      : 'bg-white/60 border-slate-200 hover:bg-white/80'
                  } border`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-10 bg-slate-100 rounded-xl flex items-center justify-center ${activeMetric === 'content' ? 'bg-accent-soft' : ''}`}>
                      <Target className={`size-5 ${activeMetric === 'content' ? 'text-accent' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">Content</div>
                      <div className={`text-xs ${activeMetric === 'content' ? 'text-accent' : 'text-slate-500'}`}>
                        No anomalies
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r from-accent to-accent/80 h-2 rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: '95%' }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Wellness Insights Legend */}
              <div className="p-6 bg-accent-soft/20 rounded-lg border border-accent/10">
                <div className="flex items-center gap-2 mb-3">
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
                <div className="mt-4 text-xs text-muted/70">
                  📊 Patterns analyzed from weekly pickups. These are informational only and not
                  veterinary advice. Always consult your vet for health concerns.
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-white to-accent-soft/10 border-accent/20 shadow-xl rounded-xl border p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-ink flex items-center gap-3">
                  <Activity className="size-6 text-accent" />
                  Recent Activity
                </h2>
                <button className="text-accent hover:text-accent/80 transition-colors font-medium">
                  View All
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-green-50/50 border border-green-200/50 rounded-xl">
                  <div className="size-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="size-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-green-800">Service Completed</h3>
                      <span className="text-xs text-green-600">2h ago</span>
                    </div>
                    <p className="text-green-700 text-sm">
                      Weekly pickup completed with normal wellness patterns observed.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-blue-50/50 border border-blue-200/50 rounded-xl">
                  <div className="size-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Heart className="size-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-blue-800">Wellness Insight Available</h3>
                      <span className="text-xs text-blue-600">1d ago</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                      New analysis ready showing consistent wellness patterns this week.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Pack */}
            <div className="pack-card rounded-xl p-6">
              <h3 className="text-xl font-bold text-ink mb-6 flex items-center gap-3">
                <PawPrint className="size-5 text-accent" />
                Your Pack
              </h3>
              <div className="space-y-3">
                {user.dogs.map((dog: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-accent-soft/20 rounded-lg">
                    <div className="size-8 bg-accent/20 rounded-full flex items-center justify-center">
                      <PawPrint className="size-4 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">{dog.name}</div>
                      <div className="text-xs text-muted">{dog.breed}</div>
                    </div>
                  </div>
                ))}
              </div>
              {user.dogs.length > 1 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-blue-700">
                    <Users className="size-3" />
                    Combined wellness insights for all dogs
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-white to-accent-soft/10 border-accent/20 shadow-lg rounded-xl border p-6">
              <h3 className="text-xl font-bold text-ink mb-6 flex items-center gap-3">
                <Lightning className="size-5 text-accent" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button className="w-full p-4 bg-gradient-to-r from-accent/10 to-accent/5 hover:from-accent/20 hover:to-accent/10 rounded-xl border border-accent/20 hover:border-accent/40 transition-all duration-300 text-left group">
                  <div className="flex items-center gap-3">
                    <Plus className="size-5 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-ink font-medium">Schedule Extra Service</span>
                  </div>
                </button>
                <button className="w-full p-4 bg-gradient-to-r from-accent/10 to-accent/5 hover:from-accent/20 hover:to-accent/10 rounded-xl border border-accent/20 hover:border-accent/40 transition-all duration-300 text-left group">
                  <div className="flex items-center gap-3">
                    <Eye className="size-5 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-ink font-medium">View Full Report</span>
                  </div>
                </button>
                <button className="w-full p-4 bg-gradient-to-r from-accent/10 to-accent/5 hover:from-accent/20 hover:to-accent/10 rounded-xl border border-accent/20 hover:border-accent/40 transition-all duration-300 text-left group">
                  <div className="flex items-center gap-3">
                    <Bell className="size-5 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-ink font-medium">Alert Settings</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Eco Impact */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50 shadow-lg rounded-xl border p-6">
              <h3 className="text-xl font-bold text-ink mb-6 flex items-center gap-3">
                <Leaf className="size-5 text-green-600" />
                Your Eco Impact
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                  <span className="text-ink">Waste Diverted</span>
                  <span className="font-bold text-green-600">{ecoImpact.toFixed(1)} lbs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                  <span className="text-ink">CO₂ Saved</span>
                  <span className="font-bold text-green-600">{(ecoImpact * 0.5).toFixed(1)} lbs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                  <span className="text-ink">Trees Equivalent</span>
                  <span className="font-bold text-green-600">{Math.round(ecoImpact / 50)} trees</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-green-200/50">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">
                    🌱 Together we're making a difference
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}