"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileSkipCard from "./MobileSkipCard";
import MobileSkipModal from "./MobileSkipModal";

interface Props {
  zipCode?: string | null;
  visitId?: string | null;
  frequency?: string | null;
  weekendUpgrade?: boolean | null;
}

export default function MobileSkipAction({
  zipCode,
  visitId,
  frequency,
  weekendUpgrade,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async ({ date }: { date: string; window: string }) => {
    if (!visitId) {
      throw new Error("Visit not available");
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/schedule/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId,
          action: "reschedule",
          nextVisitAt: date,
          preferredWindow: window,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to reschedule");
      }

      router.refresh();
      setOpen(false);
    } catch (err: unknown) {
      console.error("Mobile skip action failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reschedule right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!visitId) {
    return (
      <MobileSkipCard
        zipCode={zipCode}
        onClick={() => {}}
        loading={false}
        disabled
        helperText="No upcoming visit available to reschedule yet."
      />
    );
  }

  return (
    <>
      <MobileSkipCard
        zipCode={zipCode}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        loading={submitting}
      />
      <MobileSkipModal
        open={open}
        onOpenChange={(value) => {
          if (!submitting) {
            setOpen(value);
            setError(null);
          }
        }}
        zipCode={zipCode ?? ""}
        frequency={(frequency ?? "weekly") as any}
        weekendUpgrade={Boolean(weekendUpgrade)}
        onSubmit={handleSubmit}
        error={error}
        submitting={submitting}
      />
    </>
  );
}
