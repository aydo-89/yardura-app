import React from "react";
import { TONE_GREEN, TONE_AMBER, TONE_RED } from "@/shared/wellness";

interface LegendItem {
  label: string;
  tone: "green" | "amber" | "red";
}

interface LegendProps {
  items?: LegendItem[];
  className?: string;
}

const defaultItems: LegendItem[] = [
  { label: "Normal", tone: "green" },
  { label: "Monitor", tone: "amber" },
  { label: "Action needed", tone: "red" },
];

export const Legend: React.FC<LegendProps> = ({
  items = defaultItems,
  className = "",
}) => {
  const getToneColor = (tone: string) => {
    switch (tone) {
      case "green":
        return TONE_GREEN;
      case "amber":
        return TONE_AMBER;
      case "red":
        return TONE_RED;
      default:
        return TONE_GREEN;
    }
  };

  return (
    <div className={`flex flex-wrap justify-center gap-4 text-xs ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: getToneColor(item.tone) }}
            aria-hidden="true"
          />
          <span className="text-slate-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
