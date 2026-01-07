"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatServiceDate, formatServiceTime } from "@/lib/time-window";
import {
  CalendarDays,
  Dog,
  Edit3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { EditCustomerDialog } from "@/components/admin/EditCustomerDialog";
import { CustomerJobCard } from "@/components/admin/CustomerJobCard";

type SerializableDog = {
  id: string;
  name: string | null;
  breed: string | null;
  age: number | null;
};

type SerializableJobCard = {
  id: string;
  frequencyLabel: string;
  nextVisitAt: string | null;
  status: string;
  stripeSubscriptionId: string | null;
  preferredTimeWindowLabel: string | null;
};

type SerializableVisit = {
  id: string;
  status: string;
  scheduledDate: string;
  jobFrequencyLabel: string | null;
  technicianName: string | null;
  routeId: string | null;
};

type SerializableLedger = {
  id: string;
  createdAt: string;
  description: string | null;
  amountCents: number | null;
  status: string | null;
  type: string | null;
};

type SerializableCustomerDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  createdAt: string;
  dogs: SerializableDog[];
  activeJobs: SerializableJobCard[];
  inactiveJobs: SerializableJobCard[];
  upcomingVisits: SerializableVisit[];
  recentVisits: SerializableVisit[];
  ledgerEntries: SerializableLedger[];
  lifetimeRevenueCents: number;
};

type CustomerDetailDashboardProps = {
  customer: SerializableCustomerDetail;
};

const formatCurrency = (cents?: number | null) => {
  if (typeof cents !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDateTime = (value: string) => {
  const dateLabel =
    formatServiceDate(value, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) ?? "—";
  const timeLabel =
    formatServiceTime(value, {
      hour: "numeric",
      minute: "2-digit",
    }) ?? "";
  return `${dateLabel} ${timeLabel}`.trim();
};

const formatAddress = (customer: SerializableCustomerDetail) =>
  [customer.addressLine1, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ") || "—";

export function CustomerDetailDashboard({ customer }: CustomerDetailDashboardProps) {
  const metrics = useMemo(() => {
    const activeJobs = customer.activeJobs.length;
    const upcomingVisitDate = customer.upcomingVisits[0]?.scheduledDate ?? null;
    const upcomingVisitLabel = upcomingVisitDate
      ? `${formatDateTime(upcomingVisitDate)} (${formatDistanceToNow(new Date(upcomingVisitDate), { addSuffix: true })})`
      : "No visits scheduled";

    return {
      activeJobs,
      upcomingVisitLabel,
      lifetimeRevenue: formatCurrency(customer.lifetimeRevenueCents),
      dogCount: customer.dogs.length,
    };
  }, [customer]);

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-16">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <Users className="h-4 w-4" />
                <span>Customer profile</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">{customer.name || "Customer"}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                  {customer.email ? (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {customer.email}
                    </span>
                  ) : null}
                  {customer.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Joined {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                  <MapPin className="h-4 w-4" />
                  {formatAddress(customer)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40">
                <Link href={`/admin/customers/${customer.id}/billing`}>Billing portal</Link>
              </Button>
              <EditCustomerDialog
                customer={{
                  id: customer.id,
                  name: customer.name ?? "",
                  email: customer.email ?? null,
                  phone: customer.phone ?? null,
                  addressLine1: customer.addressLine1 ?? "",
                  city: customer.city ?? "",
                  state: customer.state ?? "",
                  zip: customer.zip ?? "",
                }}
                trigger={
                  <Button className="flex items-center gap-2 rounded-xl bg-brand-coral text-white shadow-sm transition hover:bg-brand-coral/90">
                    <Edit3 className="h-4 w-4" /> Edit profile
                  </Button>
                }
              />
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Active jobs</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{metrics.activeJobs}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Service plans currently running</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Next visit</p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{metrics.upcomingVisitLabel}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tap a visit below for detail</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Lifetime value</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{metrics.lifetimeRevenue}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Based on posted ledger entries</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Household</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-brand-mint">
                <Dog className="h-4 w-4" /> {metrics.dogCount} {metrics.dogCount === 1 ? "pet" : "pets"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Keep verification photos in mind before arrival</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2 admin-card">
            <CardHeader>
              <CardTitle>Active jobs</CardTitle>
              <CardDescription>Cadence, next visit, and subscription controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.activeJobs.length ? (
                customer.activeJobs.map((job) => <CustomerJobCard key={job.id} job={job} />)
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No active jobs.</p>
              )}
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Inactive jobs</CardTitle>
              <CardDescription>Paused subscriptions and archived services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.inactiveJobs.length ? (
                customer.inactiveJobs.map((job) => <CustomerJobCard key={job.id} job={job} />)
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No inactive jobs.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Upcoming visits</CardTitle>
              <CardDescription>Next ten scheduled services.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Technician</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.upcomingVisits.length ? (
                    customer.upcomingVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                          {formatDateTime(visit.scheduledDate)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                          {visit.jobFrequencyLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                          {visit.technicianName ?? "Unassigned"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No upcoming visits.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Recent visits</CardTitle>
              <CardDescription>Last ten completed services.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Technician</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.recentVisits.length ? (
                    customer.recentVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                          {formatDateTime(visit.scheduledDate)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                          {visit.status}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                          {visit.technicianName ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No completed visits yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Billing ledger</CardTitle>
            <CardDescription>Recent invoices and adjustments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.ledgerEntries.length ? (
                  customer.ledgerEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                        {entry.description ?? entry.type ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-300">
                        {entry.status ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatCurrency(entry.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No billing ledger entries.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {customer.dogs.length ? (
          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Household pets</CardTitle>
              <CardDescription>Breed and age details for technician prep.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.dogs.map((dog) => (
                <div key={dog.id} className="rounded-xl border border-slate-200 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {dog.name || "Unnamed"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[dog.breed || "Unknown breed", dog.age != null ? `${dog.age} yrs` : null]
                      .filter(Boolean)
                      .join(" • ") || "No additional details"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
