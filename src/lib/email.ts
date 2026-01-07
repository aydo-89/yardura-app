import { getEmailConfig } from "@/lib/env";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  bcc?: string | string[];
  from?: string;
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  bcc,
  from,
}: SendEmailOptions): Promise<string | null> {
  const config = getEmailConfig();
  const recipients = Array.isArray(to) ? to : [to];
  const bccRecipients = bcc
    ? Array.isArray(bcc)
      ? bcc
      : [bcc]
    : [];
  const fromAddress = from ?? config.from;

  if (recipients.length === 0) {
    throw new Error("No email recipients provided");
  }

  if (config.provider === "smtp" && config.smtp) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport(config.smtp as any);
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients,
      subject,
      html,
      text,
      bcc: bccRecipients.length ? bccRecipients : undefined,
    });
    return info?.messageId ?? null;
  }

  if (config.provider === "resend" && config.resendApiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(config.resendApiKey);
    const response = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject,
      html,
      text,
      bcc: bccRecipients.length ? bccRecipients : undefined,
    });
    return response.data?.id ?? null;
  }

  console.log("\n[Email delivery disabled]");
  console.log("From:", fromAddress);
  console.log("To:", recipients.join(", "));
  if (bccRecipients.length) {
    console.log("Bcc:", bccRecipients.join(", "));
  }
  console.log("Subject:", subject);
  console.log("Body (text):", text ?? "—");
  console.log("Body (html):", html);
  console.log();
  return null;
}
