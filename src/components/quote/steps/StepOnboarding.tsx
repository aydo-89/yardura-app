"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star } from "lucide-react";
import { getPremiumOnboardingOptions } from "@/lib/priceEstimator";
import { StepProps } from "@/types/quote";

export const StepOnboarding: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  _errors,
  _estimatedPrice,
  onNext,
}) => {
  const onboardingOptions = getPremiumOnboardingOptions();

  // Separate DNA vs microbiome services (both coming soon)
  const dnaServices = onboardingOptions.filter(
    (option) => option.value === "premium-dna",
  );

  const microbiomeServices = onboardingOptions.filter(
    (option) => option.value === "wellness-microbiome",
  );

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/20 to-purple-50/20 min-h-[600px]">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
              <Star className="size-6 text-white" />
            </div>
            Wellness & Health Insights
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            All subscriptions include FREE basic wellness insights. Add premium
            testing options below.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Free Basic Insights Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-800 mb-2">
                  ✅ Basic Wellness Insights Included FREE
                </p>
                <p className="text-blue-700 leading-relaxed">
                  All subscriptions automatically include non-diagnostic health
                  trend monitoring, 3C's tracking (Color, Consistency, Content),
                  and basic wellness insights - no additional cost required.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Premium Add-on Options */}
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-base">
              Optional premium testing for advanced health insights
            </p>
          </div>

          <RadioGroup
            value={quoteData.premiumOnboarding || "none"}
            onValueChange={(value) =>
              updateQuoteData({ premiumOnboarding: value })
            }
            className="space-y-8"
          >
            {/* DNA Testing Services */}
            {dnaServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                  <Label className="text-xl font-semibold text-blue-800">
                    Genetic Health Testing
                  </Label>
                </div>
                <div className="grid gap-4">
                  {dnaServices.map((option) => (
                    <motion.div
                      key={option.value}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex items-start space-x-4 p-6 border-2 rounded-xl transition-all duration-300 bg-gradient-to-r from-gray-50/50 to-blue-50/30 border-gray-200 ${option.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-50/70 hover:border-blue-400 hover:shadow-lg cursor-pointer"}`}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-2"
                        disabled={option.disabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Label
                            htmlFor={option.value}
                            className={`font-semibold text-lg ${option.disabled ? "cursor-not-allowed text-gray-500" : "cursor-pointer text-blue-900"}`}
                          >
                            {option.label}
                          </Label>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                              Coming Soon
                            </div>
                          </div>
                        </div>
                        <p
                          className={`text-sm leading-relaxed ${option.disabled ? "text-gray-500" : "text-blue-700"}`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Microbiome Services */}
            {microbiomeServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-gradient-to-r from-green-400 to-teal-500 rounded-full"></div>
                  <Label className="text-xl font-semibold text-teal-800">
                    Gut Health Analysis
                  </Label>
                </div>
                <div className="grid gap-4">
                  {microbiomeServices.map((option) => (
                    <motion.div
                      key={option.value}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex items-start space-x-4 p-6 border-2 rounded-xl transition-all duration-300 bg-gradient-to-r from-gray-50/50 to-teal-50/30 border-gray-200 ${option.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-teal-50/70 hover:border-teal-400 hover:shadow-lg cursor-pointer"}`}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-2"
                        disabled={option.disabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Label
                            htmlFor={option.value}
                            className={`font-semibold text-lg ${option.disabled ? "cursor-not-allowed text-gray-500" : "cursor-pointer text-teal-900"}`}
                          >
                            {option.label}
                          </Label>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                              Coming Soon
                            </div>
                          </div>
                        </div>
                        <p
                          className={`text-sm leading-relaxed ${option.disabled ? "text-gray-500" : "text-teal-700"}`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </RadioGroup>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-800 mb-2">
                  Coming Soon Features
                </p>
                <p className="text-amber-700 leading-relaxed">
                  These premium health testing options will be available soon.
                  You'll be notified when they launch, and we'll help you get
                  started with your pet's health journey.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Service Summary */}
          {quoteData.premiumOnboarding &&
            quoteData.premiumOnboarding !== "none" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-r from-accent/15 to-accent-soft/25 rounded-2xl p-8 border-2 border-accent/30 shadow-lg"
              >
                <div className="text-sm text-muted-foreground mb-2">
                  Welcome Package Investment
                </div>
                <div className="text-3xl font-bold text-accent mb-1">
                  $
                  {(
                    (onboardingOptions.find(
                      (opt) => opt.value === quoteData.premiumOnboarding,
                    )?.price || 0) / 100
                  ).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ships after your first visit
                </div>
              </motion.div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};
