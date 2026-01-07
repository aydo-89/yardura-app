"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Menu,
  X,
  LogOut,
  PhoneCall,
  Shield,
  Moon,
  Sun,
  ChevronDown,
} from "lucide-react";

import { useTheme } from "@/components/theme/ThemeProvider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getNavigationForRole,
  type RoleNavItem,
} from "@/lib/navigation/role-navigation";
import {
  ROLE_DISPLAY_NAME,
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";

const MAX_PRIMARY_LINKS = 6;

export default function UserHeader({ className }: { className?: string }) {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<AppUserRole | null>(null);
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerSurface = isDark
    ? "bg-gradient-to-r from-slate-950/95 via-slate-950/90 to-slate-900/85 border-white/10"
    : "bg-gradient-to-r from-white/95 via-white/92 to-emerald-50/85 border-slate-200/60";
  const pillSurface = isDark
    ? "border-white/10 bg-slate-900/60"
    : "border-slate-200/70 bg-white/80";

  if (status === "loading") {
    return (
      <header
        className={cn(
          "sticky top-0 z-40 backdrop-blur",
          headerSurface,
          className,
        )}
      >
        <div className="container h-16 flex items-center justify-center">
          <div className={cn("h-8 w-32 animate-pulse rounded", isDark ? "bg-slate-800" : "bg-slate-200")} />
        </div>
      </header>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const activeRole = extractActiveRole(session);
  const availableRoles = extractUserRoles(session);
  const navRole = useMemo<AppUserRole | null>(() => {
    if (pathname?.startsWith("/admin")) {
      return activeRole === "OWNER" ? "OWNER" : "ADMIN";
    }
    if (pathname?.startsWith("/field-tech")) {
      return "TECH";
    }
    if (pathname?.startsWith("/dashboard")) {
      return "CUSTOMER";
    }
    return activeRole;
  }, [activeRole, pathname]);
  const isCustomer = navRole === "CUSTOMER";
  const navConfig = getNavigationForRole(navRole);
  const extendedNavConfig = navConfig.extendedNav ?? [];

  const primaryNav = useMemo(() => {
    if (isCustomer) return [] as RoleNavItem[];
    const base = navConfig.primaryNav.map((item) => ({ ...item }));
    if (activeRole === "OWNER" && user.email === "ayden@yardura.com") {
      base.push({
        href: "/admin/god-mode",
        label: "God mode",
        icon: Shield,
        description: "Advanced diagnostics",
      });
    }
    return base;
  }, [isCustomer, navConfig.primaryNav, activeRole, user.email]);

  const visiblePrimaryNav = useMemo(() => {
    if (isCustomer) return [] as RoleNavItem[];
    return primaryNav.slice(0, MAX_PRIMARY_LINKS);
  }, [isCustomer, primaryNav]);

  const overflowPrimaryNav = useMemo(() => {
    if (isCustomer) return [] as RoleNavItem[];
    return primaryNav.slice(MAX_PRIMARY_LINKS);
  }, [isCustomer, primaryNav]);

  const extendedNav = useMemo(() => {
    if (isCustomer) return [] as RoleNavItem[];
    return [...overflowPrimaryNav, ...extendedNavConfig].map((item) => ({ ...item }));
  }, [extendedNavConfig, overflowPrimaryNav, isCustomer]);

  const accountNav = navConfig.accountNav.map((item) => ({ ...item }));

  const handleRoleChange = useCallback(
    async (nextRole: AppUserRole) => {
      if (!session?.user || nextRole === activeRole) {
        setIsAccountOpen(false);
        return;
      }

      try {
        setRoleSwitchError(null);
        setSwitchingRole(nextRole);
        await update?.({ activeRole: nextRole });
        setIsAccountOpen(false);

        if (nextRole === "CUSTOMER") {
          router.replace("/dashboard");
        } else {
          router.replace(getDefaultRedirectForRole(nextRole));
        }
      } catch (error) {
        console.error("[UserHeader] Failed to switch roles", error);
        setRoleSwitchError("We couldn't switch roles right now. Try again.");
      } finally {
        setSwitchingRole(null);
      }
    },
    [activeRole, router, session?.user, update],
  );

  const combinedNav: RoleNavItem[] = [];
  const seen = new Set<string>();
  if (!isCustomer) {
    [...visiblePrimaryNav, ...extendedNav, ...accountNav].forEach((item) => {
      if (seen.has(item.href)) return;
      seen.add(item.href);
      combinedNav.push(item);
    });
  }

  const hasExtendedNav = extendedNav.length > 0;
  const inExtendedNav = hasExtendedNav
    ? extendedNav.some((item) => pathname?.startsWith(item.href))
    : false;

  const handleLogout = async () => {
    setIsAccountOpen(false);
    setIsNavOpen(false);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        localStorage.removeItem("quote-session-id");
        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .catch((cacheError) => {
              console.warn("Failed to clear caches", cacheError);
            });
        }
      } catch (storageError) {
        console.warn("Failed to clear local session state", storageError);
      }
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).catch((error) => {
        console.warn("Custom logout cookie clear failed", error);
      });

      await signOut({
        callbackUrl: `/?logout=${Date.now()}`,
        redirect: true,
      });
    } catch (error) {
      console.error("Logout error", error);
      if (typeof window !== "undefined") {
        window.location.href = `/?logout=${Date.now()}`;
      }
    }
  };

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-opacity-85 transition-shadow",
        headerSurface,
        isScrolled
          ? isDark
            ? "shadow-[0_25px_60px_-35px_rgba(16,185,129,0.5)]"
            : "shadow-[0_30px_55px_-35px_rgba(15,118,110,0.35)]"
          : "shadow-none",
        className,
      )}
    >
      <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/insightscoop-logo-horizontal.png"
              alt="InsightScoop logo"
              width={160}
              height={48}
              className="h-9 w-auto object-contain"
              priority
            />
            <div className="hidden lg:flex flex-col whitespace-nowrap text-[10px] text-muted-foreground tracking-wide leading-tight">
              <span className="inline-flex items-center gap-1">
                <span>by Yardura</span>
                <Image
                  src="/yardura-logo.png"
                  alt="Yardura"
                  width={12}
                  height={12}
                  className="h-3 w-3 rounded-sm object-contain"
                />
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle color theme"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sm transition",
                isDark
                  ? "bg-slate-900/80 text-slate-200 hover:border-emerald-400"
                  : "bg-white/80 text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-600",
              )}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setIsAccountOpen((open) => !open)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                isDark ? "bg-slate-800 text-white" : "bg-slate-900 text-white",
              )}
              aria-label="Open account menu"
            >
              {initials}
            </button>
            {!isCustomer && combinedNav.length > 0 ? (
              <button
                onClick={() => setIsNavOpen((open) => !open)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                  isDark
                    ? "border-white/10 text-slate-200 hover:bg-white/10"
                    : "border-slate-200/70 text-slate-600 hover:bg-emerald-50",
                )}
                aria-label="Toggle navigation"
              >
                {isNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            ) : null}
          </div>
        </div>

        {visiblePrimaryNav.length > 0 ? (
          <nav className="hidden lg:flex items-center justify-center">
            <div className={cn("flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-sm", pillSurface)}>
              {visiblePrimaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition",
                    pathname?.startsWith(item.href)
                      ? isDark
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-white text-emerald-700 shadow-sm"
                      : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {item.icon ? <item.icon className="h-4 w-4" /> : null}
                  {item.label}
                </Link>
              ))}
              {hasExtendedNav ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMoreOpen((open) => !open)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                      inExtendedNav || isMoreOpen
                        ? isDark
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-white text-emerald-700 shadow-sm"
                        : isDark
                          ? "text-slate-300 hover:text-white"
                          : "text-slate-600 hover:text-slate-900",
                    )}
                    aria-haspopup="menu"
                    aria-expanded={isMoreOpen}
                  >
                    More
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isMoreOpen ? "-scale-y-100" : "scale-y-100",
                      )}
                    />
                  </button>
                  {isMoreOpen ? (
                    <div
                      className={cn(
                        "absolute right-0 top-[calc(100%+12px)] z-40 w-72 rounded-3xl border p-4 shadow-2xl backdrop-blur",
                        isDark
                          ? "border-white/10 bg-slate-950/95"
                          : "border-slate-200/70 bg-white/95",
                      )}
                    >
                      <div className="space-y-1">
                        {extendedNav.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition",
                              pathname?.startsWith(item.href)
                                ? isDark
                                  ? "bg-white/10 text-white"
                                  : "bg-emerald-50 text-emerald-700"
                                : isDark
                                  ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700",
                            )}
                            onClick={() => setIsMoreOpen(false)}
                          >
                            {item.icon ? (
                              <item.icon
                                className={cn(
                                  "h-4 w-4",
                                  pathname?.startsWith(item.href)
                                    ? isDark
                                      ? "text-emerald-200"
                                      : "text-emerald-600"
                                    : isDark
                                      ? "text-slate-400"
                                      : "text-slate-400",
                                )}
                              />
                            ) : null}
                            <div className="flex-1">
                              <p className="font-semibold leading-tight">{item.label}</p>
                              {item.description ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </nav>
        ) : null}

        <div className="hidden items-center gap-3 lg:flex">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className={cn(
              "gap-2",
              isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <a href="tel:+18774179273">
              <PhoneCall className="size-4" />
              1-877-417-YARD
            </a>
          </Button>

          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle color theme"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sm transition",
              isDark
                ? "bg-slate-900/80 text-slate-200 hover:border-emerald-400"
                : "bg-white/80 text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-600",
            )}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setIsAccountOpen((open) => !open)}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              isDark ? "bg-slate-800 text-white" : "bg-slate-900 text-white",
            )}
            aria-label="Open account menu"
          >
            {initials}
          </button>
        </div>
      </div>

      {isAccountOpen ? (
        <div className="absolute right-6 top-[calc(100%+12px)] z-40 w-full max-w-xs overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 p-5 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/95 lg:right-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Signed in as
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {user.name ?? user.email}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{navConfig.displayName}</p>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Toggle dark mode</p>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="data-[state=checked]:bg-emerald-400"
              />
            </div>

            {availableRoles.length > 1 ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Working view</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Switch between admin, field, or customer experiences.</p>
                </div>
                <div className="space-y-2">
                  {availableRoles.map((roleOption) => {
                    const isActiveRole = roleOption === activeRole;
                    const isSwitching = switchingRole === roleOption;
                    return (
                      <button
                        key={roleOption}
                        type="button"
                        disabled={isActiveRole || isSwitching}
                        onClick={() => handleRoleChange(roleOption)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          isActiveRole
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/70 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-200/70 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-white",
                          isSwitching ? "opacity-60" : undefined,
                        )}
                      >
                        <span>{ROLE_DISPLAY_NAME[roleOption]}</span>
                        <span className="text-xs">
                          {isActiveRole
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
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400/90">{roleSwitchError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              {accountNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setIsAccountOpen(false)}
                >
                  {item.icon ? <item.icon className="h-4 w-4" /> : null}
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-emerald-400"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isCustomer && isNavOpen && combinedNav.length > 0 && (
        <div className={cn("border-t bg-white/98 backdrop-blur dark:bg-slate-950/95", isDark ? "border-white/10" : "border-slate-200/60")}
          aria-label="Mobile navigation"
        >
          <div className="space-y-1 px-4 py-3">
            {combinedNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2 transition",
                  isDark ? "hover:bg-white/10" : "hover:bg-emerald-50",
                )}
                onClick={() => setIsNavOpen(false)}
              >
                {item.icon ? (
                  <item.icon className={cn("size-4", isDark ? "text-emerald-200" : "text-emerald-600")} />
                ) : (
                  <div className={cn("size-2 rounded-full", isDark ? "bg-slate-400" : "bg-emerald-400/80")} />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-slate-100" : "text-slate-700",
                  )}
                >
                  {item.label}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
