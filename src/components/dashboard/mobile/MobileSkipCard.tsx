"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";

interface Props {
  zipCode?: string | null;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export default function MobileSkipCard({
  zipCode,
  onClick,
  loading = false,
  disabled = false,
  helperText,
}: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
      return;
    }
    router.push("/dashboard/skip?source=mobile");
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`w-full bg-gradient-to-br from-brand-mint/20 via-brand-mint/10 to-transparent border border-brand-mint/40 rounded-2xl px-4 py-5 text-left transition ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:border-brand-mint/80"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-mint">
            Need to reschedule?
          </p>
          <p className="text-base font-semibold text-white">
            Skip or move your next visit
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {helperText || `We’ll offer slots based on your ZIP ${zipCode ?? ""}`}
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-brand-mint" />
        ) : (
          <CalendarClock className="h-6 w-6 text-brand-mint" />
        )}
      </div>
    </button>
  );
}
