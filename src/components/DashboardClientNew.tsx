'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  CheckCircle2,
  Dog,
  Trophy,
  Home,
  User,
  Leaf,
} from 'lucide-react';

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

function buildSparklinePath(points: WeeklyPoint[], width = 280, height = 60, padding = 16) {
  if (points.length === 0) return '';
  const maxVal = Math.max(1, ...points.map((p) => p.value));
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = innerWidth / Math.max(1, points.length - 1);
  const yFor = (v: number) => padding + (innerHeight - (v / maxVal) * innerHeight);
  const xFor = (i: number) => padding + i * stepX;
  let d = '';
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  });
  return d;
}

type StatRingProps = {
  value: number; // 0..1
  size?: number;
  thickness?: number;
  centerText?: string;
  caption?: string;
  accentColorClassName?: string; // e.g. text-accent
};

function StatRing({
  value,
  size = 56,
  thickness = 6,
  centerText,
  caption,
  accentColorClassName = 'text-accent',
}: StatRingProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value || 0));
  const dash = clamped * circumference;
  const remainder = circumference - dash;
  return (
    <div className="inline-flex flex-col items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={thickness}
          fill="none"
          opacity="0.35"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${remainder}`}
          fill="none"
          className={accentColorClassName}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {centerText && (
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="fill-slate-900"
            fontSize={Math.max(12, size * 0.28)}
            fontWeight={700}
          >
            {centerText}
          </text>
        )}
      </svg>
      {caption && <div className="text-[10px] leading-none text-muted mt-1">{caption}</div>}
    </div>
  );
}

export default function DashboardClientNew(props: DashboardClientProps) {
  const { user, dogs, serviceVisits, dataReadings } = props;
  const [copied, setCopied] = useState(false);

  // Generate particle data once to avoid hydration mismatch
  const [particles] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      width: Math.random() * 4 + 2,
      height: Math.random() * 4 + 2,
      delay: Math.random() * 2,
    }))
  );

  // Local state mirrors for inline updates and onboarding hiding
  const [userState, setUserState] = useState(user);
  const [dogsState, setDogsState] = useState(dogs);
  const hasAnyData = dataReadings.length > 0 || serviceVisits.length > 0;
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
  const trendPath = useMemo(() => buildSparklinePath(weeklySeries), [weeklySeries]);

  const uniqueColors = useMemo(() => {
    const set = new Set(
      dataReadings
        .map((r) => (r.color || '').trim().toLowerCase())
        .filter((s) => s && s !== 'normal' && s !== 'healthy')
    );
    return set.size;
  }, [dataReadings]);

  const uniqueConsistency = useMemo(() => {
    const set = new Set(
      dataReadings.map((r) => (r.consistency || '').trim().toLowerCase()).filter((s) => s)
    );
    return set.size;
  }, [dataReadings]);

  const referralUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${user.id}`
      : `https://www.yardura.com/?ref=${user.id}`;

  const weeksWithData = useMemo(
    () => weeklySeries.filter((p) => p.value > 0).length,
    [weeklySeries]
  );

  const baselinePercent = useMemo(
    () => Math.min(100, Math.round((weeksWithData / 4) * 100)),
    [weeksWithData]
  );

  const lastReadingAt = useMemo(() => {
    if (dataReadings.length === 0) return null as Date | null;
    const ts = Math.max(...dataReadings.map((r) => new Date(r.timestamp).getTime()));
    return new Date(ts);
  }, [dataReadings]);

  const nextServiceAt = useMemo(() => {
    const future = serviceVisits
      .map((v) => new Date(v.scheduledDate))
      .filter((d) => d.getTime() >= Date.now())
      .sort((a, b) => a.getTime() - b.getTime());
    return future[0] || null;
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

  const nextServiceProgress = useMemo(() => {
    if (daysUntilNext == null) return 0;
    return 1 - Math.min(1, daysUntilNext / 7);
  }, [daysUntilNext]);

  const daysSinceLast = useMemo(() => {
    if (!lastCompletedAt) return null as number | null;
    const ms = Date.now() - lastCompletedAt.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [lastCompletedAt]);

  const lastServiceRecency = useMemo(() => {
    if (daysSinceLast == null) return 0;
    return Math.min(1, daysSinceLast / 7);
  }, [daysSinceLast]);

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

  const gramsThisWeek = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = new Date();
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return inRange(t, start, end) ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

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

  const activityRatio7of30 = useMemo(() => {
    return last30DaysCount > 0 ? Math.min(1, last7DaysCount / last30DaysCount) : 0;
  }, [last7DaysCount, last30DaysCount]);

  const ecoRatioVsPrev = useMemo(() => {
    return gramsPrevMonth > 0 ? Math.min(1.25, gramsThisMonth / gramsPrevMonth) / 1.25 : 0.6; // normalize, cap for ring
  }, [gramsThisMonth, gramsPrevMonth]);

  const recentInsightsLevel = useMemo(() => {
    const concerning = dataReadings.some((r) => {
      const c = (r.color || '').toLowerCase();
      return c.includes('black') || c.includes('tarry') || c.includes('melena') || c.includes('red');
    });
    return concerning ? 'WATCH' : 'NORMAL';
  }, [dataReadings]);

  const consistencyCounts = useMemo(() => {
    const map = new Map<string, number>();
    dataReadings.forEach((r) => {
      const key = (r.consistency || 'unknown').toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [dataReadings]);

  const colorFlagCounts = useMemo(() => {
    const mutable: { blackTar: number; brightRed: number; yellowGray: number; green: number } = {
      blackTar: 0,
      brightRed: 0,
      yellowGray: 0,
      green: 0,
    };
    dataReadings.forEach((r) => {
      const c = (r.color || '').toLowerCase();
      if (!c) return;
      if (c.includes('black') || c.includes('tarry') || c.includes('melena')) mutable.blackTar += 1;
      if (c.includes('red')) mutable.brightRed += 1;
      if (c.includes('yellow') || c.includes('gray') || c.includes('grey')) mutable.yellowGray += 1;
      if (c.includes('green')) mutable.green += 1;
    });
    return mutable;
  }, [dataReadings]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
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
            <p className="text-slate-300 mt-2 text-lg">
              Household: {dogsState.length} {dogsState.length === 1 ? 'dog' : 'dogs'} •
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-300">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                Live wellness tracking
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm" asChild>
              <a href="#" aria-label="Open settings">
                <Settings className="size-4 mr-2" /> Settings
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
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
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
            {/* Next Pickup */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Pickup</CardTitle>
                <Calendar className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {nextServiceAt ? nextServiceAt.toLocaleDateString() : '—'}
                    </div>
                    <p className="text-xs text-muted">Scheduled window</p>
                  </div>
                  <div className="hidden sm:block">
                    <StatRing
                      value={nextServiceProgress}
                      centerText={daysUntilNext != null ? `${daysUntilNext}d` : '—'}
                      caption="to next"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Last Pickup */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Pickup</CardTitle>
                <Calendar className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {lastCompletedAt ? lastCompletedAt.toLocaleDateString() : '—'}
                    </div>
                    <p className="text-xs text-muted">Most recent visit</p>
                  </div>
                  <div className="hidden sm:block">
                    <StatRing
                      value={lastServiceRecency}
                      centerText={daysSinceLast != null ? `${daysSinceLast}d` : '—'}
                      caption="since"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Insights */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Insights</CardTitle>
                <Heart className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${recentInsightsLevel === 'WATCH' ? 'text-amber-600' : 'text-slate-900'}`}>
                  {recentInsightsLevel === 'WATCH' ? 'Watch' : 'All normal'}
                </div>
                <p className="text-xs text-muted">Informational only</p>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
                <TrendingUp className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-muted">
                    <div className="flex items-center justify-between"><span>Deposits (7d)</span><span className="font-semibold text-ink">{last7DaysCount}</span></div>
                    <div className="flex items-center justify-between"><span>Deposits (30d)</span><span className="font-semibold text-ink">{last30DaysCount}</span></div>
                    <div className="flex items-center justify-between"><span>Avg wt (30d)</span><span className="font-semibold text-ink">{avgWeight30G != null ? `${avgWeight30G.toFixed(1)} g` : '—'}</span></div>
                  </div>
                  <div className="hidden sm:block">
                    <StatRing
                      value={activityRatio7of30}
                      centerText={`${last7DaysCount}`}
                      caption="7d"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Eco (MTD) */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eco (MTD)</CardTitle>
                <Leaf className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-muted">
                    <div className="flex items-center justify-between"><span>Diverted</span><span className="font-semibold text-ink">{formatLbsFromGrams(gramsThisMonth)} lbs</span></div>
                    <div className="flex items-center justify-between"><span>Methane</span><span className="font-semibold text-ink">{methaneThisMonthLbsEq.toFixed(1)} ft³</span></div>
                  </div>
                  <div className="hidden sm:block">
                    <StatRing
                      value={ecoRatioVsPrev}
                      centerText={`${formatLbsFromGrams(gramsThisMonth)}`}
                      caption="lbs MTD"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing */}
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Billing</CardTitle>
                <User className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{user.stripeCustomerId ? 'Active' : 'Set up'}</div>
                <p className="text-xs text-muted">Manage plan and payments</p>
                <div className="mt-2">
                  <a className="text-xs text-accent underline" href="/billing">Open Billing Portal</a>
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
                <Button className="h-20 flex flex-col gap-2" variant="outline">
                  <Calendar className="size-6" />
                  <span>Schedule Service</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline">
                  <Dog className="size-6" />
                  <span>Add Dog</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline">
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
          {/* Wellness Overview Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <Heart className="size-4 text-pink-500" />
                  Last Sample
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {lastReadingAt ? lastReadingAt.toLocaleDateString() : '—'}
                </div>
                <p className="text-xs text-muted mt-1">Most recent wellness check</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-green-500" />
                  Weekly Trend
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {typeof weekTrend === 'number'
                    ? `${weekTrend * 100 > 0 ? '+' : ''}${Math.round(weekTrend * 100)}%`
                    : '—'
                  }
                </div>
                <p className="text-xs text-muted mt-1">Waste volume change</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <Dog className="size-4 text-blue-500" />
                  Health Score
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {dataReadings.length > 0 ? 'Good' : '—'}
                </div>
                <p className="text-xs text-muted mt-1">Overall wellness status</p>
              </CardContent>
            </Card>
          </div>
          {/* Insights Timeline (stacked markers) */}
          <Card>
            <CardHeader>
              <CardTitle>Insights Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <svg viewBox="0 0 800 120" className="w-[800px] h-[120px] max-w-full">
                  <line x1="20" y1="60" x2="780" y2="60" stroke="hsl(var(--muted))" strokeWidth="1" opacity="0.5" />
                  {dataReadings.slice(0, 24).map((r, i) => {
                    const x = 30 + i * 30;
                    const hasRed = (r.color || '').toLowerCase().includes('red');
                    const hasBlack = (r.color || '').toLowerCase().includes('black') || (r.color || '').toLowerCase().includes('tarry');
                    return (
                      <g key={r.id || i}>
                        {/* Consistency dot */}
                        <circle cx={x} cy={45} r={4} fill="hsl(var(--accent))">
                          <title>{new Date(r.timestamp).toLocaleDateString()} • Consistency: {r.consistency || '—'}</title>
                        </circle>
                        {/* Color markers */}
                        {hasRed && (
                          <rect x={x - 4} y={64} width={8} height={8} fill="#ef4444">
                            <title>Color: red</title>
                          </rect>
                        )}
                        {hasBlack && (
                          <rect x={x - 4} y={76} width={8} height={8} fill="#111827">
                            <title>Color: black/tarry</title>
                          </rect>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="mt-3 text-xs text-muted">Markers summarize recent color/consistency. Informational only.</div>
            </CardContent>
          </Card>
          {/* Key Signals (compact) */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle>Key Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 items-start">
                <div className="p-4 rounded-xl border bg-white/60">
                  <div className="text-xs text-muted mb-1">Last sample</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {lastReadingAt ? lastReadingAt.toLocaleDateString() : '—'}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs bg-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Most recent check
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-white/60">
                  <div className="text-xs text-muted mb-1">WoW change</div>
                  <div className={`text-2xl font-bold ${typeof weekTrend === 'number' ? (weekTrend >= 0 ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-900'}`}>
                    {typeof weekTrend === 'number' ? `${weekTrend >= 0 ? '+' : ''}${Math.round(weekTrend * 100)}%` : '—'}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    vs prior week volume
                  </div>
                </div>

                <div className="md:col-span-1 md:row-span-1 col-span-3">
                  <div className="p-4 rounded-xl border bg-white/60">
                    <div className="text-xs text-muted mb-2">8-week activity</div>
                    <svg viewBox="0 0 300 60" className="w-full h-[60px]">
                      <g stroke="hsl(var(--muted))" strokeWidth="0.5" opacity="0.3">
                        <line x1="0" y1="10" x2="300" y2="10" />
                        <line x1="0" y1="30" x2="300" y2="30" />
                        <line x1="0" y1="50" x2="300" y2="50" />
                      </g>
                      {trendPath && (
                        <path d={trendPath} fill="none" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" />
                      )}
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted">
                Insights are informational only and not veterinary advice.
              </div>
            </CardContent>
          </Card>

          {/* Core Signals (3 Cs) */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle>Core Wellness Signals (3 Cs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/60 border border-slate-200/60">
                  <div className="text-sm font-medium text-ink">Color</div>
                  <div className="text-xs text-muted">
                    {uniqueColors > 1 ? 'Variability detected last weeks' : 'Stable hues'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/60 border border-slate-200/60">
                  <div className="text-sm font-medium text-ink">Consistency</div>
                  <div className="text-xs text-muted">
                    {uniqueConsistency > 1 ? 'Mixed textures observed' : 'Consistent patterns'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/60 border border-slate-200/60">
                  <div className="text-sm font-medium text-ink">Content</div>
                  <div className="text-xs text-muted">No content anomalies logged</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted">
                Informational only, not veterinary advice. Talk to your vet for concerns.
              </div>
            </CardContent>
          </Card>

          {/* Color Distribution */}
          <Card className="motion-hover-lift">
            <CardHeader>
              <CardTitle>Color Distribution (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                  const counts = new Map<string, number>();
                  dataReadings
                    .filter((r) => new Date(r.timestamp).getTime() >= cutoff)
                    .forEach((r) => {
                      const label = (r.color || 'unknown').toLowerCase();
                      counts.set(label, (counts.get(label) || 0) + 1);
                    });
                  const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
                  const max = Math.max(1, ...items.map(([, c]) => c));
                  return items.map(([label, count]) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-muted truncate">{label}</div>
                      <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                      </div>
                      <div className="w-8 text-right text-xs text-muted">{count}</div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Service Streak and Breakdown */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div>
              <Card className="motion-hover-lift">
                <CardHeader>
                  <CardTitle>Service Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{serviceStreak}</div>
                  <div className="text-xs text-muted">Completed visits in a row</div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card className="motion-hover-lift">
                <CardHeader>
                  <CardTitle>Observations Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {consistencyCounts.length > 0 ? (
                    <div className="space-y-2">
                      {consistencyCounts.map(([label, count]) => {
                        const max = Math.max(...consistencyCounts.map(([, c]) => c));
                        const width = Math.round((count / (max || 1)) * 100);
                        return (
                          <div key={label} className="flex items-center gap-3">
                              <div className="w-24 text-xs text-muted truncate">{label}</div>
                              <div className="flex-1 relative bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
                                <div
                                  className="bg-gradient-to-r from-pink-400 to-pink-600 h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${width}%` }}
                                />
                                {/* Hand giving belly rub */}
                                <div
                                  className="absolute top-1/2 transform -translate-y-1/2 text-xs animate-pulse"
                                  style={{ left: `calc(${width}% - 8px)` }}
                                >
                                  🖐️
                                </div>
                                {/* Sparkles for good consistency */}
                                {width > 70 && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-white text-xs animate-ping">✨</div>
                                  </div>
                                )}
                              </div>
                              <div className="w-8 text-right text-xs text-muted">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Heart className="size-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted">No wellness observations yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Schedule a service to unlock health insights for your pets
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
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

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Service Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-blue-500" />
                  Next Service
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {nextServiceAt ? nextServiceAt.toLocaleDateString() : 'None scheduled'}
                </div>
                <p className="text-xs text-muted mt-1">Upcoming appointment</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-green-500" />
                  Service Streak
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {serviceStreak}
                </div>
                <p className="text-xs text-muted mt-1">Consecutive visits completed</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-purple-500" />
                  Total Services
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {serviceVisits.length}
                </div>
                <p className="text-xs text-muted mt-1">All time</p>
              </CardContent>
            </Card>
          </div>

          {/* Service Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-accent" />
                Schedule Your Next Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button className="h-20 flex flex-col gap-2" variant="outline">
                  <Calendar className="size-6" />
                  <span>One-Time Service</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline">
                  <TrendingUp className="size-6" />
                  <span>Start Subscription</span>
                </Button>
                <Button className="h-20 flex flex-col gap-2" variant="outline">
                  <Heart className="size-6" />
                  <span>View Past Services</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Service Visits */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Service Visits</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceVisits.length > 0 ? (
                <div className="space-y-3">
                  {serviceVisits.slice(0, 5).map((visit) => {
                    const badgeVariant: 'default' | 'secondary' =
                      visit.status === 'COMPLETED' ? 'default' : 'secondary';
                    return (
                      <div
                        key={visit.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">
                            {visit.serviceType.replace('_', ' ')} • {visit.yardSize}
                          </div>
                          <div className="text-sm text-slate-600">
                            {new Date(visit.scheduledDate).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={
                            badgeVariant === 'default'
                              ? 'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-accent text-white'
                              : 'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border'
                          }
                        >
                          {visit.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="text-slate-600">
                    <Calendar className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No service visits scheduled yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {user.stripeCustomerId
                        ? "Ready to get started with clean, sustainable yard care?"
                        : "Sign up to schedule your first service and unlock pet wellness insights!"
                      }
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {user.stripeCustomerId ? (
                      <>
                        <Button className="bg-accent hover:bg-accent/90">
                          Schedule Service
                        </Button>
                        <Button variant="outline">
                          View Subscription
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button className="bg-accent hover:bg-accent/90">
                          Start Subscription
                        </Button>
                        <Button variant="outline">
                          Schedule One-Time
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    ✨ Free wellness insights included with every service
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
