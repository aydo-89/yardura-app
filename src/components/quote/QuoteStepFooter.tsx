'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuoteStepFooterProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  showBack?: boolean;
  isFinalStep?: boolean;
}

export const QuoteStepFooter: React.FC<QuoteStepFooterProps> = ({
  currentStep,
  totalSteps,
  onBack,
  onContinue,
  continueDisabled = false,
  continueLoading = false,
  showBack = true,
  isFinalStep = false,
}) => {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200/60 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
          {/* Step indicator */}
          <div className="text-sm text-slate-600 font-medium">
            Step {currentStep + 1} of {totalSteps}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-green-700 to-green-600 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-4 w-full justify-center">
            {showBack && (
              <Button
                variant="outline"
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-2.5"
                disabled={continueLoading}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}

            <Button
              onClick={onContinue}
              disabled={continueDisabled || continueLoading}
              className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50"
              aria-disabled={continueDisabled || continueLoading}
            >
              {continueLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isFinalStep ? 'Creating Account...' : 'Validating...'}
                </>
              ) : (
                <>
                  {isFinalStep ? 'Complete Quote' : 'Continue'}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
