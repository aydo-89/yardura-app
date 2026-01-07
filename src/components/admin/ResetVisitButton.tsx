"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResetVisitButtonProps = {
  visitId: string;
  className?: string;
  onReset?: () => void;
};

const RESET_WARNING =
  "Reset this visit? This will delete all media, insights, communications, QA records, payouts/ledger entries, and reward events, and return the visit to SCHEDULED. This cannot be undone.";

export function ResetVisitButton({ visitId, className, onReset }: ResetVisitButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    const confirmed = window.confirm(RESET_WARNING);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/field-ops/visits/${visitId}/reset`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to reset visit");
      }
      toast.success("Visit reset successfully");
      if (onReset) {
        onReset();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("visit.reset", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset visit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleReset}
      disabled={submitting}
      className={cn(
        "gap-2 rounded-full border-brand-coral/50 bg-brand-coral/10 text-brand-coral hover:bg-brand-coral/20 dark:border-brand-coral/40 dark:bg-brand-coral/20 dark:text-brand-coral dark:hover:bg-brand-coral/30",
        className,
      )}
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      )}
      Reset Visit
    </Button>
  );
}
