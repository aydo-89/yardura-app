'use client';

import { Shield, Zap, Truck, Leaf, LucideIcon } from 'lucide-react';
import Reveal from './Reveal';

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
    title: 'Reliable & Trusted',
    description:
      'Licensed, insured, and committed to excellence. Same-day service, satisfaction guarantee, and professional technicians you can trust.',
    color: 'text-blue-600',
  },
  {
    icon: Zap,
    title: 'Tech-Enabled Insights',
    description:
      "AI-powered stool analysis tracks your dog's health patterns. Non-diagnostic insights help you spot changes early and consult your vet sooner.",
    color: 'text-accent',
    comingSoon: true,
  },
  {
    icon: Truck,
    title: 'Convenient & Flexible',
    description:
      'Flexible scheduling options to fit your needs. Weekly, bi-weekly, or custom service plans. Same-day emergency service available when you need it most.',
    color: 'text-green-600',
  },
];

function DifferentiatorCard({ icon: Icon, title, description, color, comingSoon }: DifferentiatorProps) {
  return (
    <div className="group relative">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-soft/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative bg-white border border-accent/10 rounded-2xl p-8 shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-accent-soft/30 ${color} relative`}>
            <Icon className="size-6" />
            {comingSoon && (
              <div className="absolute -top-1 -right-1 bg-accent text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                Soon
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-ink mb-3">{title}</h3>
            <p className="text-muted leading-relaxed">{description}</p>
            {comingSoon && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-accent-soft/50 rounded-full border border-accent/20">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-accent">Coming Soon</span>
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
    <section className="py-24 bg-gradient-to-br from-accent-soft/20 via-white to-accent-soft/10">
      <div className="container">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-6">
              Why Choose Yardura?
            </h2>
            <p className="text-lg text-muted">
              We're not just another dog waste removal service. Our unique combination of
              technology, reliability, and health insights sets us apart.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8">
          {differentiators.map((diff, index) => (
            <Reveal key={diff.title} delay={index * 0.1}>
              <DifferentiatorCard {...diff} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="text-center mt-12">
            <p className="text-sm text-muted max-w-2xl mx-auto">
              <strong>Experience the difference:</strong> Professional service meets cutting-edge
              technology for a cleaner yard, healthier pets, and peace of mind.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
