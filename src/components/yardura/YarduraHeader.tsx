"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { label: "Operations", href: "#operations" },
  { label: "Portfolio", href: "#brands" },
  { label: "Why Yardura", href: "#why-yardura" },
  { label: "Partner", href: "#partner" },
];

export default function YarduraHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-slate-950/75 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-white">
          <Image
            src="/yardura-logo.png"
            alt="Yardura"
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/30 bg-white/90 object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide uppercase text-white/80">Yardura</span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/50">
              Brand Collective
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-white/70 md:flex">
          {NAV_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="mailto:hello@yardura.com"
            className="hidden rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-300/10 md:inline-flex"
          >
            Contact
          </a>
          <Link
            href="https://cal.com/yardura/partnership"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-lg transition hover:brightness-110"
          >
            Book intro
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}
