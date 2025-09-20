"use client";

import { Shield, Zap, Truck, LucideIcon } from "lucide-react";
import Reveal from "./Reveal";

interface DifferentiatorProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  comingSoon?: boolean;
}

const differentiators: DifferentiatorProps[] = [
  {
    icon: Shield,
    title: "Reliable & Professional",
    description:
      "Licensed, insured, and dependable. Same weekly schedule, satisfaction guarantee, and friendly service you can count on.",
    color: "text-emerald-700",
  },
  {
    icon: Zap,
    title: "Smart Health Insights",
    description:
      "Optional health monitoring helps you stay informed about your dog's wellness. Early insights mean better vet conversations.",
    color: "text-green-700",
    comingSoon: true,
  },
  {
    icon: Truck,
    title: "Convenient & Flexible",
    description:
      "Weekly or bi-weekly service that fits your schedule. Easy online booking, flexible plans, and no long-term contracts required.",
    color: "text-teal-700",
  },
];

function DifferentiatorCard({
  icon: Icon,
  title,
  description,
  color,
  comingSoon,
}: DifferentiatorProps) {
  // Determine card colors based on the icon color
  const getCardColors = (color: string) => {
    switch (color) {
      case "text-emerald-700":
        return {
          hoverBg: "from-emerald-50/20 to-emerald-100/30",
          iconBg: "from-emerald-500/30 to-emerald-600/20",
          border: "border-emerald-200/30",
        };
      case "text-teal-700":
        return {
          hoverBg: "from-teal-50/20 to-teal-100/30",
          iconBg: "from-teal-500/30 to-teal-600/20",
          border: "border-teal-200/30",
        };
      default:
        return {
          hoverBg: "from-green-700/10 to-green-600/15",
          iconBg: "from-green-700/20 to-green-600/10",
          border: "border-green-700/20",
        };
    }
  };

  const colors = getCardColors(color);

  return (
    <div className="group relative">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.hoverBg} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl`}
      />
      <div
        className={`relative card-modern p-8 interactive-hover border ${colors.border}`}
      >
        <div className="flex items-start gap-6">
          <div
            className={`p-4 rounded-2xl bg-gradient-to-br ${colors.iconBg} ${color} relative shadow-sm`}
          >
            <Icon className="size-8" />
            {comingSoon && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-700 to-green-600 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                Soon
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              {description}
            </p>
            {comingSoon && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-700/10 rounded-2xl border border-green-700/20 shadow-sm">
                <div className="w-2 h-2 bg-green-700 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-700">
                  Coming Soon
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Differentiators() {
  return (
    <section className="section-modern gradient-section-warm">
      <div className="container">
        <Reveal>
          <div className="text-center max-w-4xl mx-auto mb-20">
            <div className="relative">
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
                Why Choose{" "}
                <span className="relative">
                  Yeller
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-emerald-700 via-emerald-600 to-white rounded-full"></div>
                </span>
                ?
              </h2>
              <div className="flex justify-center mb-6">
                <div className="text-lg font-semibold text-slate-600 flex items-center gap-2">
                  <span>by Yardura</span>
                  <img
                    src="/yardura-logo.png"
                    alt="Yardura"
                    className="h-5 w-5 rounded-sm object-contain"
                  />
                </div>
              </div>
            </div>
            <p className="text-responsive-lg text-slate-600 leading-relaxed text-balance">
              We're not just another dog waste removal service. Our unique
              combination of technology, reliability, and health insights sets
              us apart.
            </p>
          </div>
        </Reveal>

        {/* Visual Hero for Section */}
        <Reveal delay={0.2}>
          <div className="relative rounded-3xl overflow-hidden mb-16 shadow-2xl">
            <img
              src="/sections/tech-insights1.png"
              alt="Smart health monitoring technology"
              className="w-full h-64 md:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-start pl-8 md:pl-16">
              <div className="text-white max-w-lg">
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  Technology Meets Care
                </h3>
                <p className="text-lg opacity-90">
                  Smart insights that help you stay ahead of potential health
                  issues
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid-cards">
          {differentiators.map((diff, index) => (
            <Reveal key={diff.title} delay={index * 0.1}>
              <DifferentiatorCard {...diff} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="text-center mt-16">
            <div className="bg-white/90 backdrop-blur-md border border-green-700/20 rounded-3xl p-8 shadow-card max-w-4xl mx-auto">
              <p className="text-lg text-slate-700 font-medium max-w-3xl mx-auto leading-relaxed">
                <strong className="text-gradient text-xl">
                  Experience the difference:
                </strong>{" "}
                Professional service meets cutting-edge technology for a cleaner
                yard, healthier pets, and peace of mind.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
