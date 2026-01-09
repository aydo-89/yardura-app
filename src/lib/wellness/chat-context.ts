import { prisma } from '@/lib/prisma';
import {
  buildWellnessReadingsFromCaptures,
  buildWellnessReadingsFromMedia,
} from '@/lib/wellness/readings';

type ChatContextLimits = {
  lookbackDays: number;
  weeklyReports: number;
  dailyCheckIns: number;
  ownerCaptures: number;
  proCaptures: number;
  foodInventory: number;
  foodLogs: number;
  foodSchedules: number;
  reminders: number;
  walks: number;
  chats: number;
  weightEntries: number;
};

const FULL_LIMITS: ChatContextLimits = {
  lookbackDays: 90,
  weeklyReports: 8,
  dailyCheckIns: 8,
  ownerCaptures: 6,
  proCaptures: 6,
  foodInventory: 8,
  foodLogs: 8,
  foodSchedules: 6,
  reminders: 6,
  walks: 12,
  chats: 6,
  weightEntries: 24,
};

const LITE_LIMITS: ChatContextLimits = {
  lookbackDays: 30,
  weeklyReports: 2,
  dailyCheckIns: 3,
  ownerCaptures: 2,
  proCaptures: 2,
  foodInventory: 3,
  foodLogs: 3,
  foodSchedules: 2,
  reminders: 3,
  walks: 4,
  chats: 2,
  weightEntries: 6,
};

const MAX_TEXT = 180;

const cleanText = (value: string | null | undefined, max = MAX_TEXT) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
};

const toIso = (value: Date | null | undefined) =>
  value instanceof Date ? value.toISOString() : null;

type WeatherSummary = {
  temperatureF: number | null;
  feelsLikeF: number | null;
  condition: string | null;
  alert: string | null;
};

const describeWeatherCode = (code?: number | null) => {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code ?? -1)) return 'Mostly clear';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code ?? -1)) return 'Fog';
  if (code && code >= 51 && code <= 67) return 'Drizzle or rain';
  if (code && code >= 71 && code <= 77) return 'Snow';
  if (code && code >= 80 && code <= 82) return 'Rain showers';
  if (code && code >= 95) return 'Thunderstorms';
  return 'Mixed';
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const summarizeTemps = (values: Array<number | null | undefined>) => {
  const cleaned = values.filter(isFiniteNumber);
  if (cleaned.length === 0) {
    return { high: null as number | null, low: null as number | null };
  }
  return { high: Math.max(...cleaned), low: Math.min(...cleaned) };
};

async function fetchWeatherSummary(
  latitude: number | null,
  longitude: number | null,
): Promise<WeatherSummary | null> {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,apparent_temperature,weather_code' +
    '&hourly=apparent_temperature' +
    '&daily=temperature_2m_max,temperature_2m_min' +
    '&temperature_unit=fahrenheit&timezone=auto';

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
      };
      hourly?: { apparent_temperature?: number[] };
    };

    const hourlyTemps = data.hourly?.apparent_temperature ?? [];
    const next6Summary = summarizeTemps(hourlyTemps.slice(0, 6));
    const currentTemp = isFiniteNumber(data.current?.temperature_2m)
      ? data.current?.temperature_2m
      : next6Summary.high ?? null;
    const feelsLike = isFiniteNumber(data.current?.apparent_temperature)
      ? data.current?.apparent_temperature
      : currentTemp;
    const condition = describeWeatherCode(data.current?.weather_code ?? null);

    const HEAT_CAUTION = 85;
    const HEAT_DANGER = 95;
    const COLD_CAUTION = 20;
    const COLD_DANGER = 10;

    let alert: string | null = null;
    if (isFiniteNumber(feelsLike) && feelsLike >= HEAT_DANGER) {
      alert = 'Extreme heat now';
    } else if (next6Summary.high !== null && next6Summary.high >= HEAT_DANGER) {
      alert = 'Heat spike expected';
    } else if (isFiniteNumber(feelsLike) && feelsLike >= HEAT_CAUTION) {
      alert = 'Warm conditions';
    } else if (next6Summary.high !== null && next6Summary.high >= HEAT_CAUTION) {
      alert = 'Warm stretch ahead';
    } else if (isFiniteNumber(feelsLike) && feelsLike <= COLD_DANGER) {
      alert = 'Dangerous cold now';
    } else if (next6Summary.low !== null && next6Summary.low <= COLD_DANGER) {
      alert = 'Dangerous cold soon';
    } else if (isFiniteNumber(feelsLike) && feelsLike <= COLD_CAUTION) {
      alert = 'Cold conditions';
    } else if (next6Summary.low !== null && next6Summary.low <= COLD_CAUTION) {
      alert = 'Cold stretch ahead';
    }

    return {
      temperatureF: currentTemp ?? null,
      feelsLikeF: feelsLike ?? null,
      condition,
      alert,
    };
  } catch {
    return null;
  }
}

type BuildChatContextOptions = {
  customerId: string;
  orgId: string;
  dogId?: string | null;
  includeFullContext: boolean;
  timeZone?: string | null;
};

type ChatContextResult = {
  context: Record<string, unknown>;
  memory: {
    householdSummary: string | null;
    dogSummary: string | null;
  };
};

export async function buildWellnessChatContext(
  options: BuildChatContextOptions,
): Promise<ChatContextResult> {
  const limits = options.includeFullContext ? FULL_LIMITS : LITE_LIMITS;
  const now = new Date();
  const lookback = new Date(now.getTime() - limits.lookbackDays * 24 * 60 * 60 * 1000);
  const dogFilter =
    options.dogId
      ? { OR: [{ dogId: options.dogId }, { suspectedDogIds: { has: options.dogId } }] }
      : undefined;

  const [
    customer,
    dogs,
    weightEntries,
    weeklyReports,
    dailyCheckIns,
    ownerCaptures,
    proMedia,
    foodProducts,
    foodLogs,
    foodSchedules,
    reminders,
    walks,
    job,
    nextVisit,
    billingPlan,
    chats,
    householdMemory,
    dogMemory,
  ] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: options.customerId },
      select: {
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        shareWellnessNotes: true,
        shareWellnessCaptures: true,
        autoBlurWellnessPhotos: true,
      },
    }),
    prisma.dog.findMany({
      where: options.dogId
        ? { id: options.dogId, customerId: options.customerId }
        : { customerId: options.customerId },
      select: {
        id: true,
        name: true,
        breed: true,
        age: true,
        weight: true,
        allergies: true,
        medications: true,
        dietNotes: true,
        vetName: true,
        vetClinic: true,
        vetPhone: true,
      },
    }),
    prisma.dogWeightEntry.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { dogId: options.dogId } : {}),
        recordedAt: { gte: lookback },
      },
      orderBy: { recordedAt: 'desc' },
      take: limits.weightEntries,
      select: {
        dogId: true,
        weightLbs: true,
        recordedAt: true,
      },
    }),
    prisma.weeklyWellnessReport.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { suspectedDogIds: { has: options.dogId } }] } : {}),
      },
      orderBy: { weekStart: 'desc' },
      take: limits.weeklyReports,
      select: {
        weekStart: true,
        weekEnd: true,
        noIssues: true,
        stoolColors: true,
        stoolConsistency: true,
        stoolContents: true,
        symptomTags: true,
        appetite: true,
        hydration: true,
        energy: true,
        stoolFrequency: true,
        vomiting: true,
        diarrhea: true,
        medsGiven: true,
        medsNotes: true,
        behaviorNotes: true,
        stoolNotes: true,
        diagnosisLabel: true,
        diagnosisNotes: true,
      },
    }),
    prisma.customerWellnessDailyCheckIn.findMany({
      where: {
        customerId: options.customerId,
        loggedAt: { gte: lookback },
        ...(options.dogId
          ? { OR: [{ dogId: options.dogId }, { suspectedDogIds: { has: options.dogId } }] }
          : {}),
      },
      orderBy: { loggedAt: 'desc' },
      take: limits.dailyCheckIns,
      select: {
        dogId: true,
        loggedAt: true,
        appetite: true,
        energy: true,
        waterIntake: true,
        stoolFrequency: true,
        vomiting: true,
        diarrhea: true,
        medsGiven: true,
        medsNotes: true,
        notes: true,
      },
    }),
    prisma.customerWellnessCapture.findMany({
      where: {
        customerId: options.customerId,
        analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
        ...(dogFilter ?? {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: limits.ownerCaptures,
      select: {
        id: true,
        capturedAt: true,
        analysisResult: true,
        storagePath: true,
        dogId: true,
      },
    }),
    prisma.serviceVisitMedia.findMany({
      where: {
        assetType: 'INSIGHTSCOOP',
        analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
        visibilityState: 'VISIBLE',
        serviceVisit: { customerId: options.customerId },
      },
      orderBy: { capturedAt: 'desc' },
      take: limits.proCaptures,
      select: {
        id: true,
        capturedAt: true,
        analysisResult: true,
        stoolSampleId: true,
        stoolSampleView: true,
        assetType: true,
        reviewStatus: true,
      },
    }),
    prisma.customerFoodProduct.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limits.foodInventory,
      select: {
        id: true,
        type: true,
        brand: true,
        productName: true,
        ingredients: true,
        notes: true,
        dogId: true,
      },
    }),
    prisma.customerFoodLog.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { loggedAt: 'desc' },
      take: limits.foodLogs,
      select: {
        loggedAt: true,
        type: true,
        brand: true,
        productName: true,
        portion: true,
        notes: true,
        dogId: true,
      },
    }),
    prisma.customerFoodSchedule.findMany({
      where: {
        customerId: options.customerId,
        active: true,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limits.foodSchedules,
      select: {
        timesOfDay: true,
        startsOn: true,
        endsOn: true,
        product: {
          select: {
            type: true,
            brand: true,
            productName: true,
          },
        },
      },
    }),
    prisma.customerWellnessReminder.findMany({
      where: {
        customerId: options.customerId,
        active: true,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { nextDueAt: 'asc' },
      take: limits.reminders,
      select: {
        title: true,
        category: true,
        nextDueAt: true,
        lastCompletedAt: true,
        dogId: true,
      },
    }),
    prisma.customerWellnessWalk.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limits.walks,
      select: {
        startedAt: true,
        durationSeconds: true,
        distanceMeters: true,
        dogId: true,
      },
    }),
    prisma.job.findFirst({
      where: { customerId: options.customerId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: {
        frequency: true,
        perVisitRevenueCents: true,
        extraAreas: true,
        deodorizeMode: true,
        status: true,
        dogCount: true,
        nextVisitAt: true,
      },
    }),
    prisma.serviceVisit.findFirst({
      where: {
        customerId: options.customerId,
        status: 'SCHEDULED',
        scheduledDate: { gte: now },
      },
      orderBy: { scheduledDate: 'asc' },
      select: {
        scheduledDate: true,
        serviceType: true,
        yardSize: true,
        dogsServiced: true,
        preferredTimeWindow: true,
      },
    }),
    prisma.customerBillingPlan.findFirst({
      where: { customerId: options.customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        billingPreference: true,
        recurringAmountCents: true,
        perVisitAmountCents: true,
        firstChargeAmountCents: true,
      },
    }),
    prisma.customerWellnessChatLog.findMany({
      where: {
        customerId: options.customerId,
        ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limits.chats,
      select: {
        createdAt: true,
        message: true,
        riskLevel: true,
      },
    }),
    prisma.customerWellnessMemory.findFirst({
      where: { customerId: options.customerId, key: 'household' },
      select: { summary: true },
    }),
    options.dogId
      ? prisma.customerWellnessMemory.findFirst({
          where: { customerId: options.customerId, key: `dog:${options.dogId}` },
          select: { summary: true },
        })
      : Promise.resolve(null),
  ]);

  const dogNameById = new Map(dogs.map((dog) => [dog.id, dog.name]));

  const weightsByDog = new Map<string, Array<{ weightLbs: number; recordedAt: Date }>>();
  weightEntries.forEach((entry) => {
    const list = weightsByDog.get(entry.dogId) ?? [];
    list.push({ weightLbs: entry.weightLbs, recordedAt: entry.recordedAt });
    weightsByDog.set(entry.dogId, list);
  });

  const dogSummaries = dogs.map((dog) => {
    const weights = weightsByDog.get(dog.id) ?? [];
    const latest = weights[0];
    const baseline = weights[weights.length - 1];
    const change =
      latest && baseline && latest.recordedAt !== baseline.recordedAt
        ? Number((latest.weightLbs - baseline.weightLbs).toFixed(2))
        : null;
    return {
      id: dog.id,
      name: dog.name,
      breed: cleanText(dog.breed, 80),
      ageYears: dog.age ?? null,
      weightLbs: dog.weight ?? null,
      allergies: cleanText(dog.allergies, 140),
      medications: cleanText(dog.medications, 140),
      dietNotes: cleanText(dog.dietNotes, 140),
      vetName: cleanText(dog.vetName, 80),
      vetClinic: cleanText(dog.vetClinic, 80),
      vetPhoneOnFile: Boolean(dog.vetPhone),
      weightTrend: latest
        ? {
            latest: {
              weightLbs: latest.weightLbs,
              recordedAt: toIso(latest.recordedAt),
            },
            changeSinceFirst: change,
          }
        : null,
    };
  });

  const ownerReadings = buildWellnessReadingsFromCaptures(
    ownerCaptures.map((capture) => ({
      id: capture.id,
      capturedAt: capture.capturedAt,
      analysisResult: (capture.analysisResult as Record<string, unknown> | null) ?? null,
      storagePath: capture.storagePath ?? null,
      dogName: capture.dogId ? dogNameById.get(capture.dogId) ?? null : null,
    })),
  );

  const proReadings = buildWellnessReadingsFromMedia(
    proMedia.map((media) => ({
      id: media.id,
      capturedAt: media.capturedAt,
      analysisResult: (media.analysisResult as Record<string, unknown> | null) ?? null,
      stoolSampleId: media.stoolSampleId ?? null,
      stoolSampleView: media.stoolSampleView ?? null,
      assetType: media.assetType ?? null,
      reviewStatus: media.reviewStatus ?? null,
    })),
  );

  const recentOwnerReadings = ownerReadings.slice(0, limits.ownerCaptures).map((reading) => ({
    capturedAt: reading.timestamp,
    dogName: reading.dogName ?? null,
    indicator: reading.indicator ?? null,
    summary: cleanText(reading.summary ?? null, 200),
    color: reading.color ?? null,
    consistency: reading.consistencyLabel ?? null,
    content: reading.contentLabel ?? null,
    hydrationScore: reading.hydrationScore ?? null,
    firmnessScale: reading.firmnessScale ?? null,
    issues: reading.issues.slice(0, 4),
  }));

  const recentProReadings = proReadings.slice(0, limits.proCaptures).map((reading) => ({
    capturedAt: reading.timestamp,
    color: reading.color ?? null,
    consistency: reading.consistencyLabel ?? null,
    content: reading.contentLabel ?? null,
    issues: reading.issues.slice(0, 4),
  }));

  const reminderOverdueCount = reminders.filter(
    (reminder) => reminder.nextDueAt < now,
  ).length;

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentWalks = walks.filter((walk) => walk.startedAt >= weekAgo);
  const walkSummary = recentWalks.reduce(
    (acc, walk) => {
      acc.totalDistanceMeters += walk.distanceMeters;
      acc.totalDurationSeconds += walk.durationSeconds;
      return acc;
    },
    { totalDistanceMeters: 0, totalDurationSeconds: 0 },
  );

  const weather = options.includeFullContext
    ? await fetchWeatherSummary(customer?.latitude ?? null, customer?.longitude ?? null)
    : null;

  const context = {
    generatedAt: now.toISOString(),
    mode: options.includeFullContext ? 'full' : 'lite',
    timeZone: options.timeZone ?? null,
    selectedDogId: options.dogId ?? null,
    customer: customer
      ? {
          name: customer.name,
          memberSince: toIso(customer.createdAt),
          hasEmail: Boolean(customer.email),
          hasPhone: Boolean(customer.phone),
          dogsCount: dogs.length,
          shareWellnessNotes: customer.shareWellnessNotes,
          shareWellnessCaptures: customer.shareWellnessCaptures,
          autoBlurWellnessPhotos: customer.autoBlurWellnessPhotos,
        }
      : null,
    dogs: dogSummaries,
    memory: {
      householdSummary: cleanText(householdMemory?.summary ?? null, 800),
      dogSummary: cleanText(dogMemory?.summary ?? null, 800),
    },
    wellnessReports: weeklyReports.map((report) => ({
      weekStart: toIso(report.weekStart),
      weekEnd: toIso(report.weekEnd),
      noIssues: report.noIssues,
      symptomTags: report.symptomTags.slice(0, 8),
      stoolColors: report.stoolColors.slice(0, 6),
      stoolConsistency: report.stoolConsistency.slice(0, 6),
      stoolContents: report.stoolContents.slice(0, 6),
      appetite: report.appetite ?? null,
      hydration: report.hydration ?? null,
      energy: report.energy ?? null,
      stoolFrequency: report.stoolFrequency ?? null,
      vomiting: report.vomiting,
      diarrhea: report.diarrhea,
      medsGiven: report.medsGiven,
      medsNotes: cleanText(report.medsNotes ?? null, 140),
      behaviorNotes: cleanText(report.behaviorNotes ?? null, 140),
      stoolNotes: cleanText(report.stoolNotes ?? null, 140),
      diagnosisLabel: cleanText(report.diagnosisLabel ?? null, 80),
      diagnosisNotes: cleanText(report.diagnosisNotes ?? null, 140),
    })),
    dailyCheckIns: dailyCheckIns.map((checkIn) => ({
      loggedAt: toIso(checkIn.loggedAt),
      dogName: checkIn.dogId ? dogNameById.get(checkIn.dogId) ?? null : null,
      appetite: checkIn.appetite ?? null,
      energy: checkIn.energy ?? null,
      waterIntake: checkIn.waterIntake ?? null,
      stoolFrequency: checkIn.stoolFrequency ?? null,
      vomiting: checkIn.vomiting,
      diarrhea: checkIn.diarrhea,
      medsGiven: checkIn.medsGiven,
      medsNotes: cleanText(checkIn.medsNotes ?? null, 140),
      notes: cleanText(checkIn.notes ?? null, 140),
    })),
    captures: {
      owner: recentOwnerReadings,
      pro: recentProReadings,
    },
    food: {
      inventory: foodProducts.map((item) => ({
        type: item.type,
        name: cleanText(
          [item.brand, item.productName].filter(Boolean).join(' ').trim(),
          120,
        ),
        ingredients: cleanText(item.ingredients ?? null, 140),
        notes: cleanText(item.notes ?? null, 120),
        dogName: item.dogId ? dogNameById.get(item.dogId) ?? null : null,
      })),
      logs: foodLogs.map((log) => ({
        loggedAt: toIso(log.loggedAt),
        type: log.type,
        name: cleanText(
          [log.brand, log.productName].filter(Boolean).join(' ').trim(),
          120,
        ),
        portion: cleanText(log.portion ?? null, 40),
        notes: cleanText(log.notes ?? null, 120),
        dogName: log.dogId ? dogNameById.get(log.dogId) ?? null : null,
      })),
      schedules: foodSchedules.map((schedule) => ({
        timesOfDay: schedule.timesOfDay.slice(0, 6),
        startsOn: toIso(schedule.startsOn),
        endsOn: toIso(schedule.endsOn),
        item: cleanText(
          [schedule.product.brand, schedule.product.productName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          120,
        ),
        type: schedule.product.type,
      })),
    },
    reminders: {
      overdueCount: reminderOverdueCount,
      upcoming: reminders.map((reminder) => ({
        title: cleanText(reminder.title, 100),
        category: reminder.category,
        nextDueAt: toIso(reminder.nextDueAt),
        lastCompletedAt: toIso(reminder.lastCompletedAt),
        dogName: reminder.dogId ? dogNameById.get(reminder.dogId) ?? null : null,
      })),
    },
    walks: {
      last7Days: {
        count: recentWalks.length,
        distanceMeters: Number(walkSummary.totalDistanceMeters.toFixed(1)),
        durationSeconds: Math.round(walkSummary.totalDurationSeconds),
      },
      recent: walks.map((walk) => ({
        startedAt: toIso(walk.startedAt),
        durationSeconds: walk.durationSeconds,
        distanceMeters: Number(walk.distanceMeters.toFixed(1)),
        dogName: walk.dogId ? dogNameById.get(walk.dogId) ?? null : null,
      })),
    },
    service: {
      job: job
        ? {
            status: job.status,
            frequency: job.frequency,
            dogCount: job.dogCount ?? null,
            extraAreas: job.extraAreas ?? null,
            deodorizeMode: job.deodorizeMode ?? null,
            perVisitRevenueCents: job.perVisitRevenueCents ?? null,
            nextVisitAt: toIso(job.nextVisitAt),
          }
        : null,
      nextVisit: nextVisit
        ? {
            scheduledDate: toIso(nextVisit.scheduledDate),
            serviceType: nextVisit.serviceType,
            yardSize: nextVisit.yardSize,
            dogsServiced: nextVisit.dogsServiced ?? null,
            preferredTimeWindow: cleanText(nextVisit.preferredTimeWindow ?? null, 80),
          }
        : null,
    },
    billing: {
      plan: billingPlan
        ? {
            billingPreference: billingPlan.billingPreference,
            recurringAmountCents: billingPlan.recurringAmountCents ?? null,
            perVisitAmountCents: billingPlan.perVisitAmountCents ?? null,
            firstChargeAmountCents: billingPlan.firstChargeAmountCents ?? null,
          }
        : null,
    },
    chats: chats.map((chat) => ({
      createdAt: toIso(chat.createdAt),
      message: cleanText(chat.message, 120),
      riskLevel: chat.riskLevel ?? null,
    })),
    weather,
  };

  return {
    context,
    memory: {
      householdSummary: cleanText(householdMemory?.summary ?? null, 800),
      dogSummary: cleanText(dogMemory?.summary ?? null, 800),
    },
  };
}
