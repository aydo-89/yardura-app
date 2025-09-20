'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Building, Home } from 'lucide-react';

import { StepProps } from '@/types/quote';

export const StepBasics: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  errors,
}) => {
  const isCommercial = quoteData.serviceType === 'commercial';

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-teal-700" />
            Property Details
          </CardTitle>
          <p className="text-muted">
            {isCommercial
              ? 'Tell us about your commercial property and service needs'
              : 'Tell us about your home and pets'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Type Display */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                {isCommercial ? (
                  <Building className="w-5 h-5 text-white" />
                ) : (
                  <Home className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-teal-800">
                  {isCommercial ? 'Commercial Service' : 'Residential Service'}
                </p>
                <p className="text-sm text-teal-600">
                  {isCommercial
                    ? 'Pet waste stations and common-area cleanup for businesses'
                    : 'Professional pet waste removal for your home'}
                </p>
              </div>
            </div>
          </div>

          {/* Commercial Property Info */}
          {isCommercial && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Commercial Property Service</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Perfect for dog parks, veterinary clinics, hotels, grooming salons, boarding
                    facilities, and other businesses. We'll provide a custom quote based on your
                    specific needs.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dog Count */}
          <div>
            <Label htmlFor="dogs" className="text-base font-medium">
              {isCommercial ? 'Expected Number of Dogs *' : 'Number of Dogs *'}
            </Label>
            <p className="text-sm text-muted mt-1">
              {isCommercial
                ? 'How many dogs do you typically serve or expect to have on your property?'
                : 'How many dogs live in your home?'}
            </p>

            {isCommercial ? (
              // Free-form input for commercial
              <Input
                id="dogs"
                type="number"
                min="1"
                max="500"
                value={quoteData.dogs || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateQuoteData({ dogs: parseInt(e.target.value) || 0 })
                }
                placeholder="Enter number of dogs (e.g., 50)"
                className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 focus:outline-none"
              />
            ) : (
              // Dropdown for residential (1-4+)
              <Select
                value={quoteData.dogs?.toString()}
                onValueChange={(value) => updateQuoteData({ dogs: parseInt(value) })}
              >
                <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                  <SelectValue placeholder="Select number of dogs" />
                </SelectTrigger>
                <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                  {[1, 2, 3].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} dog{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="4">4+ dogs</SelectItem>
                </SelectContent>
              </Select>
            )}

            {errors?.dogs && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-red-600 mt-1"
                data-error="true"
              >
                {errors.dogs}
              </motion.p>
            )}
          </div>

          {/* Property Type */}
          <div>
            <Label htmlFor="yardSize" className="text-base font-medium">
              {isCommercial ? 'Service Area Size *' : "What's your place like? *"}
            </Label>
            <Select
              value={quoteData.yardSize}
              onValueChange={(value) => updateQuoteData({ yardSize: value as any })}
            >
              <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                <SelectValue
                  placeholder={
                    isCommercial ? 'Select service area size' : 'Select your property type'
                  }
                />
              </SelectTrigger>
              <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                {isCommercial ? (
                  // Commercial size options
                  <>
                    <SelectItem value="small">
                      Small (&lt; 5,000 sq ft) - Small facility or office
                    </SelectItem>
                    <SelectItem value="medium">
                      Medium (5,000-25,000 sq ft) - Standard business or clinic
                    </SelectItem>
                    <SelectItem value="large">
                      Large (25,000-100,000 sq ft) - Large facility or park
                    </SelectItem>
                    <SelectItem value="xl">
                      XL (&gt; 100,000 sq ft) - Major facility or large park
                    </SelectItem>
                  </>
                ) : (
                  // Residential property type options
                  <>
                    <SelectItem value="small">Town House</SelectItem>
                    <SelectItem value="medium">Detached (Less than 0.5 acre lot)</SelectItem>
                    <SelectItem value="large">Detached (More than 0.5 acres lot)</SelectItem>
                    <SelectItem value="xl">Multi-family or Large Estate</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {errors?.yardSize && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-red-600 mt-1"
                data-error="true"
              >
                {errors.yardSize}
              </motion.p>
            )}
          </div>

          {/* Commercial-specific questions */}
          {isCommercial && (
            <>
              <div>
                <Label htmlFor="businessType" className="text-base font-medium">
                  Business Type *
                </Label>
                <Select
                  value={quoteData.businessType || ''}
                  onValueChange={(value) => updateQuoteData({ businessType: value })}
                >
                  <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                    <SelectItem value="dog-park">🏞️ Dog Park or Recreation Area</SelectItem>
                    <SelectItem value="veterinary">🏥 Veterinary Clinic or Hospital</SelectItem>
                    <SelectItem value="grooming">✂️ Grooming Salon</SelectItem>
                    <SelectItem value="boarding">🏠 Boarding or Daycare Facility</SelectItem>
                    <SelectItem value="hotel">🏨 Pet Hotel or Resort</SelectItem>
                    <SelectItem value="training">🎾 Training Facility</SelectItem>
                    <SelectItem value="retail">🛍️ Pet Retail Store</SelectItem>
                    <SelectItem value="other">🏢 Other Commercial Facility</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.businessType && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-red-600 mt-1"
                    data-error="true"
                  >
                    {errors.businessType}
                  </motion.p>
                )}
              </div>

              <div>
                <Label htmlFor="serviceFrequency" className="text-base font-medium">
                  Typical Service Frequency
                </Label>
                <p className="text-sm text-muted mt-1">
                  How often do you need waste removal services?
                </p>
                <Select
                  value={quoteData.serviceFrequency || ''}
                  onValueChange={(value) => updateQuoteData({ serviceFrequency: value })}
                >
                  <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                    <SelectValue placeholder="Select service frequency" />
                  </SelectTrigger>
                  <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                    <SelectItem value="daily">Daily - High-traffic facility</SelectItem>
                    <SelectItem value="multiple-daily">
                      Multiple times daily - Very busy operation
                    </SelectItem>
                    <SelectItem value="weekly">Weekly - Standard maintenance</SelectItem>
                    <SelectItem value="as-needed">As needed - Variable traffic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Cleanup Assessment */}
          <div>
            <Label htmlFor="lastCleanup" className="text-base font-medium">
              {isCommercial
                ? 'Current Cleanup Situation *'
                : 'When was your yard last cleaned? *'}
            </Label>
            <p className="text-sm text-muted mt-1 mb-3">
              {isCommercial
                ? 'How often is waste currently being removed from your property?'
                : 'This helps us provide the most accurate pricing for your specific needs'}
            </p>
            <Select
              value={quoteData.daysSinceLastCleanup?.toString() || ''}
              onValueChange={(value) =>
                updateQuoteData({
                  daysSinceLastCleanup: parseInt(value),
                })
              }
            >
              <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                <SelectValue
                  placeholder={
                    isCommercial ? 'Select cleanup frequency' : 'Select time since last cleanup'
                  }
                />
              </SelectTrigger>
              <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                {isCommercial ? (
                  // Commercial cleanup options
                  <>
                    <SelectItem value="1">Daily - Well maintained</SelectItem>
                    <SelectItem value="3">Every few days - Moderate traffic</SelectItem>
                    <SelectItem value="7">Weekly - Standard facility</SelectItem>
                    <SelectItem value="14">Every 2 weeks - Lower traffic</SelectItem>
                    <SelectItem value="30">Monthly - Minimal use</SelectItem>
                    <SelectItem value="90">Over 3 months - Needs attention</SelectItem>
                  </>
                ) : (
                  // Residential cleanup options
                  <>
                    <SelectItem value="14">&lt; 2 weeks (It's spotless)</SelectItem>
                    <SelectItem value="42">2–6 weeks (It's pretty neglected)</SelectItem>
                    <SelectItem value="999">&gt; 6 weeks (Watch your step!)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
