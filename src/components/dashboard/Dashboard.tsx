// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { track } from '@/lib/analytics';
import type { DashboardClientProps } from './types';
import {
  OverviewTab,
  WellnessTab,
  ServicesTab,
  EcoTab,
  ReportsTab,
  BillingTab,
  RewardsTab,
  ProfileTab
} from './tabs';

export default function Dashboard(props: DashboardClientProps) {
  const { user, dogs, serviceVisits, dataReadings } = props;

  // Shared computed metrics
  const profilePercent = useMemo(() => {
    const fields: Array<[string, boolean]> = [
      ['Name', Boolean(user.name && user.name.trim().length > 0)],
      ['Phone', Boolean(user.phone && user.phone.trim().length > 0)],
      ['Address', Boolean(user.address && user.address.trim().length > 0)],
      ['City', Boolean(user.city && user.city.trim().length > 0)],
      ['ZIP code', Boolean(user.zipCode && user.zipCode.trim().length > 0)],
      ['At least 1 dog profile', dogs.length > 0],
    ];
    const completed = fields.filter(([, ok]) => ok).length;
    return Math.round((completed / fields.length) * 100);
  }, [user, dogs.length]);

  const profileFields = useMemo(() => {
    return [
      ['Name', Boolean(user.name && user.name.trim().length > 0)],
      ['Phone', Boolean(user.phone && user.phone.trim().length > 0)],
      ['Address', Boolean(user.address && user.address.trim().length > 0)],
      ['City', Boolean(user.city && user.city.trim().length > 0)],
      ['ZIP code', Boolean(user.zipCode && user.zipCode.trim().length > 0)],
      ['At least 1 dog profile', dogs.length > 0],
    ] as Array<[string, boolean]>;
  }, [user, dogs.length]);

  const totalGrams = useMemo(
    () => dataReadings.reduce((sum, r) => sum + (r.weight || 0), 0),
    [dataReadings]
  );

  const last30DaysCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return dataReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff).length;
  }, [dataReadings]);

  const last7DaysCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return dataReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff).length;
  }, [dataReadings]);

  const avgWeight30G = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const weights = dataReadings
      .filter((r) => r.weight != null && new Date(r.timestamp).getTime() >= cutoff)
      .map((r) => r.weight as number);
    if (weights.length === 0) return null;
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum / weights.length;
  }, [dataReadings]);

  const lastReadingAt = useMemo(() => {
    if (dataReadings.length === 0) return null;
    const ts = Math.max(...dataReadings.map((r) => new Date(r.timestamp).getTime()));
    return new Date(ts);
  }, [dataReadings]);

  const nextServiceAt = useMemo(() => {
    const nowTs = Date.now();
    const futureScheduled = serviceVisits
      .filter((v) => v.status === 'SCHEDULED')
      .map((v) => new Date(v.scheduledDate))
      .filter((d) => d.getTime() >= nowTs)
      .sort((a, b) => a.getTime() - b.getTime());

    const isWeekly = serviceVisits.some((v) => (v.serviceType || '').includes('WEEKLY'));
    let cadenceNext: Date | null = null;
    if (isWeekly) {
      const mostRecentCompleted = serviceVisits
        .filter((v) => v.status === 'COMPLETED')
        .map((v) => new Date(v.scheduledDate))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      if (mostRecentCompleted) {
        const n = new Date(mostRecentCompleted);
        do { n.setDate(n.getDate() + 7); } while (n.getTime() < nowTs);
        cadenceNext = n;
      }
    }

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
    if (!nextServiceAt) return null;
    const ms = nextServiceAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [nextServiceAt]);

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

  const gramsThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return t >= monthStart && t < monthEnd ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const methaneThisMonthLbsEq = useMemo(() => {
    return gramsThisMonth * 0.002 * 0.67;
  }, [gramsThisMonth]);

  const recentInsightsLevel = useMemo(() => {
    const concerning = dataReadings.some((r) => {
      const c = (r.color || '').toLowerCase();
      return c.includes('black') || c.includes('tarry') || c.includes('melena') || c.includes('red');
    });
    return concerning ? 'WATCH' : 'NORMAL';
  }, [dataReadings]);

  // Form state
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showDogForm, setShowDogForm] = useState(false);
  const [formPhone, setFormPhone] = useState(user.phone || '');
  const [formAddress, setFormAddress] = useState(user.address || '');
  const [formCity, setFormCity] = useState(user.city || '');
  const [formZip, setFormZip] = useState(user.zipCode || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogAge, setDogAge] = useState('');
  const [dogWeight, setDogWeight] = useState('');
  const [savingDog, setSavingDog] = useState(false);

  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${user.id}`
    : `https://www.yardura.com/?ref=${user.id}`;

  // Form handlers
  const submitProfile = async () => {
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
      // Update local state would go here
      setShowProfileForm(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const submitDog = async () => {
    if (!dogName.trim()) return;
    setSavingDog(true);
    try {
      await fetch('/api/dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dogName,
          breed: dogBreed || null,
          age: dogAge ? parseInt(dogAge) : null,
          weight: dogWeight,
        }),
      });
      // Update local state would go here
      setDogName('');
      setDogBreed('');
      setDogAge('');
      setDogWeight('');
      setShowDogForm(false);
    } finally {
      setSavingDog(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      track('referral_copy');
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

  return (
    <div className="space-y-6">
      {/* Header Hero - Simplified for now */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Welcome back{user.name ? `, ${user.name}` : ''}! 🐾
            </h1>
            <div className="text-slate-300 mt-2 text-lg">
              Household: {dogs.length} {dogs.length === 1 ? 'dog' : 'dogs'} •
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-300">
                Live wellness tracking
              </span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" onValueChange={(val) => track('dashboard_tab_change', { tab: val })} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Overview
          </TabsTrigger>
          <TabsTrigger value="wellness" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Wellness
          </TabsTrigger>
          <TabsTrigger value="services" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Services
          </TabsTrigger>
          <TabsTrigger value="eco" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Eco Impact
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Reports
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Billing
          </TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Rewards
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200">
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            user={user}
            dogs={dogs}
            dataReadings={dataReadings}
            serviceVisits={serviceVisits}
            profilePercent={profilePercent}
            profileFields={profileFields}
            lastReadingAt={lastReadingAt}
            nextServiceAt={nextServiceAt}
            daysUntilNext={daysUntilNext}
            serviceStreak={serviceStreak}
            last7DaysCount={last7DaysCount}
            last30DaysCount={last30DaysCount}
            avgWeight30G={avgWeight30G}
            gramsThisMonth={gramsThisMonth}
            totalGrams={totalGrams}
            methaneThisMonthLbsEq={methaneThisMonthLbsEq}
            recentInsightsLevel={recentInsightsLevel}
            referralUrl={referralUrl}
            onOpenProfileForm={() => setShowProfileForm(true)}
            onOpenDogForm={() => setShowDogForm(true)}
            forms={{
              showProfileForm,
              showDogForm,
              formPhone,
              setFormPhone,
              formAddress,
              setFormAddress,
              formCity,
              setFormCity,
              formZip,
              setFormZip,
              submitProfile,
              savingProfile,
              dogName,
              setDogName,
              dogBreed,
              setDogBreed,
              dogAge,
              setDogAge,
              dogWeight,
              setDogWeight,
              submitDog,
              savingDog,
              setShowProfileForm,
              setShowDogForm,
            }}
            onCopyReferral={handleCopy}
            onShareReferral={handleShare}
          />
        </TabsContent>

        <TabsContent value="wellness" className="space-y-6">
          <WellnessTab
            dataReadings={dataReadings}
            serviceVisits={serviceVisits}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <ServicesTab
            serviceVisits={serviceVisits}
            nextServiceAt={nextServiceAt}
            daysUntilNext={daysUntilNext}
            lastCompletedAt={lastCompletedAt}
            serviceStreak={serviceStreak}
            user={user}
          />
        </TabsContent>

        <TabsContent value="eco" className="space-y-6">
          <EcoTab
            gramsThisMonth={gramsThisMonth}
            methaneThisMonthLbsEq={methaneThisMonthLbsEq}
            totalGrams={totalGrams}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ReportsTab orgId={user.orgId || 'org_demo'} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingTab user={user} />
        </TabsContent>

        <TabsContent value="rewards" className="space-y-6">
          <RewardsTab user={user} />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <ProfileTab user={user} dogs={dogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
