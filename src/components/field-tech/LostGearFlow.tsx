"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Package, ChevronLeft, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface GearItem {
  id: string;
  name: string;
  cost: number;
  required: boolean;
}

const GEAR_ITEMS: GearItem[] = [
  { id: "badge", name: "InsightScoop Badge", cost: 15, required: true },
  { id: "hat", name: "Company Hat", cost: 20, required: true },
  { id: "vest", name: "Safety Vest/PPE", cost: 25, required: true },
  { id: "shirt", name: "Company Shirt", cost: 30, required: false },
  { id: "pants", name: "Company Pants", cost: 35, required: false },
];

interface LostGearFlowProps {
  onCancel: () => void;
  onOrderAndContinue: (missingItems: string[], totalCost: number) => Promise<void>;
  onReturnJobs: () => Promise<void>;
  scheduledJobsCount: number;
}

export function LostGearFlow({
  onCancel,
  onOrderAndContinue,
  onReturnJobs,
  scheduledJobsCount,
}: LostGearFlowProps) {
  const [step, setStep] = useState<"report" | "options" | "confirm-order" | "confirm-return">("report");
  const [missingItems, setMissingItems] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const totalCost = Array.from(missingItems).reduce((sum, itemId) => {
    const item = GEAR_ITEMS.find((g) => g.id === itemId);
    return sum + (item?.cost ?? 0);
  }, 0);

  const hasRequiredItemsMissing = Array.from(missingItems).some((itemId) =>
    GEAR_ITEMS.find((g) => g.id === itemId)?.required
  );

  const toggleItem = useCallback((itemId: string) => {
    setMissingItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleContinueToOptions = useCallback(() => {
    if (missingItems.size === 0) {
      toast.error("Please select at least one missing item");
      return;
    }
    setStep("options");
  }, [missingItems]);

  const handleOrderAndContinue = useCallback(async () => {
    setProcessing(true);
    try {
      await onOrderAndContinue(Array.from(missingItems), totalCost);
      toast.success("Gear ordered  -  you can start your route");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to order gear");
    } finally {
      setProcessing(false);
    }
  }, [missingItems, totalCost, onOrderAndContinue]);

  const handleReturnJobs = useCallback(async () => {
    setProcessing(true);
    try {
      await onReturnJobs();
      toast.success("Jobs returned to board");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to return jobs");
    } finally {
      setProcessing(false);
    }
  }, [onReturnJobs]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          {step !== "report" && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white"
              onClick={() => {
                if (step === "options") setStep("report");
                else if (step === "confirm-order" || step === "confirm-return") setStep("options");
              }}
              disabled={processing}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {step === "report" && "Report Missing Gear"}
              {step === "options" && "Choose an Option"}
              {step === "confirm-order" && "Confirm Order"}
              {step === "confirm-return" && "Confirm Return Jobs"}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {step === "report" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-300 mx-auto mb-2" />
              <p className="text-sm text-amber-200 font-semibold mb-1">
                Missing required gear?
              </p>
              <p className="text-xs text-amber-300/70">
                Select what you're missing below. We'll help you get back to work.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white/90">Select missing items:</p>
              {GEAR_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:border-white/20 transition"
                >
                  <Checkbox
                    checked={missingItems.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{item.name}</span>
                      {item.required && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-1">Replacement cost: ${item.cost}</p>
                  </div>
                </label>
              ))}
            </div>

            {missingItems.size > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Total replacement cost:</span>
                  <span className="text-xl font-bold text-white">${totalCost}</span>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  Deducted from future payouts over the next {Math.ceil(totalCost / 20)} weeks
                </p>
              </div>
            )}

            <Button
              onClick={handleContinueToOptions}
              disabled={missingItems.size === 0}
              className="w-full h-12 rounded-2xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-50"
            >
              Continue
            </Button>
          </div>
        )}

        {step === "options" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3 mb-3">
                <Package className="h-5 w-5 text-white/70 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">Missing Items:</p>
                  <ul className="text-xs text-white/70 space-y-1">
                    {Array.from(missingItems).map((itemId) => {
                      const item = GEAR_ITEMS.find((g) => g.id === itemId);
                      return (
                        <li key={itemId}>
                          • {item?.name} (${item?.cost})
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm text-white/70">Total:</span>
                <span className="text-lg font-bold text-white">${totalCost}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white/90">Choose how to proceed:</p>

              <button
                onClick={() => setStep("confirm-order")}
                className="w-full text-left rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 hover:border-emerald-400/50 hover:bg-emerald-500/20 transition group"
              >
                <div className="flex items-start gap-3">
                  <DollarSign className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-base font-semibold text-emerald-200 mb-1 group-hover:text-emerald-100">
                      Order Replacement Gear
                    </p>
                    <p className="text-sm text-emerald-300/70 mb-2">
                      We'll ship new gear to you and deduct ${totalCost} from your next{" "}
                      {Math.ceil(totalCost / 20)} payout{Math.ceil(totalCost / 20) > 1 ? "s" : ""}.
                    </p>
                    <p className="text-xs text-emerald-400 font-medium">
                      ✓ Keep your {scheduledJobsCount} scheduled {scheduledJobsCount === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep("confirm-return")}
                className="w-full text-left rounded-2xl border border-red-400/30 bg-red-500/10 p-5 hover:border-red-400/50 hover:bg-red-500/20 transition group"
              >
                <div className="flex items-start gap-3">
                  <Calendar className="h-6 w-6 text-red-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-base font-semibold text-red-200 mb-1 group-hover:text-red-100">
                      Return Jobs to Board
                    </p>
                    <p className="text-sm text-red-300/70 mb-2">
                      Release your {scheduledJobsCount} accepted {scheduledJobsCount === 1 ? "job" : "jobs"} back to
                      the job board. No gear cost charged.
                    </p>
                    <p className="text-xs text-red-400 font-medium">
                      ⚠ Other scoopers can claim these jobs immediately
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "confirm-order" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
              <Package className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-emerald-200 mb-2">Confirm Gear Order</p>
              <p className="text-sm text-emerald-300/70">
                We'll ship your replacement gear within 2-3 business days.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Items:</span>
                  <span className="text-white">{missingItems.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Total cost:</span>
                  <span className="text-white font-semibold">${totalCost}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-white/70">Deduction:</span>
                  <span className="text-white">
                    ${Math.min(20, totalCost)}/week for {Math.ceil(totalCost / 20)} week
                    {Math.ceil(totalCost / 20) > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60 leading-relaxed">
                  By confirming, you authorize ${totalCost} to be deducted from your future payouts. Your
                  replacement gear will be shipped to your registered address. You can proceed with today's route
                  using temporary identification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setStep("options")}
                variant="outline"
                disabled={processing}
                className="h-12 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handleOrderAndContinue}
                disabled={processing}
                className="h-12 rounded-2xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
              >
                {processing ? "Processing..." : "Confirm & Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "confirm-return" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-red-200 mb-2">Return Jobs to Board?</p>
              <p className="text-sm text-red-300/70">
                This action cannot be undone. Jobs may be claimed by other scoopers immediately.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">
                You're about to return {scheduledJobsCount} {scheduledJobsCount === 1 ? "job" : "jobs"}:
              </p>
              <ul className="text-xs text-white/70 space-y-1.5 pl-4">
                <li>• Jobs will appear on the board for others to claim</li>
                <li>• You won't be charged for replacement gear</li>
                <li>• You can re-claim jobs if still available</li>
                <li>• Complete your check-in when you have proper gear</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setStep("options")}
                variant="outline"
                disabled={processing}
                className="h-12 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handleReturnJobs}
                disabled={processing}
                className="h-12 rounded-2xl bg-red-500 text-white font-semibold hover:bg-red-400"
              >
                {processing ? "Returning..." : "Return Jobs"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

















