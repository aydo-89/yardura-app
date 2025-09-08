'use client';

import { useMemo, useRef, useState } from 'react';
// import { motion } from 'framer-motion';
import type { ChangeEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { Input } from '@/components/ui/input';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import {
  Heart,
  Calendar,
  TrendingUp,
  Users,
  Settings,
  Share2,
  Copy,
  CircleAlert,
  // CheckCircle2,
  Dog,
  Trophy,
  Home,
  User,
  Leaf,
  Bug,
  Eye,
  History,
  AlertTriangle,
  AlertCircle,
  Download,
  Palette,
  BarChart3,
  Lightbulb,
  Waves,
  Activity,
  Search,
  CheckCircle,
  Info,
  Droplets,
} from 'lucide-react';
import { generateWeekReadings, getScenario, getRandomScenarioKey, MOCK_SCENARIOS } from '@/data/mockWellnessData';

function ReportsList({ orgId }: { orgId: string }) {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(label);
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {months.map((m) => (
        <a
          key={m}
          className="border rounded-lg p-3 flex items-center justify-between hover:bg-accent-soft"
          href={`/api/reports/monthly?orgId=${encodeURIComponent(orgId)}&month=${m}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('report_download', { month: m, orgId })}
        >
          <span className="text-sm">{m}</span>
          <span className="text-accent text-xs underline">Download</span>
        </a>
      ))}
    </div>
  );
}

type DashboardClientProps = {
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    zipCode?: string | null;
    stripeCustomerId?: string | null;
    orgId?: string | null;
  };
  dogs: Array<{
    id: string;
    name: string;
    breed?: string | null;
    age?: number | null;
    weight?: number | null;
  }>;
  serviceVisits: Array<{
    id: string;
    scheduledDate: string; // ISO
    status: string;
    serviceType: string;
    yardSize: string;
  }>;
  dataReadings: Array<{
    id: string;
    timestamp: string; // ISO
    weight?: number | null;
    volume?: number | null;
    color?: string | null;
    consistency?: string | null;
  }>;
};

function formatLbsFromGrams(totalGrams: number): string {
  const lbs = totalGrams * 0.00220462;
  return lbs.toFixed(1);
}

function getProfileCompleteness(user: DashboardClientProps['user'], dogsCount: number) {
  const fields: Array<[string, boolean]> = [
    ['Name', Boolean(user.name && user.name.trim().length > 0)],
    ['Phone', Boolean(user.phone && user.phone.trim().length > 0)],
    ['Address', Boolean(user.address && user.address.trim().length > 0)],
    ['City', Boolean(user.city && user.city.trim().length > 0)],
    ['ZIP code', Boolean(user.zipCode && user.zipCode.trim().length > 0)],
    ['At least 1 dog profile', dogsCount > 0],
  ];
  const completed = fields.filter(([, ok]) => ok).length;
  const percent = Math.round((completed / fields.length) * 100);
  return { percent, fields };
}

type WeeklyPoint = { weekLabel: string; start: Date; value: number };

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWeekLabel(d: Date): string {
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

function buildWeeklySeries(
  readings: DashboardClientProps['dataReadings'],
  weeks: number = 8
): WeeklyPoint[] {
  const now = new Date();
  const currentStart = startOfWeek(now);
  const buckets: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ weekLabel: formatWeekLabel(start), start, value: 0 });
  }
  readings.forEach((r) => {
    const t = new Date(r.timestamp);
    const rStart = startOfWeek(t).getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].start.getTime() === rStart) {
        buckets[i].value += 1; // count observations per week
        break;
      }
    }
  });
  return buckets;
}

// function buildSparklinePath(points: WeeklyPoint[], width = 280, height = 60, padding = 16) {
//   if (points.length === 0) return '';
//   const maxVal = Math.max(1, ...points.map((p) => p.value));
//   const innerWidth = width - padding * 2;
//   const innerHeight = height - padding * 2;
//   const stepX = innerWidth / Math.max(1, points.length - 1);
//   const yFor = (v: number) => padding + (innerHeight - (v / maxVal) * innerHeight);
//   const xFor = (i: number) => padding + i * stepX;
//   let d = '';
//   points.forEach((p, i) => {
//     const x = xFor(i);
//     const y = yFor(p.value);
//     d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
//   });
//   return d;
// }

// StatRing component removed per design simplification

export default function DashboardClientNew(props: DashboardClientProps) {
  const { user, dogs, serviceVisits, dataReadings } = props;
  const [copied, setCopied] = useState(false);
  const [showColorDetails, setShowColorDetails] = useState(true);
  const [timelineHover, setTimelineHover] = useState<null | { x: number; y: number; text: string; href?: string; i: number; severity: 0 | 1 | 2 }>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const setHoverDelayed = (payload: { x: number; y: number; text: string; href?: string; i: number; severity: 0 | 1 | 2 }) => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => setTimelineHover(payload), 50) as unknown as number;
  };
  const clearHoverDelayed = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTimelineHover(null);
  };

  // Track user-reviewed warnings/needs-attention by week index
  const [reviewedByIndex, setReviewedByIndex] = useState<Record<number, boolean>>({});

  // Generate particle data once to avoid hydration mismatch
  const [particles] = useState(() => {
    // Use deterministic seeded random for consistent particles between SSR and client
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 1000) * 10000;
      return Math.abs(x - Math.floor(x));
    };

    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.floor(seededRandom(i * 1) * 100),
      top: Math.floor(seededRandom(i * 2) * 100),
      width: Math.floor(seededRandom(i * 3) * 4) + 2,
      height: Math.floor(seededRandom(i * 4) * 4) + 2,
      delay: Math.floor(seededRandom(i * 5) * 2),
    }));
  });

  // Local state mirrors for inline updates and onboarding hiding
  const [userState, setUserState] = useState(user);
  const [dogsState, setDogsState] = useState(dogs);
  // const hasAnyData = dataReadings.length > 0 || serviceVisits.length > 0;
  const { percent: profilePercent, fields: profileFields } = useMemo(
    () => getProfileCompleteness(userState, dogsState.length),
    [userState, dogsState.length]
  );

  const totalGrams = useMemo(
    () => dataReadings.reduce((sum, r) => sum + (r.weight || 0), 0),
    [dataReadings]
  );

  const last30DaysCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return dataReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff).length;
  }, [dataReadings]);

  const weeklySeries = useMemo(() => buildWeeklySeries(dataReadings, 8), [dataReadings]);
  // const trendPath = useMemo(() => buildSparklinePath(weeklySeries), [weeklySeries]);

  // const uniqueColors = useMemo(() => {
  //   const unique = new Set(
  //     dataReadings
  //       .map((r) => (r.color || '').trim().toLowerCase())
  //       .filter((s) => s && s !== 'normal' && s !== 'healthy')
  //   );
  //   return unique.size;
  // }, [dataReadings]);

  // const uniqueConsistency = useMemo(() => {
  //   const unique = new Set(
  //     dataReadings.map((r) => (r.consistency || '').trim().toLowerCase()).filter((s) => s)
  //   );
  //   return unique.size;
  // }, [dataReadings]);

  const referralUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${user.id}`
      : `https://www.yardura.com/?ref=${user.id}`;

  const weeksWithData = useMemo(
    () => weeklySeries.filter((p) => p.value > 0).length,
    [weeklySeries]
  );

  // const baselinePercent = useMemo(
  //   () => Math.min(100, Math.round((weeksWithData / 4) * 100)),
  //   [weeksWithData]
  // );

  const lastReadingAt = useMemo(() => {
    if (dataReadings.length === 0) return null as Date | null;
    const ts = Math.max(...dataReadings.map((r) => new Date(r.timestamp).getTime()));
    return new Date(ts);
  }, [dataReadings]);

  const nextServiceAt = useMemo(() => {
    const nowTs = Date.now();
    // Candidate 1: earliest explicitly scheduled visit in the future
    const futureScheduled = serviceVisits
      .filter((v) => v.status === 'SCHEDULED')
      .map((v) => new Date(v.scheduledDate))
      .filter((d) => d.getTime() >= nowTs)
      .sort((a, b) => a.getTime() - b.getTime());

    // Candidate 2: weekly cadence computed from most recent COMPLETED
    let cadenceNext: Date | null = null;
    const isWeekly = serviceVisits.some((v) => (v.serviceType || '').includes('WEEKLY'));
    if (isWeekly) {
      const mostRecentCompleted = serviceVisits
        .filter((v) => v.status === 'COMPLETED')
        .map((v) => new Date(v.scheduledDate))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      if (mostRecentCompleted) {
        const n = new Date(mostRecentCompleted);
        // Advance by 7-day steps until strictly in the future (>= now)
        do { n.setDate(n.getDate() + 7); } while (n.getTime() < nowTs);
        cadenceNext = n;
      }
    }

    // Choose the earliest valid candidate
    const candidates = [futureScheduled[0], cadenceNext].filter(Boolean) as Date[];
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0];
  }, [serviceVisits]);

  const lastCompletedAt = useMemo(() => {
    const completed = serviceVisits
      .filter((v) => v.status === 'COMPLETED')
      .map((v) => new Date(v.scheduledDate))
      .sort((a, b) => b.getTime() - a.getTime());
    return completed[0] || null;
  }, [serviceVisits]);

  const daysUntilNext = useMemo(() => {
    if (!nextServiceAt) return null as number | null;
    const ms = nextServiceAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [nextServiceAt]);

  // const nextServiceProgress = useMemo(() => {
  //   if (daysUntilNext == null) return 0;
  //   return 1 - Math.min(1, daysUntilNext / 7);
  // }, [daysUntilNext]);

  const daysSinceLast = useMemo(() => {
    if (!lastCompletedAt) return null as number | null;
    const ms = Date.now() - lastCompletedAt.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [lastCompletedAt]);

  // const lastServiceRecency = useMemo(() => {
  //   if (daysSinceLast == null) return 0;
  //   return Math.min(1, daysSinceLast / 7);
  // }, [daysSinceLast]);

  const serviceStreak = useMemo(() => {
    const sorted = [...serviceVisits].sort(
      (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
    );
    let count = 0;
    for (const v of sorted) {
      if (v.status === 'COMPLETED') count += 1;
      else break;
    }
    return count;
  }, [serviceVisits]);

  function inRange(t: Date, start: Date, end: Date) {
    return t.getTime() >= start.getTime() && t.getTime() < end.getTime();
  }

  // const gramsThisWeek = useMemo(() => {
  //   const start = startOfWeek(new Date());
  //   const end = new Date();
  //   return dataReadings.reduce((sum, r) => {
  //     const t = new Date(r.timestamp);
  //     return inRange(t, start, end) ? sum + (r.weight || 0) : sum;
  //   }, 0);
  // }, [dataReadings]);

  const gramsLastWeek = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return inRange(t, start, end) ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const gramsPrevWeek = useMemo(() => {
    const end = startOfWeek(new Date());
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return inRange(t, start, end) ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const weekTrend = useMemo(() => {
    if (gramsPrevWeek === 0) return null as number | null;
    return (gramsLastWeek - gramsPrevWeek) / gramsPrevWeek;
  }, [gramsLastWeek, gramsPrevWeek]);

  const last7DaysCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return dataReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff).length;
  }, [dataReadings]);

  const avgWeight30G = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const weights = dataReadings
      .filter((r) => r.weight != null && new Date(r.timestamp).getTime() >= cutoff)
      .map((r) => r.weight as number);
    if (weights.length === 0) return null as number | null;
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum / weights.length;
  }, [dataReadings]);

  const gramsThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return inRange(t, monthStart, monthEnd) ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const gramsPrevMonth = useMemo(() => {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return inRange(t, prevMonthStart, prevMonthEnd) ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const methaneThisMonthLbsEq = useMemo(() => {
    return gramsThisMonth * 0.002 * 0.67;
  }, [gramsThisMonth]);

  // const activityRatio7of30 = useMemo(() => {
  //   return last30DaysCount > 0 ? Math.min(1, last7DaysCount / last30DaysCount) : 0;
  // }, [last7DaysCount, last30DaysCount]);

  // const ecoRatioVsPrev = useMemo(() => {
  //   return gramsPrevMonth > 0 ? Math.min(1.25, gramsThisMonth / gramsPrevMonth) / 1.25 : 0.6; // normalize, cap for ring
  // }, [gramsThisMonth, gramsPrevMonth]);

  const recentInsightsLevel = useMemo(() => {
    const concerning = dataReadings.some((r) => {
      const c = (r.color || '').toLowerCase();
      return c.includes('black') || c.includes('tarry') || c.includes('melena') || c.includes('red');
    });
    return concerning ? 'WATCH' : 'NORMAL';
  }, [dataReadings]);

  // Unified categorization helpers for colors and consistency
  const colorKeyFor = (raw: string | null | undefined): string => {
    const c = (raw || '').toLowerCase();
    if (!c) return 'normal';
    if (c.includes('red')) return 'red';
    if (c.includes('black') || c.includes('tarry') || c.includes('melena')) return 'black';
    if (c.includes('yellow') || c.includes('gray') || c.includes('grey')) return 'yellow';
    if (c.includes('green')) return 'normal';
    // Treat common healthy hues as normal (collapsed category)
    if (c.includes('brown') || c.includes('tan') || c.includes('normal') || c.includes('healthy')) return 'normal';
    return 'normal';
  };

  const COLOR_HEX: Record<string, string> = {
    normal: '#10b981', // green for normal (good)
    red: '#ef4444',
    black: '#111827',
    yellow: '#f59e0b',
    green: '#10b981',
    other: '#64748b',
    unknown: '#94a3b8',
  };

  const consistencyKeyFor = (raw: string | null | undefined): string => {
    const v = (raw || '').toLowerCase();
    if (!v) return 'normal';
    if (v.includes('firm') || v.includes('formed') || v.includes('normal') || v.includes('healthy')) return 'normal';
    // Treat "loose" as "soft" to avoid duplicate categories
    if (v.includes('soft') || v.includes('loose')) return 'soft';
    if (v.includes('dry') || v.includes('hard')) return 'dry';
    if (v.includes('mucous') || v.includes('mucus')) return 'mucous';
    if (v.includes('greasy') || v.includes('fatty')) return 'greasy';
    return 'normal';
  };

  const CONS_HEX: Record<string, string> = {
    normal: '#10b981', // green for normal
    soft: '#fbbf24',
    dry: '#60a5fa',
    mucous: '#8b5cf6',
    greasy: '#3b82f6',
    other: '#64748b',
    unknown: '#94a3b8',
  };

  // const consistencyCounts = useMemo(() => {
  //   const map = new Map<string, number>();
  //   dataReadings.forEach((r) => {
  //     const key = consistencyKeyFor(r.consistency);
  //     map.set(key, (map.get(key) || 0) + 1);
  //   });
  //   return Array.from(map.entries())
  //     .sort((a, b) => b[1] - a[1])
  //     .slice(0, 4);
  // }, [dataReadings]);

  // const colorFlagCounts = useMemo(() => {
  //   const counts: Record<string, number> = {};
  //   dataReadings.forEach((r) => {
  //     const key = colorKeyFor(r.color);
  //     counts[key] = (counts[key] || 0) + 1;
  //   });
  //   return counts;
  // }, [dataReadings]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      track('referral_copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Yardura Referral',
          text: 'Get a clean yard + optional wellness signals. Use my link to join!',
          url: referralUrl,
        });
        track('referral_native_share');
      } else {
        await handleCopy();
      }
    } catch {
      // user cancelled
    }
  };

  // Inline onboarding forms
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showDogForm, setShowDogForm] = useState(false);
  const [formPhone, setFormPhone] = useState(userState.phone || '');
  const [formAddress, setFormAddress] = useState(userState.address || '');
  const [formCity, setFormCity] = useState(userState.city || '');
  const [formZip, setFormZip] = useState(userState.zipCode || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogAge, setDogAge] = useState('');
  const [dogWeight, setDogWeight] = useState('');
  const [savingDog, setSavingDog] = useState(false);

  const BREEDS = [
    'Mixed Breed',
    'Labrador Retriever',
    'Golden Retriever',
    'German Shepherd',
    'French Bulldog',
    'Bulldog',
    'Poodle',
    'Beagle',
    'Rottweiler',
    'Yorkshire Terrier',
    'Dachshund',
    'Boxer',
    'Australian Shepherd',
    'Cavalier King Charles Spaniel',
    'Shih Tzu',
  ];

  async function submitProfile() {
    setSavingProfile(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formAddress,
          city: formCity,
          zipCode: formZip,
          phone: formPhone,
        }),
      });
      setUserState({
        ...userState,
        address: formAddress,
        city: formCity,
        zipCode: formZip,
        phone: formPhone,
      });
      setShowProfileForm(false);
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitDog() {
    if (!dogName.trim()) return;
    setSavingDog(true);
    try {
      const res = await fetch('/api/dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dogName,
          breed: dogBreed || null,
          age: dogAge ? parseInt(dogAge) : null,
          weight: dogWeight,
        }),
      });
      if (res.ok) {
        const { dog } = await res.json();
        setDogsState([...dogsState, dog]);
        setDogName('');
        setDogBreed('');
        setDogAge('');
        setDogWeight('');
        setShowDogForm(false);
      }
    } finally {
      setSavingDog(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        {/* Animated background particles */}
        <div className="absolute inset-0">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute animate-pulse rounded-full bg-white/10"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.width}px`,
                height: `${particle.height}px`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Welcome back{userState.name ? `, ${userState.name}` : ''}! 🐾
            </h1>
            <div className="text-slate-300 mt-2 text-lg">
              Household: {dogsState.length} {dogsState.length === 1 ? 'dog' : 'dogs'} •
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-300">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                Live wellness tracking
              </span>
            </div>
            {/* Quick Stats */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="size-4 text-pink-300" />
                <span className="text-slate-200">
                  {recentInsightsLevel === 'WATCH' ? 'Needs attention' : 'All normal'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="size-4 text-green-300" />
                <span className="text-slate-200">
                  {formatLbsFromGrams(gramsThisMonth)} lbs diverted
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-blue-300" />
                <span className="text-slate-200">
                  {daysUntilNext ? `${daysUntilNext} days` : 'No service scheduled'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
              onClick={() => {
                // Navigate to profile tab and show settings
                const profileTab = document.querySelector('[value="profile"]') as HTMLElement;
                if (profileTab) profileTab.click();
                setTimeout(() => setShowProfileForm(true), 100);
              }}
            >
              <Settings className="size-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" onValueChange={(val) => track('dashboard_tab_change', { tab: val })} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <Home className="size-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="wellness" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <Heart className="size-4 mr-2" />
            Wellness
          </TabsTrigger>
          <TabsTrigger value="services" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <Calendar className="size-4 mr-2" />
            Services
          </TabsTrigger>
          <TabsTrigger value="eco" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <Leaf className="size-4 mr-2" />
            Eco Impact
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <TrendingUp className="size-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <User className="size-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <Trophy className="size-4 mr-2" />
            Rewards
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            <User className="size-4 mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Call to Action for First-Time Users */}
          {serviceVisits.length === 0 && (
            <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-accent/10 p-3">
                      <Dog className="size-8 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-ink mb-2">
                      {user.stripeCustomerId
                        ? "Ready to Schedule Your First Service? 🐾"
                        : "Welcome to Yardura! 🐾"
                      }
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {user.stripeCustomerId
                        ? "Your account is all set up! Schedule your first sustainable yard service and unlock free pet wellness insights."
                        : "Get your yard cleaned sustainably while gaining valuable wellness insights for your pets. Every service includes free health monitoring technology."
                      }
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {user.stripeCustomerId ? (
                      <>
                        <Button size="lg" className="bg-accent hover:bg-accent/90">
                          <Calendar className="size-4 mr-2" />
                          Schedule Your First Service
                        </Button>
                        <Button size="lg" variant="outline">
                          <Heart className="size-4 mr-2" />
                          Learn About Wellness Insights
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="lg" className="bg-accent hover:bg-accent/90">
                          <Heart className="size-4 mr-2" />
                          Start Free Trial
                        </Button>
                        <Button size="lg" variant="outline">
                          <Calendar className="size-4 mr-2" />
                          Schedule One-Time Service
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    💚 Environmentally friendly • 🐕 Pet wellness included • ✨ Professional service
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Above-the-fold KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 auto-rows-fr items-stretch gap-6">
            {/* Next Service */}
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Service</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {nextServiceAt ? nextServiceAt.toLocaleDateString() : 'Not scheduled'}
                    </div>
                <p className="text-xs text-muted mt-1">
                  {daysUntilNext ? `${daysUntilNext} days away` : 'Schedule your next pickup'}
                </p>
                {nextServiceAt && (
                  <div className="mt-2 text-xs text-blue-600">
                    {nextServiceAt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wellness Status */}
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pet Wellness</CardTitle>
                <Heart className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    recentInsightsLevel === 'WATCH' ? 'bg-amber-500' : 'bg-green-500'
                  }`}></div>
                  <span className="text-lg font-bold text-slate-900">
                    {recentInsightsLevel === 'WATCH' ? 'Needs Attention' : 'All Normal'}
                  </span>
                    </div>
                <p className="text-xs text-muted mt-1">
                  {dataReadings.length} wellness checks this month
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-slate-600">Last check:</span>
                  <span className="font-medium">
                    {lastReadingAt ? lastReadingAt.toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">This week:</span>
                    <span className="font-bold text-slate-900">{last7DaysCount}</span>
                </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">This month:</span>
                    <span className="font-bold text-slate-900">{last30DaysCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Avg weight:</span>
                    <span className="font-bold text-slate-900">
                      {avgWeight30G != null ? `${(avgWeight30G as number).toFixed(1)}g` : '—'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t">
                  <div className="text-xs text-slate-500">
                    {weekTrend != null ?
                      `Week-over-week: ${weekTrend > 0 ? '+' : ''}${(weekTrend * 100).toFixed(0)}%` :
                      'Compare with last week'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Eco Impact */}
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eco Impact</CardTitle>
                <Leaf className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Diverted:</span>
                    <span className="font-bold text-green-700">{formatLbsFromGrams(gramsThisMonth)} lbs</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Methane saved:</span>
                    <span className="font-bold text-green-700">{methaneThisMonthLbsEq.toFixed(1)} ft³</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total diverted:</span>
                    <span className="font-bold text-slate-900">{formatLbsFromGrams(totalGrams)} lbs</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Streak */}
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Service Streak</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{serviceStreak}</div>
                <p className="text-xs text-muted mt-1">
                  {serviceStreak === 1 ? 'service' : 'services'} in a row
                </p>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-slate-600">
                    Total services: {serviceVisits.length}
                </div>
                  <div className="text-xs text-slate-600">
                    Since: {lastCompletedAt ? lastCompletedAt.toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button className="h-20 flex flex-col gap-2" variant="outline" onClick={() => track('dashboard_quick_action', { action: 'schedule_service' })}>
                  <Calendar className="size-6" />
                  <span>Schedule Service</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline" onClick={() => track('dashboard_quick_action', { action: 'add_dog' })}>
                  <Dog className="size-6" />
                  <span>Add Dog</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline" onClick={() => track('dashboard_quick_action', { action: 'view_health_insights' })}>
                  <Heart className="size-6" />
                  <span>View Health Insights</span>
                </Button>
              </div>
            </CardContent>
          </Card>

      {/* Onboarding: Profile & Dog inline forms; hides when complete */}
      {(profilePercent < 100 || dogsState.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-accent" />
              Complete your profile to unlock weekly signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-ink">Profile completeness</div>
                    <div className="text-sm text-muted">{profilePercent}%</div>
                  </div>
                  <div className="relative w-full bg-slate-100 rounded-full h-4 overflow-hidden border-2 border-slate-200">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${profilePercent}%` }}
                    >
                      {/* Training treats */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-xs animate-pulse">🍖</div>
                      </div>
                    </div>
                    {/* Puppy at the end */}
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-1000 ease-out text-sm"
                      style={{ left: `calc(${profilePercent}% - 8px)` }}
                    >
                      🐶
                    </div>
                    {/* Finish line flag */}
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-xs">
                      🏁
                    </div>
                  </div>
                </div>

                <ul className="grid sm:grid-cols-2 gap-2">
                  {profileFields.map(([label, ok]: [string, boolean]) => (
                    <li key={label} className="flex items-center gap-2 text-sm">
                      {ok ? (
                        <span className="text-lg animate-bounce">🐾</span>
                      ) : (
                        <span className="text-lg opacity-50">⭕</span>
                      )}
                      <span className={ok ? 'text-slate-600 line-through' : 'text-slate-700'}>
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setShowProfileForm(!showProfileForm)}>
                    {showProfileForm ? 'Close Profile Form' : 'Update Profile'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowDogForm(!showDogForm)}>
                    {showDogForm ? 'Close Dog Form' : 'Add Dog Profile'}
                  </Button>
                </div>

                {showProfileForm && (
                  <div className="mt-4 space-y-3 p-4 border rounded-xl">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Phone</label>
                        <Input
                          value={formPhone}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormPhone(e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">ZIP</label>
                        <Input
                          value={formZip}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormZip(e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Address</label>
                      <AddressAutocomplete
                        value={formAddress}
                        onChange={(val: string) => setFormAddress(val)}
                        onSelect={(addr: {
                          formattedAddress: string;
                          city?: string;
                          postalCode?: string;
                        }) => {
                          if (addr.formattedAddress) setFormAddress(addr.formattedAddress);
                          if (addr.city) setFormCity(addr.city || '');
                          if (addr.postalCode) setFormZip(addr.postalCode || '');
                        }}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">City</label>
                        <Input
                          value={formCity}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormCity(e.target.value)
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={submitProfile} disabled={savingProfile}>
                          {savingProfile ? 'Saving…' : 'Save Profile'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {showDogForm && (
                  <div className="mt-4 space-y-3 p-4 border rounded-xl">
                    <div>
                      <label className="block text-xs font-medium mb-1">Dog Name *</label>
                      <Input
                        value={dogName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDogName(e.target.value)}
                      />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium mb-1">Breed</label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={dogBreed}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            setDogBreed(e.target.value)
                          }
                        >
                          <option value="">Select breed</option>
                          {BREEDS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Age</label>
                        <Input
                          value={dogAge}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setDogAge(e.target.value)}
                          type="number"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium mb-1">Weight (lbs)</label>
                        <Input
                          value={dogWeight}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setDogWeight(e.target.value)
                          }
                          type="number"
                          min="0"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <Button onClick={submitDog} disabled={savingDog || !dogName.trim()}>
                          {savingDog ? 'Saving…' : 'Save Dog'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Referral Incentives */}
              <div className="p-4 rounded-xl bg-accent-soft border border-accent/20 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="size-4 text-accent" />
                  <div className="text-sm font-medium text-ink">Referral rewards</div>
                </div>
                <div className="text-sm text-slate-700 mb-3">
                  Get a free visit for every referral.
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    readOnly
                    value={referralUrl}
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-accent/20 text-sm"
                    aria-label="Your referral link"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCopy} aria-label="Copy referral link">
                      <Copy className="size-4 mr-2" /> {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button onClick={handleShare} aria-label="Share referral link">
                      <Share2 className="size-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-muted">
              Wellness signals are informational only and not veterinary advice.
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Wellness Tab */}
        <TabsContent value="wellness" className="space-y-6">
          {(() => {
            // Create SINGLE SHARED byWeek map for ENTIRE wellness tab
            const mondayStart = (d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; };
            const now = new Date();
            const sharedByWeek = new Map<string, typeof dataReadings>();

            // Process existing readings
            dataReadings.forEach((r) => {
              const ds = mondayStart(new Date(r.timestamp));
              const key = ds.toISOString().slice(0,10);
              const arr = sharedByWeek.get(key) || [];
              arr.push(r);
              sharedByWeek.set(key, arr);
            });

            // Generate unified mock data for recent weeks
            let cur = mondayStart(now);
            const mockProfile = process.env.DASHBOARD_MOCK_PROFILE || 'diverse';
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const selectedScenario = urlParams?.get('scenario') as keyof typeof MOCK_SCENARIOS;

            for (let i = 0; i < 8; i++) {
              const key = cur.toISOString().slice(0,10);
              let arr = sharedByWeek.get(key) || [];

              if (arr.length === 0) {
                const weekStart = new Date(cur);

                // Apply scenario selection logic
                let scenarioKey: keyof typeof MOCK_SCENARIOS;
                if (selectedScenario && MOCK_SCENARIOS[selectedScenario]) {
                  scenarioKey = selectedScenario;
                } else if (mockProfile === 'normal') {
                  scenarioKey = i < 2 ? 'normal_mix' : 'perfect';
                } else {
                  // Default diverse profile
                  if (i === 0) scenarioKey = 'red_alert';
                  else if (i === 1) scenarioKey = 'mucous_alert';
                  else if (i === 2) scenarioKey = 'yellow_alert';
                  else if (i === 3) scenarioKey = 'soft_alert';
                  else if (i === 4) scenarioKey = 'dry_alert';
                  else if (i === 5) scenarioKey = 'black_alert';
                  else if (i === 6) scenarioKey = 'normal_mix';
                  else scenarioKey = 'perfect';
                }

                const scenario = MOCK_SCENARIOS[scenarioKey];
                arr = generateWeekReadings(weekStart, scenario);
                sharedByWeek.set(key, arr);
              }

              cur = new Date(cur);
              cur.setDate(cur.getDate() - 7);
            }

            // Store shared data in a way accessible to all sections
            if (typeof window !== 'undefined') {
              (window as any).sharedWellnessData = { sharedByWeek, mondayStart, now, mockProfile, selectedScenario };
            }

            return null; // Just set up the data, don't render anything
                      })()}



          {/* Wellness Summary and Early Warning */}
          {(() => {
            // Use the SHARED byWeek map created at the top of the wellness tab
            const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
            const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();
            const mondayStart = sharedData.mondayStart || ((d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; });
            const now = sharedData.now || new Date();

            let cur = mondayStart(now);
            let softWeeks = 0; let consecutiveHighSoft = 0; let maxConsec = 0; let coverageWeeks = 0; let weeksTotal = 0; let normalWeeks = 0;
            const isNormalReading = (r: any) => consistencyKeyFor(r.consistency) === 'normal' && (['red','black','yellow'].indexOf(colorKeyFor(r.color)) === -1);
            let normalCount = 0, totalCount = 0, abnormalCount = 0;
            // content-derived helpers for parasite proxy
            let mucousWeeks = 0, greasyWeeks = 0;
            let alertWeeks = 0; // red/black color weeks

            // Process weeks with enhanced mock data for recent weeks
            for (let i=0;i<8;i++) {
              const key = cur.toISOString().slice(0,10);
              const arr = byWeek.get(key) || [];

              weeksTotal++;
              if (arr.length>0) coverageWeeks++;
              const total = Math.max(1, arr.length);
              const soft = arr.filter((r: any) => consistencyKeyFor(r.consistency) !== 'normal').length;
              const softShare = soft/total;
              if (softShare >= 0.3) { softWeeks++; consecutiveHighSoft++; maxConsec = Math.max(maxConsec, consecutiveHighSoft); } else { consecutiveHighSoft = 0; }
              arr.forEach((r: any)=>{
                totalCount++;
                if (isNormalReading(r)) {
                  normalCount++;
                } else {
                  abnormalCount++;
                }
              });
              const hasCritical = arr.some((r: any)=> (colorKeyFor(r.color)==='red' || colorKeyFor(r.color)==='black'));
              if (hasCritical) alertWeeks++;
              if (softShare < 0.3 && !hasCritical) normalWeeks++;
              if (arr.some((r: any)=> consistencyKeyFor(r.consistency)==='mucous')) mucousWeeks++;
              if (arr.some((r: any)=> consistencyKeyFor(r.consistency)==='greasy')) greasyWeeks++;
              cur = new Date(cur); cur.setDate(cur.getDate()-7);
            }
            // Overall normal rate: percentage of normal readings across all data
            const normalRate = totalCount>0 ? Math.round((normalCount/totalCount)*100) : 0;
            const severity = (softWeeks>=4 || maxConsec>=2) ? 'red' : (softWeeks>=2 ? 'amber' : 'green');
            return (
              <div className="space-y-3">
                {(() => {
                  const parasiteWeeks = Math.max(mucousWeeks, greasyWeeks);
                  const hasSoftIssue = softWeeks >= 2;
                  const hasCriticalIssue = alertWeeks > 0;
                  const hasCoverageGap = coverageWeeks < weeksTotal;
                  if (!(hasSoftIssue || hasCriticalIssue || parasiteWeeks >= 2 || hasCoverageGap)) return null;
                  const label = (hasCriticalIssue || severity==='red') ? 'Monitoring Alert' : 'Waste Pattern Notice';
                  const items: string[] = [];
                  if (hasSoftIssue) items.push(`Soft consistency in ${softWeeks}/8 weeks${maxConsec>=2 ? ` • ${maxConsec} consecutive` : ''}`);
                  if (hasCriticalIssue) items.push(`Unusual color patterns: ${alertWeeks} weeks`);
                  if (parasiteWeeks >= 2) items.push(`Mucous/greasy patterns: ${parasiteWeeks}w detected`);
                  if (hasCoverageGap) items.push(`Limited data: ${coverageWeeks}/${weeksTotal} weeks covered`);
                  return (
                    <div className="rounded-xl border p-3 bg-white/70 flex items-center justify-between" style={{ borderColor: (hasCriticalIssue || severity==='red') ? '#fecaca' : '#fde68a' }}>
                      <div className="text-sm">
                        <span className={(hasCriticalIssue || severity==='red') ? 'text-rose-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {label}:
                        </span>
                        <span className="ml-2 text-slate-700">{items.join(' • ')}</span>
                      </div>
                      <div className="flex gap-2">
                        <a href="/reports" className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50">Share Report</a>
                        {alertWeeks > 0 && (
                          <a href={`/reports?filter=critical&weeks=${alertWeeks}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-700">
                            <Eye className="size-3" />
                            <span className="underline">Optional:</span> View samples
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {/* Enhanced Health Insights Dashboard */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Wellness Score Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="size-4 text-pink-500" />
                      <span className="text-sm font-medium text-slate-700">Wellness Score</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mb-1">{normalRate}%</div>
                    <div className="text-xs text-slate-500">Normal consistency readings</div>
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          normalRate >= 80 ? 'bg-green-500' :
                          normalRate >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${normalRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Coverage Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="size-4 text-blue-500" />
                      <span className="text-sm font-medium text-slate-700">Data Coverage</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mb-1">{coverageWeeks}/{weeksTotal}</div>
                    <div className="text-xs text-slate-500">Weeks with readings</div>
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${(coverageWeeks/weeksTotal)*100}%` }}
                      />
                    </div>
                  </div>

                  {/* Consistency Alert Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`size-4 ${severity === 'red' ? 'text-red-500' : severity === 'amber' ? 'text-amber-500' : 'text-green-500'}`} />
                      <span className="text-sm font-medium text-slate-700">Consistency</span>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      severity === 'red' ? 'text-red-700' :
                      severity === 'amber' ? 'text-amber-700' : 'text-green-700'
                    }`}>
                      {severity === 'red' ? 'Watch' : severity === 'amber' ? 'Monitor' : 'Good'}
                    </div>
                    <div className="text-xs text-slate-500">{softWeeks} weeks with soft stools</div>
                    {softWeeks > 0 && (
                      <div className="mt-2 text-xs text-amber-600 font-medium">
                        ⚠️ {maxConsec >= 2 ? `${maxConsec} consecutive weeks` : 'Irregular pattern detected'}
                      </div>
                    )}
                  </div>

                  {/* Critical Alerts Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="size-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Critical Alerts</span>
                    </div>
                    {alertWeeks > 0 ? (
                      <>
                        <div className="text-2xl font-bold text-red-700 mb-1">{alertWeeks}</div>
                        <div className="text-xs text-slate-500">Weeks with red/black stool</div>
                        <a href={`/reports?filter=critical-samples&weeks=${alertWeeks}`} className="inline-flex items-center gap-1 mt-2 text-xs text-red-600 hover:text-red-700 font-medium">
                          <Eye className="size-3" />
                          Review {alertWeeks} critical sample{alertWeeks > 1 ? 's' : ''} →
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-green-700 mb-1">0</div>
                        <div className="text-xs text-slate-500">No critical alerts</div>
                        <div className="mt-2 text-xs text-green-600 font-medium">
                          ✅ All clear this period
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Advanced Insights Row */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {/* Parasite Detection */}
                  {(mucousWeeks >= 2 || greasyWeeks >= 2) && (
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
                      <Bug className="size-4 text-amber-600" />
                      <div className="text-sm">
                        <span className="font-medium text-amber-800">Possible Parasites</span>
                        <span className="text-amber-600 ml-1">
                          {Math.max(mucousWeeks, greasyWeeks)}w detected
                        </span>
                      </div>
                      <div className="text-xs text-amber-600 ml-1">
                        (non-diagnostic)
                      </div>
                    </div>
                  )}


                  {/* Export Data */}
                  <a href="/reports" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                    <Download className="size-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Export Report</span>
                    <span className="text-xs text-blue-600">Share with vet</span>
                  </a>
                </div>
              </div>
            );
          })()}
          {/* Wellness Overview Chips (compact) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white">
              <Heart className="size-3 text-pink-500" />
              Last sample: <strong className="ml-1">{(() => {
                // Try to get last reading from shared wellness data first
                const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
                const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();

                if (byWeek.size > 0) {
                  // Find the most recent reading across all weeks
                  let latestReading: any = null;
                  for (const [key, readings] of byWeek.entries()) {
                    for (const reading of readings) {
                      if (!latestReading || new Date(reading.timestamp) > new Date(latestReading.timestamp)) {
                        latestReading = reading;
                      }
                    }
                  }
                  return latestReading ? new Date(latestReading.timestamp).toLocaleDateString() : '—';
                }

                // Fallback to original calculation
                return lastReadingAt ? (lastReadingAt as Date).toLocaleDateString() : '—';
              })()}</strong>
            </span>
            {/* Derived Wellness Status (recomputed locally) */}
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white">
              <Dog className="size-3 text-blue-500" />
              Status: <strong className="ml-1">{(() => {
                // Use the shared byWeek map
                const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
                const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();
                const mondayStart = sharedData.mondayStart || ((d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; });
                const now = sharedData.now || new Date();

                let cur = mondayStart(now); let softWeeks=0, consec=0, maxConsec=0;
                for (let i=0;i<8;i++){ const key=cur.toISOString().slice(0,10); const arr=byWeek.get(key)||[]; const total=Math.max(1,arr.length); const soft=arr.filter((r: any)=> consistencyKeyFor(r.consistency)!=='normal').length; const share=soft/total; if (share>=0.3){ softWeeks++; consec++; maxConsec=Math.max(maxConsec,consec);} else {consec=0;} cur=new Date(cur); cur.setDate(cur.getDate()-7); }
                const sev = (softWeeks>=4 || maxConsec>=2) ? 'red' : (softWeeks>=2 ? 'amber' : 'green');
                return sev==='red' ? 'Needs attention' : sev==='amber' ? 'Watch' : 'Good';
              })()}</strong>
            </span>
          </div>
          {/* Wellness Insights - Simplified & Clear */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Wellness Overview</span>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Normal
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Monitor
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Action Needed
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Use the shared byWeek map
                const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
                const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();
                const mondayStart = sharedData.mondayStart || ((d: Date) => {
                  const tmp = new Date(d);
                  const day = (tmp.getDay() + 6) % 7; // Monday=0
                  tmp.setDate(tmp.getDate() - day);
                  tmp.setHours(0, 0, 0, 0);
                  return tmp;
                });
                const now = sharedData.now || new Date();

                // Simplified weekly data structure
                const weeks: Array<{
                  start: Date;
                  label: string;
                  deposits: number;
                  avgWeight: number;
                  healthStatus: 'normal' | 'monitor' | 'action';
                  wellnessScore: number; // 0-100, higher is better
                  issues: string[];
                  colors: {
                    normal: number;
                    red: number;
                    black: number;
                    yellow: number;
                  };
                  consistency: {
                    normal: number;
                    soft: number; // soft + mucous + greasy
                    dry: number;
                  };
                }> = [];

                // Start from current week and go backwards (most recent first)
                const currentWeekStart = mondayStart(now);

                // First pass: populate byWeek with mock data for recent weeks (same as analysis section)
                for (let i = 0; i < 8; i++) {
                  const weekStart = new Date(currentWeekStart);
                  weekStart.setDate(currentWeekStart.getDate() - (i * 7));
                  const key = weekStart.toISOString().slice(0, 10);
                  let arr = byWeek.get(key) || [];

                  if (arr.length === 0) {
                    const weekStartDate = new Date(weekStart);

                    // Select scenarios based on environment variables, URL parameter, or default variety (same as main timeline)
                    const mockProfile = process.env.DASHBOARD_MOCK_PROFILE || 'diverse'; // 'diverse' | 'normal'
                    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                    const selectedScenario = urlParams?.get('scenario') as keyof typeof MOCK_SCENARIOS;

                    let scenarioKey: keyof typeof MOCK_SCENARIOS;
                    if (selectedScenario && MOCK_SCENARIOS[selectedScenario]) {
                      // Use the selected scenario for all weeks if specified via URL
                      scenarioKey = selectedScenario;
                    } else if (mockProfile === 'normal') {
                      // Environment variable set to 'normal' - use only normal scenarios
                      scenarioKey = i < 2 ? 'normal_mix' : 'perfect';
                    } else {
                      // Default 'diverse' profile: different scenarios for different weeks
                      if (i === 0) scenarioKey = 'red_alert';        // Current week: red stool
                      else if (i === 1) scenarioKey = 'mucous_alert'; // Last week: mucous
                      else if (i === 2) scenarioKey = 'yellow_alert'; // Two weeks ago: yellow
                      else if (i === 3) scenarioKey = 'soft_alert';   // Three weeks ago: soft
                      else if (i === 4) scenarioKey = 'dry_alert';    // Four weeks ago: dry
                      else if (i === 5) scenarioKey = 'black_alert';  // Five weeks ago: black
                      else if (i === 6) scenarioKey = 'normal_mix';   // Six weeks ago: normal mix
                      else scenarioKey = 'perfect';                   // Seven weeks ago: perfect
                    }

                    const scenario = MOCK_SCENARIOS[scenarioKey];
                    arr = generateWeekReadings(weekStartDate, scenario);

                    byWeek.set(key, arr);
                  }
                }

                // Second pass: build weeks array using the populated byWeek map
                for (let i = 0; i < 8; i++) {
                  const weekStart = new Date(currentWeekStart);
                  weekStart.setDate(currentWeekStart.getDate() - (i * 7));
                  const key = weekStart.toISOString().slice(0, 10);
                  const arr = byWeek.get(key) || [];

                  const deposits = arr.length;
                  const avgWeight = deposits > 0 ? arr.reduce((sum: number, r: any) => sum + (r.weight || 0), 0) / deposits : 0;

                  // Simplified consistency categorization
                  let consistency = {
                    normal: arr.filter((r: any) => consistencyKeyFor(r.consistency) === 'normal').length,
                    soft: arr.filter((r: any) => ['soft', 'mucous', 'greasy'].includes(consistencyKeyFor(r.consistency) || '')).length,
                    dry: arr.filter((r: any) => consistencyKeyFor(r.consistency) === 'dry').length,
                  };

                  let colors = {
                    normal: arr.filter((r: any) => ['normal', 'green', 'brown', 'tan'].includes(colorKeyFor(r.color))).length,
                    red: arr.filter((r: any) => colorKeyFor(r.color) === 'red').length,
                    black: arr.filter((r: any) => colorKeyFor(r.color) === 'black').length,
                    yellow: arr.filter((r: any) => colorKeyFor(r.color) === 'yellow').length,
                  };

                  // SIMULATED RECENT ALERT SCENARIO:
                  // Most weeks normal, but recent weeks have alerts
                  if (i === 0) {
                    // Most recent week: ACTION ALERT (red stool detected)
                    colors.red = Math.max(2, colors.red + 2);
                    colors.normal = Math.max(0, colors.normal - 2);
                    if (consistency.normal > 0) {
                      consistency.normal = Math.max(0, consistency.normal - 1);
                      consistency.soft = consistency.soft + 1;
                    }
                  } else if (i === 1) {
                    // Second most recent week: MONITOR ALERT (soft consistency)
                    consistency.soft = Math.max(3, consistency.soft + 3);
                    consistency.normal = Math.max(0, consistency.normal - 3);
                  }
                  // Weeks 2-7 remain mostly normal (typical baseline)

                  // Simple wellness score (0-100) - measures digestive health and stool quality
                  const total = Math.max(1, arr.length);
                  const normalRate = (consistency.normal + colors.normal) / (2 * total);
                  const issueRate = (consistency.soft + colors.red + colors.black) / total;
                  const wellnessScore = Math.max(0, Math.min(100, normalRate * 100 - issueRate * 25));

                  // Determine status and issues
                  const issues: string[] = [];
                  let healthStatus: 'normal' | 'monitor' | 'action' = 'normal';

                  if (colors.red > 0 || colors.black > 0) {
                    healthStatus = 'action';
                    issues.push(`${colors.red > 0 ? 'Red' : 'Black'} stool (${colors.red + colors.black})`);
                  } else                   if (consistency.soft > consistency.normal || colors.yellow > 0) {
                    healthStatus = 'monitor';
                    if (consistency.soft > 0) issues.push(`Soft/mucous (${consistency.soft})`);
                    if (colors.yellow > 0) issues.push(`Yellow stool (${colors.yellow})`);
                  }

                  weeks.push({
                    start: new Date(weekStart),
                    label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    deposits,
                    avgWeight,
                    healthStatus,
                    wellnessScore,
                    issues,
                    consistency,
                    colors,
                  });
                }

                // Current week insights (weeks[0] is the most recent/current week)
                const currentWeek = weeks[0];
                const recentWeeks = weeks.slice(0, 4); // First 4 weeks (most recent)
                const avgWellness = recentWeeks.reduce((sum, w) => sum + w.wellnessScore, 0) / recentWeeks.length;

                return (
                  <div className="space-y-6">
                    {/* Health Status Overview */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white border rounded-lg">
                        <div className="text-sm font-medium text-slate-600 mb-2">Current Week</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            currentWeek?.healthStatus === 'action' ? 'bg-red-500' :
                            currentWeek?.healthStatus === 'monitor' ? 'bg-amber-500' : 'bg-green-500'
                          }`}></div>
                          <span className="text-lg font-semibold capitalize">{currentWeek?.healthStatus || 'Normal'}</span>
                        </div>
                        {currentWeek?.issues?.length > 0 && (
                          <div className="text-xs text-slate-600 mt-1">
                            {currentWeek?.issues?.join(', ') || ''}
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-white border rounded-lg">
                        <div className="text-sm font-medium text-slate-600 mb-2">Recent Trend</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {avgWellness.toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-600">
                          Avg wellness score (4 weeks)
                        </div>
                      </div>

                      <div className="p-4 bg-white border rounded-lg">
                        <div className="text-sm font-medium text-slate-600 mb-2">Activity</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {recentWeeks.reduce((sum, w) => sum + w.deposits, 0)}
                        </div>
                        <div className="text-xs text-slate-600">
                          Total deposits (4 weeks)
                        </div>
                      </div>
                    </div>

                    {/* Weekly Wellness Timeline */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Heart className="size-4" />
                        Weekly Wellness Timeline
                      </h4>
                      <div className="grid grid-cols-8 gap-3">
                        {weeks.slice().reverse().map((week, i) => (
                          <div key={i} className="text-center">
                            <div className="relative mb-2">
                              {/* Health status indicator */}
                              <div className="h-16 bg-slate-100 rounded-lg overflow-hidden">
                                <div
                                  className={`h-full rounded-lg transition-all duration-300 ${
                                    week.healthStatus === 'action' ? 'bg-red-500' :
                                    week.healthStatus === 'monitor' ? 'bg-amber-500' : 'bg-green-500'
                                  }`}
                                />
                              </div>
                              {/* Deposit count indicator */}
                              <div className="absolute -top-1 -right-1 bg-slate-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                {week.deposits}
                              </div>
                            </div>
                            <div className="text-xs text-slate-600">{week.label}</div>
                            {/* Status icon */}
                            <div className={`text-sm mt-1 ${
                              week.healthStatus === 'action' ? 'text-red-600' :
                              week.healthStatus === 'monitor' ? 'text-amber-600' :
                              'text-green-600'
                            }`}>
                              {week.healthStatus === 'action' ? '⚠️' :
                               week.healthStatus === 'monitor' ? '👁️' :
                               '✅'}
                            </div>
                            {/* Issues tooltip on hover */}
                            {week.issues.length > 0 && (
                              <div className="text-xs text-red-600 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                                ⚠️ {week.issues.length} issue{week.issues.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted text-center mt-2">
                        Color = Health Status • ✅ Good • 👁️ Monitor • ⚠️ Action • Number = Weekly Deposits
                      </div>
                    </div>

                    {/* Comprehensive Weekly Breakdown */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <BarChart3 className="size-4" />
                        Detailed Week-by-Week Analysis
                      </h4>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {weeks.slice(0, 4).map((week, i) => {
                          const totalDeposits = week.deposits;
                          // Count ALL abnormal readings that should be reviewable
                          const abnormalReadings = week.consistency.soft + week.consistency.dry +
                                                 week.colors.red + week.colors.black + week.colors.yellow;
                          const warningsCount = abnormalReadings; // Use total abnormal readings instead of just issues.length
                          const hasParasites = week.consistency.soft > week.consistency.normal; // Parasite indicators in soft consistency
                          const abnormalColors = week.colors.red + week.colors.black + week.colors.yellow;
                          const abnormalConsistency = week.consistency.soft;

                        return (
                            <div key={i} className="p-5 bg-white border rounded-lg shadow-sm">
                              {/* Header */}
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <span className="font-semibold text-slate-900 text-lg">{week.label}</span>
                                  <div className="text-xs text-slate-500 mt-1">{totalDeposits} total deposits</div>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  week.healthStatus === 'action' ? 'bg-red-100 text-red-700' :
                                  week.healthStatus === 'monitor' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {week.healthStatus === 'action' ? 'Action Needed' :
                                   week.healthStatus === 'monitor' ? 'Monitor' : 'Normal'}
                                </div>
                              </div>

                              {/* Wellness Score */}
                              <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-slate-700">Wellness Score</span>
                                  <span className="text-lg font-bold text-slate-900">{week.wellnessScore.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      week.wellnessScore >= 80 ? 'bg-green-500' :
                                      week.wellnessScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${week.wellnessScore}%` }}
                                  />
                                </div>
                              </div>

                              {/* Detailed Breakdown Grid */}
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {/* Consistency Breakdown */}
                                <div className="bg-slate-50 rounded p-3">
                                  <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                                    <Droplets className="size-3" />
                                    Consistency
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-green-600">Normal:</span>
                                      <span className="font-medium">{week.consistency.normal}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-amber-600">Soft:</span>
                                      <span className="font-medium">{week.consistency.soft || 0}</span>
                                    </div>
                                    {week.consistency.dry > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-orange-600">Dry:</span>
                                        <span className="font-medium">{week.consistency.dry}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Color Breakdown */}
                                <div className="bg-slate-50 rounded p-3">
                                  <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                                    <Palette className="size-3" />
                                    Colors
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-green-600">Normal:</span>
                                      <span className="font-medium">{week.colors.normal}</span>
                                    </div>
                                    {week.colors.yellow > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-amber-600">Yellow:</span>
                                        <span className="font-medium">{week.colors.yellow}</span>
                                      </div>
                                    )}
                                    {week.colors.red > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-red-600">Red:</span>
                                        <span className="font-medium">{week.colors.red}</span>
                                      </div>
                                    )}
                                    {week.colors.black > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Black:</span>
                                        <span className="font-medium">{week.colors.black}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Alerts & Warnings */}
                              {(warningsCount > 0 || hasParasites || abnormalColors > 0 || abnormalConsistency > 0) && (
                                <div className="border-t pt-3">
                                  <div className="text-xs font-medium text-slate-600 mb-2">Alerts & Patterns</div>
                                  <div className="space-y-1 text-xs">
                                    {warningsCount > 0 && (
                                      <div className="flex items-center gap-2 text-red-600">
                                        <AlertTriangle className="size-3" />
                                        <span>{warningsCount} warning{warningsCount > 1 ? 's' : ''}</span>
                                      </div>
                                    )}

                                    {hasParasites && (
                                      <div className="flex items-center gap-2 text-purple-600">
                                        <Bug className="size-3" />
                                        <span>Parasite indicators detected</span>
                                      </div>
                                    )}

                                    {abnormalColors > 0 && (
                                      <div className="flex items-center gap-2 text-orange-600">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        <span>{abnormalColors} abnormal color{abnormalColors > 1 ? 's' : ''}</span>
                                      </div>
                                    )}

                                    {abnormalConsistency > 0 && (
                                      <div className="flex items-center gap-2 text-amber-600">
                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                        <span>{abnormalConsistency} abnormal texture{abnormalConsistency > 1 ? 's' : ''}</span>
                                      </div>
                                    )}

                                    {/* Optional Sample Review */}
                                    <div className="pt-2 mt-2 border-t border-slate-200">
                                      <a
                                        href={`/reports?week=${encodeURIComponent(week.label)}&filter=abnormal-samples&count=${warningsCount}&colors=${abnormalColors}&consistency=${abnormalConsistency}`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-700 text-xs rounded-md transition-colors"
                                      >
                                        <Eye className="size-3" />
                                        <span className="underline">Optional:</span> View {warningsCount} abnormal sample{warningsCount > 1 ? 's' : ''} from {week.label}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Weight Info */}
                              {week.avgWeight > 0 && (
                                <div className="border-t pt-3 mt-3">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600">Avg Weight:</span>
                                    <span className="font-medium">{week.avgWeight.toFixed(1)}g</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Health Insights Summary */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Leaf className="size-4" />
                        Key Insights
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium text-slate-900 mb-2">Recent Activity</div>
                          <div className="space-y-1 text-slate-600">
                            <div>• {recentWeeks.reduce((sum, w) => sum + w.deposits, 0)} deposits in 4 weeks</div>
                            <div>• Average: {(recentWeeks.reduce((sum, w) => sum + w.deposits, 0) / 4).toFixed(1)} per week</div>
                            {recentWeeks.some(w => w.deposits === 0) && (
                              <div className="text-amber-600">• Some weeks with no activity detected</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="font-medium text-slate-900 mb-2">Health Status</div>
                          <div className="space-y-1 text-slate-600">
                            <div>• Average wellness score: {avgWellness.toFixed(0)}%</div>
                            <div>• {recentWeeks.filter(w => w.healthStatus === 'normal').length} normal weeks</div>
                            <div>• {recentWeeks.filter(w => w.healthStatus === 'monitor').length} weeks to monitor</div>
                            {recentWeeks.some(w => w.healthStatus === 'action') && (
                              <div className="text-red-600">• Action needed in some weeks</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          

          {/* Core Wellness Signals removed (redundant) */}

          {/* Enhanced Color Distribution Analysis */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Palette className="size-5 text-indigo-500" />
                  Stool Color Analysis
                </span>
                <span className="text-sm font-normal text-slate-500">Last 8 weeks</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
                  {(() => {
                    // Use the shared byWeek map
                    const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
                    const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();
                    const mondayStart = sharedData.mondayStart || ((d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; });
                    const now = sharedData.now || new Date();
                    let cur = mondayStart(now);
                    const windowReadings: any[] = [];
                    for (let i=0;i<8;i++) { const key = cur.toISOString().slice(0,10); const arr = byWeek.get(key) || []; windowReadings.push(...arr); cur = new Date(cur); cur.setDate(cur.getDate()-7); }

                const totalReadings = windowReadings.length;
                if (totalReadings === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <Palette className="size-8 mx-auto mb-2 opacity-50" />
                      <p>No color data available for analysis</p>
                    </div>
                  );
                }

                // Enhanced color analysis with better categorization
                const colorStats = {
                  normal: { count: 0, label: 'Normal', description: 'Healthy brown/tan colors', color: COLOR_HEX.normal },
                  yellow: { count: 0, label: 'Yellow/Gray', description: 'May indicate liver issues', color: COLOR_HEX.yellow },
                  red: { count: 0, label: 'Red', description: 'Possible blood in stool', color: COLOR_HEX.red },
                  black: { count: 0, label: 'Black/Tarry', description: 'Possible digested blood', color: COLOR_HEX.black },
                };

                    windowReadings.forEach(r => {
                      const ck = colorKeyFor(r.color);
                  if (ck in colorStats) {
                    colorStats[ck as keyof typeof colorStats].count++;
                  } else {
                    colorStats.normal.count++; // Default to normal
                  }
                });

                const colorEntries = Object.entries(colorStats);
                const maxCount = Math.max(...colorEntries.map(([, stat]) => stat.count));

                    return (
                  <div className="space-y-6">
                    {/* Color Overview Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {colorEntries.map(([key, stat]) => {
                        const percentage = totalReadings > 0 ? Math.round((stat.count / totalReadings) * 100) : 0;
                        const isConcerning = key === 'red' || key === 'black';

                          return (
                          <div key={key} className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                            isConcerning && stat.count > 0
                              ? 'border-red-200 bg-red-50'
                              : stat.count === maxCount && stat.count > 0
                              ? 'border-green-200 bg-green-50'
                              : 'border-slate-200 bg-white'
                          }`}>
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: stat.color }}
                              />
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{stat.label}</div>
                                <div className="text-xs text-slate-500">{percentage}%</div>
                              </div>
                            </div>

                            <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
                              {stat.count}
                            </div>

                            <div className="text-xs text-slate-600 leading-tight">
                              {stat.description}
                            </div>

                            {isConcerning && stat.count > 0 && (
                              <div className="mt-2 text-xs text-red-600 font-medium">
                                ⚠️ Requires attention
                              </div>
                            )}
                                    </div>
                                  );
                                })}
                              </div>

                    {/* Weekly Color Timeline */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <BarChart3 className="size-4" />
                        Weekly Color Patterns
                      </h4>

                      <div className="grid grid-cols-8 gap-3">
                        {(() => {
                          const weeklyData = [];
                          let curWeek = mondayStart(now);

                          for (let i = 0; i < 8; i++) {
                            const key = curWeek.toISOString().slice(0, 10);
                            const weekReadings = byWeek.get(key) || [];
                            const weekStats = {
                              normal: 0, yellow: 0, red: 0, black: 0,
                              total: weekReadings.length,
                              hasAlerts: false
                            };

                            weekReadings.forEach((r: any) => {
                              const ck = colorKeyFor(r.color);
                              if (ck in weekStats) {
                                weekStats[ck as keyof typeof weekStats]++;
                              } else {
                                weekStats.normal++;
                              }
                            });

                            weekStats.hasAlerts = weekStats.red > 0 || weekStats.black > 0;
                            weeklyData.unshift({ ...weekStats, label: curWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });

                            curWeek = new Date(curWeek);
                            curWeek.setDate(curWeek.getDate() - 7);
                          }

                          return weeklyData.map((week, i) => (
                            <div key={i} className="text-center">
                              <div className="relative h-20 bg-slate-100 rounded-lg overflow-hidden mb-2">
                                {/* Stacked bars for each color */}
                                {week.total > 0 && (
                                  <>
                                    {/* Normal (bottom layer) */}
                                    <div
                                      className="absolute bottom-0 w-full transition-all duration-300"
                                      style={{
                                        height: `${(week.normal / week.total) * 100}%`,
                                        backgroundColor: COLOR_HEX.normal
                                      }}
                                    />

                                    {/* Yellow (middle layer) */}
                                    {week.yellow > 0 && (
                                      <div
                                        className="absolute w-full transition-all duration-300"
                                        style={{
                                          bottom: `${(week.normal / week.total) * 100}%`,
                                          height: `${(week.yellow / week.total) * 100}%`,
                                          backgroundColor: COLOR_HEX.yellow
                                        }}
                                      />
                                    )}

                                    {/* Red (top layer) */}
                                    {week.red > 0 && (
                                      <div
                                        className="absolute w-full transition-all duration-300 border-2 border-white"
                                        style={{
                                          bottom: `${((week.normal + week.yellow) / week.total) * 100}%`,
                                          height: `${(week.red / week.total) * 100}%`,
                                          backgroundColor: COLOR_HEX.red
                                        }}
                                      />
                                    )}

                                    {/* Black (top layer with higher priority) */}
                                    {week.black > 0 && (
                                      <div
                                        className="absolute w-full transition-all duration-300 border-2 border-white"
                                        style={{
                                          bottom: `${((week.normal + week.yellow + week.red) / week.total) * 100}%`,
                                          height: `${(week.black / week.total) * 100}%`,
                                          backgroundColor: COLOR_HEX.black
                                        }}
                                      />
                                    )}
                                  </>
                                )}

                                {/* Alert indicator */}
                                {week.hasAlerts && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
                                )}
                            </div>

                              <div className="text-xs text-slate-600">{week.label}</div>
                              <div className="text-xs text-slate-500">{week.total} readings</div>
                            </div>
                          ));
                  })()}
                </div>

                      {/* Color Legend */}
                      <div className="flex flex-wrap justify-center gap-4 text-xs">
                        {colorEntries.map(([, stat]) => (
                          <div key={stat.label} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stat.color }}
                            />
                            <span className="text-slate-600">{stat.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Health Insights */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Lightbulb className="size-4 text-yellow-500" />
                        Waste Color Insights
                      </h4>

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium text-slate-900 mb-2">Normal Range</div>
                          <div className="text-slate-600 space-y-1">
                            <div>• Brown/tan colors are typical and healthy</div>
                            <div>• Slight variations are usually normal</div>
                            <div>• {colorStats.normal.count} normal readings ({Math.round((colorStats.normal.count / totalReadings) * 100)}%)</div>
                          </div>
                        </div>

                        <div>
                          <div className="font-medium text-slate-900 mb-2">Concerning Signs</div>
                          <div className="text-slate-600 space-y-1">
                            {colorStats.red.count > 0 && (
                              <div className="text-red-600">• Red color may indicate fresh blood</div>
                            )}
                            {colorStats.black.count > 0 && (
                              <div className="text-red-600">• Black/tarry may indicate digested blood</div>
                            )}
                            {colorStats.yellow.count > 0 && (
                              <div className="text-amber-600">• Yellow/gray may indicate liver issues</div>
                            )}
                            {(colorStats.red.count === 0 && colorStats.black.count === 0 && colorStats.yellow.count === 0) && (
                              <div className="text-green-600">• No concerning colors detected</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Enhanced Consistency & Content Analysis */}
          <div className="space-y-6">
            {/* Consistency Analysis */}
              <Card className="motion-hover-lift">
                <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Waves className="size-5 text-blue-500" />
                    Stool Consistency Analysis
                  </span>
                  <span className="text-sm font-normal text-slate-500">Last 8 weeks</span>
                </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Use the shared byWeek map
                    const sharedData = (typeof window !== 'undefined' && (window as any).sharedWellnessData) || {};
                    const byWeek = sharedData.sharedByWeek || new Map<string, typeof dataReadings>();
                    const mondayStart = sharedData.mondayStart || ((d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; });
                    const now = sharedData.now || new Date();

                    let cur = mondayStart(now);

                  // Enhanced consistency analysis
                  const consistencyStats = {
                    normal: { count: 0, label: 'Normal', description: 'Well-formed, easy to pass', color: COLOR_HEX.normal },
                    soft: { count: 0, label: 'Soft', description: 'Soft or loose texture', color: CONS_HEX.soft },
                    dry: { count: 0, label: 'Dry', description: 'Hard or pellet-like', color: '#d97706' },
                  };

                  // Process weeks using the shared byWeek data
                  for (let i=0;i<8;i++) {
                    const key = cur.toISOString().slice(0,10);
                    const arr = byWeek.get(key) || [];

                    cur = new Date(cur);
                    cur.setDate(cur.getDate() - 7);
                  }

                  const weeklyData = [];
                  // Now use the populated byWeek map for processing
                  cur = mondayStart(now); // Reset cur for processing
                  for (let i = 0; i < 8; i++) {
                    const key = cur.toISOString().slice(0,10);
                    const weekReadings = byWeek.get(key) || [];

                    const weekStats = {
                      label: cur.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      total: weekReadings.length,
                      normal: 0, abnormal: 0, dry: 0, soft: 0, mucous: 0, greasy: 0,
                      hasAlerts: false
                    };

                    weekReadings.forEach((r: any) => {
                      const ck = consistencyKeyFor(r.consistency);
                      if (ck === 'normal') {
                        weekStats.normal++;
                        consistencyStats.normal.count++;
                      } else if (ck === 'soft' || ck === 'mucous' || ck === 'greasy') {
                        // Count soft/mucous/greasy as "soft" category
                        weekStats.soft++;
                        consistencyStats.soft.count++;
                      } else if (ck === 'dry') {
                        // Keep dry as separate category
                        weekStats.dry++;
                        consistencyStats.dry.count++;
                      }
                    });

                    weekStats.hasAlerts = weekStats.soft > 0 || weekStats.dry > 0;
                    weeklyData.unshift(weekStats);

                    cur = new Date(cur);
                    cur.setDate(cur.getDate() - 7);
                  }

                  const totalReadings = weeklyData.reduce((sum, w) => sum + w.total, 0);
                  const consistencyEntries = Object.entries(consistencyStats);
                  const maxCount = Math.max(...consistencyEntries.map(([, stat]) => stat.count));

                    return (
                    <div className="space-y-6">
                      {/* Consistency Overview Cards */}
                      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {consistencyEntries.map(([key, stat]) => {
                          const percentage = totalReadings > 0 ? Math.round((stat.count / totalReadings) * 100) : 0;
                          const isConcerning = key === 'soft' || key === 'dry';

                          return (
                            <div key={key} className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                              isConcerning && stat.count > 0
                                ? 'border-amber-200 bg-amber-50'
                                : stat.count === maxCount && stat.count > 0
                                ? 'border-green-200 bg-green-50'
                                : 'border-slate-200 bg-white'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className="w-3 h-3 rounded-full border border-white shadow-sm"
                                  style={{ backgroundColor: stat.color }}
                                />
                                <div className="text-xs font-semibold text-slate-900">{stat.label}</div>
                            </div>

                              <div className="text-lg font-bold mb-1" style={{ color: stat.color }}>
                                {stat.count}
                              </div>

                              <div className="text-xs text-slate-600 leading-tight">
                                {percentage}%
                              </div>

                              {isConcerning && stat.count > 0 && (
                                <div className="mt-1 text-xs text-amber-600 font-medium">
                                  ⚠️ Monitor
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Weekly Consistency Timeline */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Activity className="size-4" />
                          Weekly Consistency Patterns
                        </h4>

                        <div className="grid grid-cols-8 gap-3">
                          {weeklyData.map((week, i) => (
                            <div key={i} className="text-center">
                              <div className="relative h-20 bg-slate-100 rounded-lg overflow-hidden mb-2">
                                {/* Stacked bars for each consistency type */}
                                {week.total > 0 && (
                                  <>
                                    {/* Normal (bottom layer) */}
                                    <div
                                      className="absolute bottom-0 w-full transition-all duration-300"
                                      style={{
                                        height: `${(week.normal / week.total) * 100}%`,
                                        backgroundColor: COLOR_HEX.normal
                                      }}
                                    />

                                    {/* Abnormal (middle layer - includes soft, mucous, greasy) */}
                                    {week.abnormal > 0 && (
                                      <div
                                        className="absolute w-full transition-all duration-300"
                                        style={{
                                          bottom: `${(week.normal / week.total) * 100}%`,
                                          height: `${(week.abnormal / week.total) * 100}%`,
                                          backgroundColor: CONS_HEX.soft
                                        }}
                                      />
                                    )}

                                    {/* Dry (top layer) */}
                                    {week.dry > 0 && (
                                      <div
                                        className="absolute w-full transition-all duration-300"
                                        style={{
                                          bottom: `${((week.normal + week.abnormal) / week.total) * 100}%`,
                                          height: `${(week.dry / week.total) * 100}%`,
                                          backgroundColor: '#d97706'
                                        }}
                                      />
                                    )}
                                  </>
                                )}

                                {/* Alert indicator */}
                                {week.hasAlerts && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-white"></div>
                                )}
                              </div>

                              <div className="text-xs text-slate-600">{week.label}</div>
                              <div className="text-xs text-slate-500">{week.total} readings</div>
                          </div>
                        ))}
                        </div>

                      {/* Consistency Legend */}
                      <div className="flex flex-wrap justify-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLOR_HEX.normal }}
                          />
                          <span className="text-slate-600">Normal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CONS_HEX.soft }}
                          />
                          <span className="text-slate-600">Soft</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: '#d97706' }}
                          />
                          <span className="text-slate-600">Dry</span>
                        </div>
                      </div>
                      </div>

                      {/* Consistency Health Insights */}
                      <div className="bg-slate-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <Lightbulb className="size-4 text-yellow-500" />
                          Consistency Monitoring Insights
                        </h4>

                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-slate-900 mb-2">Typical Patterns</div>
                            <div className="text-slate-600 space-y-1">
                              <div>• Well-formed consistency suggests good digestion</div>
                              <div>• Soft but formed often indicates proper hydration</div>
                              <div>• {consistencyStats.normal.count} normal readings ({Math.round((consistencyStats.normal.count / totalReadings) * 100)}%)</div>
                            </div>
                          </div>

                          <div>
                            <div className="font-medium text-slate-900 mb-2">Notable Changes</div>
                            <div className="text-slate-600 space-y-1">
                              {consistencyStats.dry.count > 0 && (
                                <div className="text-amber-600">• Dry/hard consistency may warrant monitoring</div>
                              )}
                              {consistencyStats.soft.count > 0 && (
                                <div className="text-amber-600">• Soft consistency detected - monitor closely</div>
                              )}
                              {(consistencyStats.dry.count === 0 && consistencyStats.soft.count === 0) && (
                                <div className="text-green-600">• No concerning consistency changes detected</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

            {/* Enhanced Content Signals */}
                <Card className="motion-hover-lift">
                  <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="size-5 text-purple-500" />
                  Content Analysis & Parasite Detection
                </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const mondayStart = (d: Date) => { const t = new Date(d); const day=(t.getDay()+6)%7; t.setDate(t.getDate()-day); t.setHours(0,0,0,0); return t; };
                      const now = new Date(); let cur = mondayStart(now);
                  let mucousWeeks = 0, greasyWeeks = 0, dryWeeks = 0;

                  for (let i=0;i<8;i++) {
                    const start = new Date(cur); const end = new Date(cur); end.setDate(end.getDate()+7);
                        const inWeek = dataReadings.filter(r=>{ const t=new Date(r.timestamp); return t>=start && t<end; });

                        if (inWeek.some(r=> consistencyKeyFor(r.consistency)==='mucous')) mucousWeeks++;
                        if (inWeek.some(r=> consistencyKeyFor(r.consistency)==='greasy')) greasyWeeks++;
                    if (inWeek.some(r=> consistencyKeyFor(r.consistency)==='dry')) dryWeeks++;

                        cur.setDate(cur.getDate()-7);
                      }

                  const hasAnySignals = mucousWeeks > 0 || greasyWeeks > 0 || dryWeeks > 0;

                  if (!hasAnySignals) {
                    return (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle className="size-8 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No concerning content signals detected</p>
                        <p className="text-sm">Your pet's stool content appears normal across all recent readings.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Mucous Detection */}
                        {mucousWeeks > 0 && (
                          <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-sm"></div>
                              <div>
                                <div className="text-sm font-semibold text-purple-800">Mucous Content</div>
                                <div className="text-xs text-purple-600">Potential irritation</div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-purple-700 mb-2">{mucousWeeks}</div>
                            <div className="text-xs text-purple-600 leading-tight">
                              Weeks with mucous coating detected. May indicate intestinal irritation or infection.
                            </div>
                          </div>
                        )}

                        {/* Greasy Detection */}
                        {greasyWeeks > 0 && (
                          <div className="p-4 rounded-lg border-2 border-cyan-200 bg-cyan-50">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-sm"></div>
                              <div>
                                <div className="text-sm font-semibold text-cyan-800">Greasy Content</div>
                                <div className="text-xs text-cyan-600">Possible malabsorption</div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-cyan-700 mb-2">{greasyWeeks}</div>
                            <div className="text-xs text-cyan-600 leading-tight">
                              Weeks with greasy/oily appearance. May suggest fat malabsorption issues.
                            </div>
                          </div>
                        )}

                        {/* Dry Detection */}
                        {dryWeeks > 0 && (
                          <div className="p-4 rounded-lg border-2 border-orange-200 bg-orange-50">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm"></div>
                              <div>
                                <div className="text-sm font-semibold text-orange-800">Dry Content</div>
                                <div className="text-xs text-orange-600">Potential dehydration</div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-orange-700 mb-2">{dryWeeks}</div>
                            <div className="text-xs text-orange-600 leading-tight">
                              Weeks with dry/hard consistency. May indicate insufficient water intake.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recommendations */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <Info className="size-4" />
                          Veterinary Recommendations
                        </h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          {mucousWeeks > 0 && <div>• Consult vet about potential intestinal parasites or infections</div>}
                          {greasyWeeks > 0 && <div>• Discuss possible pancreatic or liver issues with your veterinarian</div>}
                          {dryWeeks > 0 && <div>• Ensure adequate water intake and consider dietary adjustments</div>}
                          <div>• Keep detailed records of these observations for your vet visit</div>
                        </div>
                      </div>
                    </div>
                  );
                    })()}
                  </CardContent>
                </Card>
          </div>

          {/* Important Disclaimer */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-semibold mb-2">Important Medical Disclaimer</div>
                <div className="space-y-1 text-blue-700">
                  <div>• This waste monitoring system is <strong>not a substitute for professional veterinary care</strong></div>
                  <div>• Waste quality scores and alerts are monitoring tools only - they do not constitute medical diagnosis</div>
                  <div>• Always consult your veterinarian for any health concerns or changes in your pet's waste patterns</div>
                  <div>• Regular veterinary check-ups are essential for your pet's overall health and wellness</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportsList orgId={user.orgId || 'org_demo'} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-xl border bg-white/60">
                  <div className="text-xs text-muted mb-1">Status</div>
                  <div className="text-lg font-semibold text-ink">{user.stripeCustomerId ? 'Active' : 'Not set'}</div>
                </div>
                <div className="p-4 rounded-xl border bg-white/60">
                  <div className="text-xs text-muted mb-1">Plan</div>
                  <div className="text-lg font-semibold text-ink">Weekly Clean</div>
                </div>
                <div className="p-4 rounded-xl border bg-white/60">
                  <div className="text-xs text-muted mb-1">Next Charge</div>
                  <div className="text-lg font-semibold text-ink">{new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="mt-4">
                <a className="text-sm text-accent underline" href="/billing">Open Stripe Portal</a>
              </div>
            </CardContent>
          </Card>

          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle>Recent Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {Array.from({ length: 4 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i * 7);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Weekly Clean • {d.toLocaleDateString()}</div>
                        <div className="text-xs text-muted">Invoice #{1000 + i}</div>
                      </div>
                      <a href="#" className="text-accent text-xs underline">Download PDF</a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Today's Date & Service Timeline */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Today</div>
                    <div className="text-lg font-bold text-slate-900">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-300"></div>
                  <div className="text-center">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Last Service</div>
                    <div className="text-lg font-bold text-slate-900">
                      {(() => {
                        const completedServices = serviceVisits.filter(v => v.status === 'COMPLETED');
                        if (completedServices.length === 0) return 'None';
                        const lastService = completedServices.sort((a, b) =>
                          new Date(b.scheduledDate).getTime() -
                          new Date(a.scheduledDate).getTime()
                        )[0];
                        const serviceDate = new Date(lastService.scheduledDate);
                        return serviceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-300"></div>
                  <div className="text-center">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Next Service</div>
                    <div className="text-lg font-bold text-slate-900">
                      {nextServiceAt ?
                        nextServiceAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
                        'Not set'
                      }
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">Service Timeline</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-slate-700">Completed</span>
                    <div className="w-2 h-2 rounded-full bg-blue-500 ml-2"></div>
                    <span className="text-xs text-slate-700">Scheduled</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-blue-500" />
                  Next Service
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {nextServiceAt ? nextServiceAt.toLocaleDateString() : 'Not scheduled'}
                </div>
                <p className="text-xs text-muted mt-1">
                  {daysUntilNext ? `${daysUntilNext} days away` : 'Schedule your next pickup'}
                </p>
                {nextServiceAt && (
                  <div className="mt-2 text-xs text-blue-600 font-medium">
                    {nextServiceAt.toLocaleDateString(undefined, { weekday: 'long' })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-green-500" />
                  Service History
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {serviceVisits.length}
                </div>
                <p className="text-xs text-muted mt-1">Total services completed</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Completed:</span>
                    <span className="font-medium text-green-600">
                      {serviceVisits.filter(v => v.status === 'COMPLETED').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pending:</span>
                    <span className="font-medium text-amber-600">
                      {serviceVisits.filter(v => v.status === 'SCHEDULED').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Trophy className="size-4 text-yellow-500" />
                  Service Streak
                </div>
                <div className="text-2xl font-bold text-slate-900">{serviceStreak}</div>
                <p className="text-xs text-muted mt-1">
                  {serviceStreak === 1 ? 'service' : 'services'} in a row
                </p>
                <div className="mt-2">
                  {serviceStreak > 0 ? (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <div className="flex -space-x-1">
                        {Array.from({ length: Math.min(serviceStreak, 5) }).map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-green-500 rounded-full"></div>
                        ))}
                        {serviceStreak > 5 && (
                          <div className="w-2 h-2 bg-green-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                            +
                          </div>
                        )}
                      </div>
                      <span>On track!</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Start your streak today
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-blue-500" />
                Schedule Your Next Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button
                  className="h-20 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  variant="outline"
                  onClick={() => {
                    track('service_scheduling', { type: 'one_time' });
                    // Navigate to scheduling page or open modal
                    window.location.href = '/schedule?type=one-time';
                  }}
                >
                  <Calendar className="size-6 text-blue-500" />
                  <span className="font-medium">One-Time Service</span>
                  <span className="text-xs text-slate-500">Perfect for occasional needs</span>
                </Button>
                <Button
                  className="h-20 flex flex-col gap-2 hover:bg-green-50 hover:border-green-200 transition-colors"
                  variant="outline"
                  onClick={() => {
                    track('service_scheduling', { type: 'subscription' });
                    window.location.href = '/subscribe';
                  }}
                >
                  <TrendingUp className="size-6 text-green-500" />
                  <span className="font-medium">Weekly Subscription</span>
                  <span className="text-xs text-slate-500">Save 15% with recurring service</span>
                </Button>
                <Button
                  className="h-20 flex flex-col gap-2 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  variant="outline"
                  onClick={() => {
                    // Scroll to service history section
                    const historySection = document.querySelector('[data-service-history]');
                    if (historySection) {
                      historySection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <Heart className="size-6 text-purple-500" />
                  <span className="font-medium">View Past Services</span>
                  <span className="text-xs text-slate-500">Review your service history</span>
                </Button>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-blue-500 mt-0.5">💡</div>
                  <div className="text-sm text-blue-800">
                    <strong>Pro tip:</strong> Weekly subscriptions include free pet wellness monitoring and priority scheduling.
                    Save an average of $50/month compared to one-time services.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service History & Analytics */}
          <Card data-service-history>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="size-5 text-slate-600" />
                  Service History & Analytics
                </span>
                <span className="text-sm font-normal text-slate-500">
                  {serviceVisits.length} total services
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {serviceVisits.length > 0 ? (
                <div className="space-y-4">
                  {/* Service Timeline */}
                <div className="space-y-3">
                    {serviceVisits.slice(0, 8).map((visit, index) => {
                      const isCompleted = visit.status === 'COMPLETED';
                      const isScheduled = visit.status === 'SCHEDULED';
                    return (
                      <div
                        key={visit.id}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className={`w-3 h-3 rounded-full mt-2 ${
                            isCompleted ? 'bg-green-500' :
                            isScheduled ? 'bg-blue-500' : 'bg-slate-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-slate-900">
                                {visit.serviceType.replace('_', ' ')}
                          </div>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isCompleted ? 'bg-green-100 text-green-800' :
                                isScheduled ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                          {visit.status}
                        </span>
                            </div>
                            <div className="text-sm text-slate-600 mt-1">
                              {visit.yardSize} • {new Date(visit.scheduledDate).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            {index === 0 && isCompleted && (
                              <div className="text-xs text-green-600 mt-1 font-medium">
                                ✅ Most recent service
                              </div>
                            )}
                          </div>
                      </div>
                    );
                  })}
                  </div>

                  {/* Service Analytics */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Service Analytics</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-700">
                          {serviceVisits.filter(v => v.status === 'COMPLETED').length}
                        </div>
                        <div className="text-xs text-green-600">Services Completed</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-700">
                          {serviceVisits.filter(v => v.status === 'SCHEDULED').length}
                        </div>
                        <div className="text-xs text-blue-600">Services Scheduled</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-700">
                          {serviceStreak}
                        </div>
                        <div className="text-xs text-purple-600">Current Streak</div>
                      </div>
                    </div>
                  </div>

                  {/* Service Patterns */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Service Patterns</h4>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Most common service type:</span>
                        <span className="font-medium">
                          {serviceVisits.length > 0 ?
                            serviceVisits.reduce((a, b) =>
                              serviceVisits.filter(v => v.serviceType === a.serviceType).length >
                              serviceVisits.filter(v => v.serviceType === b.serviceType).length ? a : b
                            ).serviceType.replace('_', ' ') : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Most common yard size:</span>
                        <span className="font-medium">
                          {serviceVisits.length > 0 ?
                            serviceVisits.reduce((a, b) =>
                              serviceVisits.filter(v => v.yardSize === a.yardSize).length >
                              serviceVisits.filter(v => v.yardSize === b.yardSize).length ? a : b
                            ).yardSize : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average services per month:</span>
                        <span className="font-medium">
                          {serviceVisits.length > 0 ?
                            (serviceVisits.length / Math.max(1, Math.ceil((Date.now() - new Date(serviceVisits[serviceVisits.length - 1]?.scheduledDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30)))).toFixed(1) : '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="text-slate-600">
                    <Calendar className="size-12 mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Service History Yet</h3>
                    <p className="text-slate-500 mb-4">
                      {user.stripeCustomerId
                        ? "Ready to get started with clean, sustainable yard care?"
                        : "Sign up to schedule your first service and unlock pet wellness insights!"
                      }
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {user.stripeCustomerId ? (
                      <>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.location.href = '/schedule'}
                        >
                          <Calendar className="size-4 mr-2" />
                          Schedule Service
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.location.href = '/subscribe'}
                        >
                          <TrendingUp className="size-4 mr-2" />
                          Start Subscription
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.location.href = '/subscribe'}
                        >
                          <Heart className="size-4 mr-2" />
                          Start Free Trial
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.location.href = '/schedule?type=one-time'}
                        >
                          <Calendar className="size-4 mr-2" />
                          Schedule One-Time
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
                    ✨ Free wellness insights included with every service • 🏆 Build your service streak • 🌱 Contribute to environmental impact
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eco Impact Tab */}
        <TabsContent value="eco" className="space-y-6">
          {/* Eco Impact Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 p-8 text-white shadow-2xl">
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Leaf className="size-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Environmental Impact</h2>
              <p className="text-green-100">Together we're making a difference for our planet</p>
              <div className="mt-4 flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-green-100">MTD Diverted</div>
                  <div className="text-2xl font-bold">{formatLbsFromGrams(gramsThisMonth)} lbs</div>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div className="text-center">
                  <div className="text-xs text-green-100">MTD Methane Avoided</div>
                  <div className="text-2xl font-bold">{methaneThisMonthLbsEq.toFixed(1)} ft³</div>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-4 right-4 text-4xl opacity-20">🌱</div>
            <div className="absolute bottom-4 left-4 text-3xl opacity-20">🌍</div>
            <div className="absolute top-1/2 left-1/4 text-2xl opacity-20">🌿</div>
          </div>

          {/* Eco Diversion Level */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="rounded-full bg-green-100 p-2">
                  <Leaf className="size-5 text-green-600" />
                </div>
                Eco Diversion Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Level Indicator */}
                <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="text-4xl mb-2">🌱</div>
                  <div className="text-2xl font-bold text-green-700 mb-1">100% Eco Diversion</div>
                  <div className="text-green-600">Maximum environmental impact achieved!</div>
                </div>

                {/* Diversion Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-2xl mb-2">♻️</div>
                    <div className="font-semibold text-blue-800">Compost Created</div>
                    <div className="text-xl font-bold text-blue-700">{formatLbsFromGrams(totalGrams * 0.8)}</div>
                    <div className="text-xs text-blue-600">From diverted waste</div>
                  </div>

                  <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-2xl mb-2">🏭</div>
                    <div className="font-semibold text-orange-800">Methane Avoided</div>
                    <div className="text-xl font-bold text-orange-700">{(totalGrams * 0.002 * 0.67).toFixed(1)} lbs</div>
                    <div className="text-xs text-orange-600">CO2 equivalent</div>
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl mb-2">🌍</div>
                    <div className="font-semibold text-green-800">Landfill Space Saved</div>
                    <div className="text-xl font-bold text-green-700">{(totalGrams * 0.002).toFixed(1)} cu ft</div>
                    <div className="text-xs text-green-600">Preserved space</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Eco Impact (cleaner) */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Environmental Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm font-medium text-slate-700 mb-1">Diverted (MTD)</div>
                  <div className="text-2xl font-bold text-slate-900">{formatLbsFromGrams(gramsThisMonth)}</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm font-medium text-green-700 mb-1">Methane Avoided (MTD)</div>
                  <div className="text-2xl font-bold text-green-700">{methaneThisMonthLbsEq.toFixed(1)} ft³</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eco Impact Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Environmental Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-slate-600 mb-4">
                  See how your eco-friendly choices compare to traditional waste disposal:
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="text-red-500">🏭</div>
                      <div>
                        <div className="font-medium text-red-800">Traditional Landfill</div>
                        <div className="text-xs text-red-600">Waste goes to landfill</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-700">0%</div>
                      <div className="text-xs text-red-600">diverted</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="text-blue-500">♻️</div>
                      <div>
                        <div className="font-medium text-blue-800">25% Eco Diversion</div>
                        <div className="text-xs text-blue-600">Partial waste diversion</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">25%</div>
                      <div className="text-xs text-blue-600">diverted</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="text-green-500">🌱</div>
                      <div>
                        <div className="font-medium text-green-800">100% Eco Diversion</div>
                        <div className="text-xs text-green-600">Maximum environmental impact</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-700">100%</div>
                      <div className="text-xs text-green-600">diverted</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          {/* Empty State for No Earned Rewards */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="rounded-full bg-yellow-100 p-2">
                  <Trophy className="size-5 text-yellow-600" />
                </div>
                Your Rewards & Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Rewards Earned Yet</h3>
                <p className="text-slate-600 mb-6">
                  Keep using Yardura services to unlock rewards and achievements!
                </p>
              </div>

              {/* Potential Rewards to Earn */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Rewards You Can Earn</h4>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Landfill Hero */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">🌱</div>
                      <div>
                        <div className="font-semibold text-green-800">Landfill Hero</div>
                        <div className="text-xs text-green-600">Divert 100 lbs from landfill</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: {Math.round(totalGrams / 50)}/100 lbs
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min((totalGrams / 5000) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">🎁 Free eco-friendly treats</div>
                  </div>

                  {/* Service Streak */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">🔥</div>
                      <div>
                        <div className="font-semibold text-blue-800">Streak Master</div>
                        <div className="text-xs text-blue-600">5 consecutive services</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: {serviceStreak}/5 services
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(serviceStreak / 5) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">🎯 Priority scheduling</div>
                  </div>

                  {/* Wellness Watcher */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">💜</div>
                      <div>
                        <div className="font-semibold text-purple-800">Wellness Watcher</div>
                        <div className="text-xs text-purple-600">20 wellness analyses</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: {dataReadings.length}/20 analyses
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(dataReadings.length / 20) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">📊 Custom health report</div>
                  </div>

                  {/* Loyalty Customer */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">⭐</div>
                      <div>
                        <div className="font-semibold text-orange-800">Loyal Customer</div>
                        <div className="text-xs text-orange-600">10 services completed</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: {serviceVisits.length}/10 services
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(serviceVisits.length / 10) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">🎁 Branded merchandise</div>
                  </div>

                  {/* Eco Champion */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-red-50 to-pink-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">👑</div>
                      <div>
                        <div className="font-semibold text-red-800">Eco Champion</div>
                        <div className="text-xs text-red-600">500 lbs diverted</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: {Math.round(totalGrams / 50)}/500 lbs
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min((totalGrams / 25000) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">👑 VIP status + free year</div>
                  </div>

                  {/* Referral Champion */}
                  <div className="p-4 border border-slate-200 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">👥</div>
                      <div>
                        <div className="font-semibold text-indigo-800">Referral Champion</div>
                        <div className="text-xs text-indigo-600">3 successful referrals</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Progress: 0/3 referrals
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: '0%' }}></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">🎁 Free service per referral</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Profile Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-teal-600 to-emerald-600 p-8 text-white shadow-2xl">
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <User className="size-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{userState.name || 'Welcome!'}</h2>
              <p className="text-green-100">{userState.email}</p>
              <div className="mt-4 flex justify-center gap-3">
                <Button
                  onClick={() => setShowProfileForm(!showProfileForm)}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                >
                  {showProfileForm ? 'Cancel Edit' : 'Edit Profile'}
                </Button>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-4 right-4 text-6xl opacity-10">🐾</div>
            <div className="absolute bottom-4 left-4 text-4xl opacity-10">🏡</div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="rounded-full bg-green-100 p-2">
                  <User className="size-5 text-green-600" />
                </div>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Name</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 group-hover:border-green-300 transition-colors">
                      <p className="text-lg font-medium text-slate-900">{userState.name || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="group">
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Email</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 group-hover:border-green-300 transition-colors">
                      <p className="text-lg font-medium text-slate-900">{userState.email}</p>
                    </div>
                  </div>
                  <div className="group">
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Phone</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 group-hover:border-green-300 transition-colors">
                      <p className="text-lg font-medium text-slate-900">{userState.phone || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="group md:col-span-2">
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Address</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 group-hover:border-green-300 transition-colors">
                      <p className="text-lg font-medium text-slate-900">
                        {userState.address && userState.city && userState.zipCode
                          ? `${userState.address}, ${userState.city}, ${userState.zipCode}`
                          : 'Not set'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {showProfileForm && (
                  <div className="mt-6 p-4 border rounded-xl bg-slate-50">
                    <h3 className="font-medium mb-4">Edit Profile Information</h3>
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Name</label>
                          <Input
                            value={userState.name || ''}
                            onChange={(e) => setUserState({ ...userState, name: e.target.value })}
                            placeholder="Your full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Phone</label>
                          <Input
                            value={formPhone}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setFormPhone(e.target.value)
                            }
                            placeholder="Phone number"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Address</label>
                        <AddressAutocomplete
                          value={formAddress}
                          onChange={(val: string) => setFormAddress(val)}
                          onSelect={(addr: {
                            formattedAddress: string;
                            city?: string;
                            postalCode?: string;
                          }) => {
                            if (addr.formattedAddress) setFormAddress(addr.formattedAddress);
                            if (addr.city) setFormCity(addr.city || '');
                            if (addr.postalCode) setFormZip(addr.postalCode || '');
                          }}
                          placeholder="Enter your address"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">City</label>
                          <Input
                            value={formCity}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setFormCity(e.target.value)
                            }
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">ZIP Code</label>
                          <Input
                            value={formZip}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setFormZip(e.target.value)
                            }
                            placeholder="ZIP Code"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowProfileForm(false)}>
                          Cancel
                        </Button>
                        <Button onClick={submitProfile} disabled={savingProfile}>
                          {savingProfile ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="rounded-full bg-green-100 p-2">
                  <Dog className="size-5 text-green-600" />
                </div>
                Your Furry Family
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {dogsState.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🐕‍🦺</div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No dogs registered yet</h3>
                    <p className="text-slate-600 mb-4">Add your first furry friend to unlock personalized wellness insights!</p>
                    <Button onClick={() => setShowDogForm(true)} className="bg-green-600 hover:bg-green-700">
                      <Dog className="size-4 mr-2" />
                      Add Your First Dog
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4">
                      {dogsState.map((dog, index) => (
                        <div key={dog.id} className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-6 border border-green-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="text-4xl">🐕</div>
                                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                  {index + 1}
                                </div>
                              </div>
                              <div>
                                <div className="text-xl font-bold text-slate-900">{dog.name}</div>
                                <div className="text-sm text-slate-600 space-y-1">
                                  {dog.breed && <div>🏷️ {dog.breed}</div>}
                                  {dog.age && <div>🎂 {dog.age} years old</div>}
                                  {dog.weight && <div>⚖️ {dog.weight} lbs</div>}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50">
                              <User className="size-4 mr-2" />
                              Edit
                            </Button>
                          </div>
                          {/* Decorative paw prints */}
                          <div className="absolute top-2 right-2 text-green-200 text-xl">🐾</div>
                          <div className="absolute bottom-2 left-2 text-green-200 text-lg opacity-50">🐾</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => setShowDogForm(!showDogForm)}
                        variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Dog className="size-4 mr-2" />
                        {showDogForm ? 'Cancel' : 'Add Another Dog'}
                      </Button>
                    </div>
                  </>
                )}

                {showDogForm && (
                  <div className="mt-6 p-4 border rounded-xl bg-slate-50">
                    <h3 className="font-medium mb-4">Add New Dog</h3>
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Dog Name *</label>
                          <Input
                            value={dogName}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setDogName(e.target.value)}
                            placeholder="Dog's name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Breed</label>
                          <select
                            className="w-full border rounded-md p-2"
                            value={dogBreed}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                              setDogBreed(e.target.value)
                            }
                          >
                            <option value="">Select breed</option>
                            <option value="Golden Retriever">Golden Retriever</option>
                            <option value="Labrador">Labrador</option>
                            <option value="German Shepherd">German Shepherd</option>
                            <option value="Bulldog">Bulldog</option>
                            <option value="Mixed">Mixed</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Age</label>
                          <Input
                            value={dogAge}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setDogAge(e.target.value)}
                            type="number"
                            min="0"
                            placeholder="Age in years"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium mb-1">Weight (lbs)</label>
                          <Input
                            value={dogWeight}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setDogWeight(e.target.value)
                            }
                            type="number"
                            min="0"
                            placeholder="Weight in lbs"
                          />
                        </div>
                        <div className="sm:col-span-2 flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setShowDogForm(false)}>
                            Cancel
                          </Button>
                          <Button onClick={submitDog} disabled={savingDog || !dogName.trim()}>
                            {savingDog ? 'Saving...' : 'Save Dog'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy & Data Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="accent-accent" />
                  Opt-in to anonymous insights (informational only)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-accent" />
                  Allow report previews in-app
                </label>
                <div className="pt-2">
                  <button className="text-xs underline text-accent">Request data deletion</button>
                </div>
                <p className="text-xs text-muted">Insights are informational only and not veterinary advice.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
