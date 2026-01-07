"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type DogOption = {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
};

type DatasetPayload = {
  dogs: DogOption[];
  captures: Array<{
    id: string;
    capturedAt: string;
    dogId: string | null;
    suspectedDogIds: string[];
    scope: string;
    attribution: string;
    symptomTags: string[];
    notes: string | null;
    gpsLat?: number | null;
    gpsLng?: number | null;
    consentToShare?: boolean;
    analysisStatus: string;
    analysisResult: Record<string, unknown> | null;
    analysisConfidence: number | null;
    analysisModel: string | null;
    storagePath: string;
    imageUrl: string | null;
  }>;
  proMedia: Array<{
    id: string;
    capturedAt: string;
    analysisStatus: string;
    analysisResult: Record<string, unknown> | null;
    analysisConfidence: number | null;
    analysisModel: string | null;
    gpsLat?: number | null;
    gpsLng?: number | null;
    storagePath: string;
    imageUrl: string | null;
  }>;
  weeklyReports: Array<{
    id: string;
    dogId: string | null;
    weekStart: string;
    weekEnd: string;
    noIssues: boolean;
    symptomTags: string[];
    stoolNotes: string | null;
    dailyCheckInIds?: string[];
  }>;
  dailyCheckIns: Array<{
    id: string;
    dogId: string | null;
    loggedAt: string;
    weekStart?: string;
    appetite: string | null;
    energy: string | null;
    waterIntake: string | null;
    stoolFrequency: number | null;
    vomiting: boolean;
    diarrhea: boolean;
    notes: string | null;
  }>;
  weightEntries?: Array<{
    id: string;
    dogId: string;
    weightLbs: number;
    recordedAt: string;
    source?: string | null;
    notes?: string | null;
  }>;
  reminders: Array<{
    id: string;
    dogId: string | null;
    title: string;
    category: string;
    nextDueAt: string;
    active: boolean;
  }>;
  foodLogs: Array<{
    id: string;
    dogId: string | null;
    loggedAt: string;
    type: string;
    productName: string | null;
    brand: string | null;
    allergenMatches: string[];
  }>;
  chatLogs: Array<{
    id: string;
    dogId: string | null;
    createdAt: string;
    symptoms: string[];
    message: string;
    response: string;
    riskLevel: string | null;
  }>;
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

export default function MobileWellnessReviewExport({ dogs }: { dogs: DogOption[] }) {
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<{
    shareWellnessNotes: boolean;
    shareWellnessCaptures: boolean;
    autoBlurWellnessPhotos: boolean;
  } | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);

  const [dogId, setDogId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(200);
  const [pdfDays, setPdfDays] = useState(14);

  const buildQuery = (overrideLimit?: number) => {
    const params = new URLSearchParams();
    if (dogId) params.set("dogId", dogId);
    const parsedFrom = parseDateInput(fromDate);
    const parsedTo = parseDateInput(toDate);
    if (parsedFrom) params.set("from", parsedFrom.toISOString());
    if (parsedTo) params.set("to", parsedTo.toISOString());
    params.set("limit", String(overrideLimit ?? limit));
    return params.toString();
  };

  const fetchDataset = async () => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/customer/wellness-dataset?${buildQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load dataset.");
      }
      setDataset(data?.data ?? null);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to load dataset.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreferences = async () => {
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const res = await fetch("/api/customer/wellness-preferences");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load preferences.");
      }
      setPreferences(data?.data ?? null);
    } catch (error) {
      setPrefsError(
        error instanceof Error ? error.message : "Unable to load preferences.",
      );
    } finally {
      setPrefsLoading(false);
    }
  };

  const updatePreferences = async (
    next: Partial<{
      shareWellnessNotes: boolean;
      shareWellnessCaptures: boolean;
      autoBlurWellnessPhotos: boolean;
    }>,
  ) => {
    if (!preferences) return;
    const optimistic = { ...preferences, ...next };
    setPreferences(optimistic);
    try {
      const res = await fetch("/api/customer/wellness-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to update preferences.");
      }
      setPreferences(data?.data ?? optimistic);
    } catch (error) {
      setPreferences(preferences);
      setPrefsError(
        error instanceof Error ? error.message : "Unable to update preferences.",
      );
    }
  };

  useEffect(() => {
    fetchDataset().catch(() => null);
    fetchPreferences().catch(() => null);
  }, []);

  const handleDownloadJson = async () => {
    setSubmitError(null);
    try {
      const res = await fetch(`/api/customer/wellness-dataset?${buildQuery(1000)}`);
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
      anchor.download = `wellness-dataset-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to export dataset.",
      );
    }
  };

  const handleDownloadPdf = () => {
    const params = new URLSearchParams();
    params.set("days", String(pdfDays));
    if (dogId) params.set("dogId", dogId);
    window.open(`/api/customer/wellness-report/pdf?${params.toString()}`, "_blank");
  };

  const summary = useMemo(() => {
    if (!dataset) return [];
    return [
      { label: "Owner captures", value: dataset.captures.length },
      { label: "Pro captures", value: dataset.proMedia.length },
      { label: "Weekly reports", value: dataset.weeklyReports.length },
      { label: "Daily check-ins", value: dataset.dailyCheckIns.length },
      { label: "Reminders", value: dataset.reminders.length },
      { label: "Food logs", value: dataset.foodLogs.length },
      { label: "Chat logs", value: dataset.chatLogs.length },
      { label: "Weight logs", value: dataset.weightEntries?.length ?? 0 },
    ];
  }, [dataset]);

  const latestCaptures = dataset?.captures.slice(0, 3) ?? [];
  const latestDaily = dataset?.dailyCheckIns.slice(0, 3) ?? [];
  const latestChats = dataset?.chatLogs.slice(0, 2) ?? [];
  const latestWeights = dataset?.weightEntries?.slice(0, 2) ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Review and export
          </p>
          <h2 className="text-lg font-semibold text-white">
            Your wellness dataset
          </h2>
          <p className="text-sm text-slate-400">
            Review recent captures, check-ins, and notes. Export a JSON dataset
            or a 1-page vet report.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Dog
            </Label>
            <Select value={dogId ?? "ALL"} onValueChange={(value) => {
              setDogId(value === "ALL" ? null : value);
            }}>
              <SelectTrigger className="bg-slate-950/70 text-slate-200">
                <SelectValue placeholder="All dogs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All dogs</SelectItem>
                {dogs.map((dog) => (
                  <SelectItem key={dog.id} value={dog.id}>
                    {dog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Max records
            </Label>
            <Input
              type="number"
              min={50}
              max={1000}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 200)}
              className="bg-slate-950/70 text-slate-200"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              From
            </Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="bg-slate-950/70 text-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              To
            </Label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="bg-slate-950/70 text-slate-200"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-slate-800 text-slate-200"
            onClick={fetchDataset}
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {isLoading ? "Refreshing..." : "Refresh data"}
          </Button>
          <Button
            type="button"
            className="rounded-full bg-white text-slate-900 hover:bg-slate-100"
            onClick={handleDownloadJson}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Download JSON
          </Button>
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            {submitError}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Vet-ready report
            </p>
            <h3 className="text-base font-semibold text-white">
              Export a 1-page PDF
            </h3>
            <p className="text-xs text-slate-400">
              Includes recent symptoms and stool images from the past few days.
            </p>
          </div>
          <FileText className="h-5 w-5 text-slate-300" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Days to include
          </Label>
          <Input
            type="number"
            min={3}
            max={30}
            value={pdfDays}
            onChange={(event) => setPdfDays(Number(event.target.value) || 14)}
            className="w-24 bg-slate-950/70 text-slate-200"
          />
          <Button
            type="button"
            className="rounded-full bg-white text-slate-900 hover:bg-slate-100"
            onClick={handleDownloadPdf}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Download PDF
          </Button>
        </div>
      </section>

      {dataset && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
              >
                <p className="uppercase tracking-wide text-[10px] text-slate-500 mb-1">
                  {item.label}
                </p>
                <p className="text-slate-100 font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Latest captures
              </p>
              {latestCaptures.length === 0 ? (
                <p className="text-xs text-slate-500">No captures yet.</p>
              ) : (
                <div className="grid gap-3">
                  {latestCaptures.map((capture) => (
                    <div
                      key={capture.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"
                    >
                      {capture.imageUrl && (
                        <img
                          src={capture.imageUrl}
                          alt="Stool capture"
                          className="w-full rounded-xl border border-slate-800 object-cover"
                        />
                      )}
                      <div className="text-xs text-slate-400">
                        {new Date(capture.capturedAt).toLocaleString()} ·{" "}
                        {capture.analysisStatus}
                      </div>
                      {capture.symptomTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {capture.symptomTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-300"
                            >
                              {tag.replace(/_/g, " ").toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                      {capture.notes && (
                        <p className="text-xs text-slate-400">{capture.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Daily check-ins
              </p>
              {latestDaily.length === 0 ? (
                <p className="text-xs text-slate-500">No daily check-ins yet.</p>
              ) : (
                <div className="grid gap-3">
                  {latestDaily.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="text-xs text-slate-400">
                        {new Date(entry.loggedAt).toLocaleDateString()} ·
                        Stool {entry.stoolFrequency ?? "—"} ·
                        {entry.vomiting ? " Vomiting" : ""}{" "}
                        {entry.diarrhea ? " Diarrhea" : ""}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-slate-400 mt-2">{entry.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Recent chats
              </p>
              {latestChats.length === 0 ? (
                <p className="text-xs text-slate-500">No chats logged.</p>
              ) : (
                <div className="grid gap-3">
                  {latestChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="text-xs text-slate-400">
                        {new Date(chat.createdAt).toLocaleString()} ·{" "}
                        {chat.riskLevel ?? "unknown"} risk
                      </div>
                      <p className="mt-2 text-xs text-slate-300 line-clamp-2">
                        {chat.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Weight trend
              </p>
              {latestWeights.length === 0 ? (
                <p className="text-xs text-slate-500">No weight logs yet.</p>
              ) : (
                <div className="grid gap-3">
                  {latestWeights.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="text-xs text-slate-400">
                        {new Date(entry.recordedAt).toLocaleDateString()} ·{" "}
                        {entry.weightLbs} lbs
                      </div>
                      {entry.notes && (
                        <p className="mt-2 text-xs text-slate-300">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Privacy controls</p>
          <p className="mt-1">
            Data stays private unless you export it. Choose how your notes and
            anonymized photos are used.
          </p>
        </div>

        {prefsLoading && (
          <p className="text-xs text-slate-500">Loading preferences...</p>
        )}
        {prefsError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {prefsError}
          </div>
        )}
        {preferences && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div>
                <p className="text-sm text-slate-200">Share wellness notes</p>
                <p className="text-xs text-slate-500">
                  Include weekly notes when exporting or sharing with your vet.
                </p>
              </div>
              <Switch
                checked={preferences.shareWellnessNotes}
                onCheckedChange={(checked) =>
                  updatePreferences({ shareWellnessNotes: Boolean(checked) })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div>
                <p className="text-sm text-slate-200">Allow anonymized captures</p>
                <p className="text-xs text-slate-500">
                  Help improve wellness models with anonymized stool photos.
                </p>
              </div>
              <Switch
                checked={preferences.shareWellnessCaptures}
                onCheckedChange={(checked) =>
                  updatePreferences({ shareWellnessCaptures: Boolean(checked) })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div>
                <p className="text-sm text-slate-200">Auto-blur photos</p>
                <p className="text-xs text-slate-500">
                  Blur stool photos by default in the wellness dashboard.
                </p>
              </div>
              <Switch
                checked={preferences.autoBlurWellnessPhotos}
                onCheckedChange={(checked) =>
                  updatePreferences({ autoBlurWellnessPhotos: Boolean(checked) })
                }
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
