"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Star, Heart, Shield, Award } from "lucide-react";
import { StepProps } from "@/types/quote";

export const StepWellness: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  _errors,
  _estimatedPrice,
  onNext,
}) => {
  const wellnessOptions = [
    // Basic Wellness Insights (Coming Soon)
    {
      value: "basic",
      label: "Basic Wellness Insights",
      description:
        "Includes 3C's tracking (Color, Consistency, Content), basic health trend monitoring, and wellness insights.",
      icon: Heart,
      color: "from-green-400 to-emerald-500",
      bgColor: "from-green-50 to-emerald-50",
      borderColor: "border-green-200 hover:border-green-400",
      comingSoon: true,
      features: [
        "Stool consistency analysis",
        "Color and texture observations",
        "Content signals analysis",
        "Basic wellness trend tracking",
        "Monthly health summary",
        "Alerts for concerning changes",
      ],
      waitlistKey: "basic",
    },
    // Premium DNA Testing (Coming Soon)
    {
      value: "premium-dna",
      label: "Premium DNA Testing",
      description:
        "Advanced genetic testing for breed identification, health predispositions, and ancestry information.",
      icon: Shield,
      color: "from-purple-400 to-pink-500",
      bgColor: "from-purple-50 to-pink-50",
      borderColor: "border-purple-200 hover:border-purple-400",
      comingSoon: true,
      features: [
        "Complete breed breakdown",
        "Health predisposition insights",
        "Ancestry and lineage analysis",
        "Genetic health markers",
      ],
      waitlistKey: "dna",
    },
    // Microbiome Analysis (Coming Soon)
    {
      value: "wellness-microbiome",
      label: "Gut Microbiome Analysis",
      description:
        "Comprehensive analysis of your dog's gut microbiome for digestive health and nutritional insights.",
      icon: Award,
      color: "from-teal-400 to-cyan-500",
      bgColor: "from-teal-50 to-cyan-50",
      borderColor: "border-teal-200 hover:border-teal-400",
      comingSoon: true,
      features: [
        "Microbiome diversity analysis",
        "Digestive health indicators",
        "Nutritional recommendations",
        "Long-term health trends",
      ],
      waitlistKey: "microbiome",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-green-50/20 to-blue-50/20">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg">
              <Star className="size-6 text-white" />
            </div>
            Wellness & Health Insights
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            Advanced wellness insights are coming soon - join the waitlist to be
            notified
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {wellnessOptions.map((option, index) => {
            const IconComponent = option.icon;
            return (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 border-2 rounded-xl transition-all duration-300 bg-gradient-to-r ${option.bgColor} border-gray-200 ${option.borderColor} opacity-70`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 bg-gradient-to-r ${option.color} rounded-lg flex-shrink-0`}
                  >
                    <IconComponent className="size-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="font-semibold text-lg text-gray-900">
                        {option.label}
                      </Label>
                      <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Coming Soon
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700 mb-4">
                      {option.description}
                    </p>

                    {/* Features list */}
                    {option.features && (
                      <ul className="text-sm text-muted space-y-1 mb-4">
                        {option.features.map((feature, featureIndex) => (
                          <li
                            key={featureIndex}
                            className="flex items-center gap-2"
                          >
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Waitlist checkbox */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      <Checkbox
                        id={`waitlist-${option.value}`}
                        checked={
                          !!(quoteData.wellnessWaitlist as any)?.[
                            option.waitlistKey
                          ]
                        }
                        onCheckedChange={(checked) => {
                          updateQuoteData({
                            wellnessWaitlist: {
                              ...(quoteData.wellnessWaitlist || {}),
                              [option.waitlistKey]: checked === true,
                            },
                          });
                        }}
                      />
                      <Label
                        htmlFor={`waitlist-${option.value}`}
                        className="text-sm text-muted cursor-pointer"
                      >
                        Join waitlist for {option.label.toLowerCase()}
                      </Label>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
