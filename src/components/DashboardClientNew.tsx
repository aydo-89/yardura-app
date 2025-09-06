'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

type DashboardClientProps = {
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    zipCode?: string | null;
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

export default function DashboardClientNew(props: DashboardClientProps) {
  const { user, dogs, serviceVisits, dataReadings } = props;
  const [copied, setCopied] = useState(false);

  const hasAnyData = dataReadings.length > 0 || serviceVisits.length > 0;
  const { percent: profilePercent, fields: profileFields } = useMemo(
    () => getProfileCompleteness(user, dogs.length),
    [user, dogs.length]
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">
            Welcome back{user.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-slate-600">
            Household: {dogs.length} {dogs.length === 1 ? 'dog' : 'dogs'}. Signals are aggregated
            across all dogs (non-diagnostic).
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="#" aria-label="Open settings">
            <Settings className="size-4 mr-2" /> Settings
          </a>
        </Button>
      </div>

      {/* Empty State: Profile & Onboarding */}
      {!hasAnyData && (
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
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${profilePercent}%` }}
                    />
                  </div>
                </div>

                <ul className="grid sm:grid-cols-2 gap-2">
                  {profileFields.map(([label, ok]: [string, boolean]) => (
                    <li key={label} className="flex items-center gap-2 text-sm">
                      {ok ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <CircleAlert className="size-4 text-amber-500" />
                      )}
                      <span className={ok ? 'text-slate-600 line-through' : 'text-slate-700'}>
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="#">Update Profile</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#">Add Dog Profile</a>
                  </Button>
                </div>
              </div>

              {/* Referral Incentives */}
              <div className="p-4 rounded-xl bg-accent-soft border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="size-4 text-accent" />
                  <div className="text-sm font-medium text-ink">Referral rewards</div>
                </div>
                <div className="text-sm text-slate-700 mb-3">
                  Give $10, Get $10 on your next service.
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={referralUrl}
                    className="flex-1 px-3 py-2 rounded-lg border border-accent/20 text-sm"
                    aria-label="Your referral link"
                  />
                  <Button variant="outline" onClick={handleCopy} aria-label="Copy referral link">
                    <Copy className="size-4 mr-2" /> {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button onClick={handleShare} aria-label="Share referral link">
                    <Share2 className="size-4 mr-2" /> Share
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-muted">
              Wellness signals are informational only and not veterinary advice.
            </div>
          </CardContent>
        </Card>
      )}

      {/* When data exists */}
      {hasAnyData && (
        <>
          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Household Dogs</CardTitle>
                <Dog className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dogs.length}</div>
                <p className="text-xs text-muted">Aggregated insights</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Waste Diverted</CardTitle>
                <TrendingUp className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatLbsFromGrams(totalGrams)} lbs</div>
                <p className="text-xs text-muted">Kept out of landfills</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Observations (30d)</CardTitle>
                <Heart className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{last30DaysCount}</div>
                <p className="text-xs text-muted">Weekly pickup snapshots</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Service Visits</CardTitle>
                <Calendar className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{serviceVisits.length}</div>
                <p className="text-xs text-muted">All time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Trend (Week over Week) */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Week-over-Week Observations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-28 mb-3">
                    <svg
                      viewBox="0 0 280 60"
                      className="w-full h-full"
                      aria-label="Weekly observations"
                    >
                      <defs>
                        <linearGradient id="wkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
                        </linearGradient>
                      </defs>

                      <g stroke="hsl(var(--muted))" strokeWidth="0.5" opacity="0.3">
                        <line x1="0" y1="15" x2="280" y2="15" />
                        <line x1="0" y1="30" x2="280" y2="30" />
                        <line x1="0" y1="45" x2="280" y2="45" />
                      </g>

                      <path
                        d={trendPath}
                        fill="none"
                        stroke="hsl(var(--accent))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    {weeklySeries.map((p: WeeklyPoint) => (
                      <span key={p.weekLabel}>{p.weekLabel}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Core Signals (3 Cs) */}
            <div>
              <Card>
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
            </div>
          </div>

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
                        <Badge variant={badgeVariant}>{visit.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-600">No visits yet. Schedule your first one!</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
