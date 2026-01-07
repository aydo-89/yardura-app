import { sendTransactionalEmail } from "@/lib/email";
import { buildVisitDelayEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/env";
import {
  formatServiceDate,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";

export interface VisitDelayEmailPayload {
  toEmail: string;
  customerName?: string | null;
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

export async function sendVisitDelayEmail(payload: VisitDelayEmailPayload) {
  const {
    toEmail,
    customerName,
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

  const resolvedWindowShortLabel =
    resolvePreferredTimeWindowShortLabel(
      preferredTimeWindowSlug ?? null,
      preferredTimeWindow ?? null,
    ) ?? null;
  const resolvedWindow = resolvedWindowShortLabel
    ? `${resolvedWindowShortLabel} window`
    : "Next available window";

  const friendlyAddress = formatAddressLine(addressLine1, city, zip);

  const { html, text } = buildVisitDelayEmail({
    toName: customerName ?? toEmail,
    scheduledDate,
    arrivalWindow: resolvedWindow,
    addressLine: friendlyAddress || undefined,
    dashboardUrl,
  });

  await sendTransactionalEmail({
    to: toEmail,
    subject: `Visit update: ${formattedDate} (${resolvedWindow})`,
    html,
    text,
    from: "Yardura Support <support@yardura.com>",
  });
}
