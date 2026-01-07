"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Menu, X, PhoneCall, LogIn, Sun, Moon, MapPin } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useTheme } from "@/components/theme/ThemeProvider";

const navItems = [
  { href: "/#services", label: "Services" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/city", label: "Cities", icon: MapPin },
  { href: "/#eco", label: "Eco" },
  { href: "/#insights", label: "Insights" },
  { href: "/#faq", label: "FAQ" },
];

export function QuoteWizardHeader() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const handleNavClick = (label: string) => {
    track("nav_click", { location: "quote_header", label });
    setOpen(false);
  };

  const ThemeModeButton = () => (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 dark:border-emerald-400/40 dark:bg-white/10 dark:text-emerald-50"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="hidden xl:inline">{isDark ? "Dark" : "Light"} mode</span>
    </button>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] border-b border-brand-coral/15 bg-cream-porcelain/90 text-brand-ink shadow-lg backdrop-blur-md dark:border-emerald-500/30 dark:bg-[#050b08]/90 dark:text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/30 via-white/10 to-transparent dark:from-[#06150f]/60 dark:via-[#03150d]/70 dark:to-transparent" />
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 text-sm font-semibold"
          onClick={() => track("nav_click", { location: "quote_header", label: "logo" })}
        >
          <Image
            src="/brand/insightscoop-logo-horizontal.png"
            alt="InsightScoop"
            width={156}
            height={36}
            className="hidden h-9 w-auto object-contain md:block"
            priority
          />
          <Image
            src="/brand/insightscoop-logo-stacked.png"
            alt="InsightScoop"
            width={120}
            height={36}
            className="h-9 w-auto object-contain md:hidden"
            priority
          />
        </Link>

        <div className="hidden items-center gap-4 text-sm md:flex">
          <div className="flex items-center gap-1 rounded-full border border-[rgba(20,92,69,0.18)] bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold text-[0.85rem] text-[rgba(var(--graphite-rgb-commas),0.7)] transition hover:bg-[rgba(var(--vanilla-rgb-commas),0.6)] hover:text-brand-ink dark:text-emerald-50/80 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => track("nav_click", { location: "quote_header", label: item.label })}
              >
                {item.icon && <item.icon className="h-3.5 w-3.5" />}
                {item.label}
              </Link>
            ))}
          </div>
          <ThemeModeButton />
          <Link
            href="tel:181741779273"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#145c45] to-[#1bbf89] px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:translate-y-[-2px] hover:shadow-xl dark:from-emerald-500/70 dark:to-teal-400/70"
            onClick={() => track("header_phone_call", { location: "quote_header" })}
          >
            <PhoneCall className="h-4 w-4" /> 1-877-417-YARD
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[rgba(var(--graphite-rgb-commas),0.65)] transition hover:text-[#145c45] dark:text-emerald-100/80 dark:hover:text-white"
            onClick={() => track("cta_header_login", { location: "quote_header" })}
          >
            <LogIn className="h-4 w-4" /> Login
          </Link>
        </div>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/30 p-2 text-brand-ink shadow-sm dark:border-emerald-500/40 dark:bg-white/10 dark:text-emerald-50"
                aria-label="Open navigation"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="z-[1100] flex h-full w-72 flex-col bg-[#0b1e16] px-0 py-6 text-emerald-50"
            >
              <SheetHeader className="px-6 text-left">
                <SheetTitle className="text-base font-semibold text-emerald-50">
                  Menu
                </SheetTitle>
                <SheetDescription className="text-xs text-emerald-200/70">
                  Quick links while you finish your quote.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block text-sm font-medium text-emerald-100/90 hover:text-white"
                    onClick={() => handleNavClick(item.label)}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="pt-4">
                  <ThemeModeButton />
                </div>
              </div>
              <div className="mt-auto space-y-3 px-6 pb-6">
                <Button
                  variant="outline"
                  className="w-full border-emerald-300/50 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25"
                  asChild
                >
                  <Link
                    href="tel:181741779273"
                    onClick={() => handleNavClick("call")}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" /> Call 1-877-417-YARD
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-emerald-100 hover:text-white"
                  asChild
                >
                  <Link href="/signin" onClick={() => handleNavClick("login")}>Log in</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
