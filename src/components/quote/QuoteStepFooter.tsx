"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuoteStepFooterProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  showBack?: boolean;
  isFinalStep?: boolean;
  minimal?: boolean;
  className?: string;
  showReset?: boolean;
  onReset?: () => void;
  resetDisabled?: boolean;
  finalCtaLabel?: string;
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
  minimal = false,
  className,
  showReset = false,
  onReset,
  resetDisabled = false,
  finalCtaLabel,
}) => {
  const hasReset = showReset && typeof onReset === "function";
  const hasLeftControls = hasReset || showBack;

  const resetButton = hasReset ? (
    <Button
      variant="ghost"
      size={minimal ? "sm" : "default"}
      onClick={onReset}
      disabled={resetDisabled || continueLoading}
      className="flex items-center justify-center gap-1 w-full rounded-2xl text-brand-muted hover:text-brand-ink hover:bg-brand-soft/40 dark:text-cream-vanilla/80 dark:hover:text-cream-vanilla dark:hover:bg-white/10 md:w-auto md:rounded-full"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Clear & Start Over
    </Button>
  ) : null;

  const backButton = showBack ? (
    <Button
      variant="outline"
      size={minimal ? "sm" : "default"}
      onClick={onBack}
      className={cn(
        "flex items-center justify-center gap-1 rounded-2xl border border-slate-300 bg-white/80 px-4 py-1.5 text-brand-ink transition hover:bg-slate-100 hover:text-brand-ink w-full dark:border-brand-coral/40 dark:bg-transparent dark:text-cream-vanilla dark:hover:bg-brand-coral/15 dark:hover:text-cream-vanilla md:w-auto md:justify-start md:rounded-full",
        !minimal && "px-6 py-2.5",
      )}
      disabled={continueLoading}
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      Back
    </Button>
  ) : null;

  const continueButton = (
    <Button
      onClick={onContinue}
      disabled={continueDisabled || continueLoading}
      className={cn(
        "flex items-center gap-2 rounded-2xl bg-brand-coral text-white transition hover:bg-brand-coral-ink focus-visible:ring-brand-coral/40 disabled:cursor-not-allowed disabled:bg-brand-coral/30 disabled:text-cream-vanilla/70 md:rounded-full md:bg-brand-coral md:text-white md:hover:bg-brand-coral-ink md:disabled:bg-brand-coral/30 md:disabled:text-cream-vanilla/70 dark:md:bg-brand-coral dark:md:text-white dark:md:hover:bg-brand-coral-ink",
        minimal
          ? "px-5 py-1.5 justify-center w-full md:w-auto"
          : "px-8 py-2.5",
      )}
      aria-disabled={continueDisabled || continueLoading}
    >
      {continueLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {isFinalStep ? "Processing quote..." : "Validating..."}
        </>
      ) : (
        <>
          <span>
            {isFinalStep ? finalCtaLabel ?? "Complete Quote" : "Continue"}
          </span>
          <ChevronRight className="w-4 h-4" />
        </>
      )}
    </Button>
  );

  if (minimal) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 md:flex-row md:items-center",
          hasLeftControls ? "md:justify-between" : "md:justify-end",
          className,
        )}
      >
        {hasLeftControls ? (
          <div className="flex flex-col gap-2 sm:flex-row md:w-auto md:flex-row md:items-center">
            {resetButton ? <div className="w-full md:w-auto">{resetButton}</div> : null}
            {backButton ? <div className="w-full md:w-auto">{backButton}</div> : null}
          </div>
        ) : null}

        <div className="w-full md:w-auto">{continueButton}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 border-t backdrop-blur-sm",
        "border-brand-coral/15 bg-cream-porcelain/95 shadow-lg",
        "dark:border-brand-coral/30 dark:bg-[#07140F]/95 dark:shadow-[0_-6px_20px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-3 w-full max-w-3xl mx-auto">
          {/* Step indicator */}
          <div className="text-sm font-medium text-slate-600 text-center dark:text-cream-vanilla/80">
            Step {currentStep + 1} of {totalSteps}
          </div>

          {/* Progress bar */}
          <div className="w-full rounded-full h-1.5 bg-slate-200 dark:bg-brand-coral/20">
            <div
              className="h-1.5 rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-brand-coral to-gold"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between w-full">
            {hasLeftControls ? (
              <div className="flex items-center gap-2">
                {resetButton}
                {backButton}
              </div>
            ) : (
              <div />
            )}

            {continueButton}
          </div>
        </div>
      </div>
    </div>
  );
};
