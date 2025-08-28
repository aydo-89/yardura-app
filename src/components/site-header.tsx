"use client";
import { useState } from "react";
import { PhoneCall, Leaf, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

        const navItems = [
        { href: "#services", label: "Services" },
        { href: "#pricing", label: "Pricing" },
        { href: "#insights", label: "Insights" },
        { href: "#eco", label: "Eco", icon: Leaf },
        { href: "#faq", label: "FAQ" },
      ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="container flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <img src="/yardura-logo.png" alt="Yardura logo" className="h-9 w-9 rounded-xl shadow-soft object-contain bg-white" />
          <div>
            <div className="font-extrabold text-xl text-ink">Yardura</div>
            <div className="text-xs text-slate-500">Tech-enabled • Eco-friendly</div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-brand-700 transition-colors flex items-center gap-1"
            >
              {item.icon && <item.icon className="size-4" />}
              {item.label}
            </a>
          ))}
          <a href="/signup" className="px-4 py-2 rounded-xl border hover:bg-brand-50 transition">
            Sign up
          </a>
          <a href="/signin" className="px-4 py-2 rounded-xl bg-ink text-white hover:bg-brand-800 transition shadow-soft">
            Log in
          </a>
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <a href="tel:+16125819812" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-500 text-white">
            <PhoneCall className="size-4" /> Call
          </a>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <nav className="container py-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-lg hover:bg-brand-50 hover:text-brand-700 transition-colors flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.icon && <item.icon className="size-4" />}
                {item.label}
              </a>
            ))}
            <div className="pt-3 border-t">
              <a
                href="/signup"
                className="block px-3 py-3 rounded-xl bg-ink text-white hover:bg-brand-700 transition shadow-soft text-center font-semibold"
                onClick={() => setIsMenuOpen(false)}
              >
                Create Account
              </a>
              <a
                href="/signin"
                className="mt-2 block px-3 py-3 rounded-xl border hover:bg-brand-50 transition text-center font-semibold"
                onClick={() => setIsMenuOpen(false)}
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

