"use client";

import { cn } from "@/lib/utils";

export type WellnessIndicator = "watch" | "monitor" | "vet_now";

const INDICATOR_STYLES: Record<
  WellnessIndicator,
  { label: string; className: string }
> = {
  watch: {
    label: "Watch",
    className: "border-emerald-400/40 text-emerald-200 bg-emerald-500/10",
  },
  monitor: {
    label: "Monitor",
    className: "border-amber-400/40 text-amber-200 bg-amber-500/10",
  },
  vet_now: {
    label: "Vet now",
    className: "border-rose-400/40 text-rose-200 bg-rose-500/10",
  },
};

type WellnessIndicatorPillProps = {
  indicator: WellnessIndicator;
  size?: "sm" | "md";
  className?: string;
};

export default function WellnessIndicatorPill({
  indicator,
  size = "sm",
  className,
}: WellnessIndicatorPillProps) {
  const style = INDICATOR_STYLES[indicator];
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[10px]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.24em]",
        sizeClass,
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
