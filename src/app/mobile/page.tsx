"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { AppUserRole } from "@/lib/auth/roles";
import { ROLE_DISPLAY_NAME, getDefaultRedirectForRole } from "@/lib/auth/roles";

const REDIRECT_DELAY_MS = 1200;
const PULSE_INTERVAL_MS = 360;

export default function MobileSplashPage() {
  const router = useRouter();
  const { status, data: session, update } = useSession();
  const [pulseIndex, setPulseIndex] = useState(0);
  const [isSwitchingRole, setIsSwitchingRole] = useState<AppUserRole | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPulseIndex((idx) => (idx + 1) % 3);
    }, PULSE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const availableRoles = useMemo(
    () => (session?.userRoles ?? []).filter(Boolean) as AppUserRole[],
    [session?.userRoles],
  );

  const resolveTargetForRole = useCallback((role?: AppUserRole | null) => {
    if (!role || role === "CUSTOMER") {
      return "/mobile/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech/schedule";
    }
    return getDefaultRedirectForRole(role);
  }, []);

  const hasMultipleRoles = availableRoles.length > 1;
  const activeRole = (session as any)?.activeRole as AppUserRole | null | undefined;

  const targetHref = useMemo(() => {
    if (status === "authenticated") {
      const activeRole = (session as any)?.activeRole as AppUserRole | null | undefined;
      return resolveTargetForRole(activeRole ?? availableRoles[0] ?? null);
    }
    return "/mobile/signin";
  }, [availableRoles, resolveTargetForRole, session, status]);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && hasMultipleRoles) {
      return;
    }
    const timeout = window.setTimeout(() => {
      router.replace(targetHref);
    }, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [hasMultipleRoles, router, status, targetHref]);

  const surfaceClass =
    theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900";

  const handleRoleSelect = async (role: AppUserRole) => {
    if (isSwitchingRole === role) return;
    setIsSwitchingRole(role);
    try {
      await update?.({ activeRole: role });
      router.replace(resolveTargetForRole(role));
    } catch (error) {
      console.error("[MobileSplash] Failed to switch role", error);
    } finally {
      setIsSwitchingRole(null);
    }
  };

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center ${surfaceClass}`}
    >
      <div className="relative mb-10 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-400/40 via-emerald-500/20 to-transparent blur-2xl" />
        <div className="relative flex h-full w-full items-center justify-center rounded-3xl border border-emerald-400/40 bg-slate-900/80 shadow-[0_0_25px_-10px_rgb(16,185,129)]">
          <Image
            src="/brand/insightscoop-logo-stacked.png"
            alt="InsightScoop"
            width={80}
            height={80}
            priority
            className="h-20 w-20 object-contain"
          />
        </div>
      </div>

      {status === "authenticated" && hasMultipleRoles ? (
        <div className="w-full max-w-sm space-y-6 px-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-emerald-200">Choose a view</p>
            <p className="text-sm text-slate-300/80">
              You have multiple access levels. Jump into the experience you need right now.
            </p>
          </div>

          <div className="space-y-3">
            {availableRoles.map((role) => {
              const isActive = role === activeRole;
              const isBusy = isSwitchingRole === role;
              const description =
                role === "CUSTOMER"
                  ? "Subscriber dashboard and visit controls"
                  : role === "TECH"
                    ? "Route, check-ins, and payout tools"
                    : "Admin & ops consoles";

              return (
                <button
                  key={role}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    isActive
                      ? "border-emerald-400 bg-emerald-500/10 text-white"
                      : "border-slate-700/70 bg-slate-900/60 text-slate-200 hover:border-emerald-400/60"
                  } ${isBusy ? "opacity-60" : ""}`}
                >
                  <p className="text-base font-semibold tracking-tight">
                    {ROLE_DISPLAY_NAME[role]}
                  </p>
                  <p className="text-sm text-slate-400">{description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.3em] text-emerald-300">
                    {isBusy ? "Switching…" : isActive ? "Current" : "Open"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-semibold text-emerald-200">
              InsightScoop by Yardura
            </p>
            <p className="max-w-[260px] text-sm text-slate-300/80">
              Preparing your mobile experience. We&apos;ll take you right to your dashboard once you&apos;re signed in.
            </p>
          </div>

          <div className="mt-12 flex items-center gap-2" aria-live="polite">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full bg-emerald-400 transition-opacity duration-200 ${index === pulseIndex ? "opacity-100" : "opacity-30"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
