"use client";

import { cn } from "@/lib/utils";

interface FirstWeekCreditBannerProps {
  amount: string;
  descriptor?: string | null;
  subtext?: string;
  className?: string;
  headline?: string;
  variant?: "week" | "year";
  badgeText?: string;
  tone?: "light" | "dark";
  showAmount?: boolean;
  netAmount?: string | null;
}

const variantStyles = {
  week: {
    border: "border-emerald-500",
    headline: "text-emerald-700",
    amount: "text-emerald-600",
    shadow: "shadow-[0_14px_28px_rgba(16,185,129,0.25)]",
    badge: "bg-emerald-100 text-emerald-700",
    badgeDark: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-50",
    accentGlow: "after:bg-emerald-400/20",
  },
  year: {
    border: "border-amber-500",
    headline: "text-amber-700",
    amount: "text-amber-600",
    shadow: "shadow-[0_14px_28px_rgba(251,191,36,0.25)]",
    badge: "bg-amber-100 text-amber-700",
    badgeDark: "bg-amber-100 text-amber-700 dark:bg-amber-400/25 dark:text-amber-50",
    accentGlow: "after:bg-amber-400/25",
  },
} as const;

export function FirstWeekCreditBanner({
  amount,
  descriptor,
  subtext = "Submit your quote now to lock these first-week credits when you start service.",
  className,
  headline = "First-week coverage",
  variant = "week",
  badgeText = "FREE",
  tone = "light",
  showAmount = true,
  netAmount = null,
}: FirstWeekCreditBannerProps) {
  const styles = variantStyles[variant];
  // Responsive base class:
  // - Mobile: always dark emerald
  // - Desktop light mode (md:): white background
  // - Desktop dark mode (md:dark:): dark emerald
  const baseClass =
    tone === "dark"
      ? "rounded-3xl border-2 bg-[#102f24] text-emerald-50 shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:bg-white md:text-brand-ink md:shadow-[0_14px_28px_rgba(16,185,129,0.25)] md:dark:bg-[#102f24] md:dark:text-emerald-50 md:dark:shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
      : "rounded-3xl border-2 bg-white text-brand-ink";
  // Responsive badge: dark on mobile, light on md+ light mode, dark on md+ dark mode
  const badgeClass =
    tone === "dark"
      ? cn(styles.badgeDark, "md:bg-emerald-100 md:text-emerald-700 md:dark:bg-emerald-500/20 md:dark:text-emerald-50")
      : styles.badge;
  const darkHeadlineClass =
    variant === "week"
      ? "text-emerald-200 md:text-emerald-700 md:dark:text-emerald-200"
      : "text-amber-200 md:text-amber-700 md:dark:text-amber-200";
  const darkDescriptorClass =
    variant === "week"
      ? "text-emerald-100/85 md:text-brand-ink md:dark:text-emerald-100/85"
      : "text-amber-100/85 md:text-brand-ink md:dark:text-amber-100/85";
  const darkSubtextClass =
    variant === "week"
      ? "text-emerald-100/70 md:text-brand-ink md:dark:text-emerald-100/70"
      : "text-amber-100/70 md:text-brand-ink md:dark:text-amber-100/70";
  const darkNetAmountClass =
    variant === "week"
      ? "text-emerald-50 md:text-brand-ink md:dark:text-emerald-50"
      : "text-amber-50 md:text-brand-ink md:dark:text-amber-50";
  const headlineClass =
    tone === "dark" ? darkHeadlineClass : styles.headline;
  const amountClass = (() => {
    if (tone !== "dark") {
      return styles.amount;
    }

    if (variant === "week") {
      return "text-emerald-200 md:text-emerald-600 md:dark:text-emerald-200";
    }

    return "text-amber-200 md:text-amber-600 md:dark:text-amber-200";
  })();
  const descriptorClass =
    tone === "dark" ? darkDescriptorClass : "text-brand-ink";
  const subtextClass =
    tone === "dark" ? darkSubtextClass : "text-brand-ink";
  const netAmountClass =
    tone === "dark" ? darkNetAmountClass : "text-brand-ink";

  return (
    <div
      className={cn(
        baseClass,
        styles.border,
        tone === "light" && styles.shadow,
        "relative overflow-hidden p-5 sm:p-6",
        "after:pointer-events-none after:absolute after:-right-8 after:top-1/2 after:h-40 after:w-40 after:-translate-y-1/2 after:rounded-full after:content-['']",
        styles.accentGlow,
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.32em]">
        <span className={headlineClass}>{headline}</span>
        {badgeText ? (
          <span
            className={cn(
              "rounded-full px-4 py-1.5 text-[0.68rem] font-black",
              badgeClass,
            )}
          >
            {badgeText}
          </span>
        ) : null}
      </div>
      {showAmount ? (
        <div className="mt-3 flex items-center gap-2 text-3xl font-black sm:text-4xl">
          <span className={cn("relative inline-flex", amountClass)}>
            <span className="relative z-10">{amount}</span>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 top-1/2 block h-[3px] -translate-y-1/2 rounded bg-current opacity-85",
                tone === "dark" ? "md:opacity-90" : "",
              )}
            />
          </span>
          {netAmount ? (
            <span className={cn("text-lg font-semibold", netAmountClass)}>
              {netAmount}
            </span>
          ) : null}
        </div>
      ) : null}
      {!showAmount && netAmount ? (
        <div className={cn("mt-3 text-3xl font-black sm:text-4xl", netAmountClass)}>
          {netAmount}
        </div>
      ) : null}
      {descriptor ? (
        <p className={cn("mt-2 text-sm font-semibold", descriptorClass)}>{descriptor}</p>
      ) : null}
      <p className={cn("mt-3 text-xs font-semibold", subtextClass)}>
        {subtext}
      </p>
    </div>
  );
}
