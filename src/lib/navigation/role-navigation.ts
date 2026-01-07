import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Clock,
  Compass,
  CreditCard,
  DollarSign,
  Eye,
  Handshake,
  Home,
  Layers,
  LifeBuoy,
  Map,
  MapPin,
  Megaphone,
  PlayCircle,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";

import type { AppUserRole } from "@/lib/auth/roles";
import { ROLE_DISPLAY_NAME } from "@/lib/auth/roles";

export interface RoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface RoleNavigationConfig {
  displayName: string;
  tagline: string;
  primaryNav: RoleNavItem[];
  extendedNav?: RoleNavItem[];
  accountNav: RoleNavItem[];
  showAdminBadge?: boolean;
}

const CUSTOMER_NAV: RoleNavigationConfig = {
  displayName: ROLE_DISPLAY_NAME.CUSTOMER,
  tagline: "My Services",
  showAdminBadge: false,
  primaryNav: [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: Home,
      description: "Track visits, notes, and wellness insights",
    },
    {
      href: "/dashboard#services",
      label: "Services",
      icon: Sparkles,
      description: "View upcoming visits and add-ons",
    },
    {
      href: "/dashboard#billing",
      label: "Billing",
      icon: CreditCard,
      description: "See invoices, payments, and subscriptions",
    },
    {
      href: "/account",
      label: "Account",
      icon: Settings,
      description: "Update contact information and preferences",
    },
  ],
  extendedNav: [],
  accountNav: [
    {
      href: "/contact",
      label: "Support",
      icon: LifeBuoy,
      description: "Need help? Reach the Yardura team",
    },
  ],
};

const SALES_REP_NAV: RoleNavigationConfig = {
  displayName: ROLE_DISPLAY_NAME.SALES_REP,
  tagline: "Sales Ops Portal",
  showAdminBadge: false,
  primaryNav: [
    {
      href: "/field-tech",
      label: "Field ops",
      icon: MapPin,
      description: "Run today's route and capture visit proof",
    },
    {
      href: "/admin/leads",
      label: "Pipeline",
      icon: ClipboardList,
      description: "Qualify inbound quotes and assign reps",
    },
    {
      href: "/admin/leads/outbound",
      label: "Outbound",
      icon: Megaphone,
      description: "Sequence door-to-door and SMS follow-ups",
    },
    {
      href: "/admin/leads/cadences",
      label: "Cadences",
      icon: PlayCircle,
      description: "Automate multi-touch nurture programs",
    },
  ],
  extendedNav: [],
  accountNav: [
    {
      href: "/account",
      label: "Account settings",
      icon: Settings,
      description: "Update profile and notification preferences",
    },
    {
      href: "/dashboard",
      label: "Customer view",
      icon: Home,
      description: "Peek at the customer portal experience",
    },
  ],
};

const TECH_NAV: RoleNavigationConfig = {
  displayName: ROLE_DISPLAY_NAME.TECH,
  tagline: "Field Ops Portal",
  showAdminBadge: false,
  primaryNav: [
    {
      href: "/field-tech",
      label: "Today's route",
      icon: Map,
      description: "Clock in, capture photos, and send 3Cs",
    },
    {
      href: "/admin/dispatch/routes",
      label: "Route board",
      icon: MapPin,
      description: "Check assignments and map sequencing",
    },
  ],
  extendedNav: [],
  accountNav: [
    {
      href: "/account",
      label: "Account settings",
      icon: Settings,
      description: "Manage contact and login details",
    },
    {
      href: "/contact",
      label: "Ops support",
      icon: LifeBuoy,
      description: "Flag equipment or gate issues",
    },
  ],
};

const ADMIN_NAV: RoleNavigationConfig = {
  displayName: ROLE_DISPLAY_NAME.ADMIN,
  tagline: "Admin Portal",
  showAdminBadge: true,
  primaryNav: [
    {
      href: "/admin",
      label: "Admin home",
      icon: Shield,
      description: "Run operations, growth, and finance programs",
    },
    {
      href: "/admin/dispatch/routes",
      label: "Dispatch",
      icon: Compass,
      description: "Assign routes, optimize schedules, handle skips",
    },
    {
      href: "/admin/leads",
      label: "Leads",
      icon: ClipboardList,
      description: "Manage inbound demand and CRM handoffs",
    },
    {
      href: "/admin/field-ops",
      label: "Field ops QA",
      icon: Eye,
      description: "Approve check-ins, visit media, and coaching notes",
    },
    {
      href: "/admin/customers",
      label: "Customers",
      icon: Users,
      description: "Review profiles, active jobs, and visit schedules",
    },
    {
      href: "/admin/pricing",
      label: "Pricing",
      icon: DollarSign,
      description: "Tune hero plans, flankers, and add-ons",
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: BarChart3,
      description: "Monitor KPIs and route performance",
    },
  ],
  extendedNav: [
    {
      href: "/admin/users",
      label: "Team",
      icon: Users,
      description: "Invite staff, reps, and contractors",
    },
    {
      href: "/admin/leads/outbound",
      label: "Door knocking",
      icon: Megaphone,
      description: "Plan canvassing runs and log field intel",
    },
    {
      href: "/admin/leads/cadences",
      label: "Cadence builder",
      icon: PlayCircle,
      description: "Automate outreach programs and follow-ups",
    },
    {
      href: "/admin/marketplace/handoffs",
      label: "Scooper discipline",
      icon: Handshake,
      description: "Track missed visits, releases, and recurring job drops",
    },
    {
      href: "/admin/marketplace/applicants",
      label: "Scooper applications",
      icon: ClipboardList,
      description: "Review applicants and update vetting status",
    },
    {
      href: "/admin/marketplace/availability",
      label: "Scooper availability",
      icon: Clock,
      description: "Manage daily coverage and open shifts",
    },
    {
      href: "/admin/marketplace/tiles",
      label: "Tile readiness",
      icon: Layers,
      description: "Track readiness thresholds and capacity",
    },
    {
      href: "/admin/marketplace/tiles/studio",
      label: "Tile Studio",
      icon: MapPin,
      description: "Generate, publish, and assign service tiles",
    },
    {
      href: "/admin/promo-codes",
      label: "Promo codes",
      icon: Tag,
      description: "Launch incentives and limited offers",
    },
    {
      href: "/admin/billing",
      label: "Billing & plans",
      icon: CreditCard,
      description: "Audit invoices, payments, and plan logic",
    },
  ],
  accountNav: [
    {
      href: "/account",
      label: "Account settings",
      icon: Settings,
      description: "Manage profile, MFA, and notifications",
    },
    {
      href: "/dashboard",
      label: "Customer view",
      icon: Home,
      description: "Jump into the subscriber experience",
    },
  ],
};

const OWNER_NAV: RoleNavigationConfig = {
  displayName: ROLE_DISPLAY_NAME.OWNER,
  tagline: "Leadership Console",
  showAdminBadge: true,
  primaryNav: [
    {
      href: "/admin",
      label: "Exec overview",
      icon: Shield,
      description: "Watch the daily operations heartbeat",
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: BarChart3,
      description: "Unit economics, retention, and conversion",
    },
    {
      href: "/admin/pricing",
      label: "Pricing",
      icon: DollarSign,
      description: "Adjust hero plans, add-ons, and promos",
    },
    {
      href: "/admin/dispatch/routes",
      label: "Dispatch",
      icon: Compass,
      description: "Review field capacity and SLA adherence",
    },
    {
      href: "/admin/leads",
      label: "Growth",
      icon: Megaphone,
      description: "Align outbound and inbound rhythm",
    },
    {
      href: "/admin/users",
      label: "Team",
      icon: Users,
      description: "Control access and manage roles",
    },
  ],
  extendedNav: ADMIN_NAV.extendedNav ? [...ADMIN_NAV.extendedNav] : [],
  accountNav: [
    {
      href: "/account",
      label: "Account settings",
      icon: Settings,
      description: "Manage leadership contact info",
    },
    {
      href: "/dashboard",
      label: "Customer view",
      icon: Home,
      description: "Jump into the subscriber experience",
    },
  ],
};

const ROLE_NAVIGATION: Record<AppUserRole, RoleNavigationConfig> = {
  CUSTOMER: CUSTOMER_NAV,
  SALES_REP: SALES_REP_NAV,
  TECH: TECH_NAV,
  ADMIN: ADMIN_NAV,
  OWNER: OWNER_NAV,
};

export function getNavigationForRole(role: AppUserRole | null | undefined): RoleNavigationConfig {
  if (!role) {
    return CUSTOMER_NAV;
  }

  return ROLE_NAVIGATION[role] ?? CUSTOMER_NAV;
}
