import React, { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg bg-white ${className}`}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between p-4 h-auto font-medium text-left hover:bg-slate-50"
        aria-expanded={isOpen}
        aria-controls={`disclosure-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="size-4 text-slate-500" />
          ) : (
            <ChevronRight className="size-4 text-slate-500" />
          )}
          {title}
        </span>
        <span className="text-sm text-slate-500">{isOpen ? 'Hide details' : 'Show details'}</span>
      </Button>

      {isOpen && (
        <div
          id={`disclosure-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="px-4 pb-4"
        >
          {children}
        </div>
      )}
    </div>
  );
};
