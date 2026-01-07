import React from "react";
import { CheckCircle, Eye, AlertTriangle } from "lucide-react";
import { withAlpha } from "@/shared/brand";
import {
  wellnessTheme,
  type WellnessSimpleStatus,
  type WellnessStatus,
} from "@/shared/wellness";

interface StatusPillProps {
  status: WellnessSimpleStatus | WellnessStatus;
  className?: string;
  size?: "sm" | "md";
}

// Map old status types to new ones
const mapStatus = (
  status: WellnessSimpleStatus | WellnessStatus | "normal" | "action",
): keyof typeof statusConfig => {
  switch (status) {
    case "normal":
    case "good":
      return "good";
    case "monitor":
      return "monitor";
    case "action":
    case "attention":
      return "attention";
    default:
      return "good";
  }
};

const statusConfig = {
  good: {
    icon: CheckCircle,
    label: "All good",
    bgColor: wellnessTheme.colors.green,
    textColor: "#F4FFFB",
  },
  monitor: {
    icon: Eye,
    label: "Monitor",
    bgColor: wellnessTheme.colors.yellow,
    textColor: wellnessTheme.slate800,
  },
  attention: {
    icon: AlertTriangle,
    label: "Needs attention",
    bgColor: wellnessTheme.colors.red,
    textColor: wellnessTheme.slate800,
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  className = "",
  size = "sm",
}) => {
  const mappedStatus = mapStatus(status);
  const config = statusConfig[mappedStatus];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  };

  const iconSizeClasses = {
    sm: "size-3",
    md: "size-4",
  };

  const backgroundColor =
    mappedStatus === "good"
      ? withAlpha(config.bgColor, 0.38)
      : withAlpha(config.bgColor, 0.22);

  const borderColor =
    mappedStatus === "good"
      ? withAlpha(config.bgColor, 0.6)
      : withAlpha(config.bgColor, 0.35);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor,
        color: config.textColor,
        borderColor,
      }}
    >
      <Icon className={iconSizeClasses[size]} aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
};
