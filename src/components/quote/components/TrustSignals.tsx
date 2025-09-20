"use client";

import { Shield, Award, Truck, Heart, LucideIcon } from "lucide-react";

interface TrustSignal {
  icon: LucideIcon;
  text: string;
  description: string;
}

const TRUST_SIGNALS: TrustSignal[] = [
  {
    icon: Shield,
    text: "Licensed & Insured",
    description: "Fully licensed and insured for your peace of mind",
  },
  {
    icon: Award,
    text: "5-Star Service",
    description: "Trusted by hundreds of happy customers",
  },
  {
    icon: Truck,
    text: "Reliable Service",
    description: "98% on-time service rate with flexible scheduling",
  },
  {
    icon: Heart,
    text: "Eco-Friendly",
    description: "Carbon-neutral service with sustainable practices",
  },
];

interface TrustSignalsProps {
  className?: string;
}

export const TrustSignals = ({ className = "" }: TrustSignalsProps) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {TRUST_SIGNALS.map((signal, index) => {
        const IconComponent = signal.icon;
        return (
          <div
            key={index}
            className="flex flex-col items-center text-center p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <IconComponent className="size-8 text-teal-700 mb-2" />
            <h3 className="font-semibold text-sm text-gray-900 mb-1">
              {signal.text}
            </h3>
            <p className="text-xs text-gray-600 leading-tight">
              {signal.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
