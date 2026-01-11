import { format } from "date-fns";

import { describeFirstWeekCoverage, derivePostTrialPresentation, deriveTrialWeekPresentation } from "@/lib/pricing-presentation";
import { extractWeekendUpgrade } from "@/lib/pricing/weekend";
import { formatVisitsRange } from "@/lib/utils";
import type { BillingPreference } from "@/lib/billing/types";
import type { PricingData } from "@/types/quote";
import {
  renderRadialGauge,
  renderHorizontalBars,
  renderDonutChart,
  renderActivityDots,
  renderHydrationMeter,
  renderIssuesBubbles,
  renderStatCard,
} from "./visualizations";

export type HeroAccent = "coral" | "emerald" | "mint" | "gold" | "slate";

/**
 * InsightScoop Brand Identity
 * - Primary: Coral (#F3645B)
 * - Secondary: Evergreen (#204B36), Mint (#19B4A3), Gold (#FFC24D)
 * - Neutrals: Porcelain (#FAF7F1), Graphite (#1B1E23)
 * - Fonts: Nunito (headings), Inter (body)
 */
const BRAND = {
  // Backgrounds
  background: "#FAF7F1",        // Porcelain - warm cream
  cardBg: "#FFFFFF",
  // Text
  ink: "#1B1E23",               // Graphite - primary text
  subdued: "#64748B",           // Slate-500 - secondary text
  // Primary accent
  coral: "#F3645B",
  coralDark: "#C43D37",
  coralText: "#FFFFFF",
  // Secondary accents
  evergreen: "#204B36",
  evergreenText: "#FAF7F1",
  mint: "#19B4A3",
  mintText: "#FFFFFF",
  gold: "#FFC24D",
  goldText: "#1B1E23",
  sunset: "#FF7A45",
  // Footer
  footerBg: "#204B36",          // Evergreen
  footerText: "#FAF7F1",        // Porcelain
  // Fonts (web-safe fallbacks for email)
  fontHeading: "'Nunito', 'Segoe UI', Arial, sans-serif",
  fontBody: "'Inter', 'Segoe UI', Arial, sans-serif",
};

const HERO_ACCENTS: Record<HeroAccent, { background: string; text: string }> = {
  coral: { background: BRAND.coral, text: BRAND.coralText },
  emerald: { background: BRAND.evergreen, text: BRAND.evergreenText },
  mint: { background: BRAND.mint, text: BRAND.mintText },
  gold: { background: BRAND.gold, text: BRAND.goldText },
  slate: { background: BRAND.ink, text: "#F8FAFC" },
};

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailLayout(options: {
  previewText?: string;
  heroEyebrow?: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroAccent?: HeroAccent;
  bodyHtml: string;
  footerHtml?: string;
}): string {
  const {
    previewText,
    heroEyebrow,
    heroTitle,
    heroSubtitle,
    heroAccent = "coral",
    bodyHtml,
    footerHtml,
  } = options;

  const hero = HERO_ACCENTS[heroAccent] ?? HERO_ACCENTS.coral;
  const preheader = previewText ? escapeHtml(previewText) : "";
  const eyebrow = heroEyebrow ? escapeHtml(heroEyebrow) : "";
  const subtitle = heroSubtitle ? escapeHtml(heroSubtitle) : "";
  const footerContent =
    footerHtml ?? `
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85;font-family:${BRAND.fontHeading};">InsightScoop</p>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.6;">Clean yards. Healthy pups. Wellness insights from every scoop.</p>
      <p style="margin:0;font-size:12px;line-height:1.6;opacity:0.8;">Need help? Reply to this email or call <a href="tel:1-877-417-9273" style="color:${BRAND.coral};text-decoration:none;font-weight:600;">1-877-417-YARD</a>.</p>
      <p style="margin:16px 0 0;font-size:11px;opacity:0.6;">© ${new Date().getFullYear()} InsightScoop by Yardura. All rights reserved.</p>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heroTitle)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
    @media (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-padding { padding: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:${BRAND.fontBody};color:${BRAND.ink};">
  ${preheader ? `<span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:${BRAND.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
  <table role="presentation" width="100%" style="border-collapse:collapse;background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" class="email-container" style="width:640px;max-width:640px;background-color:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(27,30,35,0.08);">
          <tr>
            <td style="padding:32px;background-color:${hero.background};color:${hero.text};">
              ${eyebrow ? `<p style="margin:0 0 10px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.85;font-family:${BRAND.fontBody};">${eyebrow}</p>` : ""}
              <h1 style="margin:0;font-size:28px;line-height:1.2;font-family:${BRAND.fontHeading};font-weight:700;">${escapeHtml(heroTitle)}</h1>
              ${subtitle ? `<p style="margin:12px 0 0;font-size:16px;line-height:1.6;opacity:0.95;font-family:${BRAND.fontBody};">${subtitle}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:36px;font-family:${BRAND.fontBody};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:${BRAND.footerBg};color:${BRAND.footerText};line-height:1.6;font-family:${BRAND.fontBody};">
              ${footerContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPrimaryButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:0 0 28px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 36px;border-radius:999px;background-color:${BRAND.coral};color:${BRAND.coralText};text-decoration:none;font-weight:600;font-size:16px;font-family:${BRAND.fontBody};box-shadow:0 4px 12px rgba(243,100,91,0.3);">
      ${escapeHtml(label)}
    </a>
  </div>`;
}

function renderList(items: string[], ordered = false): string {
  if (!items.length) return "";
  const tag = ordered ? "ol" : "ul";
  const entries = items
    .map((item) => `<li style="margin:0 0 10px;">${escapeHtml(item)}</li>`)
    .join("");
  return `<${tag} style="margin:0;padding-left:${ordered ? 22 : 20}px;color:${BRAND.subdued};font-size:14px;line-height:1.6;">${entries}</${tag}>`;
}

function formatCurrencyUSD(value: number | null | undefined, opts: { minimumFractionDigits?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.minimumFractionDigits ?? 2,
    maximumFractionDigits: opts.minimumFractionDigits ?? 2,
  }).format(value / 100);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100);
    }
  }
  return null;
}

function deriveGreetingName(name?: string | null, email?: string | null): string {
  if (name && name.trim()) return escapeHtml(name.trim().split(/\s+/)[0]);
  if (email && email.includes("@")) {
    const handle = email.split("@")[0];
    if (handle) return escapeHtml(handle);
  }
  return "there";
}

function formatAddress(lead: QuoteEmailOptions["lead"]): string | null {
  const parts = [lead.address, lead.city, lead.state, lead.zipCode]
    .map((part) => (part ? part.trim() : ""))
    .filter(Boolean);
  if (!parts.length) return null;
  return escapeHtml(parts.join(", "));
}

function normalizeAreasToClean(areas: unknown): string[] {
  if (!areas) return [];
  if (Array.isArray(areas)) {
    return areas
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .map((item) => escapeHtml(item));
  }
  if (typeof areas === "object") {
    return Object.entries(areas as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => escapeHtml(key.replace(/[_-]/g, " ")));
  }
  if (typeof areas === "string") {
    try {
      return normalizeAreasToClean(JSON.parse(areas));
    } catch (error) {
      return [escapeHtml(areas)];
    }
  }
  return [];
}

function formatAddOnsSummary(lead: QuoteEmailOptions["lead"]): string[] {
  const items: string[] = [];
  if (lead.deodorize) {
    const mode = lead.deodorizeMode?.replace(/-/g, " ") ?? "each visit";
    items.push(`Deodorizing (${escapeHtml(mode)})`);
  }
  if (lead.sprayDeck) {
    const mode = lead.sprayDeckMode?.replace(/-/g, " ") ?? "each visit";
    items.push(`Deck & patio rinse (${escapeHtml(mode)})`);
  }
  if (lead.divertMode && lead.divertMode !== "none") {
    const divertLabel =
      {
        takeaway: "Waste takeaway",
        "100": "Compost routing (capacity-dependent)",
      }[lead.divertMode ?? ""] ?? "Compost routing";
    items.push(escapeHtml(divertLabel));
  }
  return items;
}

export interface QuoteEmailOptions {
  lead: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    submittedAt?: Date | null;
    dogs?: number | null;
    yardSize?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    deodorize?: boolean | null;
    deodorizeMode?: string | null;
    sprayDeck?: boolean | null;
    sprayDeckMode?: string | null;
    divertMode?: string | null;
    areasToClean?: unknown;
    serviceType?: string | null;
  };
  pricing?: PricingData | null;
  quoteReference: string;
  frequencyKey: string;
  billingPreference: BillingPreference;
  onboardingUrl: string;
  siteUrl: string;
}

export interface QuoteEmailResult {
  subject: string;
  html: string;
  text: string;
  estimatedMonthlyCents: number | null;
}

function formatFrequencyLabel(
  key: string,
  options?: { weekendUpgrade?: boolean },
): { label: string; cadence?: string; highlight?: string } {
  const normalized = key.toLowerCase();
  const weekend = Boolean(options?.weekendUpgrade);

  switch (normalized) {
    case "weekly":
      return {
        label: "Weekly service",
        cadence: "Typically 4 or 5 visits/mo",
        highlight: "Most popular",
      };
    case "twice-weekly":
      return {
        label: "Twice weekly service",
        cadence: "Typically 8 or 9 visits/mo",
        highlight: "High-activity yards",
      };
    case "daily":
      return weekend
        ? {
            label: "Daily service (Mon–Sun)",
            cadence: "Typically 30 or 31 visits/mo",
            highlight: "Maximum coverage",
          }
        : {
            label: "Weekday service",
            cadence: "Typically 21 or 22 visits/mo",
            highlight: "Maximum coverage",
          };
    case "biweekly":
    case "bi-weekly":
    case "every-other-week":
      return {
        label: "Every other week",
        cadence: "Typically 2 visits/mo",
        highlight: "Balanced routine",
      };
    case "monthly":
      return {
        label: "Monthly deep clean",
        cadence: "1 visit per month",
      };
    case "onetime":
    case "one-time":
      return {
        label: "One-time intensive clean",
      };
    default:
      return { label: "Recurring service" };
  }
}

export interface ActionEmailOptions {
  heroEyebrow?: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroAccent?: HeroAccent;
  greetingName?: string;
  previewText?: string;
  introParagraphs: string[];
  button?: { label: string; url: string };
  secondaryLink?: { label: string; url: string };
  highlightList?: { title: string; items: string[] };
  closingNote?: string;
  footerNote?: string;
}

export interface ActionEmailResult {
  html: string;
  text: string;
}

export interface PaymentLinkEmailOptions {
  leadName: string;
  setupUrl: string;
  frequencyLabel: string;
  previewText?: string;
}

export interface ScooperProfileEmailOptions {
  toName: string;
  scooperName: string;
  dashboardUrl: string;
  scheduledDate: Date;
  arrivalWindow: string;
  addressLine?: string;
  scooperImage?: string | null;
  scooperEmail?: string | null;
  scooperPhone?: string | null;
}

export interface ScooperApplicationEmailOptions {
  toName: string;
  applicantName: string;
  appliedAt: Date;
  homeBase?: string | null;
  preferredTiles?: string[] | null;
}

export interface VisitCompletedEmailOptions {
  toName: string;
  subject: string;
  summaryLines: string[];
  dashboardUrl: string;
  extraLines?: string[];
  highlights?: string[];
}

function renderKeyValueTable(rows: { label: string; value: string; emphasis?: boolean }[]): string {
  const html = rows
    .map((row) => {
      const color = row.emphasis ? BRAND.ink : BRAND.subdued;
      const weight = row.emphasis ? 600 : 500;
      return `<tr><td style="padding:10px 0;font-size:14px;color:${color};font-weight:${weight};">${escapeHtml(row.label)}</td><td style="padding:10px 0;text-align:right;font-size:14px;color:${BRAND.ink};font-weight:600;">${row.value}</td></tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" style="border-collapse:collapse;"><tbody>${html}</tbody></table>`;
}

function formatPhoneLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  return `<a href="tel:${digits}" style="color:${BRAND.evergreen};text-decoration:none;font-weight:600;">${escapeHtml(trimmed)}</a>`;
}

export function buildQuoteEmail(options: QuoteEmailOptions): QuoteEmailResult {
  const { lead, pricing, quoteReference, frequencyKey, billingPreference, onboardingUrl } = options;

  const frequency = frequencyKey?.toLowerCase() || "weekly";
  const weekendUpgradeEnabled = extractWeekendUpgrade(
    pricing?.weekendUpgrade ?? null,
    pricing?.breakdown ?? null,
    pricing,
  );
  const frequencyMeta = formatFrequencyLabel(frequency, { weekendUpgrade: weekendUpgradeEnabled });
  const greetingName = deriveGreetingName(lead.firstName, lead.email);

  const trialWeek = pricing ? deriveTrialWeekPresentation(pricing, frequency) : null;
  const postTrial = pricing ? derivePostTrialPresentation(pricing) : null;

  const perVisitCents =
    postTrial?.perVisitCents ??
    parseAmount((pricing as Record<string, unknown>)?.perVisit) ??
    parseAmount((pricing as Record<string, unknown>)?.perVisitCents) ??
    0;

  const monthlyCents =
    postTrial?.monthlyCents ??
    parseAmount((pricing as Record<string, unknown>)?.fullMonthlyAmount) ??
    parseAmount((pricing as Record<string, unknown>)?.monthly) ??
    null;

  const estimatedMonthlyCents = monthlyCents ?? postTrial?.firstInvoiceTotalCents ?? null;

  const activationDelayDays =
    postTrial?.activationDelayDays ??
    trialWeek?.trialLengthDays ??
    (frequency === "biweekly" || frequency === "bi-weekly" || frequency === "every-other-week" ? 14 : 7);
  const activationPhrase = activationDelayDays === 14 ? "two weeks after your kickoff visit" : "one week after your kickoff visit";

  const perVisitAvailable = !["onetime", "one-time", "monthly"].includes(frequency);

  const perVisitChargeCents =
    frequency === "daily"
      ? perVisitCents * (weekendUpgradeEnabled ? 7 : 5)
      : frequency === "twice-weekly"
        ? perVisitCents * 2
        : perVisitCents;

  const perVisitLabel =
    frequency === "daily"
      ? weekendUpgradeEnabled
        ? "per service week (Mon–Sun coverage)"
        : "per service week (weekday visits)"
      : frequency === "twice-weekly"
        ? "per service week (2 visits)"
        : perVisitAvailable
          ? "per visit"
          : "per service";

  const perVisitDescription =
    frequency === "daily"
      ? weekendUpgradeEnabled
        ? "Seven visits bundled into a single weekly charge."
        : "Five weekday visits bundled into a single weekly charge."
      : frequency === "twice-weekly"
        ? "Two visits bundled into one weekly charge."
        : frequency === "biweekly" || frequency === "bi-weekly" || frequency === "every-other-week"
          ? "We run the card the day after each every-other-week visit."
          : "We run the card after each completed visit.";

  const usesSkipCreditForPerVisit =
    frequency === "daily" || frequency === "twice-weekly";

  const skipCreditDisplay = formatCurrencyUSD(perVisitCents);
  const perVisitSkipCopy = usesSkipCreditForPerVisit
    ? `Skip or cancel and we drop a ${skipCreditDisplay} credit automatically.`
    : "Skip or cancel and there's no charge.";

  const visitsPerMonthValue = (() => {
    const parseVisits = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
      return null;
    };

    const weekend = parseVisits(pricing?.weekendVisitsPerMonth ?? null);
    const base = parseVisits(pricing?.visitsPerMonth);

    if (weekendUpgradeEnabled && weekend) {
      return weekend;
    }

    return base;
  })();
  const visitsPerMonthRange = formatVisitsRange(visitsPerMonthValue ?? undefined);

  const weekendMonthlyFallback =
    weekendUpgradeEnabled && visitsPerMonthValue && perVisitCents > 0
      ? Math.round(perVisitCents * visitsPerMonthValue)
      : null;

  const adjustedEstimatedMonthlyCents =
    estimatedMonthlyCents ?? weekendMonthlyFallback ?? null;
  const approxVisitsLabel = visitsPerMonthRange ? `Typically ${visitsPerMonthRange}` : null;

  const serviceSummaryRows: Array<{ label: string; value: string; emphasis?: boolean }> = [
    {
      label: "Service type",
      value: frequencyMeta.highlight ? `${frequencyMeta.label} · ${frequencyMeta.highlight}` : frequencyMeta.label,
      emphasis: true,
    },
  ];

  if (frequencyMeta.cadence) {
    serviceSummaryRows.push({ label: "Cadence", value: escapeHtml(frequencyMeta.cadence) });
  }

  if (lead.dogs !== null && lead.dogs !== undefined) {
    serviceSummaryRows.push({ label: "Dogs covered", value: `${lead.dogs}` });
  }

  if (lead.yardSize) {
    serviceSummaryRows.push({ label: "Yard size", value: escapeHtml(lead.yardSize) });
  }

  const addressLine = formatAddress(lead);
  if (addressLine) {
    serviceSummaryRows.push({ label: "Service address", value: addressLine });
  }

  const addOnSummary = formatAddOnsSummary(lead);
  if (addOnSummary.length) {
    serviceSummaryRows.push({ label: "Add-ons", value: addOnSummary.join(", ") });
  }

  const areas = normalizeAreasToClean(lead.areasToClean);
  if (areas.length) {
    serviceSummaryRows.push({ label: "Areas to clean", value: areas.join(", ") });
  }

  serviceSummaryRows.push({ label: "Quote reference", value: escapeHtml(`#${quoteReference}`) });

  const serviceSummaryHtml = `
    <div style="margin:0 0 28px;padding:20px 24px;border:1px solid rgba(27,30,35,0.08);border-radius:18px;background-color:#FFFFFF;">
      <h2 style="margin:0 0 14px;font-size:18px;color:${BRAND.ink};">Service summary</h2>
      ${renderKeyValueTable(serviceSummaryRows)}
    </div>
  `;

  const trialSectionHtml = trialWeek
    ? (() => {
        const charges = trialWeek.charges
          .map(
            (item) => `<tr><td style="padding:8px 0;font-size:13px;color:${BRAND.ink};">${escapeHtml(item.label)}</td><td style="padding:8px 0;font-size:13px;color:${BRAND.ink};text-align:right;font-weight:600;">${formatCurrencyUSD(item.amountCents)}</td></tr>`,
          )
          .join("");

        const credits = trialWeek.credits
          .map(
            (item) => `<tr><td style="padding:8px 0;font-size:13px;color:${BRAND.ink};">${escapeHtml(item.label)}</td><td style="padding:8px 0;font-size:13px;text-align:right;font-weight:600;color:#0F766E;">-${formatCurrencyUSD(item.amountCents)}</td></tr>`,
          )
          .join("");

        const descriptor =
          trialWeek.descriptor ?? describeFirstWeekCoverage(frequency, trialWeek.followUpVisitCount) ?? "Initial clean on us.";

        return `
          <div style="margin:0 0 28px;padding:24px;border:1px solid rgba(32,75,54,0.18);border-radius:18px;background-color:#EBFAF7;">
            <h2 style="margin:0 0 14px;font-size:18px;color:#0F3C34;">Free trial week</h2>
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tbody>
                ${charges}
                ${credits}
                <tr><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0F3C34;border-top:1px solid rgba(15,60,52,0.18);">Trial week total</td><td style="padding:12px 0;font-size:13px;font-weight:700;color:#0F3C34;text-align:right;border-top:1px solid rgba(15,60,52,0.18);">${formatCurrencyUSD(trialWeek.netDueCents)}</td></tr>
              </tbody>
            </table>
            <p style="margin:14px 0 0;font-size:13px;color:#0F3C34;">${escapeHtml(descriptor)}</p>
          </div>
        `;
      })()
    : "";

  const perVisitCardHtml = perVisitAvailable
    ? `
      <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 18px;">
        <tr>
          <td style="padding:24px;border:1px solid rgba(15,60,52,0.16);border-radius:18px;background-color:#102D22;color:#E2F5EE;">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;">Pay per visit</p>
            <p style="margin:0 0 4px;font-size:24px;font-weight:700;">${formatCurrencyUSD(perVisitChargeCents)}</p>
            <p style="margin:0 0 16px;font-size:13px;color:rgba(226,245,238,0.85);">${escapeHtml(perVisitLabel)}</p>
            ${approxVisitsLabel ? `<p style="margin:0 0 16px;font-size:13px;color:rgba(226,245,238,0.75);">${escapeHtml(approxVisitsLabel)}</p>` : ""}
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:rgba(226,245,238,0.9);">${escapeHtml(perVisitDescription)} ${escapeHtml(perVisitSkipCopy)}</p>
            <p style="margin:0;font-size:12px;color:rgba(226,245,238,0.7);">Billing begins ${activationPhrase}.</p>
          </td>
        </tr>
      </table>
    `
    : "";

  const monthlyCardHtml = `
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:0;">
      <tr>
        <td style="padding:24px;border:1px solid rgba(255,194,77,0.35);border-radius:18px;background-color:#FFF6E6;color:${BRAND.ink};">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#B45309;">Flat monthly option</p>
          <p style="margin:0 0 4px;font-size:24px;font-weight:700;color:#B45309;">${monthlyCents !== null ? formatCurrencyUSD(monthlyCents) : "Custom quoted"}</p>
          ${approxVisitsLabel ? `<p style="margin:0 0 12px;font-size:13px;color:#B45309;opacity:0.85;">${escapeHtml(approxVisitsLabel)}</p>` : ""}
          <p style="margin:0 0 12px;font-size:13px;color:${BRAND.subdued};line-height:1.6;">We average your visits across the calendar so you pay the same amount each month. Skip a week? We add a ${skipCreditDisplay} credit automatically.</p>
          <p style="margin:0;font-size:12px;color:${BRAND.subdued};">Billing begins ${activationPhrase}.</p>
        </td>
      </tr>
    </table>
  `;

  const afterTrialHtml = `
    <div style="margin:0 0 28px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:${BRAND.ink};">After the trial</h2>
      ${perVisitAvailable ? perVisitCardHtml : ""}
      ${monthlyCardHtml}
    </div>
  `;

  const nextStepsHtml = `
    <div style="margin:0 0 28px;padding:22px;border:1px solid rgba(27,30,35,0.08);border-radius:18px;background-color:#FFFFFF;">
      <h2 style="margin:0 0 12px;font-size:18px;color:${BRAND.ink};">Next steps</h2>
      ${renderList([
        "Pick your kickoff date and confirm the billing cadence we've saved.",
        "Add gate notes, lock codes, and pup details so the crew can dive right in.",
        "We'll send a confirmation and keep you in the loop after every visit.",
      ], true)}
    </div>
  `;

  const bodyHtml = [
    serviceSummaryHtml,
    trialSectionHtml,
    afterTrialHtml,
    nextStepsHtml,
    renderPrimaryButton("Schedule your free week", onboardingUrl),
    `<p style="margin:0 0 18px;font-size:14px;color:${BRAND.subdued};">Questions or special requests? Reply to this email or call <a href="tel:1-877-417-9273" style="color:${BRAND.evergreen};text-decoration:none;font-weight:600;">1-877-417-YARD</a>.</p>`,
  ].join("\n");

  const heroSubtitle = trialWeek
    ? trialWeek.followUpVisitCount > 0
      ? "We picked up the tab for the messy part—your first week is on us."
      : "We stripped away the guesswork with a zero-dollar kickoff clean."
    : "Review your pricing snapshot and lock in your kickoff date.";

  const previewText = trialWeek
    ? "Your InsightScoop quote with a free kickoff week is ready to review."
    : "Review your InsightScoop service snapshot and schedule your first visit.";

  const html = renderEmailLayout({
    previewText,
    heroEyebrow: "Quote saved",
    heroTitle: "Your InsightScoop quote is ready",
    heroSubtitle,
    heroAccent: "coral",
    bodyHtml,
  });

  const summaryLines: string[] = [`Service type: ${frequencyMeta.label}`];
  if (frequencyMeta.cadence) summaryLines.push(`Cadence: ${frequencyMeta.cadence}`);
  if (lead.dogs !== null && lead.dogs !== undefined) summaryLines.push(`Dogs covered: ${lead.dogs}`);
  if (addressLine) summaryLines.push(`Service address: ${addressLine}`);
  if (addOnSummary.length) summaryLines.push(`Add-ons: ${addOnSummary.join(", ")}`);
  if (trialWeek) summaryLines.push(`Free week value: ${formatCurrencyUSD(trialWeek.totalValueCents)}`);
  summaryLines.push(`Per-visit option: ${formatCurrencyUSD(perVisitChargeCents)} ${perVisitLabel}`);
  summaryLines.push(
    `Monthly option: ${adjustedEstimatedMonthlyCents !== null ? formatCurrencyUSD(adjustedEstimatedMonthlyCents) : "Custom"}`,
  );

  const text = [
    `Hi ${greetingName},`,
    "",
    "Here’s your InsightScoop quote summary:",
    ...summaryLines.map((line) => `- ${line}`),
    "",
    "Next steps:",
    "1. Finish onboarding to secure your kickoff date.",
    "2. Add gate notes, pet details, and billing preference.",
    "3. We'll confirm scheduling and send visit updates.",
    "",
    `Complete setup: ${onboardingUrl}`,
    "",
    "Need a hand? Call 1-877-417-YARD (9273).",
    "",
    "— The InsightScoop Team",
  ].join("\n");

  return {
    subject: `Your InsightScoop quote · #${quoteReference}`,
    html,
    text,
    estimatedMonthlyCents: adjustedEstimatedMonthlyCents,
  };
}

export function buildActionEmail(options: ActionEmailOptions): ActionEmailResult {
  const {
    heroEyebrow,
    heroTitle,
    heroSubtitle,
    heroAccent = "emerald",
    greetingName,
    previewText,
    introParagraphs,
    button,
    secondaryLink,
    highlightList,
    closingNote,
    footerNote,
  } = options;

  const greeting = greetingName ? `Hi ${escapeHtml(greetingName)},` : "Hi there,";
  const introHtml = introParagraphs
    .map((paragraph) => `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">${paragraph}</p>`)
    .join("");

  const highlightHtml = highlightList
    ? `
      <div style="margin:0 0 24px;padding:20px;border:1px solid rgba(27,30,35,0.1);border-radius:18px;background-color:#FFFFFF;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${BRAND.ink};">${escapeHtml(highlightList.title)}</p>
        ${renderList(highlightList.items)}
      </div>
    `
    : "";

  const buttonHtml = button ? renderPrimaryButton(button.label, button.url) : "";
  const secondaryHtml = secondaryLink
    ? `<p style="margin:0 0 18px;font-size:13px;color:${BRAND.subdued};">Or copy this link: <a href="${escapeHtml(secondaryLink.url)}" style="color:${BRAND.evergreen};text-decoration:none;">${escapeHtml(secondaryLink.url)}</a></p>`
    : "";

  const closingHtml = closingNote ? `<p style="margin:24px 0 0;font-size:14px;color:${BRAND.subdued};">${closingNote}</p>` : "";

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">${greeting}</p>
    ${introHtml}
    ${highlightHtml}
    ${buttonHtml}
    ${secondaryHtml}
    ${closingHtml}
  `;

  const html = renderEmailLayout({
    previewText,
    heroEyebrow,
    heroTitle,
    heroSubtitle,
    heroAccent,
    bodyHtml,
    footerHtml: footerNote ? `<p style="margin:0;font-size:13px;line-height:1.6;">${footerNote}</p>` : undefined,
  });

  const textParts: string[] = [greeting];
  introParagraphs.forEach((paragraph) => {
    textParts.push(paragraph.replace(/<[^>]*>/g, ""));
  });
  if (highlightList) {
    textParts.push(`${highlightList.title}:`);
    highlightList.items.forEach((item, index) => {
      textParts.push(`${index + 1}. ${item.replace(/<[^>]*>/g, "")}`);
    });
  }
  if (button) {
    textParts.push(`Action: ${button.label} -> ${button.url}`);
  }
  if (secondaryLink) {
    textParts.push(`Link: ${secondaryLink.url}`);
  }
  if (closingNote) {
    textParts.push(closingNote.replace(/<[^>]*>/g, ""));
  }
  textParts.push("— The InsightScoop Team");

  return {
    html,
    text: textParts.filter(Boolean).join("\n\n"),
  };
}

export function buildMagicLinkEmail(recipientName: string, magicLinkUrl: string): ActionEmailResult {
  return buildActionEmail({
    heroEyebrow: "Account access",
    heroTitle: "Finish setting up InsightScoop",
    heroSubtitle: "We saved your service details—complete onboarding in one click.",
    heroAccent: "coral",
    greetingName: recipientName,
    previewText: "Complete your InsightScoop setup and pick your kickoff date.",
    introParagraphs: [
      "You're a few clicks away from clean yards and weekly wellness insights.",
      "Use the secure button below to finish creating your account. The link stays active for 24 hours and you can always request a new one from the sign-in page.",
    ],
    button: { label: "Complete account setup", url: magicLinkUrl },
    secondaryLink: { label: "Complete account setup", url: magicLinkUrl },
    highlightList: {
      title: "What happens next",
      items: [
        "Confirm your service address and billing cadence",
        "Add gate or lock notes so the crew can get in",
        "Pick your kickoff date—we'll confirm everything right away",
      ],
    },
    closingNote: "Prefer a hand? Call us at 1-877-417-YARD and we'll walk through it with you.",
  });
}

export function buildInviteEmail(
  inviterName: string,
  recipientName: string,
  magicLinkUrl: string,
  roleLabel: string,
): ActionEmailResult {
  return buildActionEmail({
    heroEyebrow: "Team invite",
    heroTitle: "You're invited to InsightScoop Service OS",
    heroSubtitle: `${escapeHtml(inviterName)} set up an account for you. Finish sign-in to join the workspace.`,
    heroAccent: "emerald",
    greetingName: recipientName,
    previewText: "Activate your InsightScoop account and access the service dashboard.",
    introParagraphs: [
      `You're joining InsightScoop as a ${escapeHtml(roleLabel)}. Use the secure button below to activate your login.`,
    ],
    button: { label: "Activate my account", url: magicLinkUrl },
    secondaryLink: { label: "Activate my account", url: magicLinkUrl },
    highlightList: {
      title: "Inside InsightScoop Service OS",
      items: [
        "Live route and customer dashboards",
        "Visit summaries and wellness insights",
        "Billing, scheduling, and add-on management",
      ],
    },
    closingNote: "Need help getting started? Reply to this email and the team will jump in.",
  });
}

export function buildPasswordResetEmail(name: string | null, resetUrl: string): ActionEmailResult {
  return buildActionEmail({
    heroEyebrow: "Security",
    heroTitle: "Reset your InsightScoop password",
    heroSubtitle: "We received a password reset request for your account.",
    heroAccent: "slate",
    greetingName: name || "there",
    previewText: "Set a new InsightScoop password—the secure link lasts 24 hours.",
    introParagraphs: [
      "Tap the button below to choose a new password. For security reasons, this link expires in 24 hours.",
      "If you didn't request a password reset, you can safely ignore this email—your login will stay the same.",
    ],
    button: { label: "Set a new password", url: resetUrl },
    secondaryLink: { label: "Set a new password", url: resetUrl },
  });
}

export function buildPaymentLinkEmail(options: PaymentLinkEmailOptions): ActionEmailResult {
  const { leadName, setupUrl, frequencyLabel, previewText } = options;
  return buildActionEmail({
    heroEyebrow: "Complete setup",
    heroTitle: "One secure step to lock in service",
    heroSubtitle: `We saved your ${escapeHtml(frequencyLabel)} quote—add payment to start scheduling.`,
    heroAccent: "coral",
    greetingName: leadName,
    previewText: previewText ?? "Review your InsightScoop service details and add payment to schedule.",
    introParagraphs: [
      "We have all your service details ready to go. Just confirm your billing preference and add a payment method—no charge today.",
    ],
    button: { label: "Complete setup", url: setupUrl },
    secondaryLink: { label: "Complete setup", url: setupUrl },
    highlightList: {
      title: "Here's what happens",
      items: [
        "Review your service summary and kickoff week",
        "Choose monthly or pay-per-visit billing",
        "Add a payment method (secure via Stripe)",
        "Pick your kickoff date and we'll send reminders",
      ],
    },
    closingNote: "Questions? Call 1-877-417-YARD or reply to this email and we'll help right away.",
  });
}

export function buildScooperProfileEmail(options: ScooperProfileEmailOptions): ActionEmailResult {
  const {
    toName,
    scooperName,
    dashboardUrl,
    scheduledDate,
    arrivalWindow,
    addressLine,
    scooperImage,
    scooperEmail,
    scooperPhone,
  } = options;

  const visitDate = format(scheduledDate, "EEEE, MMMM d");
  const greeting = deriveGreetingName(toName, undefined);

  const imageMarkup = scooperImage
    ? `<img src="${escapeHtml(scooperImage)}" alt="${escapeHtml(scooperName)}" style="width:80px;height:80px;border-radius:999px;object-fit:cover;display:block;" />`
    : `<div style="width:80px;height:80px;border-radius:999px;background-color:#DCFCE7;color:#047857;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:28px;">${escapeHtml(scooperName.charAt(0).toUpperCase())}</div>`;

  const contactLines: string[] = [];
  const phoneLink = formatPhoneLink(scooperPhone);
  if (phoneLink) contactLines.push(`<strong>Day-of phone:</strong> ${phoneLink}`);
  if (scooperEmail) {
    contactLines.push(`<strong>Email:</strong> <a href="mailto:${escapeHtml(scooperEmail)}" style="color:${BRAND.evergreen};text-decoration:none;font-weight:600;">${escapeHtml(scooperEmail)}</a>`);
  }

  const contactHtml = contactLines.length
    ? `<p style="margin:0;font-size:14px;color:${BRAND.subdued};">${contactLines.join("<br />")}</p>`
    : `<p style="margin:0;font-size:14px;color:${BRAND.subdued};">Reply to this email if you need anything before the visit.</p>`;

  const visitSnapshotItems = [
    `<strong>Date:</strong> ${escapeHtml(visitDate)}`,
    `<strong>Arrival:</strong> ${escapeHtml(arrivalWindow)}`,
  ];
  if (addressLine) visitSnapshotItems.push(`<strong>Address:</strong> ${escapeHtml(addressLine)}`);

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">${escapeHtml(scooperName)} will arrive on <strong>${escapeHtml(visitDate)}</strong> around <strong>${escapeHtml(arrivalWindow)}</strong> to knock out your first tidy-up. We'll send a recap and wellness insights right after the visit.</p>
    <div style="display:flex;gap:18px;align-items:center;border:1px solid rgba(27,30,35,0.08);border-radius:18px;padding:18px;background-color:#FFFFFF;margin:0 0 24px;">
      ${imageMarkup}
      <div style="flex:1;">
        <p style="margin:0;font-size:18px;font-weight:600;color:${BRAND.ink};">${escapeHtml(scooperName)}</p>
        ${contactHtml}
      </div>
    </div>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(255,194,77,0.45);border-radius:18px;background-color:#FFF6E6;">
      <p style="margin:0;font-size:14px;color:${BRAND.subdued};">${visitSnapshotItems.join("<br />")}</p>
    </div>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(32,75,54,0.18);border-radius:18px;background-color:#FFFFFF;">
      <h3 style="margin:0 0 12px;color:${BRAND.ink};font-size:16px;">Before we arrive</h3>
      ${renderList([
        "Double-check gate access or share your lock code so we can get in smoothly.",
        "Let us know if pups will be outside—we're happy to coordinate around them.",
        "Update notes or services anytime from your dashboard.",
      ])}
    </div>
    ${renderPrimaryButton("Review visit instructions", dashboardUrl)}
    <p style="margin:0;font-size:14px;color:${BRAND.subdued};">Need anything else? Reply to this email or call <a href="tel:1-877-417-9273" style="color:${BRAND.evergreen};text-decoration:none;font-weight:600;">1-877-417-YARD</a>.</p>
  `;

  const html = renderEmailLayout({
    previewText: "Meet your InsightScoop scooper and review your visit details.",
    heroEyebrow: "Crew introduction",
    heroTitle: "Meet your scooper",
    heroSubtitle: `${escapeHtml(scooperName)} is locked in for your first clean.`,
    heroAccent: "emerald",
    bodyHtml,
  });

  const text = [
    `Hi ${greeting},`,
    "",
    `${scooperName} will arrive on ${visitDate} around ${arrivalWindow}.`,
    addressLine ? `Address: ${addressLine}` : "",
    scooperPhone ? `Day-of phone: ${scooperPhone}` : "",
    scooperEmail ? `Email: ${scooperEmail}` : "",
    "",
    "Before we arrive:",
    "- Double-check gate access or share your lock code",
    "- Let us know if pups will be outside",
    "- Update notes from your dashboard",
    "",
    `Review visit instructions: ${dashboardUrl}`,
    "",
    "Need anything? Reply to this email or call 1-877-417-YARD.",
    "",
    "— The InsightScoop Team",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function buildScooperApplicationEmail(
  options: ScooperApplicationEmailOptions,
): ActionEmailResult {
  const { toName, applicantName, appliedAt, homeBase, preferredTiles } = options;
  const greeting = deriveGreetingName(toName, undefined);
  const appliedDate = format(appliedAt, "EEEE, MMMM d");
  const tileSummary =
    preferredTiles && preferredTiles.length
      ? preferredTiles.join(", ")
      : "We’ll match you based on open coverage.";

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Thanks for applying to become an InsightScoop scooper. We’ve logged your coverage preferences and will follow up as soon as we verify tile demand and certification timing.</p>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(25,180,163,0.25);border-radius:18px;background-color:#F0FDFA;">
      ${renderKeyValueTable([
        { label: "Applicant", value: escapeHtml(applicantName), emphasis: true },
        { label: "Submitted", value: escapeHtml(appliedDate) },
        { label: "Home base", value: escapeHtml(homeBase ?? "Not provided") },
        { label: "Preferred tiles", value: escapeHtml(tileSummary) },
      ])}
    </div>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(255,194,77,0.35);border-radius:18px;background-color:#FFF8E7;">
      <h3 style="margin:0 0 10px;color:${BRAND.ink};font-size:16px;">What happens next</h3>
      ${renderList([
        "Ops reviews coverage demand in your preferred tiles.",
        "We’ll email you if a background check or insurance proof is needed.",
        "Once certified, routes and earnings unlock in the app.",
      ])}
    </div>
    <p style="margin:0;font-size:14px;color:${BRAND.subdued};">Need to update your availability? Reply to this email and we’ll adjust the application for you.</p>
  `;

  const html = renderEmailLayout({
    previewText: "Your InsightScoop scooper application is in.",
    heroEyebrow: "Application received",
    heroTitle: "You're in the queue",
    heroSubtitle: "Thanks for applying to scoop with InsightScoop.",
    heroAccent: "mint",
    bodyHtml,
  });

  const text = [
    `Hi ${greeting},`,
    "",
    "Thanks for applying to become an InsightScoop scooper.",
    `Submitted: ${appliedDate}`,
    homeBase ? `Home base: ${homeBase}` : "",
    preferredTiles?.length ? `Preferred tiles: ${preferredTiles.join(", ")}` : "",
    "",
    "What happens next:",
    "- Ops reviews coverage demand in your preferred tiles.",
    "- We'll email if background check or insurance proof is needed.",
    "- Once certified, routes and earnings unlock in the app.",
    "",
    "Reply to this email if you need to update availability.",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export interface VisitDelayEmailOptions {
  toName?: string | null;
  scheduledDate: Date;
  arrivalWindow: string;
  addressLine?: string | null;
  dashboardUrl: string;
}

export function buildVisitDelayEmail(options: VisitDelayEmailOptions): ActionEmailResult {
  const { toName, scheduledDate, arrivalWindow, addressLine, dashboardUrl } = options;
  const visitDate = format(scheduledDate, "EEEE, MMMM d");
  const greeting = deriveGreetingName(toName, undefined);

  const snapshotItems = [
    `<strong>Updated visit:</strong> ${escapeHtml(visitDate)}`,
    `<strong>Window:</strong> ${escapeHtml(arrivalWindow)}`,
  ];
  if (addressLine) snapshotItems.push(`<strong>Address:</strong> ${escapeHtml(addressLine)}`);

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">We’re still confirming a scooper for your next visit. To keep you covered, we moved your visit to the next available window.</p>
    <div style="margin:0 0 22px;padding:18px;border:1px solid rgba(255,194,77,0.45);border-radius:18px;background-color:#FFF6E6;">
      <p style="margin:0;font-size:14px;color:${BRAND.subdued};">${snapshotItems.join("<br />")}</p>
    </div>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:${BRAND.subdued};">We’ll notify you as soon as your scooper is locked in. Need to adjust anything? You can update your visit preferences anytime in the dashboard.</p>
    ${renderPrimaryButton("View dashboard", dashboardUrl)}
    <p style="margin:0;font-size:14px;color:${BRAND.subdued};">Questions? Reply to this email and we’ll help right away.</p>
  `;

  const html = renderEmailLayout({
    previewText: "We’ve moved your visit to the next available window.",
    heroEyebrow: "Scheduling update",
    heroTitle: "Your visit window shifted",
    heroSubtitle: "We’re lining up a scooper and keeping you covered.",
    heroAccent: "gold",
    bodyHtml,
  });

  const text = [
    `Hi ${greeting},`,
    "",
    "We’re still confirming a scooper for your next visit. To keep you covered, we moved your visit to the next available window.",
    "",
    `Updated visit: ${visitDate}`,
    `Window: ${arrivalWindow}`,
    addressLine ? `Address: ${addressLine}` : "",
    "",
    `View dashboard: ${dashboardUrl}`,
    "",
    "Reply to this email if you need anything.",
    "",
    "— The InsightScoop Team",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function buildVisitCompletedEmail(options: VisitCompletedEmailOptions): ActionEmailResult {
  const { toName, subject, summaryLines, dashboardUrl, extraLines = [], highlights = [] } = options;
  const greeting = deriveGreetingName(toName, undefined);

  const summaryHtml = summaryLines
    .map((line) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">${escapeHtml(line)}</p>`)
    .join("");
  const extraHtml = extraLines
    .map((line) => `<p style="margin:0 0 14px;font-size:14px;color:${BRAND.subdued};">${escapeHtml(line)}</p>`)
    .join("");
  const highlightHtml = highlights.length
    ? `
        <div style="margin:24px 0 28px;padding:18px 24px;border:1px solid rgba(27,30,35,0.08);border-radius:18px;background-color:#FAFBFB;">
          <h2 style="margin:0 0 12px;font-size:16px;color:${BRAND.ink};">Today's checklist</h2>
          ${renderList(highlights)}
        </div>
      `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    ${summaryHtml}
    ${extraHtml}
    ${highlightHtml}
    ${renderPrimaryButton("View visit recap", dashboardUrl)}
    <p style="margin:0;font-size:14px;color:${BRAND.subdued};">Thank you for trusting InsightScoop with your crew.</p>
  `;

  const html = renderEmailLayout({
    previewText: "Your InsightScoop visit just wrapped—see what we found.",
    heroEyebrow: "Visit complete",
    heroTitle: subject,
    heroSubtitle: "Here's the rundown from today's scoop.",
    heroAccent: "coral",
    bodyHtml,
  });

  const text = [
    `Hi ${greeting},`,
    "",
    ...summaryLines,
    ...extraLines,
    ...(highlights.length ? ["", "Highlights:", ...highlights.map((item) => `- ${item}`)] : []),
    "",
    `See the full recap: ${dashboardUrl}`,
    "",
    "— The InsightScoop Team",
  ].join("\n");

  return { html, text };
}

export interface CustomerEmailReportEmailOptions {
  toName?: string | null;
  cadenceLabel: string;
  periodLabel: string;
  stats: Array<{
    label: string;
    value: string;
    note?: string | null;
    accent?: HeroAccent;
    progress?: number | null;
  }>;
  highlights: string[];
  sections: Array<{
    title: string;
    lines: string[];
    accent?: HeroAccent;
  }>;
  photos?: Array<{ url: string; caption: string }>;
  poopMap?: { url: string; pointsCount: number; ownerCount?: number; proCount?: number };
  dashboardUrl: string;
  manageUrl?: string | null;
  // Enhanced visualization data
  visualizations?: {
    wellnessScore?: number;
    wellnessLabel?: string;
    hydrationLevel?: number | null;
    issues?: Array<{ label: string; count: number }>;
    checkInDays?: number[];
    periodDays?: number;
    foodBreakdown?: Record<string, number>;
    walkStats?: { total: number; distanceMiles: number; durationMinutes: number };
    walkRouteMap?: {
      url: string;
      dogName?: string | null;
      distanceMiles?: number | null;
      durationMinutes?: number | null;
    };
    activitySummary?: Array<{ label: string; value: number; color?: string }>;
  };
}

function renderStatGrid(stats: CustomerEmailReportEmailOptions["stats"]): string {
  if (!stats.length) return "";
  const rows: typeof stats[] = [];
  for (let i = 0; i < stats.length; i += 2) {
    rows.push(stats.slice(i, i + 2));
  }

  const renderCell = (stat: (typeof stats)[number]) => {
    const accent = stat.accent ? HERO_ACCENTS[stat.accent] : null;
    const borderColor = accent ? accent.background : "rgba(27,30,35,0.12)";
    const progressValue =
      typeof stat.progress === "number" && Number.isFinite(stat.progress)
        ? Math.min(100, Math.max(0, stat.progress))
        : null;
    const progressBar = progressValue !== null
      ? `<div style="margin-top:10px;height:6px;border-radius:999px;background-color:rgba(27,30,35,0.08);overflow:hidden;">
          <div style="height:100%;width:${progressValue}%;background-color:${accent ? accent.background : BRAND.coral};border-radius:999px;"></div>
        </div>`
      : "";
    return `<td style="padding:10px;vertical-align:top;">
      <div style="border:1px solid ${borderColor};border-radius:16px;padding:14px 16px;background-color:#FFFFFF;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.subdued};font-family:${BRAND.fontBody};">${escapeHtml(stat.label)}</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:${BRAND.ink};font-family:${BRAND.fontHeading};">${escapeHtml(stat.value)}</p>
        ${stat.note ? `<p style="margin:6px 0 0;font-size:12px;color:${BRAND.subdued};">${escapeHtml(stat.note)}</p>` : ""}
        ${progressBar}
      </div>
    </td>`;
  };

  const rowHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((stat) => renderCell(stat)).join("")}${row.length === 1 ? `<td style="padding:10px;"></td>` : ""}</tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 24px;">${rowHtml}</table>`;
}

function renderSectionCards(sections: CustomerEmailReportEmailOptions["sections"]): string {
  if (!sections.length) return "";
  return sections
    .map((section) => {
      const accent = section.accent ? HERO_ACCENTS[section.accent] : null;
      const border = accent ? accent.background : "rgba(27,30,35,0.12)";
      return `
        <div style="margin:0 0 18px;padding:18px 22px;border:1px solid ${border};border-radius:18px;background-color:#FAFBFB;">
          <h3 style="margin:0 0 10px;font-size:16px;color:${BRAND.ink};font-family:${BRAND.fontHeading};">${escapeHtml(section.title)}</h3>
          ${renderList(section.lines)}
        </div>
      `;
    })
    .join("");
}

function renderPhotoStrip(photos: CustomerEmailReportEmailOptions["photos"]): string {
  if (!photos || photos.length === 0) return "";
  const photoCells = photos
    .map(
      (photo) => `
        <td style="padding:6px;vertical-align:top;">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption)}" width="180" style="width:180px;height:auto;border-radius:14px;display:block;" />
          <p style="margin:6px 0 0;font-size:11px;color:${BRAND.subdued};text-align:center;">${escapeHtml(photo.caption)}</p>
        </td>
      `,
    )
    .join("");

  return `
    <div style="margin:0 0 24px;">
      <h3 style="margin:0 0 10px;font-size:16px;color:${BRAND.ink};font-family:${BRAND.fontHeading};">Latest stool photos</h3>
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>${photoCells}</tr>
      </table>
    </div>
  `;
}

function renderPoopMapSection(poopMap: CustomerEmailReportEmailOptions["poopMap"]): string {
  if (!poopMap?.url) return "";
  const countLabel =
    poopMap.pointsCount === 1
      ? "1 capture mapped"
      : `${poopMap.pointsCount} captures mapped`;
  
  // Build legend based on whether we have both owner and pro captures
  const ownerCount = poopMap.ownerCount ?? 0;
  const proCount = poopMap.proCount ?? 0;
  const hasBothSources = ownerCount > 0 && proCount > 0;
  
  // Always show legend with owner/pro colors (matching the app)
  // Mint (#19B4A3) = Owner, Coral (#F3645B) = Pro/Scooper
  const legendItems: string[] = [];
  if (ownerCount > 0) {
    legendItems.push(`
      <span style="display:inline-flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#19B4A3;"></span>
        Owner${hasBothSources ? ` (${ownerCount})` : ""}
      </span>
    `);
  }
  if (proCount > 0) {
    legendItems.push(`
      <span style="display:inline-flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#F3645B;"></span>
        Scooper${hasBothSources ? ` (${proCount})` : ""}
      </span>
    `);
  }
  
  const legendHtml = legendItems.length > 0
    ? `
      <div style="margin:12px 0 0;display:flex;justify-content:center;gap:16px;font-size:11px;color:${BRAND.subdued};">
        ${legendItems.join("")}
      </div>
    `
    : `
      <p style="margin:12px 0 0;font-size:11px;color:${BRAND.subdued};text-align:center;">
        Each marker shows where poop was captured this period
      </p>
    `;

  return `
    <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
      <h3 style="margin:0 0 10px;font-size:16px;color:${BRAND.ink};font-family:${BRAND.fontHeading};">Yard hot spots</h3>
      <p style="margin:0 0 12px;font-size:12px;color:${BRAND.subdued};">${escapeHtml(countLabel)} this period.</p>
      <img src="${poopMap.url}" alt="Yard hot spot heatmap" width="520" style="width:100%;max-width:520px;height:auto;border-radius:16px;display:block;" />
      ${legendHtml}
    </div>
  `;
}

export function buildCustomerEmailReportEmail(
  options: CustomerEmailReportEmailOptions,
): ActionEmailResult {
  const {
    toName,
    cadenceLabel,
    periodLabel,
    stats,
    highlights,
    sections,
    photos,
    poopMap,
    dashboardUrl,
    manageUrl,
    visualizations,
  } = options;
  const greeting = deriveGreetingName(toName, undefined);

  // ─────────────────────────────────────────────────────────────
  // HERO VISUALIZATION SECTION
  // Stunning visual dashboard at the top
  // ─────────────────────────────────────────────────────────────
  let heroVisualsHtml = "";
  
  if (visualizations) {
    const parts: string[] = [];
    
    // Wellness Score Gauge - the star of the show
    if (typeof visualizations.wellnessScore === 'number') {
      parts.push(`
        <td style="vertical-align:top;text-align:center;padding:12px;">
          ${renderRadialGauge({
            value: visualizations.wellnessScore,
            label: "Wellness Score",
            sublabel: visualizations.wellnessLabel,
            size: 140,
          })}
        </td>
      `);
    }

    // Hydration meter
    if (typeof visualizations.hydrationLevel === 'number') {
      parts.push(`
        <td style="vertical-align:top;text-align:center;padding:12px;">
          ${renderHydrationMeter({ level: visualizations.hydrationLevel })}
        </td>
      `);
    }

    if (parts.length > 0) {
      heroVisualsHtml = `
        <div style="margin:0 0 28px;padding:24px;background:linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%);border-radius:20px;border:1px solid rgba(0,0,0,0.04);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>${parts.join('')}</tr>
          </table>
        </div>
      `;
    }
  }

  // Bristol scale removed - not helpful in email format

  // ─────────────────────────────────────────────────────────────
  // ISSUES BUBBLES
  // ─────────────────────────────────────────────────────────────
  const issuesHtml = visualizations?.issues?.length
    ? `
      <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
        ${renderIssuesBubbles({ issues: visualizations.issues })}
      </div>
    `
    : "";

  // ─────────────────────────────────────────────────────────────
  // CHECK-IN ACTIVITY DOTS
  // ─────────────────────────────────────────────────────────────
  const activityDotsHtml = visualizations?.checkInDays?.length && visualizations?.periodDays
    ? `
      <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
        ${renderActivityDots({
          title: "Check-in Activity",
          days: visualizations.periodDays,
          activeDays: visualizations.checkInDays,
          color: "#34D399",
        })}
      </div>
    `
    : "";

  // ─────────────────────────────────────────────────────────────
  // FOOD BREAKDOWN DONUT CHART
  // ─────────────────────────────────────────────────────────────
  const foodChartColors = ["#FF6B6B", "#FBBF24", "#34D399", "#38BDF8", "#A78BFA", "#FB7185"];
  const foodBreakdownHtml = visualizations?.foodBreakdown && Object.keys(visualizations.foodBreakdown).length > 0
    ? (() => {
        const items = Object.entries(visualizations.foodBreakdown).map(([label, value], i) => ({
          label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
          value,
          color: foodChartColors[i % foodChartColors.length],
        }));
        const total = items.reduce((sum, i) => sum + i.value, 0);
        return `
          <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
            ${renderDonutChart({
              title: "Food & Meds Breakdown",
              items,
              centerValue: String(total),
              centerLabel: "logs",
            })}
          </div>
        `;
      })()
    : "";

  // ─────────────────────────────────────────────────────────────
  // ACTIVITY SUMMARY BARS
  // ─────────────────────────────────────────────────────────────
  const activityBarsHtml = visualizations?.activitySummary?.length
    ? `
      <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
        ${renderHorizontalBars({
          title: "Activity Summary",
          items: visualizations.activitySummary,
        })}
      </div>
    `
    : "";

  // ─────────────────────────────────────────────────────────────
  // WALK STATS VISUAL CARDS
  // ─────────────────────────────────────────────────────────────
  const walkStatsHtml = visualizations?.walkStats
    ? `
      <div style="margin:0 0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${renderStatCard({
              icon: "🚶",
              label: "Walks",
              value: visualizations.walkStats.total,
              sublabel: "this period",
              color: "#10B981",
            })}
            ${renderStatCard({
              icon: "📍",
              label: "Distance",
              value: `${visualizations.walkStats.distanceMiles.toFixed(1)} mi`,
              sublabel: "total walked",
              color: "#38BDF8",
            })}
          </tr>
          <tr>
            ${renderStatCard({
              icon: "⏱️",
              label: "Duration",
              value: `${visualizations.walkStats.durationMinutes} min`,
              sublabel: "active time",
              color: "#A78BFA",
            })}
            <td style="padding:8px;"></td>
          </tr>
        </table>
      </div>
    `
    : "";

  // ─────────────────────────────────────────────────────────────
  // WALK ROUTE MAP
  // Shows the latest walk route on a map
  // ─────────────────────────────────────────────────────────────
  const walkRouteMapHtml = visualizations?.walkRouteMap?.url
    ? (() => {
        const route = visualizations.walkRouteMap;
        const dogLabel = route.dogName ? ` with ${route.dogName}` : "";
        const distanceLabel = route.distanceMiles
          ? `${route.distanceMiles.toFixed(1)} mi`
          : "";
        const durationLabel = route.durationMinutes
          ? `${Math.round(route.durationMinutes)} min`
          : "";
        const statsLabel = [distanceLabel, durationLabel].filter(Boolean).join(" · ");
        
        return `
          <div style="margin:0 0 24px;padding:20px;background-color:#FFFFFF;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
            <h3 style="margin:0 0 4px;font-size:16px;color:${BRAND.ink};font-family:${BRAND.fontHeading};">Latest walk${dogLabel}</h3>
            ${statsLabel ? `<p style="margin:0 0 12px;font-size:12px;color:${BRAND.subdued};">${statsLabel}</p>` : ""}
            <img src="${route.url}" alt="Walk route map" width="520" style="width:100%;max-width:520px;height:auto;border-radius:12px;display:block;" />
            <div style="margin:10px 0 0;display:flex;justify-content:center;gap:16px;font-size:11px;color:${BRAND.subdued};">
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10B981;"></span>
                Start
              </span>
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#F3645B;"></span>
                End
              </span>
            </div>
          </div>
        `;
      })()
    : "";

  const highlightHtml = highlights.length
    ? `
      <div style="margin:0 0 24px;padding:18px 22px;border-radius:18px;background:linear-gradient(135deg, #FFF6E6 0%, #FFFBEB 100%);border:1px solid rgba(255,194,77,0.3);">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.subdued};font-family:${BRAND.fontBody};">✨ Highlights</p>
        ${renderList(highlights)}
      </div>
    `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Here's your ${escapeHtml(cadenceLabel)} wellness report for <strong>${escapeHtml(periodLabel)}</strong>.</p>
    
    ${heroVisualsHtml}
    ${issuesHtml}
    ${activityDotsHtml}
    ${foodBreakdownHtml}
    ${walkStatsHtml}
    ${walkRouteMapHtml}
    ${activityBarsHtml}
    ${renderPoopMapSection(poopMap)}
    
    ${renderStatGrid(stats)}
    ${highlightHtml}
    ${renderSectionCards(sections)}
    ${renderPhotoStrip(photos)}
    ${renderPrimaryButton("Open your dashboard", dashboardUrl)}
    ${manageUrl ? `<p style="margin:16px 0 0;font-size:13px;color:${BRAND.subdued};text-align:center;">Manage report settings: <a href="${escapeHtml(manageUrl)}" style="color:${BRAND.coral};text-decoration:none;">Update preferences</a></p>` : ""}
  `;

  const html = renderEmailLayout({
    previewText: `${cadenceLabel} wellness report: ${periodLabel}`,
    heroEyebrow: "Here's the InsightScoop",
    heroTitle: "Your wellness snapshot is ready",
    heroSubtitle: `${cadenceLabel} report • ${periodLabel}`,
    heroAccent: "mint",
    bodyHtml,
  });

  const text = [
    `Hi ${greeting},`,
    "",
    `Here's your ${cadenceLabel} wellness report for ${periodLabel}.`,
    "",
    visualizations?.wellnessScore ? `Wellness Score: ${visualizations.wellnessScore}` : "",
    poopMap?.pointsCount ? `Yard hot spots: ${poopMap.pointsCount} captures mapped` : "",
    "",
    "Highlights:",
    ...highlights.map((item) => `- ${item}`),
    "",
    `View dashboard: ${dashboardUrl}`,
    manageUrl ? `Manage report settings: ${manageUrl}` : "",
    "",
    "— The InsightScoop Team",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

// =============================================================================
// Scooper Background Check & Certification Status Emails
// =============================================================================

export interface BackgroundCheckEmailOptions {
  toName?: string | null;
  status: "PASSED" | "FAILED";
  scooperName: string;
  completedAt: Date;
  dashboardUrl?: string;
  failureReason?: string | null;
}

export function buildBackgroundCheckEmail(
  options: BackgroundCheckEmailOptions,
): ActionEmailResult {
  const { toName, status, scooperName, completedAt, dashboardUrl, failureReason } = options;
  const greeting = deriveGreetingName(toName, undefined);
  const completedDate = format(completedAt, "MMMM d, yyyy");

  const isPassed = status === "PASSED";

  const bodyHtml = isPassed
    ? `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Great news! Your background check has been completed and approved. You're one step closer to earning with InsightScoop.</p>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(25,180,163,0.25);border-radius:18px;background-color:#F0FDFA;">
      ${renderKeyValueTable([
        { label: "Scooper", value: escapeHtml(scooperName), emphasis: true },
        { label: "Status", value: "Passed ✓" },
        { label: "Completed", value: escapeHtml(completedDate) },
      ])}
    </div>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(255,194,77,0.35);border-radius:18px;background-color:#FFF8E7;">
      <h3 style="margin:0 0 10px;color:${BRAND.ink};font-size:16px;">What happens next</h3>
      ${renderList([
        "Your certification status will be updated shortly.",
        "Once fully certified, you'll receive route assignments.",
        "Earnings and job opportunities unlock in the app.",
      ])}
    </div>
    ${dashboardUrl ? renderPrimaryButton("View your dashboard", dashboardUrl) : ""}
  `
    : `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Unfortunately, your background check did not pass our requirements at this time.</p>
    <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(243,100,91,0.25);border-radius:18px;background-color:#FEF2F2;">
      ${renderKeyValueTable([
        { label: "Scooper", value: escapeHtml(scooperName), emphasis: true },
        { label: "Status", value: "Not passed" },
        { label: "Reviewed", value: escapeHtml(completedDate) },
        ...(failureReason ? [{ label: "Notes", value: escapeHtml(failureReason) }] : []),
      ])}
    </div>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${BRAND.subdued};">If you believe this is an error or have questions about the decision, please reply to this email and our team will review your case.</p>
  `;

  const html = renderEmailLayout({
    previewText: isPassed
      ? "Your background check passed! You're cleared to scoop."
      : "Update on your InsightScoop background check",
    heroEyebrow: "Background check update",
    heroTitle: isPassed ? "You're cleared!" : "Background check update",
    heroSubtitle: isPassed
      ? "Your background check has been approved."
      : "We have an update on your application.",
    heroAccent: isPassed ? "mint" : "coral",
    bodyHtml,
  });

  const text = isPassed
    ? [
        `Hi ${greeting},`,
        "",
        "Great news! Your background check has been completed and approved.",
        "",
        `Scooper: ${scooperName}`,
        "Status: Passed",
        `Completed: ${completedDate}`,
        "",
        "What happens next:",
        "- Your certification status will be updated shortly.",
        "- Once fully certified, you'll receive route assignments.",
        "- Earnings and job opportunities unlock in the app.",
        "",
        dashboardUrl ? `View dashboard: ${dashboardUrl}` : "",
        "",
        "— The InsightScoop Team",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Hi ${greeting},`,
        "",
        "Unfortunately, your background check did not pass our requirements at this time.",
        "",
        `Scooper: ${scooperName}`,
        "Status: Not passed",
        `Reviewed: ${completedDate}`,
        failureReason ? `Notes: ${failureReason}` : "",
        "",
        "If you believe this is an error, please reply to this email.",
        "",
        "— The InsightScoop Team",
      ]
        .filter(Boolean)
        .join("\n");

  return { html, text };
}

export interface CertificationStatusEmailOptions {
  toName?: string | null;
  scooperName: string;
  certificationType: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  dashboardUrl?: string;
  revocationReason?: string | null;
}

export function buildCertificationStatusEmail(
  options: CertificationStatusEmailOptions,
): ActionEmailResult {
  const {
    toName,
    scooperName,
    certificationType,
    status,
    issuedAt,
    expiresAt,
    dashboardUrl,
    revocationReason,
  } = options;
  const greeting = deriveGreetingName(toName, undefined);
  const issuedDate = issuedAt ? format(issuedAt, "MMMM d, yyyy") : null;
  const expiresDate = expiresAt ? format(expiresAt, "MMMM d, yyyy") : null;

  const certTypeName = certificationType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  let bodyHtml: string;
  let previewText: string;
  let heroTitle: string;
  let heroSubtitle: string;
  let heroAccent: HeroAccent;

  if (status === "ACTIVE") {
    previewText = `You're certified! ${certTypeName} certification is now active.`;
    heroTitle = "You're certified!";
    heroSubtitle = `Your ${certTypeName} certification is now active.`;
    heroAccent = "mint";
    bodyHtml = `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Congratulations! Your ${certTypeName} certification has been approved and is now active. You're ready to start earning with InsightScoop!</p>
      <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(25,180,163,0.25);border-radius:18px;background-color:#F0FDFA;">
        ${renderKeyValueTable([
          { label: "Scooper", value: escapeHtml(scooperName), emphasis: true },
          { label: "Certification", value: escapeHtml(certTypeName) },
          { label: "Status", value: "Active ✓" },
          ...(issuedDate ? [{ label: "Issued", value: escapeHtml(issuedDate) }] : []),
          ...(expiresDate ? [{ label: "Expires", value: escapeHtml(expiresDate) }] : []),
        ])}
      </div>
      <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(255,194,77,0.35);border-radius:18px;background-color:#FFF8E7;">
        <h3 style="margin:0 0 10px;color:${BRAND.ink};font-size:16px;">You're ready to scoop!</h3>
        ${renderList([
          "Open the app to view available routes.",
          "Accept jobs that fit your schedule.",
          "Complete visits and start earning.",
        ])}
      </div>
      ${dashboardUrl ? renderPrimaryButton("View available routes", dashboardUrl) : ""}
    `;
  } else if (status === "REVOKED") {
    previewText = `Your ${certTypeName} certification has been revoked.`;
    heroTitle = "Certification update";
    heroSubtitle = `Your ${certTypeName} certification status has changed.`;
    heroAccent = "coral";
    bodyHtml = `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">We're writing to inform you that your ${certTypeName} certification has been revoked.</p>
      <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(243,100,91,0.25);border-radius:18px;background-color:#FEF2F2;">
        ${renderKeyValueTable([
          { label: "Scooper", value: escapeHtml(scooperName), emphasis: true },
          { label: "Certification", value: escapeHtml(certTypeName) },
          { label: "Status", value: "Revoked" },
          ...(revocationReason ? [{ label: "Reason", value: escapeHtml(revocationReason) }] : []),
        ])}
      </div>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${BRAND.subdued};">This means you will not be able to accept new routes until the issue is resolved. If you have questions or believe this was in error, please reply to this email.</p>
    `;
  } else {
    // EXPIRED
    previewText = `Your ${certTypeName} certification has expired.`;
    heroTitle = "Certification expired";
    heroSubtitle = `Your ${certTypeName} certification needs renewal.`;
    heroAccent = "gold";
    bodyHtml = `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Hi ${greeting},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.subdued};">Your ${certTypeName} certification has expired and needs to be renewed to continue scooping.</p>
      <div style="margin:0 0 24px;padding:18px;border:1px solid rgba(255,194,77,0.35);border-radius:18px;background-color:#FFF8E7;">
        ${renderKeyValueTable([
          { label: "Scooper", value: escapeHtml(scooperName), emphasis: true },
          { label: "Certification", value: escapeHtml(certTypeName) },
          { label: "Status", value: "Expired" },
          ...(expiresDate ? [{ label: "Expired on", value: escapeHtml(expiresDate) }] : []),
        ])}
      </div>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${BRAND.subdued};">To continue earning with InsightScoop, please complete the renewal process. Reply to this email if you need assistance.</p>
      ${dashboardUrl ? renderPrimaryButton("Start renewal", dashboardUrl) : ""}
    `;
  }

  const html = renderEmailLayout({
    previewText,
    heroEyebrow: "Certification update",
    heroTitle,
    heroSubtitle,
    heroAccent,
    bodyHtml,
  });

  let textLines: string[];
  if (status === "ACTIVE") {
    textLines = [
      `Hi ${greeting},`,
      "",
      `Congratulations! Your ${certTypeName} certification is now active.`,
      "",
      `Scooper: ${scooperName}`,
      `Certification: ${certTypeName}`,
      "Status: Active",
      issuedDate ? `Issued: ${issuedDate}` : "",
      expiresDate ? `Expires: ${expiresDate}` : "",
      "",
      "You're ready to scoop! Open the app to view available routes.",
      "",
      dashboardUrl ? `View routes: ${dashboardUrl}` : "",
      "",
      "— The InsightScoop Team",
    ];
  } else if (status === "REVOKED") {
    textLines = [
      `Hi ${greeting},`,
      "",
      `Your ${certTypeName} certification has been revoked.`,
      "",
      `Scooper: ${scooperName}`,
      `Certification: ${certTypeName}`,
      "Status: Revoked",
      revocationReason ? `Reason: ${revocationReason}` : "",
      "",
      "Reply to this email if you have questions.",
      "",
      "— The InsightScoop Team",
    ];
  } else {
    textLines = [
      `Hi ${greeting},`,
      "",
      `Your ${certTypeName} certification has expired.`,
      "",
      `Scooper: ${scooperName}`,
      `Certification: ${certTypeName}`,
      "Status: Expired",
      expiresDate ? `Expired on: ${expiresDate}` : "",
      "",
      "Please complete the renewal process to continue earning.",
      "",
      dashboardUrl ? `Start renewal: ${dashboardUrl}` : "",
      "",
      "— The InsightScoop Team",
    ];
  }

  const text = textLines.filter(Boolean).join("\n");

  return { html, text };
}
