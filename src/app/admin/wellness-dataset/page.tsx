"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DatasetPayload = {
  dogs: unknown[];
  captures: unknown[];
  proMedia: unknown[];
  weeklyReports: unknown[];
  dailyCheckIns: unknown[];
  reminders: unknown[];
  foodLogs: unknown[];
  chatLogs: unknown[];
  weightEntries?: unknown[];
};

const toDateInput = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

const parseDateInput = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const defaultFromDate = (() => {
  const initialFrom = new Date();
  initialFrom.setDate(initialFrom.getDate() - 30);
  return toDateInput(initialFrom);
})();

export default function AdminWellnessDatasetPage() {
  const [customerId, setCustomerId] = useState("");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(1000);
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = (overrideLimit?: number) => {
    const params = new URLSearchParams();
    if (customerId.trim()) params.set("customerId", customerId.trim());
    const parsedFrom = parseDateInput(fromDate);
    const parsedTo = parseDateInput(toDate);
    if (parsedFrom) params.set("from", parsedFrom.toISOString());
    if (parsedTo) params.set("to", parsedTo.toISOString());
    params.set("limit", String(overrideLimit ?? limit));
    return params.toString();
  };

  const fetchDataset = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wellness-dataset?${buildQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load dataset.");
      }
      setDataset(data?.data ?? null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load dataset.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/wellness-dataset?${buildQuery(5000)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to export dataset.");
      }
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `wellness-dataset-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to export dataset.",
      );
    }
  };

  useEffect(() => {
    fetchDataset().catch(() => null);
  }, []);

  const summaryItems = useMemo(() => {
    if (!dataset) return [];
    return [
      { label: "Dogs", value: dataset.dogs.length },
      { label: "Owner captures", value: dataset.captures.length },
      { label: "Pro media", value: dataset.proMedia.length },
      { label: "Weekly reports", value: dataset.weeklyReports.length },
      { label: "Daily check-ins", value: dataset.dailyCheckIns.length },
      { label: "Reminders", value: dataset.reminders.length },
      { label: "Food logs", value: dataset.foodLogs.length },
      { label: "Chat logs", value: dataset.chatLogs.length },
      { label: "Weight logs", value: dataset.weightEntries?.length ?? 0 },
    ];
  }, [dataset]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Wellness dataset export
        </h1>
        <p className="text-sm text-slate-500">
          Owner-only export of wellness captures, reports, and related logs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer ID (optional)</Label>
              <Input
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder="cus_123..."
              />
            </div>
            <div className="space-y-2">
              <Label>Limit</Label>
              <Input
                type="number"
                min={100}
                max={5000}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value) || 1000)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchDataset}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              {isLoading ? "Refreshing..." : "Refresh data"}
            </Button>
            <Button type="button" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Download JSON
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {dataset ? (
            <div className="grid gap-3 md:grid-cols-2">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Run a refresh to view dataset totals.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            Exports include storage paths for images. Use internal tooling to
            sign URLs if needed for review.
          </p>
          <p>
            Data may include household-level entries without a dog ID.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
