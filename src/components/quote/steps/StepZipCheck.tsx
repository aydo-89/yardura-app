'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Award,
  Truck,
  Heart,
  LucideIcon,
} from 'lucide-react';

import { track } from '@/lib/analytics';
import { StepProps } from '@/types/quote';
import { ZipEligibilityResult } from '@/lib/zip-eligibility';

interface ValidationResult {
  valid: boolean;
  message: string;
  location?: string;
  zone?: ZipEligibilityResult['zone'];
  eligible?: boolean;
  estimatedDelivery?: string;
}


// Trust signals (removed false claims about customer count)

export const StepZipCheck: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
}) => {
  const [zipCode, setZipCode] = useState(quoteData.zipCode || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const validateZipCode = async () => {
    if (!zipCode.trim()) {
      setValidationResult({ valid: false, message: 'Please enter a zip code' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const params = new URLSearchParams({ zipCode: zipCode.trim() });
      const res = await fetch(`/api/zip-eligibility?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to validate ZIP');
      const eligibilityResult: ZipEligibilityResult = await res.json();

      setValidationResult({
        valid: eligibilityResult.eligible,
        message: eligibilityResult.message,
        location: eligibilityResult.zone?.name || 'Outside Service Area',
        zone: eligibilityResult.zone,
      });

      track('zip_check', {
        zip: zipCode.trim(),
        inArea: eligibilityResult.eligible,
        location: eligibilityResult.zone?.name || 'Outside Service Area',
        zone: eligibilityResult.zone?.zoneId || null,
        estimatedDelivery: eligibilityResult.estimatedDelivery || null,
      });
    } catch (error) {
      console.error('ZIP validation error:', error);
      setValidationResult({
        valid: false,
        message: 'Unable to validate ZIP code. Please try again.',
      });
    }

    setIsValidating(false);
  };

  const handleContinue = () => {
    if (validationResult?.valid) {
      updateQuoteData({ zipCode: zipCode.trim() });
      onNext?.();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-accent" />
            Service Area Check
          </CardTitle>
          <p className="text-muted">
            Let's make sure we can provide service in your area. Enter your zip code below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Location Display */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-accent">
                  {validationResult?.location || 'Twin Cities Metro Area'}
                </p>
                <p className="text-sm text-muted">Minnesota</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Serving Minneapolis, Richfield, Edina, Bloomington, and surrounding areas
            </p>
          </div>

          {/* Zip Code Input */}
          <div>
            <Label htmlFor="zipCode" className="text-base font-medium">
              Zip Code *
            </Label>
            <div className="flex gap-3 mt-2">
              <Input
                id="zipCode"
                type="text"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onBlur={() => {
                  // Simple ZIP validation on blur
                  if (zipCode && (!zipCode.match(/^\d{5}$/) || zipCode.length !== 5)) {
                    // Could add error state here if needed
                  }
                }}
                placeholder="55401"
                className="flex-1 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
              />
              <Button
                onClick={validateZipCode}
                disabled={!zipCode.trim() || isValidating}
                className="px-6"
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
              </Button>
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                validationResult.valid
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    validationResult.valid ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                >
                  {validationResult.valid ? (
                    <CheckCircle className="w-3 h-3 text-white" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{validationResult.message}</p>
                  {validationResult.location && (
                    <p className="text-sm mt-1 opacity-80">{validationResult.location}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

