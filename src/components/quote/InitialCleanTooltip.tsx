"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLTIP_COPY =
  "Initial cleans take longer because we clear built-up waste and reset the yard. We ask when it was last serviced so we can plan the deep reset - every follow-up visit is streamlined and priced significantly less per visit.";

type TooltipIconProps = {
  className?: string;
  iconClassName?: string;
};

export function InitialCleanTooltipIcon({ className, iconClassName }: TooltipIconProps) {
  const tooltipId = useId();

  return (
    <span
      className={cn(
        "group relative inline-flex items-center justify-center text-emerald-200/80 md:text-brand-muted",
        className,
      )}
      aria-label={TOOLTIP_COPY}
      role="img"
      aria-describedby={tooltipId}
    >
      <Info
        aria-hidden="true"
        className={cn(
          "size-4 text-inherit transition-colors group-hover:text-emerald-50 md:text-brand-muted/90 md:group-hover:text-brand-ink",
          iconClassName,
        )}
      />
      <span
        id={tooltipId}
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-[min(92vw,20rem)] -translate-x-1/2 rounded-2xl bg-[#0f1f25] px-4 py-3 text-xs font-medium leading-relaxed text-white opacity-0 shadow-[0_18px_35px_rgba(6,8,12,0.35)] ring-1 ring-white/10 transition-all duration-150 group-hover:flex group-hover:opacity-100 group-focus-visible:flex"
      >
        {TOOLTIP_COPY}
      </span>
    </span>
  );
}

type LabelProps = {
  label?: string;
  className?: string;
  iconClassName?: string;
};

export function InitialCleanLabel({ label = "Initial clean", className, iconClassName }: LabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <InitialCleanTooltipIcon iconClassName={iconClassName} />
    </span>
  );
}
