"use client";
import { useState, useEffect, useRef } from "react";
import { PhoneCall, Leaf, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveSection } from "@/hooks/useActiveSection";
import { track } from "@/lib/analytics";

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sectionIds = ["hero", "services", "pricing", "insights", "eco", "faq"];
  const activeId = useActiveSection(sectionIds);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const navItems = [
    { href: "#services", label: "Services", id: "services" },
    { href: "#pricing", label: "Pricing", id: "pricing" },
    { href: "#insights", label: "Insights", id: "insights" },
    { href: "#eco", label: "Eco", id: "eco", icon: Leaf },
    { href: "#faq", label: "FAQ", id: "faq" },
  ];

  // Focus trapping for mobile menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMenuOpen) return;

      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key === 'Tab' && menuRef.current) {
        const focusableElements = menuRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus first element in menu
      setTimeout(() => {
        const firstFocusable = menuRef.current?.querySelector('button, [href]') as HTMLElement;
        firstFocusable?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-accent/10 shadow-sm transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-accent-soft/20 via-transparent to-accent-soft/20 opacity-50"></div>
      <div className="container flex items-center justify-between py-3 relative z-10">
        <div className="flex items-center gap-2">
          <img src="/yardura-logo.png" alt="Yardura logo" className="h-9 w-9 rounded-xl shadow-soft object-contain bg-white" />
          <div>
            <div className="font-extrabold text-xl text-ink">Yardura</div>
            <div className="text-xs text-slate-500">Tech-enabled • Eco-friendly</div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm" role="navigation" aria-label="Main navigation">
          <h2 className="sr-only">Main Navigation</h2>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "hover:text-accent transition-colors focus:ring-2 focus:ring-accent focus:outline-none rounded-md px-2 py-1 flex items-center gap-1",
                activeId === item.id && "text-accent font-medium"
              )}
            >
              {item.icon && <item.icon className="size-4" aria-hidden="true" />}
              {item.label}
            </a>
          ))}

          {/* Primary CTA */}
          <a
            href="/quote" data-analytics="cta_quote"
            className="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition font-semibold shadow-soft focus:ring-2 focus:ring-accent focus:outline-none"
          >
            Get My Quote
          </a>

          <a
            href="/signup"
            className="px-4 py-2 rounded-xl border hover:bg-accent-soft transition focus:ring-2 focus:ring-accent focus:outline-none"
          >
            Sign up
          </a>
          <a
            href="/signin"
            className="px-4 py-2 rounded-xl bg-ink text-white hover:bg-accent transition shadow-soft focus:ring-2 focus:ring-accent focus:outline-none"
          >
            Log in
          </a>
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <a
            href="tel:+16125819812"
            data-analytics="header_phone_call"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-white focus:ring-2 focus:ring-accent focus:outline-none"
          >
            <PhoneCall className="size-4" aria-hidden="true" /> Call
          </a>

          {/* Primary CTA */}
          <a
            href="/quote" data-analytics="cta_quote"
            className="px-4 py-2 rounded-xl bg-accent text-white font-semibold shadow-soft focus:ring-2 focus:ring-accent focus:outline-none"
          >
            Get Quote
          </a>

          <button
            ref={menuButtonRef}
            onClick={handleMenuToggle}
            className="p-2 rounded-lg hover:bg-accent-soft transition-colors focus:ring-2 focus:ring-accent focus:outline-none"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          id="mobile-menu"
          className="md:hidden border-t bg-white"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <nav className="container py-4 space-y-3" role="navigation" aria-label="Mobile site navigation">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-lg hover:bg-accent-soft hover:text-accent transition-colors focus:ring-2 focus:ring-accent focus:outline-none flex items-center gap-2",
                  activeId === item.id && "bg-accent-soft text-accent font-medium"
                )}
                onClick={handleMenuClose}
              >
                {item.icon && <item.icon className="size-4" aria-hidden="true" />}
                {item.label}
              </a>
            ))}

            {/* Primary CTA in Mobile Menu */}
            <div className="pt-3 border-t">
              <a
                href="/quote" data-analytics="cta_quote"
                className="block px-3 py-3 rounded-xl bg-accent text-white hover:bg-accent/90 transition shadow-soft text-center font-semibold focus:ring-2 focus:ring-accent focus:outline-none"
                onClick={handleMenuClose}
              >
                Get My Quote
              </a>
              <a
                href="/signup"
                className="block px-3 py-3 mt-2 rounded-xl bg-ink text-white hover:bg-accent transition shadow-soft text-center font-semibold focus:ring-2 focus:ring-accent focus:outline-none"
                onClick={handleMenuClose}
              >
                Create Account
              </a>
              <a
                href="/signin"
                className="block px-3 py-3 mt-2 rounded-xl border hover:bg-accent-soft transition text-center font-semibold focus:ring-2 focus:ring-accent focus:outline-none"
                onClick={handleMenuClose}
              >
                Log in
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

