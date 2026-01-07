"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import {
  CalendarDays,
  HandCoins,
  Sparkles,
  UserRound,
} from "lucide-react";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/field-tech/offers",
    label: "Offers",
    icon: Sparkles,
  },
  {
    href: "/field-tech/schedule",
    label: "Route",
    icon: CalendarDays,
  },
  {
    href: "/field-tech/earnings",
    label: "Earnings",
    icon: HandCoins,
  },
  {
    href: "/field-tech/profile",
    label: "Profile",
    icon: UserRound,
  },
] as const;

export default function FieldTechLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const showNavigation = pathname
    ? !pathname.startsWith("/field-tech/visits/") && !pathname.startsWith("/field-tech/apply")
    : true;
  const { theme } = useTheme();

  const appSurface = theme === "dark"
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-50 text-slate-900";
  const safeAreaSurface = theme === "dark" ? "bg-slate-950" : "bg-slate-50";
  const navSurface = theme === "dark"
    ? "border-slate-900/60 bg-slate-950/95"
    : "border-slate-200/70 bg-white/90";

  return (
    <div className={cn("field-tech-surface min-h-screen transition-colors", appSurface)}>
      <div className={cn("h-[env(safe-area-inset-top)]", safeAreaSurface)} />

      <MobileHeader title="Field Tech" />

      <main
        className={cn(
          "mx-auto flex w-full max-w-md flex-1 flex-col",
          showNavigation ? "pb-[5.5rem]" : "pb-0",
        )}
      >
        {children}
      </main>

      {showNavigation ? (
        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-opacity-80",
            navSurface,
          )}
        >
          <div className="mx-auto grid w-full max-w-md grid-cols-4 items-center px-6 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              const activeColor = theme === "dark" ? "text-emerald-300" : "text-emerald-500";
              const idleColor = theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-900";
              const iconIdle = theme === "dark" ? "text-slate-500" : "text-slate-400";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 text-xs transition",
                    active ? activeColor : idleColor,
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      active ? activeColor : iconIdle,
                    )}
                  />
                  <span className="font-medium tracking-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
