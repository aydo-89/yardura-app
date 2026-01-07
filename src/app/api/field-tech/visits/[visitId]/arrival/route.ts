import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CommunicationChannel,
  CommunicationStatus,
  ServiceStatus,
} from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { extractPreferredTimeWindow } from "@/lib/time-window";
import {
  createVisitCommunication,
  updateVisitCommunicationStatus,
} from "@/lib/service-visits/communications";
import { buildArrivalWindowMessage, sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";
import { sendTransactionalEmail } from "@/lib/email";
import { sendCustomerOnTheWayPush } from "@/lib/notifications/push";

const requestSchema = z
  .object({
    etaMinutes: z.number().int().positive().max(180).optional(),
    includePetReminder: z.boolean().optional(),
  })
  .optional();

type RouteParams = { params: Promise<{ visitId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 422 },
    );
  }
  const body = parsedBody.data ?? {};

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      scheduledDate: true,
      customer: {
        select: {
          id: true,
          name: true,
          userId: true,
          phone: true,
          email: true,
        },
      },
      metadata: true,
      communications: {
        where: { templateId: { in: ["on_way_sms_v1", "on_way_email_v1"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!visit || visit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (visit.status !== ServiceStatus.SCHEDULED && visit.status !== ServiceStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "visit_not_active" }, { status: 400 });
  }

  const phone = normalizePhone(visit.customer?.phone);
  const email = visit.customer?.email;
  
  // Require at least one contact method
  if (!phone && !email) {
    return NextResponse.json({ error: "missing_customer_contact" }, { status: 400 });
  }

  const { label } = extractPreferredTimeWindow(visit.metadata);
  const technicianName = auth?.userName ?? null;
  const includePetReminder = body.includePetReminder ?? true;
  
  // Determine channel: prefer SMS if phone available, otherwise email
  const useEmail = !phone && !!email;
  const channel = useEmail ? CommunicationChannel.EMAIL : CommunicationChannel.SMS;
  const templateId = useEmail ? "on_way_email_v1" : "on_way_sms_v1";
  
  const messageBody = buildArrivalWindowMessage({
    to: phone ?? email!,
    customerName: visit.customer?.name,
    windowLabel: label,
    etaMinutes: body.etaMinutes,
    technicianName,
    includePetReminder,
  });

  const communication = await createVisitCommunication({
    serviceVisitId: visit.id,
    channel,
    templateId,
    messageBody,
    sentBy: userId,
    status: CommunicationStatus.PENDING,
  });

  let status: CommunicationStatus = CommunicationStatus.PENDING;
  let statusDetail: string | null = null;
  let deliveryConfirmedAt: Date | null = null;

  try {
    if (useEmail) {
      // Send email
      console.log("[field-tech.arrival] Attempting to send email", { to: email, bodyLength: messageBody.length });
      const subject = `InsightScoop is on the way! 🐕`;
      // Simple branded email using InsightScoop brand colors
      const htmlBody = `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #FAF7F1;">
          <div style="background-color: #FFFFFF; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(27,30,35,0.08);">
            <h2 style="font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; color: #204B36; margin: 0 0 20px; font-size: 24px; font-weight: 700;">We're on our way! 🐕</h2>
            <p style="color: #1B1E23; font-size: 16px; line-height: 1.7; white-space: pre-wrap; margin: 0 0 24px;">${messageBody}</p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #64748B; font-size: 12px; margin: 0;">
              <span style="font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; font-weight: 600; letter-spacing: 0.1em;">INSIGHTSCOOP</span>
              <br />
              <span style="opacity: 0.8;">Clean yards. Healthy pups.</span>
            </p>
          </div>
        </div>
      `;
      
      try {
        await sendTransactionalEmail({
          to: email!,
          subject,
          html: htmlBody,
          text: messageBody,
        });
        status = CommunicationStatus.SENT;
        statusDetail = "email_sent";
        console.log("[field-tech.arrival] Email sent successfully");
      } catch (emailError: any) {
        console.error("[field-tech.arrival] Email send failed", emailError);
        status = CommunicationStatus.FAILED;
        statusDetail = emailError?.message ?? "email_error";
      }
    } else {
      // Send SMS
      console.log("[field-tech.arrival] Attempting to send SMS", { to: phone, bodyLength: messageBody.length });
      const result = await sendSms({ to: phone!, body: messageBody });
      console.log("[field-tech.arrival] SMS send result", result);
      const mapped = mapSmsStatus(result.status);
      status = mapped.status;
      statusDetail = mapped.detail;
      if (status === CommunicationStatus.DELIVERED) {
        deliveryConfirmedAt = new Date();
      }
    }
  } catch (error: any) {
    console.error("[field-tech.arrival.send] Error", error);
    status = CommunicationStatus.FAILED;
    statusDetail = error?.message ?? (useEmail ? "email_error" : "sms_error");
  }

  const updatedCommunication = await updateVisitCommunicationStatus({
    id: communication.id,
    status,
    statusDetail,
    deliveryConfirmedAt,
    sentAt: new Date(),
  });

  if (visit.customer?.userId) {
    try {
      const pushTemplateId = "on_way_push_v1";
      const existingPush = await prisma.visitCommunication.findFirst({
        where: {
          serviceVisitId: visit.id,
          channel: CommunicationChannel.PUSH,
          templateId: pushTemplateId,
        },
        select: { id: true },
      });

      if (!existingPush) {
        const pushComm = await createVisitCommunication({
          serviceVisitId: visit.id,
          channel: CommunicationChannel.PUSH,
          templateId: pushTemplateId,
          messageBody: "on the way push",
          status: CommunicationStatus.PENDING,
        });

        const pushResult = await sendCustomerOnTheWayPush({
          userId: visit.customer.userId,
          scheduledDate: visit.scheduledDate ?? null,
          preferredWindowLabel: label ?? null,
          etaMinutes: body.etaMinutes ?? null,
          technicianName,
        });

        const pushStatus =
          pushResult.sent > 0 ? CommunicationStatus.SENT : CommunicationStatus.FAILED;
        await updateVisitCommunicationStatus({
          id: pushComm.id,
          status: pushStatus,
          statusDetail: pushStatus === CommunicationStatus.SENT ? "sent" : "push_failed",
          sentAt: new Date(),
        });
      }
    } catch (error) {
      console.warn("[field-tech.arrival] push failed", error);
    }
  }

  return NextResponse.json({
    ok: true,
    channel,
    communication: {
      id: updatedCommunication.id,
      templateId: updatedCommunication.templateId,
      status: updatedCommunication.status,
      statusDetail: updatedCommunication.statusDetail,
      createdAt: updatedCommunication.createdAt,
      sentAt: updatedCommunication.sentAt,
    },
  });
}

function mapSmsStatus(status: string | undefined) {
  switch (status) {
    case "queued":
    case "sending":
    case "sent":
      return { status: CommunicationStatus.SENT, detail: status };
    case "delivered":
      return { status: CommunicationStatus.DELIVERED, detail: status };
    case "skipped":
      return { status: CommunicationStatus.FAILED, detail: "twilio_not_configured" };
    case "undelivered":
    case "failed":
      return { status: CommunicationStatus.FAILED, detail: status };
    default:
      return { status: CommunicationStatus.FAILED, detail: status ?? "unknown" };
  }
}

export const runtime = "nodejs";
