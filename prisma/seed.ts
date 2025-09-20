import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedOutbound(orgId: string, salesRepId: string) {
  const territory = await prisma.territory.create({
    data: {
      orgId,
      name: 'South Uptown',
      slug: `south-uptown-${Date.now()}`,
      type: 'AREA',
      color: '#0ea5e9',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-93.3076, 44.901],
            [-93.3025, 44.901],
            [-93.3025, 44.896],
            [-93.3076, 44.896],
            [-93.3076, 44.901],
          ],
        ],
      },
      assignments: {
        create: {
          orgId,
          userId: salesRepId,
          role: 'OWNER',
          isPrimary: true,
        },
      },
    },
  });

  const now = Date.now();
  const sampleLeads = [
    {
      firstName: 'Jordan',
      lastName: 'Neighbor',
      phone: '555-0100',
      address: '5630 Colfax Ave S',
      latitude: 44.90052,
      longitude: -93.30518,
      pipelineStage: 'cold',
      contactMethods: ['text', 'mobile'],
      howDidYouHear: 'Door knock',
      preferredStartOffsetDays: 2,
      activity: {
        type: 'DOOR_KNOCK' as const,
        notes: 'Friendly dog, wants info',
        occurredHoursAgo: 2,
        followUpHours: 24,
      },
    },
    {
      firstName: 'Skylar',
      lastName: 'Hill',
      phone: '555-0101',
      address: '5614 Colfax Ave S',
      latitude: 44.90003,
      longitude: -93.3046,
      pipelineStage: 'contacted',
      contactMethods: ['call'],
      howDidYouHear: 'Mailer follow-up',
      preferredStartOffsetDays: 5,
      activity: {
        type: 'CALL' as const,
        notes: 'Left voicemail, follow-up tomorrow',
        occurredHoursAgo: 6,
        followUpHours: 20,
      },
    },
    {
      firstName: 'Morgan',
      lastName: 'Lane',
      phone: '555-0102',
      address: '272 W 56th St',
      latitude: 44.89914,
      longitude: -93.3069,
      pipelineStage: 'scheduled',
      contactMethods: ['email'],
      howDidYouHear: 'Neighbor referral',
      preferredStartOffsetDays: 1,
      activity: {
        type: 'MEETING' as const,
        notes: 'Walkthrough on calendar for Friday',
        occurredHoursAgo: 12,
        followUpHours: 48,
      },
    },
  ];

  const createdLeads: Array<{ id: string; latitude: number | null; longitude: number | null }> = [];

  for (const [index, sample] of sampleLeads.entries()) {
    const preferredStartDate = new Date(now + sample.preferredStartOffsetDays * 24 * 60 * 60 * 1000);
    const followUpAt = sample.activity?.followUpHours
      ? new Date(now + sample.activity.followUpHours * 60 * 60 * 1000)
      : undefined;
    const occurredAt = sample.activity?.occurredHoursAgo
      ? new Date(now - sample.activity.occurredHoursAgo * 60 * 60 * 1000)
      : new Date(now);

    const lead = await prisma.lead.create({
      data: {
        orgId,
        leadType: 'outbound',
        pipelineStage: sample.pipelineStage,
        firstName: sample.firstName,
        lastName: sample.lastName,
        email: `outbound-${now}-${index}@yardura.test`,
        phone: sample.phone,
        address: sample.address,
        city: 'Minneapolis',
        state: 'MN',
        zipCode: '55419',
        latitude: sample.latitude,
        longitude: sample.longitude,
        ownerId: salesRepId,
        createdById: salesRepId,
        territoryId: territory.id,
        source: 'outbound',
        nextActionAt: followUpAt,
        pricingBreakdown: {
          metadata: {
            preferredStartDate: preferredStartDate.toISOString(),
            preferredContactMethods: sample.contactMethods,
            howDidYouHear: sample.howDidYouHear,
          },
        },
        activities: sample.activity
          ? {
              create: {
                orgId,
                userId: salesRepId,
                type: sample.activity.type,
                notes: sample.activity.notes,
                occurredAt,
                followUpAt,
              },
            }
          : undefined,
      },
      include: { activities: true },
    });

    const activity = lead.activities?.[0];
    if (activity) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastActivityId: activity.id,
          lastActivityAt: activity.occurredAt,
          nextActionAt: activity.followUpAt ?? followUpAt,
        },
      });
    }

    createdLeads.push({ id: lead.id, latitude: lead.latitude, longitude: lead.longitude });
  }

  if (createdLeads.length) {
    const start = createdLeads[0];
    await prisma.trip.create({
      data: {
        orgId,
        createdById: salesRepId,
        ownerId: salesRepId,
        territoryId: territory.id,
        name: 'Uptown Sweep',
        startLocation: {
          lat: start.latitude ?? 44.9005,
          lng: start.longitude ?? -93.3052,
        },
        stops: {
          create: createdLeads.map((lead, order) => ({
            leadId: lead.id,
            order: order + 1,
            plannedAt: new Date(now + order * 60 * 60 * 1000),
          })),
        },
      },
    });
  }
}

async function main() {
  const org = await prisma.org.findFirst();
  const salesRep = await prisma.user.findFirst({ where: { role: 'SALES_REP' } });

  if (org && salesRep) {
    await seedOutbound(org.id, salesRep.id);
  } else {
    console.warn('Skipping outbound seed (missing org or sales rep)');
  }
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
