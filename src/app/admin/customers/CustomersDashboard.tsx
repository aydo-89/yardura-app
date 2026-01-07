"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";

import { SERVICE_TIME_ZONE } from "@/lib/time-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SerializableCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  createdAt: string;
  orgId: string | null;
  jobs: Array<{
    id: string;
    status: string;
    frequency: string;
    nextVisitAt: string | null;
  }>;
  serviceVisits: Array<{
    scheduledDate: string;
  }>;
};

type CustomersDashboardProps = {
  initialCustomers: SerializableCustomer[];
  orgId: string | null;
  initialSearchTerm?: string;
};

const toDate = (value: string | null | undefined) =>
  value ? new Date(value) : null;

const formatAddress = (customer: SerializableCustomer) =>
  [customer.addressLine1, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ") || "—";

const formatVisit = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: SERVICE_TIME_ZONE,
  })} (${formatDistanceToNow(date, { addSuffix: true })})`;
};

const deriveNextVisitFromJobs = (
  jobs: SerializableCustomer["jobs"],
): string | null => {
  const candidate = jobs
    .map((job) => (job.nextVisitAt ? new Date(job.nextVisitAt) : null))
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return candidate ? candidate.toISOString() : null;
};

const computeStats = (customers: SerializableCustomer[]) => {
  const total = customers.length;
  const activeJobs = customers.reduce((sum, customer) => {
    return sum + customer.jobs.filter((job) => job.status === "ACTIVE").length;
  }, 0);
  const newThisWeek = customers.filter((customer) => {
    return Date.now() - new Date(customer.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const portalEnabled = customers.filter((customer) => Boolean(customer.email)).length;
  return { total, activeJobs, newThisWeek, portalEnabled };
};

export function CustomersDashboard({ initialCustomers, orgId, initialSearchTerm = "" }: CustomersDashboardProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return initialCustomers;
    return initialCustomers.filter((customer) => {
      return (
        (customer.name ?? "").toLowerCase().includes(query) ||
        (customer.email ?? "").toLowerCase().includes(query) ||
        (customer.phone ?? "").toLowerCase().includes(query) ||
        (customer.city ?? "").toLowerCase().includes(query) ||
        (customer.zip ?? "").toLowerCase().includes(query)
      );
    });
  }, [initialCustomers, searchTerm]);

  const stats = useMemo(() => computeStats(initialCustomers), [initialCustomers]);

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-16">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <Users className="h-4 w-4" />
                <span>Customer success</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">Customer directory</h1>
                <p className="admin-subtitle">
                  Spot new signups, monitor active plans, and jump into a profile with one click.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40">
                <Link href="/admin/customers/new">Add customer</Link>
              </Button>
              <Button asChild className="rounded-xl bg-brand-coral text-white shadow-sm transition hover:bg-brand-coral/90">
                <Link href={orgId ? `/admin/customers?org=${orgId}` : "/admin/customers"}>
                  Manage accounts
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Customers</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stats.newThisWeek} joined last 7 days</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Active jobs</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{stats.activeJobs}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Recurring plans in motion</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Portal-ready</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{stats.portalEnabled}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Accounts with email login enabled</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Health check</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-brand-mint">
                <ShieldCheck className="h-4 w-4" /> Service coverage healthy
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use the directory to confirm plans and visit cadence before dispatch.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <Card className="admin-card">
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Directory</CardTitle>
              <CardDescription>
                {filteredCustomers.length} customer{filteredCustomers.length === 1 ? "" : "s"} visible
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by name, email, phone, city, or ZIP"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full rounded-full border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:border-brand-mint/40 focus-visible:ring-2 focus-visible:ring-brand-mint/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Customer</TableHead>
                    <TableHead className="min-w-[200px]">Contact</TableHead>
                    <TableHead className="min-w-[220px]">Address</TableHead>
                    <TableHead className="min-w-[200px]">Active jobs</TableHead>
                    <TableHead className="min-w-[160px]">Next visit</TableHead>
                    <TableHead className="min-w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => {
                      const activeJobs = customer.jobs.filter((job) => job.status === "ACTIVE");
                      const nextVisitIso = customer.serviceVisits[0]?.scheduledDate ?? deriveNextVisitFromJobs(activeJobs);

                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="align-top text-sm text-slate-700 dark:text-slate-200">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {customer.name || "Customer"}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Joined {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                            </p>
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-500 dark:text-slate-300">
                            <div className="space-y-1">
                              {customer.email ? <div>{customer.email}</div> : null}
                              {customer.phone ? <div>{customer.phone}</div> : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-500 dark:text-slate-300">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{formatAddress(customer)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-500 dark:text-slate-300">
                            {activeJobs.length ? (
                              <div className="space-y-1">
                                {activeJobs.map((job) => (
                                  <div key={job.id} className="flex items-center justify-between gap-4">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">
                                      {job.frequency.replace(/_/g, " ")}
                                    </span>
                                    {job.nextVisitAt ? (
                                      <span className="text-slate-400">
                                        {formatVisit(job.nextVisitAt)}
                                      </span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                No active plan
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-500 dark:text-slate-300">
                            {formatVisit(nextVisitIso)}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <Button asChild variant="outline" size="sm" className="border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40 dark:hover:text-brand-mint">
                              <Link href={`/admin/customers/${customer.id}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                        No customers matched your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
