"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleSelector } from "@/components/onboarding/ScheduleSelector";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  zipCode: string;
  frequency: string;
  weekendUpgrade?: boolean;
  onSubmit: (payload: { date: string; window: string }) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

export default function MobileSkipModal({
  open,
  onOpenChange,
  zipCode,
  frequency,
  weekendUpgrade,
  onSubmit,
  submitting = false,
  error,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selectedWindow, setSelectedWindow] = useState("morning");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(error ?? null);
  }, [error]);

  const handleSubmit = async () => {
    if (!selectedDate) {
      setLocalError("Select a new visit date before confirming.");
      return;
    }
    setLocalError(null);
    try {
      await onSubmit({ date: selectedDate, window: selectedWindow });
    } catch (submissionError) {
      console.error("Skip modal submission failed", submissionError);
      setLocalError("Unable to reschedule right now. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-100 text-lg">
            Reschedule your visit
          </DialogTitle>
        </DialogHeader>
        <ScheduleSelector
          zipCode={zipCode}
          frequency={frequency as any}
          weekendUpgrade={weekendUpgrade}
          selectedDate={selectedDate}
          onDateSelected={setSelectedDate}
          selectedWindow={selectedWindow as any}
          onWindowSelected={(window) => setSelectedWindow(window)}
          mode="reschedule"
        />
        {localError && <p className="text-sm text-red-400 mt-3">{localError}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-brand-mint text-slate-900 font-semibold py-3"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
