"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Receipt, HeartPulse, Leaf } from "lucide-react";

const NAV_ITEMS = [
  { href: "/mobile/dashboard", label: "Home", icon: Home },
  { href: "/mobile/dashboard/visits", label: "Visits", icon: CalendarDays },
  { href: "/mobile/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/mobile/dashboard/eco", label: "Eco", icon: Leaf },
  { href: "/mobile/dashboard/wellness", label: "Wellness", icon: HeartPulse },
];

export default function MobileDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800">
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${
                  isActive ? "text-brand-mint" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
