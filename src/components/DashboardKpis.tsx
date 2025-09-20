"use client";
import useSWR from "swr";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Leaf,
  AlertTriangle,
  Minus,
  Sparkles,
  Target,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardKpis() {
  const { data } = useSWR("/api/dashboard/kpis", fetcher, {
    refreshInterval: 30000,
  });
  const k = data || {
    deposits30: 0,
    avgWeight30: 0,
    freq7: 0,
    eco: { lbs: 0, methane: 0 },
    alertsOpen: 0,
  };

  const kpis = [
    {
      title: "Deposits (30d)",
      value: k.deposits30,
      icon: BarChart3,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      borderColor: "border-blue-500/20",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Avg Weight (30d)",
      value: `${k.avgWeight30.toFixed?.(1) || 0} g`,
      icon: Activity,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-500/20",
      trend: "+5%",
      trendUp: true,
    },
    {
      title: "Frequency (7d)",
      value: k.freq7,
      icon: Target,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-500/20",
      trend: "0%",
      trendUp: null,
    },
    {
      title: "Eco Impact (MTD)",
      value: `${k.eco.lbs?.toFixed?.(1) || 0} lbs`,
      icon: Leaf,
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-500/10 to-teal-500/10",
      borderColor: "border-emerald-500/20",
      trend: "+18%",
      trendUp: true,
    },
    {
      title: "Methane Saved",
      value: `${k.eco.methane?.toFixed?.(2) || 0} ft³`,
      icon: Sparkles,
      gradient: "from-teal-500 to-blue-500",
      bgGradient: "from-teal-500/10 to-blue-500/10",
      borderColor: "border-teal-500/20",
      trend: "+15%",
      trendUp: true,
    },
    {
      title: "Active Alerts",
      value: k.alertsOpen,
      icon: AlertTriangle,
      gradient:
        k.alertsOpen > 0
          ? "from-orange-500 to-red-500"
          : "from-gray-500 to-slate-500",
      bgGradient:
        k.alertsOpen > 0
          ? "from-orange-500/10 to-red-500/10"
          : "from-gray-500/10 to-slate-500/10",
      borderColor:
        k.alertsOpen > 0 ? "border-orange-500/20" : "border-gray-500/20",
      trend: k.alertsOpen > 0 ? "Needs Attention" : "All Clear",
      trendUp: null,
    },
  ];

  return (
    <>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }

        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.8);
          }
        }

        .kpi-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .kpi-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transition: left 0.6s;
        }

        .kpi-card:hover::before {
          left: 100%;
        }

        .kpi-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .icon-container {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.05)
          );
          backdrop-filter: blur(10px);
        }

        .metric-value {
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .trend-indicator {
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
        {kpis.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <div
              key={index}
              className="kpi-card rounded-2xl p-6 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`p-3 rounded-xl icon-container group-hover:scale-110 transition-transform duration-300`}
                >
                  <IconComponent
                    className={`h-6 w-6 bg-gradient-to-br ${kpi.gradient} bg-clip-text text-transparent`}
                  />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {kpi.trendUp === true && (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  )}
                  {kpi.trendUp === false && (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  {kpi.trendUp === null && (
                    <Minus className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="metric-value text-2xl font-bold mb-2 group-hover:scale-105 transition-transform duration-300">
                {kpi.value}
              </div>

              <div className="text-slate-300 text-sm font-medium mb-3">
                {kpi.title}
              </div>

              <div className="trend-indicator px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1">
                {kpi.trendUp === true && (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                )}
                {kpi.trendUp === false && (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                {kpi.trendUp === null && (
                  <Minus className="h-3 w-3 text-slate-400" />
                )}
                <span
                  className={`${
                    kpi.trendUp === true
                      ? "text-green-400"
                      : kpi.trendUp === false
                        ? "text-red-400"
                        : "text-slate-400"
                  }`}
                >
                  {kpi.trend}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
