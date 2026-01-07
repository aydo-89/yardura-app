"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Availability = {
  weekday: number;
  window: string;
  maxStops: number | null;
  tile: { slug: string; name: string } | null;
};

type ApplicantRow = {
  id: string;
  status: string;
  backgroundCheckStatus: string;
  vehicleDetail: string | null;
  insuranceProofUrl: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  availabilities: Availability[];
};

const STATUS_BADGE: Record<string, string> = {
  APPLICANT: "bg-sky-500/15 text-sky-700 border border-sky-500/30",
  PENDING_REVIEW: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
  CERTIFIED: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
  PAUSED: "bg-slate-500/15 text-slate-700 border border-slate-400/30",
  DEACTIVATED: "bg-rose-500/15 text-rose-700 border border-rose-500/30",
};

const BACKGROUND_BADGE: Record<string, string> = {
  NOT_SUBMITTED: "bg-slate-200 text-slate-700 border border-slate-300",
  PENDING: "bg-amber-200 text-amber-800 border border-amber-300",
  PASSED: "bg-emerald-200 text-emerald-800 border border-emerald-300",
  FAILED: "bg-rose-200 text-rose-800 border border-rose-300",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export default function ScooperApplicantsPage() {
  const { data, isLoading, mutate } = useSWR<
    { ok: true; data: ApplicantRow[] } | { ok: false; error: string }
  >("/api/admin/scoopers/applications", fetcher, {
    revalidateOnFocus: false,
  });

  const applicants = useMemo(
    () => (data && data.ok ? data.data : []),
    [data],
  );

  const statusCounts = useMemo(() => {
    return applicants.reduce<Record<string, number>>((acc, row) => {
      const key = row.status ?? "UNKNOWN";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [applicants]);

  const [activeApplicant, setActiveApplicant] = useState<ApplicantRow | null>(null);
  const [statusDraft, setStatusDraft] = useState<string>("");
  const [backgroundDraft, setBackgroundDraft] = useState<string>("");
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openApplicant = (row: ApplicantRow) => {
    setActiveApplicant(row);
    setStatusDraft(row.status);
    setBackgroundDraft(row.backgroundCheckStatus);
    setNotesDraft(row.notes ?? "");
    setSaveError(null);
  };

  const closeDialog = () => {
    setActiveApplicant(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!activeApplicant) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/admin/scoopers/applications/${activeApplicant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: statusDraft,
            backgroundCheckStatus: backgroundDraft,
            notes: notesDraft.trim() || undefined,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Unable to update applicant.");
      }
      await mutate();
      closeDialog();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update applicant.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
      </div>
    );
  }

  if (!applicants.length) {
    return (
      <div className="admin-card rounded-2xl p-6 text-sm text-slate-600 dark:text-slate-300">
        No scooper applications are waiting right now.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Scooper onboarding
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          Scooper applications
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Review new applicants, confirm background checks, and move scoopers into certification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Applicants" value={statusCounts.APPLICANT ?? 0} />
        <StatCard label="Pending review" value={statusCounts.PENDING_REVIEW ?? 0} />
        <StatCard label="Certified" value={statusCounts.CERTIFIED ?? 0} />
      </div>

      <div className="admin-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <TableHead>Scooper</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Home base</TableHead>
              <TableHead>Preferred tiles</TableHead>
              <TableHead>Last update</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.map((row) => {
              const applicantName = row.user?.name || row.user?.email || "Scooper";
              const metadata = row.metadata ?? {};
              const homeBaseParts = [
                metadata.homeBaseAddress,
                metadata.homeBaseCity,
                metadata.homeBaseZip,
              ]
                .map((part) => (typeof part === "string" ? part.trim() : ""))
                .filter(Boolean);
              const homeBase = homeBaseParts.join(", ") || "Not provided";
              const preferredTiles = Array.isArray(metadata.preferredTileSlugs)
                ? metadata.preferredTileSlugs
                : [];

              return (
                <TableRow key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    <div>{applicantName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {row.user?.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] font-semibold", STATUS_BADGE[row.status] ?? "")}
                    >
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {homeBase}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {preferredTiles.length ? preferredTiles.slice(0, 3).join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(row.updatedAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-emerald-600 hover:text-emerald-500"
                      onClick={() => openApplicant(row)}
                    >
                      Review
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(activeApplicant)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review application</DialogTitle>
            <DialogDescription>
              Confirm coverage, notes, and onboarding readiness for this scooper.
            </DialogDescription>
          </DialogHeader>
          {activeApplicant ? (
            <div className="space-y-6">
              {(() => {
                const metadata = activeApplicant.metadata ?? {};
                const application =
                  metadata.application && typeof metadata.application === "object"
                    ? (metadata.application as Record<string, any>)
                    : {};
                const experienceTags = Array.isArray(application.experienceTags)
                  ? application.experienceTags
                  : [];
                return (
                  <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Application signals
                    </p>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
                      <div>
                        <strong>Preferred radius:</strong>{" "}
                        {application.preferredRadiusMiles ?? "—"} mi
                      </div>
                      <div>
                        <strong>Availability notes:</strong>{" "}
                        {application.availabilityNotes ?? "—"}
                      </div>
                      <div>
                        <strong>Experience:</strong>{" "}
                        {experienceTags.length ? experienceTags.join(", ") : "—"}
                      </div>
                      <div>
                        <strong>Consents:</strong>{" "}
                        {application.backgroundConsent ? "Background ok" : "Background pending"},{" "}
                        {application.termsConsent ? "Terms ok" : "Terms pending"}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Applicant
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {activeApplicant.user?.name || activeApplicant.user?.email || "Scooper"}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {activeApplicant.user?.email}
                  </p>
                  {activeApplicant.user?.phone ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {activeApplicant.user.phone}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Vehicle + insurance
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {activeApplicant.vehicleDetail || "No vehicle details submitted."}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Insurance proof:{" "}
                    {activeApplicant.insuranceProofUrl ? (
                      <a
                        href={activeApplicant.insuranceProofUrl}
                        className="text-emerald-600 hover:text-emerald-500"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View file
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Coverage preferences
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {activeApplicant.availabilities.length ? (
                    activeApplicant.availabilities.map((availability, index) => (
                      <div key={`${availability.tile?.slug}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
                        <div className="font-semibold">
                          {availability.tile?.name ?? availability.tile?.slug ?? "Tile"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {WEEKDAY_LABELS[availability.weekday] ?? availability.weekday} ·{" "}
                          {availability.window}
                          {availability.maxStops ? ` · Max ${availability.maxStops}` : ""}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No availability blocks recorded.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select value={statusDraft} onValueChange={setStatusDraft}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_BADGE).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Background check</Label>
                  <Select value={backgroundDraft} onValueChange={setBackgroundDraft}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(BACKGROUND_BADGE).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Ops notes</Label>
                <Textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  className="mt-2 min-h-[120px]"
                  placeholder="Add internal review notes, next steps, or certification blockers."
                />
              </div>

              {saveError ? (
                <p className="text-sm text-rose-500">{saveError}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="mt-6 flex gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300"
              onClick={closeDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save updates"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
