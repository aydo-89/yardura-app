"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu, X, LogOut, HelpCircle, User } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import type { AppUserRole } from "@/lib/auth/roles";
import {
  ROLE_DISPLAY_NAME,
  extractActiveRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";

function useInitials(name?: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return "";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export default function MobileAppHeader() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<AppUserRole | null>(null);
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null);
  const initials = useInitials(session?.user?.name) || "Y";
  const activeRole = extractActiveRole(session);
  const availableRoles = session?.userRoles ?? [];
  const activeRoleLabel = activeRole ? ROLE_DISPLAY_NAME[activeRole] : "Customer";

  useEffect(() => {
    if (!menuOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/mobile/signin" });
  };

  const handleRoleChange = useCallback(
    async (role: AppUserRole) => {
      if (!session?.user || role === activeRole) {
        setMenuOpen(false);
        return;
      }

      try {
        setRoleSwitchError(null);
        setSwitchingRole(role);
        await update?.({ activeRole: role });
        setMenuOpen(false);

        if (role === "CUSTOMER") {
          router.replace("/mobile/dashboard");
        } else {
          router.replace(getDefaultRedirectForRole(role));
        }
      } catch (error) {
        console.error("[MobileAppHeader] Failed to switch roles", error);
        setRoleSwitchError("Unable to switch roles right now.");
      } finally {
        setSwitchingRole(null);
      }
    },
    [activeRole, router, session?.user, update],
  );

  return (
    <header className="relative z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="px-5 pt-3 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 font-semibold">
            {initials}
          </div>
          <div>
            <p className="text-sm text-slate-400">InsightScoop by Yardura</p>
            <p className="text-base font-semibold text-slate-100">Mobile dashboard</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+72px)] w-64 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200 font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {session?.user?.name ?? "Yardura member"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {session?.user?.email ?? "Signed in"}
                </p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300">
                  {activeRoleLabel} view
                </p>
              </div>
            </div>

            {availableRoles.length > 1 ? (
              <div className="mb-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Working view
                </p>
                <div className="mt-3 space-y-2">
                  {availableRoles.map((roleOption) => {
                    const isActiveOption = roleOption === activeRole;
                    const isSwitching = switchingRole === roleOption;
                    return (
                      <button
                        key={roleOption}
                        type="button"
                        disabled={isActiveOption || isSwitching}
                        onClick={() => handleRoleChange(roleOption)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-800/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/70 hover:text-white disabled:opacity-60"
                      >
                        <span>{ROLE_DISPLAY_NAME[roleOption]}</span>
                        <span className="text-xs text-emerald-300">
                          {isActiveOption
                            ? "Active"
                            : isSwitching
                              ? "Switching…"
                              : "Switch"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {roleSwitchError ? (
                  <p className="mt-2 text-xs text-rose-400">{roleSwitchError}</p>
                ) : null}
              </div>
            ) : null}

            <nav className="space-y-2 text-sm">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl border border-transparent bg-slate-800/30 px-3 py-2 text-slate-200 transition hover:border-slate-700 hover:bg-slate-800/60"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4" />
                Manage account
              </Link>
              <a
                href="mailto:support@yardura.com"
                className="flex items-center gap-3 rounded-xl border border-transparent bg-slate-800/20 px-3 py-2 text-slate-300 transition hover:border-slate-700 hover:bg-slate-800/50"
                onClick={() => setMenuOpen(false)}
              >
                <HelpCircle className="h-4 w-4" />
                Get support
              </a>
            </nav>

            <div className="mt-4 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
