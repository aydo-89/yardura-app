"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ClipboardList,
  Compass,
  Eye,
  DollarSign,
  HandCoins,
  Layers,
  LucideIcon,
  Mail,
  MapPin,
  PlayCircle,
  Settings,
  Shield,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ADMIN_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Wait for session to fully load before checking
    if (status === "loading") return;
    
    // Only redirect if we're SURE there's no session (not authenticated after loading)
    if (status === "unauthenticated") {
      router.replace("/signin?callbackUrl=/admin");
      return;
    }

    // If authenticated, check role
    if (status === "authenticated" && session?.user) {
      const role = extractUserRole(session);
      if (!role || !ADMIN_PORTAL_ROLES.includes(role)) {
        router.replace(getDefaultRedirectForRole(role));
        return;
      }
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }
  const isGodModeUser = session?.user?.email === "ayden@yardura.com";

  const quickActions: Array<{
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      href: "/admin/dispatch/routes",
      label: "Plan today's routes",
      description: "Drag, drop, and optimize the field queue",
      icon: MapPin,
    },
    {
      href: "/admin/customers",
      label: "Find a customer",
      description: "Search profiles, review jobs, and manage visits",
      icon: Users,
    },
    {
      href: "/admin/customers/new",
      label: "Add a customer",
      description: "Create a profile without going through checkout",
      icon: UserPlus,
    },
    {
      href: "/admin/promo-codes",
      label: "Launch a promo",
      description: "Set up incentives in minutes",
      icon: Tag,
    },
  ];

  const navigationSections: Array<{
    title: string;
    description: string;
    items: Array<{
      title: string;
      href: string;
      description: string;
      icon: LucideIcon;
      badge?: string;
    }>;
  }> = [
    {
      title: "Run operations",
      description: "Dispatch, fulfillment, and frontline controls.",
      items: [
        {
          title: "Dispatch board",
          href: "/admin/dispatch/routes",
          description: "Build technician routes, assign visits, and monitor progress.",
          icon: Compass,
          badge: "Live",
        },
        {
          title: "Field ops QA",
          href: "/admin/field-ops",
          description: "Approve daily check-ins, review visit media, and document coaching notes.",
          icon: Eye,
          badge: "New",
        },
        {
          title: "Payout approvals",
          href: "/admin/field-ops/payouts",
          description: "Review withdrawal requests and release earned scooper payouts.",
          icon: HandCoins,
        },
        {
          title: "Scooper discipline",
          href: "/admin/marketplace/handoffs",
          description: "Review missed visits, late releases, and recurring job drops.",
          icon: ClipboardList,
        },
        {
          title: "Scooper availability",
          href: "/admin/marketplace/availability",
          description: "Edit day-by-day coverage without wiping a scooper’s entire schedule.",
          icon: Settings,
        },
        {
          title: "Tile readiness",
          href: "/admin/marketplace/tiles",
          description: "Track MVD thresholds, map coverage, and override waitlist gates.",
          icon: Layers,
        },
        {
          title: "Customer records",
          href: "/admin/customers",
          description: "Search customers, open job details, and manage billing.",
          icon: Users,
        },
        {
          title: "Skip reason catalog",
          href: "/admin/dispatch/skip-reasons",
          description: "Tune how weather and safety skips affect billing.",
          icon: Shield,
        },
        {
          title: "Tile Studio",
          href: "/admin/marketplace/tiles/studio",
          description: "Generate service tiles, assign ZIP coverage, and publish updates.",
          icon: MapPin,
        },
      ],
    },
    {
      title: "Grow demand",
      description: "Marketing, sales, and lifecycle levers.",
      items: [
        {
          title: "Lead management",
          href: "/admin/leads",
          description: "Review inbound interest and nurture warm handoffs.",
          icon: ClipboardList,
        },
        {
          title: "Cadence builder",
          href: "/admin/leads/cadences",
          description: "Automate follow-ups, drop campaigns, and door hangers.",
          icon: PlayCircle,
        },
        {
          title: "Canvassing & door knocking",
          href: "/admin/leads/outbound",
          description: "Map routes, log door knocks, and capture field intel.",
          icon: MapPin,
        },
      ],
    },
    {
      title: "Steer the business",
      description: "Financial, people, and insight programs.",
      items: [
        {
          title: "Pricing architecture",
          href: "/admin/pricing",
          description: "Adjust hero plans, add-ons, and intro offers.",
          icon: DollarSign,
        },
        {
          title: "Analytics & KPIs",
          href: "/admin/analytics",
          description: "Monitor conversion, retention, and ops throughput.",
          icon: BarChart3,
        },
        {
          title: "Integrations hub",
          href: "/admin/integrations",
          description: "Manage QuickBooks and upcoming partner integrations.",
          icon: Settings,
        },
        {
          title: "Team directory",
          href: "/admin/users",
          description: "Invite partners, dispatchers, and technicians.",
          icon: Users,
        },
        ...(isGodModeUser
          ? [
              {
                title: "God mode",
                href: "/admin/god-mode",
                description: "Deep configuration reserved for owners.",
                icon: Shield,
                badge: "Owner",
              },
            ]
          : []),
      ],
    },
  ];

  const statusStrip: Array<{ label: string; value: string; tone: "ok" | "info" }> = [
    { label: "Dispatch availability", value: "Healthy", tone: "ok" },
    { label: "Billing & Stripe", value: "Synchronized", tone: "ok" },
    { label: "Customer messaging", value: "Online", tone: "info" },
  ];

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute right-16 top-14 h-32 w-32 rounded-full bg-brand-mint/25 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-40 w-[24rem] -translate-x-1/2 bg-brand-coral/15 blur-3xl" />
        <div className="container mx-auto px-6 pb-12 pt-20">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-3 admin-kicker">
                <Settings className="h-4 w-4" />
                <span>Operations control center</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">
                  Yardura Service OS
                </h1>
                <p className="admin-subtitle">
                  A single pane for dispatch, growth, and customer orchestration.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusStrip.map((status) => (
                  <div
                    key={status.label}
                    className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm transition ${
                      status.tone === "ok"
                        ? "border-brand-mint/40 bg-brand-mint/15 text-brand-mint"
                        : "border-brand-coral/30 bg-brand-coral/10 text-brand-coral"
                    }`}
                  >
                    <span className="font-medium">{status.value}</span>
                    <span className="hidden text-xs text-slate-600 sm:inline dark:text-slate-200/70">
                      {status.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md admin-card rounded-3xl p-5 backdrop-blur-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                Today's priorities
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3 transition hover:border-brand-mint/40 hover:bg-brand-mint/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/10"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-mint/15 text-brand-mint shadow-sm dark:bg-brand-mint/20 dark:text-brand-mint">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 leading-tight">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {action.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-200/70">
                        {action.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-12 px-6 pb-24 pt-12">
        {navigationSections.map((section) => (
          <section key={section.title} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {section.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {section.description}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Card
                  key={item.href}
                  className="group admin-card flex h-full flex-col justify-between transition hover:-translate-y-1 hover:border-brand-mint/50 hover:shadow-xl"
                >
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mint/15 text-brand-mint transition group-hover:bg-brand-mint/25 dark:bg-brand-mint/20 dark:text-brand-mint">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        {item.description}
                      </p>
                    </div>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-semibold text-brand-coral dark:bg-brand-coral/20 dark:text-brand-coral">
                        {item.badge}
                      </span>
                    ) : null}
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Link href={item.href}>
                      <Button
                        variant="ghost"
                        className="group/btn w-full justify-between rounded-xl border border-slate-200/70 bg-white/90 text-slate-700 transition hover:border-brand-mint/40 hover:bg-brand-mint/10 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/15 dark:hover:text-brand-mint"
                      >
                        Open workspace
                        <span className="transition group-hover/btn:translate-x-1">→</span>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <section className="grid gap-4 lg:grid-cols-4">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-white">Communication playbooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Align the 3C field reporting, SMS nudges, and customer portal notifications.
              </p>
              <Link
                href="/admin/leads/cadences"
                className="inline-flex items-center gap-2 text-brand-coral hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
              >
                Review macros
                <Mail className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-white">Financial guardrails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Pricing, surcharges, and first-visit logic stay consistent across territories.
              </p>
              <Link
                href="/admin/pricing"
                className="inline-flex items-center gap-2 text-brand-coral hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
              >
                Adjust pricing
                <DollarSign className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-white">Canvassing & door knocking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Give field reps a live map to drop pins, log encounters, and sync territory notes.
              </p>
              <Link
                href="/admin/leads/outbound"
                className="inline-flex items-center gap-2 text-brand-coral hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
              >
                Open canvassing hub
                <MapPin className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-white">Team enablement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Keep the roster current so technicians, dispatch, and sales have the right access.
              </p>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 text-brand-coral hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
              >
                Manage users
                <Users className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
