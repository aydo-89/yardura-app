import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { createSignedUrl } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { verifyMobileToken } from '@/lib/mobile-auth';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function parseDaysParam(value: string | null) {
  const parsed = Number(value ?? 14);
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(Math.max(Math.floor(parsed), 3), 30);
}

function parseBoolParam(value: string | null, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') ?? '';
  const arrayBuffer = await response.arrayBuffer();
  return { bytes: arrayBuffer, contentType };
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true, name: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get('dogId');
  const days = parseDaysParam(searchParams.get('days'));
  const includeWeekly = parseBoolParam(searchParams.get('includeWeekly'), true);
  const includeRecap = parseBoolParam(searchParams.get('includeDaily'), true);
  const includeFood = parseBoolParam(searchParams.get('includeFood'), true);
  const includeImages = parseBoolParam(searchParams.get('includeImages'), true);
  const includeChats = parseBoolParam(searchParams.get('includeChats'), true);
  const includeWalks = parseBoolParam(searchParams.get('includeWalks'), true);

  const dog = dogId
    ? await prisma.dog.findFirst({
        where: { id: dogId, customerId: customer.id },
        select: { name: true, breed: true, age: true, weight: true },
      })
    : null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const latestReport = includeWeekly
    ? await prisma.weeklyWellnessReport.findFirst({
        where: {
          customerId: customer.id,
          ...(dogId ? { OR: [{ dogId }, { suspectedDogIds: { has: dogId } }] } : {}),
        },
        orderBy: { weekStart: 'desc' },
      })
    : null;

  const windowStart = latestReport?.weekStart ?? since;
  const windowEnd = latestReport?.weekEnd ?? new Date();

  const [ownerCaptures, proMedia, foodLogs, chatLogs, walks] = await Promise.all([
    includeImages
      ? prisma.customerWellnessCapture.findMany({
          where: {
            customerId: customer.id,
            capturedAt: { gte: windowStart, lte: windowEnd },
            ...(dogId ? { OR: [{ dogId }, { suspectedDogIds: { has: dogId } }] } : {}),
          },
          orderBy: { capturedAt: 'desc' },
          take: 4,
        })
      : Promise.resolve([]),
    includeImages
      ? prisma.serviceVisitMedia.findMany({
          where: {
            assetType: 'INSIGHTSCOOP',
            analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
            visibilityState: 'VISIBLE',
            capturedAt: { gte: windowStart, lte: windowEnd },
            serviceVisit: { customerId: customer.id },
          },
          orderBy: { capturedAt: 'desc' },
          take: 4,
        })
      : Promise.resolve([]),
    includeFood
      ? prisma.customerFoodLog.findMany({
          where: {
            customerId: customer.id,
            loggedAt: { gte: windowStart, lte: windowEnd },
            ...(dogId ? { dogId } : {}),
          },
          orderBy: { loggedAt: 'desc' },
          take: 4,
        })
      : Promise.resolve([]),
    includeChats
      ? prisma.customerWellnessChatLog.findMany({
          where: {
            customerId: customer.id,
            createdAt: { gte: windowStart, lte: windowEnd },
            ...(dogId ? { dogId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 2,
        })
      : Promise.resolve([]),
    includeWalks
      ? prisma.customerWellnessWalk.findMany({
          where: {
            customerId: customer.id,
            startedAt: { gte: windowStart, lte: windowEnd },
            ...(dogId ? { dogId } : {}),
          },
          orderBy: { startedAt: 'desc' },
          take: 8,
          select: { distanceMeters: true, durationSeconds: true },
        })
      : Promise.resolve([]),
  ]);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 12,
    color = rgb(0.1, 0.1, 0.1),
  ) => {
    page.drawText(text, { x, y, size, font, color });
  };

  drawText('Wellness Report', 50, 750, 20);
  drawText(`Customer: ${customer.name ?? 'Owner'}`, 50, 728, 12, rgb(0.3, 0.3, 0.3));
  drawText(`Date: ${new Date().toLocaleDateString()}`, 50, 712, 12, rgb(0.3, 0.3, 0.3));

  if (dog) {
    drawText(
      `Dog: ${dog.name}${dog.breed ? ` · ${dog.breed}` : ''}${
        typeof dog.age === 'number' ? ` · ${dog.age} yrs` : ''
      }${typeof dog.weight === 'number' ? ` · ${dog.weight} lbs` : ''}`,
      50,
      690,
      12,
      rgb(0.2, 0.2, 0.2),
    );
  } else {
    drawText('Scope: Household summary', 50, 690, 12, rgb(0.2, 0.2, 0.2));
  }

  let cursorY = 660;
  const includeSymptoms = includeWeekly || includeRecap;
  const includeTimeline = includeRecap || includeFood || includeWalks;

  if (!includeSymptoms && !includeWeekly && !includeTimeline && !includeChats && !includeImages) {
    drawText('No report sections selected.', 50, cursorY, 12, rgb(0.4, 0.4, 0.4));
    cursorY -= 18;
  }

  if (includeSymptoms) {
    drawText('Recent symptoms & notes', 50, cursorY, 14);
    cursorY -= 18;
  }

  const symptomLines: string[] = [];
  if (includeWeekly && latestReport) {
    if (latestReport.symptomTags.length) {
      symptomLines.push(`Weekly tags: ${latestReport.symptomTags.join(', ')}`);
    }
    if (latestReport.behaviorNotes) symptomLines.push(`Behavior: ${latestReport.behaviorNotes}`);
    if (latestReport.stoolNotes) symptomLines.push(`Stool notes: ${latestReport.stoolNotes}`);
  }
  if (includeRecap && latestReport) {
    if (latestReport.vomiting) symptomLines.push('Vomiting reported this week');
    if (latestReport.diarrhea) symptomLines.push('Diarrhea reported this week');
    if (typeof latestReport.stoolFrequency === 'number') {
      symptomLines.push(`Stool frequency: ${latestReport.stoolFrequency} per day`);
    }
  }
  if (includeSymptoms && symptomLines.length === 0) {
    symptomLines.push('No concerning symptoms reported recently.');
  }

  if (includeSymptoms) {
    symptomLines.slice(0, 5).forEach((line) => {
      drawText(`• ${line}`, 50, cursorY, 11, rgb(0.2, 0.2, 0.2));
      cursorY -= 14;
    });
    cursorY -= 6;
  }

  if (includeWeekly) {
    drawText('Recent stool observations', 50, cursorY, 14);
    cursorY -= 18;

    if (latestReport) {
      drawText(
        `Colors: ${latestReport.stoolColors.join(', ') || 'None'} · Consistency: ${
          latestReport.stoolConsistency.join(', ') || 'None'
        } · Content: ${latestReport.stoolContents.join(', ') || 'None'}`,
        50,
        cursorY,
        11,
        rgb(0.2, 0.2, 0.2),
      );
    } else {
      drawText('No weekly report available yet.', 50, cursorY, 11, rgb(0.4, 0.4, 0.4));
    }

    cursorY -= 10;
  }

  if (includeTimeline) {
    const timelineTitle = includeRecap
      ? 'Weekly recap & care timeline'
      : 'Diet & care timeline';
    drawText(timelineTitle, 50, cursorY, 14);
    cursorY -= 18;
  }

  const timelineLines: string[] = [];
  if (includeRecap && latestReport) {
    if (latestReport.medsGiven) {
      timelineLines.push('Meds given this week');
    }
    if (latestReport.medsNotes) {
      timelineLines.push(`Meds notes: ${latestReport.medsNotes}`);
    }
    if (latestReport.appetite) {
      timelineLines.push(`Appetite: ${latestReport.appetite.toLowerCase()}`);
    }
    if (latestReport.energy) {
      timelineLines.push(`Energy: ${latestReport.energy.toLowerCase()}`);
    }
    if (latestReport.hydration) {
      timelineLines.push(`Water intake: ${latestReport.hydration.toLowerCase()}`);
    }
  }
  if (includeFood && foodLogs.length > 0) {
    const log = foodLogs[0];
    const name = [log.brand, log.productName].filter(Boolean).join(' ');
    timelineLines.push(`Diet log: ${name || 'New food/treat logged'}`);
  }
  if (includeWalks && walks.length > 0) {
    const totals = walks.reduce(
      (acc, walk) => {
        acc.distanceMeters += walk.distanceMeters ?? 0;
        acc.durationSeconds += walk.durationSeconds ?? 0;
        return acc;
      },
      { distanceMeters: 0, durationSeconds: 0 },
    );
    const miles = totals.distanceMeters / 1609.34;
    const minutes = Math.round(totals.durationSeconds / 60);
    timelineLines.push(`Walks: ${walks.length} total • ${miles.toFixed(1)} mi • ${minutes} min`);
  }
  if (includeTimeline && timelineLines.length === 0) {
    timelineLines.push('No weekly recap recorded during this window.');
  }

  if (includeTimeline) {
    timelineLines.slice(0, 4).forEach((line) => {
      drawText(`• ${line}`, 50, cursorY, 11, rgb(0.2, 0.2, 0.2));
      cursorY -= 14;
    });
    cursorY -= 6;
  }

  if (includeChats) {
    drawText('AI chat highlights', 50, cursorY, 14);
    cursorY -= 18;
    const chatLines: string[] = [];
    chatLogs.forEach((chat) => {
      const response = typeof chat.response === 'object' && chat.response ? chat.response : {};
      const reply =
        typeof (response as { reply?: string }).reply === 'string'
          ? (response as { reply?: string }).reply
          : '';
      const cleanReply = reply?.replace(/\s+/g, ' ').trim() ?? '';
      const shortReply = cleanReply.length > 90 ? `${cleanReply.slice(0, 90)}…` : cleanReply;
      const risk =
        chat.riskLevel ||
        (response as { risk_level?: string }).risk_level ||
        'Unknown';
      const label = risk ? `Risk: ${risk}` : 'Risk: Unknown';
      const dateLabel = chat.createdAt.toLocaleDateString();
      chatLines.push(
        `${dateLabel} · ${label}${shortReply ? ` · ${shortReply}` : ''}`,
      );
    });
    if (chatLines.length === 0) {
      chatLines.push('No AI chats during this window.');
    }
    chatLines.slice(0, 2).forEach((line) => {
      drawText(`• ${line}`, 50, cursorY, 11, rgb(0.2, 0.2, 0.2));
      cursorY -= 14;
    });
    cursorY -= 6;
  }

  if (includeImages) {
    const imageSlots = [
      { x: 50, y: 190, w: 240, h: 160 },
      { x: 320, y: 190, w: 240, h: 160 },
      { x: 50, y: 20, w: 240, h: 160 },
      { x: 320, y: 20, w: 240, h: 160 },
    ];

    const imagesToUse = [...ownerCaptures, ...proMedia].slice(0, imageSlots.length);
    if (env.STORAGE_BUCKET && imagesToUse.length > 0) {
      for (let i = 0; i < imagesToUse.length; i += 1) {
        const media = imagesToUse[i];
        const storagePath = 'storagePath' in media ? media.storagePath : null;
        if (!storagePath) continue;
        const signedUrl = await createSignedUrl(env.STORAGE_BUCKET, storagePath, 60 * 10);
        if (!signedUrl) continue;
        const imageData = await fetchImageBytes(signedUrl);
        if (!imageData) continue;
        try {
          const embedded =
            imageData.contentType.includes('png')
              ? await pdfDoc.embedPng(imageData.bytes)
              : await pdfDoc.embedJpg(imageData.bytes);
          const slot = imageSlots[i];
          page.drawImage(embedded, {
            x: slot.x,
            y: slot.y,
            width: slot.w,
            height: slot.h,
          });
        } catch {
          // Skip any embed failures silently
        }
      }
    }
  }

  drawText(
    'Not a diagnosis. Seek veterinary care for severe symptoms or worsening condition.',
    50,
    370,
    10,
    rgb(0.4, 0.4, 0.4),
  );

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="wellness-report.pdf"',
    },
  });
}

export const runtime = 'nodejs';
