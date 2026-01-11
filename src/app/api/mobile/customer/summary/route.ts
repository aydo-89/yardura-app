import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { getCustomerWellnessAccess } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

async function fetchLatestReportFallback(customerId: string) {
  try {
    const rows = await prisma.$queryRaw<
      {
        id: string;
        weekStart: Date | string;
        noIssues: boolean;
        symptomTags: string[] | null;
      }[]
    >`SELECT "id", "weekStart", "noIssues", "symptomTags"
      FROM "WeeklyWellnessReport"
      WHERE "customerId" = ${customerId}
      ORDER BY "weekStart" DESC
      LIMIT 1`;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      zip: true,
      orgId: true,
      email: true,
      phone: true,
    },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const now = new Date();

  const wellnessClient = (prisma as typeof prisma & { weeklyWellnessReport?: any })
    .weeklyWellnessReport;

  const dogsPromise = (async () => {
    const dogs = await prisma.dog.findMany({
      where: {
        OR: [{ customerId: customer.id }, { userId }],
      },
      select: { id: true, customerId: true },
    });
    const unlinked = dogs.filter((dog) => !dog.customerId).map((dog) => dog.id);
    if (unlinked.length > 0) {
      await prisma.dog.updateMany({
        where: { id: { in: unlinked } },
        data: { customerId: customer.id },
      });
    }
    return dogs.length;
  })();

  const latestReportPromise = wellnessClient
    ? wellnessClient.findFirst({
        where: { customerId: customer.id },
        orderBy: { weekStart: 'desc' },
        select: {
          id: true,
          weekStart: true,
          noIssues: true,
          symptomTags: true,
        },
      })
    : fetchLatestReportFallback(customer.id);

  const contactPreferencePromise = prisma.lead.findFirst({
    where: { convertedToCustomerId: customer.id },
    orderBy: { submittedAt: 'desc' },
    select: { preferredContactMethod: true },
  });

  const [petsCount, nextVisit, lastVisit, latestReport, wellnessAccess, contactPreference] = await Promise.all([
    dogsPromise,
    prisma.serviceVisit.findFirst({
      where: {
        customerId: customer.id,
        scheduledDate: { gte: now },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledDate: 'asc' },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        serviceType: true,
        yardSize: true,
      },
    }),
    prisma.serviceVisit.findFirst({
      where: {
        customerId: customer.id,
        scheduledDate: { lt: now },
        status: { in: ['COMPLETED', 'CANCELLED', 'SKIPPED'] },
      },
      orderBy: { scheduledDate: 'desc' },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        serviceType: true,
        yardSize: true,
      },
    }),
    latestReportPromise,
    getCustomerWellnessAccess({ customerId: customer.id, orgId: customer.orgId }),
    contactPreferencePromise,
  ]);

  const latestReportDate =
    latestReport && 'weekStart' in latestReport
      ? latestReport.weekStart instanceof Date
        ? latestReport.weekStart
        : new Date(latestReport.weekStart)
      : null;
  const hasValidLatestReportDate =
    !!latestReportDate && !Number.isNaN(latestReportDate.getTime());

  return NextResponse.json({
    ok: true,
    data: {
      customer,
      orgId: customer.orgId,
      petsCount,
      nextVisit: nextVisit
        ? {
            ...nextVisit,
            scheduledDate: nextVisit.scheduledDate.toISOString(),
          }
        : null,
      lastVisit: lastVisit
        ? {
            ...lastVisit,
            scheduledDate: lastVisit.scheduledDate.toISOString(),
          }
        : null,
      latestReport:
        latestReport && hasValidLatestReportDate
          ? {
              ...latestReport,
              weekStart: latestReportDate.toISOString(),
            }
          : null,
      contact: {
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        preferredContactMethod: contactPreference?.preferredContactMethod ?? null,
      },
      wellnessAccess: {
        tier: wellnessAccess.tier,
        source: wellnessAccess.source,
        planEndsAt: wellnessAccess.planEndsAt ? wellnessAccess.planEndsAt.toISOString() : null,
        promoEndsAt: wellnessAccess.promoEndsAt.toISOString(),
        hasActiveService: wellnessAccess.hasActiveService,
        usage: wellnessAccess.usage,
        limits: wellnessAccess.limits,
        maxDogs: wellnessAccess.maxDogs,
      },
    },
  });
}
