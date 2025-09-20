"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, PieChart, TrendingUp, Users } from "lucide-react";

const allowedRoles = [
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
];

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const userRole = (session as any)?.userRole;
    if (!session || !allowedRoles.includes(userRole)) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Analytics Preview</h1>
        <p className="text-slate-600 max-w-2xl">
          A snapshot of the upcoming territory and revenue analytics workspace. This
          page prevents navigation errors until the full dashboard ships.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Pipeline health
            </CardTitle>
            <PieChart className="w-5 h-5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">Coming soon</div>
            <p className="mt-1 text-xs text-slate-500">
              Territory conversion, lead velocity, and canvass coverage will appear here.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Revenue & retention
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">Coming soon</div>
            <p className="mt-1 text-xs text-slate-500">
              MRR trends, churn risk signals, and upsell reporting integrate here next.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Team performance
            </CardTitle>
            <Users className="w-5 h-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">Coming soon</div>
            <p className="mt-1 text-xs text-slate-500">
              Door knock output, cadence execution, and trip efficiency will surface here.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/70 backdrop-blur">
        <CardHeader>
          <CardTitle>What’s on deck</CardTitle>
          <CardDescription>
            We’re wiring the analytics service after cadence automation. Expect live dashboards
            once outbound parity milestones hit “Trips, Team Radar, Cadence Planner”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            • Territory heatmaps and revenue KPIs fed by the new reporting service.<br />
            • Activity funnel (door knocks → appointments → wins) segmented by cadence.<br />
            • Exportable insights for franchise, finance, and field operations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
