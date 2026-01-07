import { BookOpen, AlertCircle, Eye, Stethoscope } from "lucide-react";
import Image from "next/image";

import WellnessIndicatorPill, {
  type WellnessIndicator,
} from "@/components/dashboard/mobile/WellnessIndicatorPill";
import type { StoolLibraryEntry } from "@/data/stool-library";
import { cn } from "@/lib/utils";

const firmnessLabels = ["Very firm", "Firm", "Formed", "Ideal", "Soft", "Loose", "Watery"];

const indicatorConfig = {
  watch: { icon: Eye, label: "Normal", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  monitor: { icon: AlertCircle, label: "Monitor", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  vet_now: { icon: Stethoscope, label: "See Vet", bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
};

export default function MobileStoolLibrary({
  entries,
}: {
  entries: StoolLibraryEntry[];
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-500/10 p-2.5 ring-1 ring-amber-500/20">
            <BookOpen className="h-5 w-5 text-amber-400" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Visual Reference
            </p>
            <h2 className="text-xl font-bold text-white">
              Stool Library
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Compare examples to quickly assess your dog&apos;s digestive health.
            </p>
          </div>
        </div>
      </section>

      {/* Cards Grid */}
      <div className="grid gap-4">
        {entries.map((entry) => {
          const firmnessLabel = firmnessLabels[entry.firmnessScale - 1] ?? "—";
          const config = indicatorConfig[entry.indicator];
          const IndicatorIcon = config.icon;
          
          return (
            <article
              key={entry.id}
              className="group overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm transition-all hover:border-slate-700/60"
            >
              {/* Image Section - Hero style */}
              {entry.imageUrl ? (
                <div className="relative">
                  <div className="aspect-[16/10] w-full overflow-hidden bg-slate-950">
                    <Image
                      src={entry.imageUrl}
                      alt={entry.label}
                      width={800}
                      height={500}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      priority={false}
                    />
                  </div>
                  {/* Gradient overlay for text legibility */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/90 to-transparent" />
                  
                  {/* Status badge on image */}
                  <div className={cn(
                    "absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md",
                    config.bg, config.border, "border"
                  )}>
                    <IndicatorIcon className={cn("h-3 w-3", config.text)} />
                    <span className={config.text}>{config.label}</span>
                  </div>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center bg-slate-950/50">
                  <span className="text-sm text-slate-600">No image</span>
                </div>
              )}

              {/* Content Section */}
              <div className="space-y-4 p-4">
                {/* Title & Meta */}
                <div>
                  <h3 className="text-lg font-semibold text-white">{entry.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Firmness {entry.firmnessScale}/7 · {firmnessLabel}
                  </p>
                </div>

                {/* Summary & Guidance - Combined for cleaner look */}
                <div className="space-y-2 rounded-xl bg-slate-950/50 p-3.5">
                  <p className="text-sm leading-relaxed text-slate-300">{entry.summary}</p>
                  <p className="text-sm leading-relaxed text-slate-400">{entry.guidance}</p>
                </div>

                {/* Firmness Scale - Minimal */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600 mr-1">Firm</span>
                  {Array.from({ length: 7 }).map((_, index) => {
                    const level = index + 1;
                    const active = level <= entry.firmnessScale;
                    return (
                      <span
                        key={level}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          active ? "bg-amber-400" : "bg-slate-800",
                        )}
                      />
                    );
                  })}
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600 ml-1">Loose</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
