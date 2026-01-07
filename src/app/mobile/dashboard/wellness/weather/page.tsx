import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ThermometerSun, Wind } from "lucide-react";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

type WeatherData = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    apparent_temperature?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

const describeWeatherCode = (code?: number | null) => {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code ?? -1)) return "Mostly clear";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code ?? -1)) return "Fog";
  if (code && code >= 51 && code <= 67) return "Drizzle or rain";
  if (code && code >= 71 && code <= 77) return "Snow";
  if (code && code >= 80 && code <= 82) return "Rain showers";
  if (code && code >= 95) return "Thunderstorms";
  return "Mixed";
};

export default async function MobileWellnessWeatherPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/weather");
  }

  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);
  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: AppUserRole | null | undefined,
    options?: { requireCustomer?: boolean },
  ) => {
    if (!role) {
      return options?.requireCustomer ? "/quote" : "/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech";
    }
    if (role === "CUSTOMER" && options?.requireCustomer) {
      return "/quote";
    }
    return getDefaultRedirectForRole(role);
  };

  if (activeRole && activeRole !== "CUSTOMER") {
    redirect(redirectForRole(activeRole));
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, city: true, state: true, latitude: true, longitude: true },
  });

  if (!customer) {
    let fallbackRole: AppUserRole | null | undefined =
      prioritizedRole ??
      ((session as any)?.userRole as AppUserRole | null | undefined) ??
      ((session?.user as any)?.role as AppUserRole | null | undefined) ??
      null;

    if (!fallbackRole) {
      const userRecord = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      });
      fallbackRole = (userRecord?.role as AppUserRole | undefined) ?? null;
    }

    redirect(redirectForRole(fallbackRole, { requireCustomer: true }));
  }

  const lat = customer.latitude;
  const lng = customer.longitude;

  let weather: WeatherData | null = null;
  if (typeof lat === "number" && typeof lng === "number") {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      "&current=temperature_2m,apparent_temperature,weather_code" +
      "&hourly=apparent_temperature" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=fahrenheit&timezone=auto";
    try {
      const res = await fetch(url, { next: { revalidate: 900 } });
      if (res.ok) {
        weather = (await res.json()) as WeatherData;
      }
    } catch {
      weather = null;
    }
  }

  const currentTemp = weather?.current?.temperature_2m;
  const feelsLike = weather?.current?.apparent_temperature ?? currentTemp;
  const condition = describeWeatherCode(weather?.current?.weather_code ?? null);

  const hourlyTemps = weather?.hourly?.apparent_temperature ?? [];
  const nextWindow = hourlyTemps.slice(0, 24);
  const high =
    nextWindow.length > 0 ? Math.max(...nextWindow.filter(Number.isFinite)) : null;
  const low =
    nextWindow.length > 0 ? Math.min(...nextWindow.filter(Number.isFinite)) : null;

  const heatAlert =
    typeof high === "number" && high >= 90
      ? "High heat alert — limit midday walks and add extra water breaks."
      : typeof high === "number" && high >= 80
        ? "Warm weather caution — keep hydration top of mind."
        : null;

  const coldAlert =
    typeof low === "number" && low <= 20
      ? "Cold snap alert — keep outdoor time short and watch paw safety."
      : typeof low === "number" && low <= 32
        ? "Chilly weather caution — consider a jacket for short coats."
        : null;

  const dailyHigh = weather?.daily?.temperature_2m_max?.[0];
  const dailyLow = weather?.daily?.temperature_2m_min?.[0];

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-3">
        <Link
          href="/mobile/dashboard/wellness"
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to wellness
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Weather safety</h1>
          <p className="text-sm text-slate-400">
            Heat and cold alerts tailored to your location.
          </p>
        </div>
      </header>

      {!weather && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
          <p className="text-sm text-slate-400">
            We couldn&apos;t load local weather yet. Capture a stool or update your
            address to enable alerts.
          </p>
          <Link href="/mobile/dashboard/wellness/capture" className="text-xs text-emerald-300">
            Add a capture with location →
          </Link>
        </section>
      )}

      {weather && (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Current conditions
                </p>
                <h2 className="text-lg font-semibold text-white">
                  {customer.city}, {customer.state}
                </h2>
                <p className="text-sm text-slate-400">{condition}</p>
              </div>
              <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
                <ThermometerSun className="h-5 w-5" aria-hidden />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Temp</p>
                <p className="text-lg font-semibold text-white">
                  {typeof currentTemp === "number" ? `${Math.round(currentTemp)}°F` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Feels like</p>
                <p className="text-lg font-semibold text-white">
                  {typeof feelsLike === "number" ? `${Math.round(feelsLike)}°F` : "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Wind className="h-4 w-4" aria-hidden />
              Safety alerts
            </div>
            {heatAlert || coldAlert ? (
              <div className="space-y-2 text-sm text-slate-200">
                {heatAlert && <p>• {heatAlert}</p>}
                {coldAlert && <p>• {coldAlert}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No extreme heat or cold expected in the next 24 hours.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Next 24 hours
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">High</p>
                <p className="text-lg font-semibold text-white">
                  {typeof dailyHigh === "number" ? `${Math.round(dailyHigh)}°F` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Low</p>
                <p className="text-lg font-semibold text-white">
                  {typeof dailyLow === "number" ? `${Math.round(dailyLow)}°F` : "—"}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
