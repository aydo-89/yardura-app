// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { track } from "@/lib/analytics";
import { ComingSoonOverlay } from "./WellnessTab/components/ComingSoonOverlay";
import {
  Heart,
  Calendar,
  TrendingUp,
  Users,
  Settings,
  Share2,
  Copy,
  CircleAlert,
  Dog as DogIcon,
  Trophy,
  Home,
  Leaf,
  User as UserIcon,
  Droplets,
} from "lucide-react";
import type {
  User,
  Dog,
  DashboardServiceVisit,
  DashboardDataReading,
} from "../types";

interface OverviewTabProps {
  user: User;
  dogs: Dog[];
  dataReadings: DashboardDataReading[];
  serviceVisits: DashboardServiceVisit[];
  profilePercent: number;
  profileFields: Array<[string, boolean]>;
  lastReadingAt: Date | null;
  nextServiceAt: Date | null;
  daysUntilNext: number | null;
  serviceStreak: number;
  last7DaysCount: number;
  last30DaysCount: number;
  avgWeight30G: number | null;
  gramsThisMonth: number;
  totalGrams: number;
  methaneThisMonthLbsEq: number;
  recentInsightsLevel: "WATCH" | "NORMAL";
  referralUrl: string;
  onOpenProfileForm(): void;
  onOpenDogForm(): void;
  forms: {
    showProfileForm: boolean;
    showDogForm: boolean;
    formPhone: string;
    setFormPhone: (v: string) => void;
    formAddress: string;
    setFormAddress: (v: string) => void;
    formCity: string;
    setFormCity: (v: string) => void;
    formZip: string;
    setFormZip: (v: string) => void;
    submitProfile: () => Promise<void>;
    savingProfile: boolean;
    dogName: string;
    setDogName: (v: string) => void;
    dogBreed: string;
    setDogBreed: (v: string) => void;
    dogAge: string;
    setDogAge: (v: string) => void;
    dogWeight: string;
    setDogWeight: (v: string) => void;
    submitDog: () => Promise<void>;
    savingDog: boolean;
    setShowProfileForm: (b: boolean) => void;
    setShowDogForm: (b: boolean) => void;
  };
  onCopyReferral(): Promise<void>;
  onShareReferral(): Promise<void>;
}

function ReportsList({ orgId }: { orgId: string }) {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
          onClick={() => track("report_download", { month: m, orgId })}
        >
          <span className="text-sm">{m}</span>
          <span className="text-accent text-xs underline">Download</span>
        </a>
      ))}
    </div>
  );
}

function formatLbsFromGrams(totalGrams: number): string {
  const lbs = totalGrams * 0.00220462;
  return lbs.toFixed(1);
}

export default function OverviewTab(props: OverviewTabProps) {
  const {
    user,
    dogs,
    dataReadings,
    serviceVisits,
    profilePercent,
    profileFields,
    lastReadingAt,
    nextServiceAt,
    daysUntilNext,
    serviceStreak,
    last7DaysCount,
    last30DaysCount,
    avgWeight30G,
    gramsThisMonth,
    totalGrams,
    methaneThisMonthLbsEq,
    recentInsightsLevel,
    referralUrl,
    onOpenProfileForm,
    onOpenDogForm,
    forms,
    onCopyReferral,
    onShareReferral,
  } = props;

  const [copied, setCopied] = useState(false);
  const [showWellnessOverlay, setShowWellnessOverlay] = useState(false);

  const handleCopy = async () => {
    await onCopyReferral();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleJoinWellnessWaitlist = async (email: string) => {
    try {
      // Send to your backend API
      const response = await fetch("/api/waitlist/wellness-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          feature: "wellness-insights",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to join waitlist");
      }

      const result = await response.json();

      // You could also send analytics events here
      console.log("Successfully joined wellness waitlist:", result);
    } catch (error) {
      console.error("Error joining wellness waitlist:", error);

      // Fallback: Store locally if API fails
      const waitlistData = {
        email,
        feature: "wellness-insights",
        timestamp: new Date().toISOString(),
        offline: true, // Mark as offline submission
      };

      // Store in localStorage as fallback
      const existingWaitlist = JSON.parse(
        localStorage.getItem("yardura_waitlist") || "[]",
      );
      existingWaitlist.push(waitlistData);
      localStorage.setItem(
        "yardura_waitlist",
        JSON.stringify(existingWaitlist),
      );

      console.log("Stored wellness waitlist signup locally:", waitlistData);
    }

    // Show success message to user
    setTimeout(() => {
      alert(
        `Thank you for joining the wellness waitlist! We'll notify you at ${email} when advanced wellness insights are available.`,
      );
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Call to Action for First-Time Users */}
      {serviceVisits.length === 0 && (
        <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-accent/10 p-3">
                  <DogIcon className="size-8 text-accent" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-ink mb-2">
                  {user.stripeCustomerId
                    ? "Ready to Schedule Your First Service? 🐾"
                    : "Welcome to Yardura! 🐾"}
                </h3>
                <p className="text-slate-600 mb-4">
                  {user.stripeCustomerId
                    ? "Your account is all set up! Schedule your first sustainable yard service and unlock free pet wellness insights."
                    : "Get your yard cleaned sustainably while gaining valuable wellness insights for your pets. Every service includes free health monitoring technology."}
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
                💚 Environmentally friendly • 🐕 Pet wellness included • ✨
                Professional service
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
              {nextServiceAt
                ? nextServiceAt.toLocaleDateString()
                : "Not scheduled"}
            </div>
            <p className="text-xs text-muted mt-1">
              {daysUntilNext
                ? `${daysUntilNext} days away`
                : "Schedule your next pickup"}
            </p>
            {nextServiceAt && (
              <div className="mt-2 text-xs text-blue-600">
                {nextServiceAt.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
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
                <span className="font-bold text-slate-900">
                  {last7DaysCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">This month:</span>
                <span className="font-bold text-slate-900">
                  {last30DaysCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Avg weight:</span>
                <span className="font-bold text-slate-900">
                  {avgWeight30G != null
                    ? `${(avgWeight30G as number).toFixed(1)}g`
                    : "—"}
                </span>
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
                <span className="font-bold text-green-700">
                  {formatLbsFromGrams(gramsThisMonth)} lbs
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Methane saved:</span>
                <span className="font-bold text-green-700">
                  {methaneThisMonthLbsEq.toFixed(1)} ft³
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total diverted:</span>
                <span className="font-bold text-slate-900">
                  {formatLbsFromGrams(totalGrams)} lbs
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pet Wellness */}
        <Card
          className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
          onClick={() => setShowWellnessOverlay(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pet Wellness</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Coming Soon Badge */}
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-gradient-to-r from-teal-50 to-blue-50 rounded-full border border-teal-200">
                  <span className="text-xs font-medium text-teal-700">
                    Coming Soon
                  </span>
                </div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
              </div>

              {/* Feature Teaser */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Advanced Pet Wellness Insights
                </h4>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-teal-400 rounded-full"></span>
                    <span>AI-powered stool analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-teal-400 rounded-full"></span>
                    <span>Health trend monitoring</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-teal-400 rounded-full"></span>
                    <span>Early issue detection</span>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1">
                  Ready for advanced wellness insights
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  Click to join the waitlist →
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Streak */}
        <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Service Streak
            </CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {serviceStreak}
            </div>
            <p className="text-xs text-muted mt-1">
              {serviceStreak === 1 ? "service" : "services"} in a row
            </p>
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
            <Button
              className="h-20 flex flex-col gap-2"
              variant="outline"
              onClick={() =>
                track("dashboard_quick_action", { action: "schedule_service" })
              }
            >
              <Calendar className="size-6" />
              <span>Schedule Service</span>
            </Button>
            <Button
              className="h-20 flex flex-col gap-2"
              variant="outline"
              onClick={() =>
                track("dashboard_quick_action", { action: "add_dog" })
              }
            >
              <DogIcon className="size-6" />
              <span>Add Dog</span>
            </Button>
            <Button
              className="h-20 flex flex-col gap-2"
              variant="outline"
              onClick={() =>
                track("dashboard_quick_action", {
                  action: "view_health_insights",
                })
              }
            >
              <Heart className="size-6" />
              <span>View Health Insights</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding: Profile & Dog inline forms; hides when complete */}
      {(profilePercent < 100 || dogs.length === 0) && (
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
                    <div className="text-sm font-medium text-ink">
                      Profile completeness
                    </div>
                    <div className="text-sm text-muted">{profilePercent}%</div>
                  </div>
                  <div className="relative w-full bg-slate-100 rounded-full h-4 overflow-hidden border-2 border-slate-200">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${profilePercent}%` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-xs animate-pulse">
                          🐾
                        </div>
                      </div>
                    </div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-1000 ease-out text-sm"
                      style={{ left: `calc(${profilePercent}% - 8px)` }}
                    >
                      🐶
                    </div>
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
                      <span
                        className={
                          ok ? "text-slate-600 line-through" : "text-slate-700"
                        }
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={onOpenProfileForm}>
                    {forms.showProfileForm
                      ? "Close Profile Form"
                      : "Update Profile"}
                  </Button>
                  <Button variant="outline" onClick={onOpenDogForm}>
                    {forms.showDogForm ? "Close Dog Form" : "Add Dog Profile"}
                  </Button>
                </div>

                {forms.showProfileForm && (
                  <div className="mt-4 space-y-3 p-4 border rounded-xl">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Phone
                        </label>
                        <Input
                          value={forms.formPhone}
                          onChange={(e) => forms.setFormPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          ZIP
                        </label>
                        <Input
                          value={forms.formZip}
                          onChange={(e) => forms.setFormZip(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Address
                      </label>
                      <AddressAutocomplete
                        value={forms.formAddress}
                        onChange={forms.setFormAddress}
                        onSelect={(addr) => {
                          if (addr.formattedAddress)
                            forms.setFormAddress(addr.formattedAddress);
                          if (addr.city) forms.setFormCity(addr.city || "");
                          if (addr.postalCode)
                            forms.setFormZip(addr.postalCode || "");
                        }}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          City
                        </label>
                        <Input
                          value={forms.formCity}
                          onChange={(e) => forms.setFormCity(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={forms.submitProfile}
                          disabled={forms.savingProfile}
                        >
                          {forms.savingProfile ? "Saving…" : "Save Profile"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {forms.showDogForm && (
                  <div className="mt-4 space-y-3 p-4 border rounded-xl">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Dog Name *
                      </label>
                      <Input
                        value={forms.dogName}
                        onChange={(e) => forms.setDogName(e.target.value)}
                      />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium mb-1">
                          Breed
                        </label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={forms.dogBreed}
                          onChange={(e) => forms.setDogBreed(e.target.value)}
                        >
                          <option value="">Select breed</option>
                          <option value="Mixed Breed">Mixed Breed</option>
                          <option value="Labrador Retriever">
                            Labrador Retriever
                          </option>
                          <option value="Golden Retriever">
                            Golden Retriever
                          </option>
                          <option value="German Shepherd">
                            German Shepherd
                          </option>
                          <option value="French Bulldog">French Bulldog</option>
                          <option value="Bulldog">Bulldog</option>
                          <option value="Poodle">Poodle</option>
                          <option value="Beagle">Beagle</option>
                          <option value="Rottweiler">Rottweiler</option>
                          <option value="Yorkshire Terrier">
                            Yorkshire Terrier
                          </option>
                          <option value="Dachshund">Dachshund</option>
                          <option value="Boxer">Boxer</option>
                          <option value="Australian Shepherd">
                            Australian Shepherd
                          </option>
                          <option value="Cavalier King Charles Spaniel">
                            Cavalier King Charles Spaniel
                          </option>
                          <option value="Shih Tzu">Shih Tzu</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Age
                        </label>
                        <Input
                          value={forms.dogAge}
                          onChange={(e) => forms.setDogAge(e.target.value)}
                          type="number"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Weight (lbs)
                        </label>
                        <Input
                          value={forms.dogWeight}
                          onChange={(e) => forms.setDogWeight(e.target.value)}
                          type="number"
                          min="0"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <Button
                          onClick={forms.submitDog}
                          disabled={forms.savingDog || !forms.dogName.trim()}
                        >
                          {forms.savingDog ? "Saving…" : "Save Dog"}
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
                  <div className="text-sm font-medium text-ink">
                    Referral rewards
                  </div>
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
                    <Button
                      variant="outline"
                      onClick={handleCopy}
                      aria-label="Copy referral link"
                    >
                      <Copy className="size-4 mr-2" />{" "}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      onClick={onShareReferral}
                      aria-label="Share referral link"
                    >
                      <Share2 className="size-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-xs text-muted">
        Wellness signals are informational only and not veterinary advice.
      </div>

      {/* Coming Soon Overlay for Wellness Insights */}
      {showWellnessOverlay && (
        <ComingSoonOverlay
          onJoinWaitlist={handleJoinWellnessWaitlist}
          onClose={() => setShowWellnessOverlay(false)}
          closable={true}
        />
      )}
    </div>
  );
}
