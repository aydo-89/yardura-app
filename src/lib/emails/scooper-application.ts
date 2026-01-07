import { sendTransactionalEmail } from "@/lib/email";
import { buildScooperApplicationEmail } from "@/lib/email/templates";

export interface ScooperApplicationEmailPayload {
  toEmail: string;
  applicantName: string;
  appliedAt: Date;
  homeBase?: string | null;
  preferredTiles?: string[] | null;
}

export async function sendScooperApplicationEmail(
  payload: ScooperApplicationEmailPayload,
) {
  const { toEmail, applicantName, appliedAt, homeBase, preferredTiles } = payload;
  const { html, text } = buildScooperApplicationEmail({
    toName: applicantName,
    applicantName,
    appliedAt,
    homeBase,
    preferredTiles,
  });

  await sendTransactionalEmail({
    to: toEmail,
    subject: "Your InsightScoop scooper application is in",
    html,
    text,
    from: "InsightScoop Crew <crew@yardura.com>",
  });
}
