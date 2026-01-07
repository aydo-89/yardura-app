"use client";

import { useState, useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  LayoutGroup,
} from "framer-motion";
import { PhoneCall, Menu, X, LucideIcon, MapPin, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { EventType, track } from "@/lib/analytics";
import { spring, dur } from "@/lib/motion/presets";
import Link from "next/link";
import { useTheme } from "@/components/theme/ThemeProvider";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  id: string;
  icon?: LucideIcon;
};

export default function AnimatedHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname() ?? "/";
  const isWellnessLanding = pathname.startsWith("/wellness");
  const isOurStory = pathname.startsWith("/our-story");
  const isDark = theme === "dark";

  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useReducedMotionSafe();

  const sectionIds = isWellnessLanding
    ? ["hero", "features", "toolkit", "plans", "pro", "reports", "download"]
    : ["hero", "services", "pricing", "eco", "insights", "faq", "cities"];
  const scrollActiveId = useActiveSection(sectionIds);
  const activeId = isOurStory ? "our-story" : scrollActiveId;

  // Transform values for scroll-based animations
  const headerHeight = useTransform(scrollY, [0, 120], [72, 56]);
  const logoScale = useTransform(scrollY, [0, 120], [1, 0.96]);
  const backdropBlur = useTransform(scrollY, [0, 120], [0, 6]);
  const headerOpacity = useTransform(scrollY, [0, 120], [0.98, 0.92]);

  const navItems: NavItem[] = isWellnessLanding
    ? [
        { href: "/wellness#features", label: "Features", id: "features" },
        { href: "/wellness#toolkit", label: "Toolkit", id: "toolkit" },
        { href: "/wellness#plans", label: "Plans", id: "plans" },
        { href: "/wellness#pro", label: "Pro Assist", id: "pro" },
        { href: "/wellness#reports", label: "Reports", id: "reports" },
        { href: "/wellness#download", label: "Download", id: "download" },
        { href: "/our-story", label: "Our Story", id: "our-story" },
      ]
    : [
        { href: "/#services", label: "Services", id: "services" },
        { href: "/#pricing", label: "Pricing", id: "pricing" },
        { href: "/city", label: "Cities", id: "cities", icon: MapPin },
        { href: "/#eco", label: "Eco", id: "eco" },
        { href: "/#insights", label: "Insights", id: "insights" },
        { href: "/our-story", label: "Our Story", id: "our-story" },
        { href: "/#faq", label: "FAQ", id: "faq" },
      ];

  const primaryCta: { href: string; label: string; trackEvent: EventType } =
    isWellnessLanding
      ? {
          href: "/wellness#download",
          label: "Download app",
          trackEvent: "cta_header_download_app",
        }
    : {
        href: "/quote?businessId=yardura",
        label: "Get Quote",
        trackEvent: "cta_header_get_quote",
      };

  const mobilePrimaryLabel = isWellnessLanding ? "Get app" : "Quote";

  // Handle scroll-based header behavior
  useEffect(() => {
    const updateScrollState = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  const headerBackground = isDark
    ? "rgba(5, 11, 8, 0.9)"
    : "rgba(255,255,255,0.92)";
  const headerBorder = isDark
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.06)";
  const headerGradient = isDark
    ? "linear-gradient(135deg, rgba(7,12,9,0.95), rgba(6,17,12,0.85), rgba(7,25,18,0.75))"
    : "linear-gradient(135deg, rgba(250,247,241,0.85), rgba(255,255,255,0.7), rgba(255,227,190,0.6))";

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <motion.header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[1000] border-b shadow-lg"
        style={{
          backgroundColor: headerBackground,
          height: prefersReducedMotion ? 80 : headerHeight,
          backdropFilter: prefersReducedMotion
            ? "blur(12px)"
            : `blur(${backdropBlur}px)`,
          opacity: prefersReducedMotion ? 0.98 : headerOpacity,
          borderColor: headerBorder,
        }}
        transition={spring.soft}
      >
        {/* Enhanced gradient overlay with dynamic opacity */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: headerGradient,
          }}
          animate={{ opacity: isScrolled ? (isDark ? 0.85 : 0.9) : isDark ? 0.6 : 0.5 }}
          transition={{ duration: dur.fast }}
        />

        {/* Subtle top accent line */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent to-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, hsl(var(--brand-coral)), transparent)",
          }}
          animate={{ opacity: isScrolled ? 1 : 0 }}
          transition={{ duration: dur.fast }}
        />

        <div className="container flex items-center justify-between py-4 relative z-10 h-full">
          {/* Enhanced Logo Section */}
          <Link href="/">
            <motion.div
              className="flex items-center gap-3 cursor-pointer"
              style={{ scale: prefersReducedMotion ? 1 : logoScale }}
              transition={spring.soft}
              whileHover={{ scale: prefersReducedMotion ? 1.02 : 1.05 }}
            >
              <div className="relative flex items-center">
                <motion.img
                  src="/brand/insightscoop-logo-horizontal.png"
                  alt="InsightScoop logo"
                  className="h-8 md:h-10 w-auto object-contain drop-shadow-sm"
                  whileHover={{ scale: 1.04 }}
                  transition={spring.snappy}
                />
              </div>
            </motion.div>
         </Link>

          {/* Enhanced Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2 text-sm whitespace-nowrap">
            {/* Navigation pills container */}
            <div
              className={cn(
                "flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur-sm",
                isDark
                  ? "border-white/15 bg-white/5"
                  : "border-[rgba(var(--graphite-rgb-commas),0.08)] bg-white/85",
              )}
            >
              <LayoutGroup>
                {navItems.map((item) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                      activeId === item.id
                        ? isDark
                          ? "bg-white/15 text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
                          : "bg-[rgba(var(--coral-rgb-commas),0.18)] text-[hsl(var(--brand-coral-ink))] shadow-sm"
                        : isDark
                          ? "text-white/70 hover:text-white hover:bg-white/5"
                          : "text-[rgba(var(--graphite-rgb-commas),0.7)] hover:text-[rgba(var(--graphite-rgb-commas),0.95)] hover:bg-[rgba(var(--vanilla-rgb-commas),0.55)]",
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring.snappy}
                    onClick={() => track("nav_click", { section: item.id })}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    {item.label}
                    {activeId === item.id && (
                      <motion.div
                        className="absolute inset-0 rounded-full -z-10"
                        style={{
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(var(--coral-rgb-commas),0.18)",
                        }}
                        layoutId="activeSection"
                        transition={spring.snappy}
                      />
                    )}
                  </motion.a>
                ))}
              </LayoutGroup>
            </div>

            {/* Enhanced CTA buttons */}
            <div className="flex items-center gap-3 ml-4 whitespace-nowrap">
              <motion.a
                href={primaryCta.href}
                data-analytics={primaryCta.trackEvent}
                className="btn-cta-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
                onClick={() => track(primaryCta.trackEvent)}
              >
                {primaryCta.label}
              </motion.a>

              <motion.a
                href="/signin"
                className={cn(
                  "px-4 py-2 rounded-full border transition-all duration-200 font-medium whitespace-nowrap",
                  isDark
                    ? "border-white/15 bg-white/5 text-white/80 hover:text-white"
                    : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white text-[rgba(var(--graphite-rgb-commas),0.75)] hover:bg-[rgba(var(--vanilla-rgb-commas),0.6)] hover:border-[rgba(var(--coral-rgb-commas),0.45)]",
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
              >
                Log in
              </motion.a>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                  isDark
                    ? "border-white/10 bg-slate-900/90 text-emerald-200 hover:bg-white/10"
                    : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white/85 text-slate-600 hover:bg-white",
                )}
                aria-label="Toggle color theme"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>
            </div>
          </nav>

          {/* Enhanced Mobile Navigation Toggle */}
          <div className="lg:hidden flex items-center gap-3">
            {!isWellnessLanding && (
              <motion.a
                href="tel:1-877-417-YARD"
                data-analytics="header_phone_call"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-[hsl(var(--brand-evergreen))] to-[hsl(var(--brand-evergreen-soft))] text-white font-semibold shadow-lg text-sm"
                whileHover={{
                  scale: 1.05,
                  boxShadow:
                    "0 10px 25px rgba(var(--evergreen-rgb-commas),0.28)",
                }}
                whileTap={{ scale: 0.95 }}
                transition={spring.snappy}
                onClick={() => track("header_phone_call")}
              >
                <PhoneCall className="size-4" />
                <span className="hidden sm:inline">Call</span>
              </motion.a>
            )}

            <motion.a
              href={primaryCta.href}
              data-analytics={primaryCta.trackEvent}
              className="btn-cta-primary rounded-full px-4 py-2 text-sm"
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(var(--coral-rgb-commas),0.35)",
              }}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
              onClick={() => track(primaryCta.trackEvent)}
            >
              {mobilePrimaryLabel}
            </motion.a>

            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                isDark
                  ? "border-white/10 bg-slate-900/90 text-emerald-200 hover:bg-white/10"
                  : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white/85 text-slate-600 hover:bg-white",
              )}
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>

            <motion.button
              onClick={handleMenuToggle}
              className={cn(
                "p-3 rounded-2xl backdrop-blur-sm border transition-all duration-200 shadow-lg",
                isDark
                  ? "border-white/10 bg-slate-900/85 hover:border-emerald-400/50"
                  : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white/80 hover:border-[rgba(var(--coral-rgb-commas),0.45)]",
                isMenuOpen && (isDark ? "border-emerald-400/60 bg-slate-900" : "border-[rgba(var(--coral-rgb-commas),0.45)] bg-white"),
              )}
              whileHover={{ scale: 1.05 }}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isMenuOpen ? "close" : "open"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: dur.fast }}
                >
                  {isMenuOpen ? (
                    <X className={cn("size-5", isDark ? "text-slate-100" : "text-slate-700")} />
                  ) : (
                    <Menu className={cn("size-5", isDark ? "text-slate-100" : "text-slate-700")} />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Enhanced Mobile Navigation Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className={cn(
                "lg:hidden border-t backdrop-blur-xl shadow-2xl",
                isDark
                  ? "border-white/10 bg-slate-950/95"
                  : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white/95",
              )}
              role="dialog"
              aria-modal="true"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
            >
              <nav className="container py-6 space-y-2">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block px-4 py-3 rounded-2xl border font-medium transition-all duration-200 flex items-center gap-3",
                      isDark
                        ? "border-white/10 bg-slate-900/80 text-slate-100 hover:bg-white/10"
                        : "border-[rgba(var(--graphite-rgb-commas),0.08)] bg-white/90 text-[rgba(var(--graphite-rgb-commas),0.78)] hover:bg-[rgba(var(--vanilla-rgb-commas),0.65)] hover:text-[rgba(var(--graphite-rgb-commas),0.95)]",
                      activeId === item.id &&
                        (isDark
                          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                          : "border-[rgba(var(--coral-rgb-commas),0.3)] bg-[rgba(var(--coral-rgb-commas),0.18)] text-[hsl(var(--brand-coral-ink))]"),
                    )}
                    onClick={() => setIsMenuOpen(false)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05, ...spring.soft }}
                    whileHover={{ scale: 1.02, x: 4 }}
                  >
                    {item.icon && (
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-xl",
                          isDark
                            ? activeId === item.id
                              ? "bg-emerald-500/20"
                              : "bg-slate-800/80"
                            : activeId === item.id
                              ? "bg-[rgba(var(--coral-rgb-commas),0.25)]"
                              : "bg-[rgba(var(--porcelain-rgb-commas),0.8)]",
                        )}
                      >
                        <item.icon className="size-4" />
                      </div>
                    )}
                    {item.label}
                  </motion.a>
                ))}

                <motion.div
                  className={cn(
                    "pt-6 space-y-3 border-t",
                    isDark
                      ? "border-white/10"
                      : "border-[rgba(var(--graphite-rgb-commas),0.12)]",
                  )}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, ...spring.soft }}
                >
                <motion.a
                  href={primaryCta.href}
                  data-analytics={primaryCta.trackEvent}
                  className="btn-cta-primary block rounded-full px-4 py-4 text-center text-base"
                  onClick={() => setIsMenuOpen(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClickCapture={() => track(primaryCta.trackEvent)}
                >
                  {primaryCta.label}
                </motion.a>
                  <motion.a
                    href="/signin"
                    className={cn(
                      "block rounded-2xl border px-4 py-3 text-center font-semibold transition-all duration-200",
                      isDark
                        ? "border-white/10 bg-slate-900/90 text-slate-100 hover:bg-white/10 hover:border-emerald-400/50"
                        : "border-[rgba(var(--graphite-rgb-commas),0.12)] bg-white text-[rgba(var(--graphite-rgb-commas),0.78)] hover:bg-[rgba(var(--vanilla-rgb-commas),0.6)] hover:border-[rgba(var(--coral-rgb-commas),0.45)]",
                    )}
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClickCapture={() => track("cta_header_login")}
                  >
                    Log In
                  </motion.a>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer to prevent content jump */}
      <div className="h-18 md:h-22" />
    </>
  );
}
