"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

import { StepProps } from "@/types/quote";

export const StepFrequency: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
}) => {
  const handleFrequencySelect = (frequency: string) => {
    updateQuoteData({ frequency: frequency as any });
    onNext?.();
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-accent" />
            Service Frequency
          </CardTitle>
          <p className="text-muted">How often do you need service?</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                value: "weekly",
                label: "Weekly Service",
                subtitle: "Most Popular Choice",
                description: "Consistent maintenance keeps your yard pristine",
                benefits: [
                  "Fresh & clean every week",
                  "Prevent odor buildup",
                  "Regular schedule",
                ],
                color: "accent",
                recommended: true,
              },
              {
                value: "biweekly",
                label: "Every Other Week",
                subtitle: "Balanced Frequency",
                description:
                  "Perfect balance of cleanliness and cost-effectiveness",
                benefits: [
                  "Every 2 weeks",
                  "Cost-effective option",
                  "Good for most yards",
                ],
                color: "blue",
                recommended: false,
              },
              {
                value: "twice-weekly",
                label: "Twice Weekly",
                subtitle: "Maximum Cleanliness",
                description: "Intensive service for maximum freshness",
                benefits: [
                  "2x per week service",
                  "Ultimate cleanliness",
                  "Heavy traffic areas",
                ],
                color: "purple",
                recommended: false,
              },
              {
                value: "monthly",
                label: "Monthly Service",
                subtitle: "Cost-Effective",
                description: "Regular maintenance for lighter needs",
                benefits: [
                  "Once per month",
                  "Budget-friendly",
                  "Light usage areas",
                ],
                color: "green",
                recommended: false,
              },
            ].map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleFrequencySelect(option.value)}
                className={`relative p-6 border-2 rounded-2xl transition-all duration-300 text-left group overflow-hidden ${
                  quoteData.frequency === option.value
                    ? `border-${option.color}-500 bg-${option.color}-50/80 shadow-xl ring-2 ring-${option.color}-200`
                    : `border-gray-200 hover:border-${option.color}-300 hover:bg-${option.color}-25 hover:shadow-lg`
                }`}
              >
                {option.recommended && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-accent to-accent/80 text-white text-xs px-3 py-1 rounded-bl-xl font-medium shadow-sm">
                    ⭐ Most Popular
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {option.label}
                    </h3>
                    <p
                      className={`text-sm font-medium text-${option.color}-700 mb-2`}
                    >
                      {option.subtitle}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                  {quoteData.frequency === option.value && (
                    <div
                      className={`bg-${option.color}-500 text-white p-2 rounded-full shadow-md`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {option.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 bg-${option.color}-500 rounded-full flex-shrink-0`}
                      ></div>
                      <span className="text-sm text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div
                  className={`mt-4 inline-flex items-center gap-2 px-3 py-1 bg-${option.color}-100 text-${option.color}-800 text-xs font-medium rounded-full border border-${option.color}-200`}
                >
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse"></span>
                  Click to select
                </div>
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
