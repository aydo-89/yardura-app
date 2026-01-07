"use client";

import { Loader2 } from "lucide-react";

export default function QuoteLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-coral mx-auto" />
        <p className="text-slate-600 dark:text-slate-300 text-sm">Loading quote...</p>
      </div>
    </div>
  );
}





