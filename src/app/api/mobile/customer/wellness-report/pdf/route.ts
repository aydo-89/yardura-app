import { NextRequest, NextResponse } from 'next/server';
import { Prisma, WellnessReportScope } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { createSignedUrl, uploadFile } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { verifyMobileToken } from '@/lib/mobile-auth';

// Page dimensions
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 16;
const SECTION_GAP = 25;

// Colors
const COLOR_TEAL = rgb(0.2, 0.6, 0.55);
const COLOR_TEXT = rgb(0.15, 0.15, 0.15);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_LIGHT = rgb(0.7, 0.7, 0.7);

/**
 * Remove non-printable characters for PDF
 */
function sanitize(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2013|\u2014|\u2011/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wrap text to fit within maxWidth, returning array of lines
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const clean = sanitize(text);
  if (!clean) return [];

  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    try {
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        // Check if single word is too long
        const wordWidth = font.widthOfTextAtSize(word, fontSize);
        if (wordWidth > maxWidth) {
          // Truncate long words
          let truncated = word;
          while (truncated.length > 3 && font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
            truncated = truncated.slice(0, -1);
          }
          currentLine = truncated + '...';
        } else {
          currentLine = word;
        }
      }
    } catch {
      // If text measurement fails, just add what we have
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * PDF Builder class with proper Y tracking and page breaks
 */
class PDFBuilder {
  private doc: PDFDocument;
  private page: PDFPage;
  private regular!: PDFFont;
  private bold!: PDFFont;
  private y: number;
  private pageNum = 1;

  constructor(doc: PDFDocument) {
    this.doc = doc;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  async init() {
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
  }

  private checkPage(needed: number) {
    if (this.y - needed < MARGIN + 40) {
      this.newPage();
    }
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    this.pageNum++;
    // Page number footer
    const pageText = `Page ${this.pageNum}`;
    const w = this.regular.widthOfTextAtSize(pageText, 9);
    this.page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN - w,
      y: 25,
      size: 9,
      font: this.regular,
      color: COLOR_MUTED,
    });
  }

  drawHeader(name: string, scope: string, date: string) {
    // Teal header bar
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 90,
      width: PAGE_WIDTH,
      height: 90,
      color: COLOR_TEAL,
    });

    // Title
    this.page.drawText('Pet Wellness Report', {
      x: MARGIN,
      y: PAGE_HEIGHT - 45,
      size: 22,
      font: this.bold,
      color: rgb(1, 1, 1),
    });

    // Customer name
    this.page.drawText(sanitize(`Prepared for ${name}`), {
      x: MARGIN,
      y: PAGE_HEIGHT - 68,
      size: 11,
      font: this.regular,
      color: rgb(1, 1, 1),
    });

    // Date on right
    const dateW = this.regular.widthOfTextAtSize(date, 10);
    this.page.drawText(date, {
      x: PAGE_WIDTH - MARGIN - dateW,
      y: PAGE_HEIGHT - 45,
      size: 10,
      font: this.regular,
      color: rgb(1, 1, 1),
    });

    this.y = PAGE_HEIGHT - 110;

    // Scope indicator
    this.page.drawText(sanitize(scope), {
      x: MARGIN,
      y: this.y,
      size: 10,
      font: this.regular,
      color: COLOR_MUTED,
    });
    this.y -= SECTION_GAP;
  }

  drawSection(title: string) {
    this.checkPage(50);

    // Divider line
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: COLOR_LIGHT,
    });
    this.y -= 18;

    // Section title
    this.page.drawText(sanitize(title.toUpperCase()), {
      x: MARGIN,
      y: this.y,
      size: 11,
      font: this.bold,
      color: COLOR_TEAL,
    });
    this.y -= 20;
  }

  drawText(text: string, options?: { bold?: boolean; indent?: number; color?: typeof COLOR_TEXT }) {
    const font = options?.bold ? this.bold : this.regular;
    const indent = options?.indent ?? 0;
    const color = options?.color ?? COLOR_TEXT;
    const maxWidth = CONTENT_WIDTH - indent;

    const lines = wrapText(text, font, 10, maxWidth);
    const totalHeight = lines.length * LINE_HEIGHT;

    this.checkPage(totalHeight);

    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y,
        size: 10,
        font,
        color,
      });
      this.y -= LINE_HEIGHT;
    }
  }

  drawBullet(text: string) {
    const maxWidth = CONTENT_WIDTH - 20;
    const lines = wrapText(text, this.regular, 10, maxWidth);
    const totalHeight = lines.length * LINE_HEIGHT;

    this.checkPage(totalHeight);

    // Bullet point
    this.page.drawText('•', {
      x: MARGIN,
      y: this.y,
      size: 10,
      font: this.regular,
      color: COLOR_TEAL,
    });

    // Text lines
    for (let i = 0; i < lines.length; i++) {
      this.page.drawText(lines[i], {
        x: MARGIN + 15,
        y: this.y,
        size: 10,
        font: this.regular,
        color: COLOR_TEXT,
      });
      this.y -= LINE_HEIGHT;
    }

    this.y -= 4; // Extra spacing after bullet
  }

  drawKeyValue(key: string, value: string) {
    const keyText = sanitize(key) + ':';
    const keyWidth = this.bold.widthOfTextAtSize(keyText, 10);
    const valueMaxWidth = CONTENT_WIDTH - keyWidth - 15;

    const lines = wrapText(value, this.regular, 10, valueMaxWidth);
    const totalHeight = Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);

    this.checkPage(totalHeight);

    // Key
    this.page.drawText(keyText, {
      x: MARGIN,
      y: this.y,
      size: 10,
      font: this.bold,
      color: COLOR_MUTED,
    });

    // Value lines
    for (let i = 0; i < lines.length; i++) {
      this.page.drawText(lines[i], {
        x: MARGIN + keyWidth + 10,
        y: this.y - (i * LINE_HEIGHT),
        size: 10,
        font: this.regular,
        color: COLOR_TEXT,
      });
    }

    this.y -= (lines.length * LINE_HEIGHT) + 6;
  }

  drawEmptyState(msg: string) {
    this.checkPage(LINE_HEIGHT);
    this.page.drawText(sanitize(msg), {
      x: MARGIN,
      y: this.y,
      size: 10,
      font: this.regular,
      color: COLOR_MUTED,
    });
    this.y -= LINE_HEIGHT + 8;
  }

  drawStatGrid(items: Array<{ label: string; value: string | number }>) {
    if (items.length === 0) return;

    const colWidth = CONTENT_WIDTH / 3;
    const rows = Math.ceil(items.length / 3);
    const height = rows * 45;

    this.checkPage(height);

    items.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = MARGIN + col * colWidth;
      const baseY = this.y - row * 45;

      // Value
      this.page.drawText(sanitize(String(item.value)), {
        x,
        y: baseY,
        size: 18,
        font: this.bold,
        color: COLOR_TEAL,
      });

      // Label
      this.page.drawText(sanitize(item.label), {
        x,
        y: baseY - 16,
        size: 9,
        font: this.regular,
        color: COLOR_MUTED,
      });
    });

    this.y -= height + 10;
  }

  async drawImages(images: Array<{ url: string; label?: string }>) {
    if (images.length === 0) return;

    // Always start images on a new page or with enough space
    if (this.y < 400) {
      this.newPage();
    }

    this.drawSection('Sample Images');

    const imgWidth = 240;
    const imgHeight = 160;
    const gap = 20;

    for (let i = 0; i < Math.min(images.length, 4); i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);

      if (row > 0 && col === 0) {
        this.checkPage(imgHeight + 30);
      }

      const x = MARGIN + col * (imgWidth + gap);
      const baseY = this.y - row * (imgHeight + 30);

      try {
        const res = await fetch(images[i].url);
        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') ?? '';
        const buffer = await res.arrayBuffer();

        const img = contentType.includes('png')
          ? await this.doc.embedPng(buffer)
          : await this.doc.embedJpg(buffer);

        // Border
        this.page.drawRectangle({
          x: x - 2,
          y: baseY - imgHeight - 2,
          width: imgWidth + 4,
          height: imgHeight + 4,
          borderColor: COLOR_LIGHT,
          borderWidth: 1,
        });

        this.page.drawImage(img, {
          x,
          y: baseY - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });

        if (images[i].label) {
          this.page.drawText(sanitize(images[i].label!), {
            x,
            y: baseY - imgHeight - 14,
            size: 8,
            font: this.regular,
            color: COLOR_MUTED,
          });
        }
      } catch {
        // Skip failed images
      }
    }

    const rows = Math.ceil(Math.min(images.length, 4) / 2);
    this.y -= rows * (imgHeight + 30) + 20;
  }

  addSpace(amount = SECTION_GAP) {
    this.y -= amount;
  }

  drawFooter() {
    const disclaimer = 'This report is for informational purposes only and is not a substitute for professional veterinary advice.';
    const lines = wrapText(disclaimer, this.regular, 8, CONTENT_WIDTH);

    // Draw on all pages
    const pages = this.doc.getPages();
    for (const pg of pages) {
      pg.drawLine({
        start: { x: MARGIN, y: 50 },
        end: { x: PAGE_WIDTH - MARGIN, y: 50 },
        thickness: 0.5,
        color: COLOR_LIGHT,
      });

      for (let i = 0; i < lines.length; i++) {
        pg.drawText(lines[i], {
          x: MARGIN,
          y: 35 - i * 10,
          size: 8,
          font: this.regular,
          color: COLOR_MUTED,
        });
      }
    }
  }
}

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

export async function GET(request: NextRequest) {
  try {
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
    const normalizedDogId = dogId?.trim() || null;
    const days = parseDaysParam(searchParams.get('days'));
    const includeWeekly = parseBoolParam(searchParams.get('includeWeekly'), true);
    const includeFood = parseBoolParam(searchParams.get('includeFood'), true);
    const includeImages = parseBoolParam(searchParams.get('includeImages'), true);
    const includeChats = parseBoolParam(searchParams.get('includeChats'), true);
    const includeWalks = parseBoolParam(searchParams.get('includeWalks'), true);
    const shareLink = parseBoolParam(searchParams.get('share'), false);

    const dog = normalizedDogId
      ? await prisma.dog.findFirst({
          where: { id: normalizedDogId, customerId: customer.id },
          select: { name: true, breed: true, age: true, weight: true },
        })
      : null;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const dogOrHouseholdFilter = normalizedDogId
      ? { OR: [{ dogId: normalizedDogId }, { dogId: null }] }
      : {};
    const householdScope: WellnessReportScope = WellnessReportScope.HOUSEHOLD;
    const dogOrHouseholdCaptureFilter: Prisma.CustomerWellnessCaptureWhereInput =
      normalizedDogId
        ? {
            OR: [
              { dogId: normalizedDogId },
              { suspectedDogIds: { has: normalizedDogId } },
              { scope: householdScope },
            ],
          }
        : {};
    const dogOrHouseholdWeeklyFilter: Prisma.WeeklyWellnessReportWhereInput =
      normalizedDogId
        ? {
            OR: [
              { dogId: normalizedDogId },
              { suspectedDogIds: { has: normalizedDogId } },
              { scope: householdScope },
            ],
          }
        : {};

    const latestReport = includeWeekly
      ? await prisma.weeklyWellnessReport.findFirst({
          where: {
            customerId: customer.id,
            ...dogOrHouseholdWeeklyFilter,
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
              ...dogOrHouseholdCaptureFilter,
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
              ...dogOrHouseholdFilter,
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
              ...dogOrHouseholdFilter,
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([]),
      includeWalks
        ? prisma.customerWellnessWalk.findMany({
            where: {
              customerId: customer.id,
              startedAt: { gte: windowStart, lte: windowEnd },
              ...dogOrHouseholdFilter,
            },
            orderBy: { startedAt: 'desc' },
            take: 8,
            select: { distanceMeters: true, durationSeconds: true },
          })
        : Promise.resolve([]),
    ]);

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const pdf = new PDFBuilder(pdfDoc);
    await pdf.init();

    // Header
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const scopeStr = dog
      ? `${dog.name}${dog.breed ? ` (${dog.breed})` : ''}${dog.age ? ` - ${dog.age} years` : ''}${dog.weight ? ` - ${dog.weight} lbs` : ''}`
      : 'Household Summary';

    pdf.drawHeader(customer.name ?? 'Pet Owner', scopeStr, dateStr);

    // Quick Stats
    const stats: Array<{ label: string; value: string | number }> = [];
    if (includeWeekly && latestReport) {
      if (latestReport.symptomTags.length > 0) {
        stats.push({ label: 'Symptoms Noted', value: latestReport.symptomTags.length });
      }
      if (typeof latestReport.stoolFrequency === 'number') {
        stats.push({ label: 'Avg Stools/Day', value: latestReport.stoolFrequency });
      }
    }
    if (includeWalks && walks.length > 0) {
      stats.push({ label: 'Total Walks', value: walks.length });
      const miles = walks.reduce((a, w) => a + (w.distanceMeters ?? 0), 0) / 1609.34;
      stats.push({ label: 'Miles Walked', value: miles.toFixed(1) });
    }
    if (includeFood && foodLogs.length > 0) {
      stats.push({ label: 'Diet Entries', value: foodLogs.length });
    }

    if (stats.length > 0) {
      pdf.drawSection('Quick Overview');
      pdf.drawStatGrid(stats);
    }

    // Health Status
    if (includeWeekly) {
      pdf.drawSection('Health Status');

      if (latestReport) {
        const hasIssues = latestReport.vomiting || latestReport.diarrhea || latestReport.symptomTags.length > 0;

        if (hasIssues) {
          if (latestReport.symptomTags.length > 0) {
            pdf.drawKeyValue('Symptoms', latestReport.symptomTags.join(', '));
          }
          if (latestReport.vomiting) {
            pdf.drawBullet('Vomiting episodes reported');
          }
          if (latestReport.diarrhea) {
            pdf.drawBullet('Diarrhea or loose stools reported');
          }
        } else {
          pdf.drawText('No concerning symptoms reported during this period.', { color: COLOR_MUTED });
        }

        if (latestReport.behaviorNotes) {
          pdf.drawKeyValue('Behavior Notes', latestReport.behaviorNotes);
        }
      } else {
        pdf.drawEmptyState('No health data recorded for this period.');
      }

      pdf.addSpace();
    }

    // Stool Analysis
    if (includeWeekly) {
      pdf.drawSection('Stool Observations');

      if (latestReport) {
        const colors = latestReport.stoolColors.length > 0 ? latestReport.stoolColors.join(', ') : 'None recorded';
        const consistency = latestReport.stoolConsistency.length > 0 ? latestReport.stoolConsistency.join(', ') : 'None recorded';
        const contents = latestReport.stoolContents.length > 0 ? latestReport.stoolContents.join(', ') : 'None recorded';

        pdf.drawKeyValue('Colors', colors);
        pdf.drawKeyValue('Consistency', consistency);
        pdf.drawKeyValue('Contents', contents);

        if (typeof latestReport.stoolFrequency === 'number') {
          pdf.drawKeyValue('Frequency', `${latestReport.stoolFrequency} times per day`);
        }
        if (latestReport.stoolNotes) {
          pdf.drawKeyValue('Notes', latestReport.stoolNotes);
        }
      } else {
        pdf.drawEmptyState('No stool observations recorded.');
      }

      pdf.addSpace();
    }

    // Activity Summary
    if (includeWalks || includeFood) {
      pdf.drawSection('Activity & Care');

      if (includeWalks && walks.length > 0) {
        const totalDist = walks.reduce((a, w) => a + (w.distanceMeters ?? 0), 0);
        const totalTime = walks.reduce((a, w) => a + (w.durationSeconds ?? 0), 0);
        const miles = (totalDist / 1609.34).toFixed(1);
        const mins = Math.round(totalTime / 60);

        pdf.drawBullet(`${walks.length} walks recorded - ${miles} miles total (${mins} minutes)`);
      }

      if (includeFood && foodLogs.length > 0) {
        const recentLog = foodLogs[0];
        const foodName = [recentLog.brand, recentLog.productName].filter(Boolean).join(' ') || 'Food/treat logged';
        pdf.drawBullet(`Recent diet entry: ${foodName}`);
        if (foodLogs.length > 1) {
          pdf.drawBullet(`${foodLogs.length} total diet entries during this period`);
        }
      }

      if (latestReport) {
        if (latestReport.appetite) {
          pdf.drawKeyValue('Appetite', latestReport.appetite.toLowerCase());
        }
        if (latestReport.energy) {
          pdf.drawKeyValue('Energy Level', latestReport.energy.toLowerCase());
        }
        if (latestReport.hydration) {
          pdf.drawKeyValue('Water Intake', latestReport.hydration.toLowerCase());
        }
      }

      if (!walks.length && !foodLogs.length) {
        pdf.drawEmptyState('No activity data recorded.');
      }

      pdf.addSpace();
    }

    // AI Chat Insights
    if (includeChats) {
      pdf.drawSection('AI Wellness Insights');

      if (chatLogs.length > 0) {
        for (const chat of chatLogs.slice(0, 3)) {
          const response = typeof chat.response === 'object' && chat.response ? chat.response : {};
          const reply = typeof (response as { reply?: string }).reply === 'string'
            ? (response as { reply?: string }).reply
            : '';

          // Truncate long replies
          const cleanReply = reply.replace(/\s+/g, ' ').trim();
          const shortReply = cleanReply.length > 200 ? cleanReply.slice(0, 200) + '...' : cleanReply;

          const risk = chat.riskLevel ||
            (response as { risk_level?: string }).risk_level ||
            'unknown';

          const dateLabel = chat.createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          pdf.drawKeyValue(dateLabel, `Risk: ${risk}`);
          if (shortReply) {
            pdf.drawText(shortReply, { indent: 10, color: COLOR_MUTED });
          }
          pdf.addSpace(10);
        }
      } else {
        pdf.drawEmptyState('No AI consultations during this period.');
      }

      pdf.addSpace();
    }

    // Images
    if (includeImages && env.STORAGE_BUCKET) {
      const allMedia = [...ownerCaptures, ...proMedia].slice(0, 4);
      const imageUrls: Array<{ url: string; label?: string }> = [];

      for (const media of allMedia) {
        const storagePath = 'storagePath' in media ? media.storagePath : null;
        if (!storagePath) continue;

        const signedUrl = await createSignedUrl(env.STORAGE_BUCKET, storagePath, 60 * 10);
        if (!signedUrl) continue;

        const capturedAt = 'capturedAt' in media && media.capturedAt
          ? new Date(media.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : undefined;
        const source = storagePath.includes('customer') ? 'Owner' : 'Pro';

        imageUrls.push({
          url: signedUrl,
          label: capturedAt ? `${source} - ${capturedAt}` : source,
        });
      }

      if (imageUrls.length > 0) {
        await pdf.drawImages(imageUrls);
      }
    }

    // Footer
    pdf.drawFooter();

    const pdfBytes = await pdfDoc.save();

    if (shareLink) {
      if (!env.STORAGE_BUCKET) {
        return NextResponse.json(
          { ok: false, error: 'Storage is not configured for sharing.' },
          { status: 500 },
        );
      }
      const scopeLabel = normalizedDogId ?? 'household';
      const reportPath = `wellness-reports/${customer.id}/${scopeLabel}/${Date.now()}.pdf`;
      await uploadFile(env.STORAGE_BUCKET, reportPath, Buffer.from(pdfBytes), 'application/pdf');
      const signedUrl = await createSignedUrl(env.STORAGE_BUCKET, reportPath, 60 * 60 * 24);
      return NextResponse.json({
        ok: true,
        data: {
          url: signedUrl,
          expiresInHours: 24,
        },
      });
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="wellness-report.pdf"',
      },
    });
  } catch (error) {
    console.error('[wellness-report/pdf] Unhandled error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF report',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
