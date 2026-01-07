import { sendTransactionalEmail } from "@/lib/email";
import { buildScooperProfileEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/env";
import {
  formatServiceDate,
  formatServiceTime,
  resolvePreferredTimeWindowLabel,
} from "@/lib/time-window";

export interface ScooperProfileEmailPayload {
  toEmail: string;
  customerName?: string | null;
  technicianName?: string | null;
  technicianEmail?: string | null;
  technicianPhone?: string | null;
  technicianImage?: string | null;
  scheduledDate: Date;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  zip?: string | null;
}

const formatAddressLine = (
  address?: string | null,
  city?: string | null,
  zip?: string | null,
) => {
  const parts = [address?.trim(), city?.trim(), zip?.trim()].filter(Boolean);
  return parts.join(", ");
};

export async function sendScooperProfileEmail(payload: ScooperProfileEmailPayload) {
  const {
    toEmail,
    customerName,
    technicianName,
    technicianEmail,
    technicianPhone,
    technicianImage,
    scheduledDate,
    preferredTimeWindow,
    preferredTimeWindowSlug,
    addressLine1,
    city,
    zip,
  } = payload;

  const siteUrl = getSiteUrl();
  const dashboardUrl = `${siteUrl}/dashboard`;

  const formattedDate =
    formatServiceDate(scheduledDate, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }) ?? scheduledDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const resolvedWindow =
    resolvePreferredTimeWindowLabel(
      preferredTimeWindowSlug ?? null,
      preferredTimeWindow ?? null,
    ) ??
    formatServiceTime(scheduledDate) ??
    "We'll share the exact arrival window soon";

  const friendlyAddress = formatAddressLine(addressLine1, city, zip);
  const scooperName = technicianName?.trim() || "your InsightScoop scooper";
  const subjectName = technicianName?.trim() || "your InsightScoop scooper";

  const subject = `Meet your InsightScoop scooper, ${subjectName}`;
  const { html, text } = buildScooperProfileEmail({
    toName: customerName ?? toEmail,
    scooperName,
    dashboardUrl,
    scheduledDate,
    arrivalWindow: resolvedWindow,
    addressLine: friendlyAddress || undefined,
    scooperImage: technicianImage ?? null,
    scooperEmail: technicianEmail ?? null,
    scooperPhone: technicianPhone ?? null,
  });

  await sendTransactionalEmail({
    to: toEmail,
    subject,
    html,
    text,
    from: "InsightScoop Crew <crew@yardura.com>",
  });
}
