import { sendTransactionalEmail } from "@/lib/email";
import {
  buildBackgroundCheckEmail,
  buildCertificationStatusEmail,
} from "@/lib/email/templates";

export interface BackgroundCheckEmailPayload {
  toEmail: string;
  toName?: string | null;
  scooperName: string;
  status: "PASSED" | "FAILED";
  completedAt: Date;
  dashboardUrl?: string;
  failureReason?: string | null;
}

export async function sendBackgroundCheckEmail(
  payload: BackgroundCheckEmailPayload,
) {
  const {
    toEmail,
    toName,
    scooperName,
    status,
    completedAt,
    dashboardUrl,
    failureReason,
  } = payload;

  const { html, text } = buildBackgroundCheckEmail({
    toName,
    scooperName,
    status,
    completedAt,
    dashboardUrl,
    failureReason,
  });

  const subject =
    status === "PASSED"
      ? "Your background check passed!"
      : "Update on your background check";

  await sendTransactionalEmail({
    to: toEmail,
    subject,
    html,
    text,
    from: "InsightScoop Crew <crew@yardura.com>",
  });
}

export interface CertificationStatusEmailPayload {
  toEmail: string;
  toName?: string | null;
  scooperName: string;
  certificationType: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  dashboardUrl?: string;
  revocationReason?: string | null;
}

export async function sendCertificationStatusEmail(
  payload: CertificationStatusEmailPayload,
) {
  const {
    toEmail,
    toName,
    scooperName,
    certificationType,
    status,
    issuedAt,
    expiresAt,
    dashboardUrl,
    revocationReason,
  } = payload;

  const certTypeName = certificationType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const { html, text } = buildCertificationStatusEmail({
    toName,
    scooperName,
    certificationType,
    status,
    issuedAt,
    expiresAt,
    dashboardUrl,
    revocationReason,
  });

  let subject: string;
  if (status === "ACTIVE") {
    subject = `You're certified! ${certTypeName} is now active`;
  } else if (status === "REVOKED") {
    subject = `Certification update: ${certTypeName}`;
  } else {
    subject = `Your ${certTypeName} certification has expired`;
  }

  await sendTransactionalEmail({
    to: toEmail,
    subject,
    html,
    text,
    from: "InsightScoop Crew <crew@yardura.com>",
  });
}
