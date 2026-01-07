import {
  CommunicationChannel,
  CommunicationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface CreateCommunicationInput {
  serviceVisitId: string;
  channel: CommunicationChannel;
  templateId?: string | null;
  messageBody: string;
  mediaUrls?: string[];
  sentBy?: string | null;
  status?: CommunicationStatus;
  statusDetail?: string | null;
  sentAt?: Date | null;
  deliveryConfirmedAt?: Date | null;
  retryCount?: number;
}

export function createVisitCommunication(input: CreateCommunicationInput) {
  return prisma.visitCommunication.create({
    data: {
      serviceVisitId: input.serviceVisitId,
      channel: input.channel,
      templateId: input.templateId ?? null,
      messageBody: input.messageBody,
      mediaUrls: input.mediaUrls ?? [],
      sentBy: input.sentBy ?? null,
      status: input.status ?? CommunicationStatus.PENDING,
      statusDetail: input.statusDetail ?? null,
      sentAt: input.sentAt ?? null,
      deliveryConfirmedAt: input.deliveryConfirmedAt ?? null,
      retryCount: input.retryCount ?? 0,
    },
  });
}

interface UpdateCommunicationStatusInput {
  id: string;
  status: CommunicationStatus;
  statusDetail?: string | null;
  deliveryConfirmedAt?: Date | null;
  sentAt?: Date | null;
}

export function updateVisitCommunicationStatus(
  input: UpdateCommunicationStatusInput,
) {
  return prisma.visitCommunication.update({
    where: { id: input.id },
    data: {
      status: input.status,
      statusDetail: input.statusDetail ?? null,
      deliveryConfirmedAt: input.deliveryConfirmedAt ?? null,
      sentAt:
        input.sentAt ??
        (input.status === CommunicationStatus.PENDING ? null : new Date()),
    },
  });
}
