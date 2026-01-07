import React, { useState, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DisclosureProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  defaultOpen = false,
  children,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 ${className}`}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between p-4 h-auto font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
        aria-expanded={isOpen}
        aria-controls={`disclosure-content-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="size-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronRight className="size-4 text-slate-500 dark:text-slate-400" />
          )}
          {title}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {isOpen ? "Hide details" : "Show details"}
        </span>
      </Button>

      {isOpen && (
        <div
          id={`disclosure-content-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="px-4 pb-4"
        >
          {children}
        </div>
      )}
    </div>
  );
};
