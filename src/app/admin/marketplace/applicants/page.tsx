"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { RefreshCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

const STATUS_OPTIONS = ["APPLICANT", "PENDING_REVIEW", "CERTIFIED", "PAUSED", "DEACTIVATED"];
const BACKGROUND_OPTIONS = ["NOT_SUBMITTED", "PENDING", "PASSED", "FAILED"];

const STATUS_BADGE: Record<string, string> = {
  APPLICANT: "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  PENDING_REVIEW: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CERTIFIED: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAUSED: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  DEACTIVATED: "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const BACKGROUND_BADGE: Record<string, string> = {
  NOT_SUBMITTED: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400",
  PENDING: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PASSED: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScooperApplicantsPage() {
  const { data, isLoading, error, mutate } = useSWR<
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

  const backgroundCounts = useMemo(() => {
    return applicants.reduce<Record<string, number>>((acc, row) => {
      const key = row.backgroundCheckStatus ?? "UNKNOWN";
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
      toast.success("Applicant updated");
      await mutate();
      closeDialog();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update applicant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto space-y-8 px-6 pb-20 pt-16">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Scooper onboarding
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Scooper applications
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Review new applicants, confirm background checks, and move scoopers into certification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="rounded-full border-slate-200 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-300"
              onClick={() => mutate()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Applicants
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {statusCounts.APPLICANT ?? 0}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  New applications
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Pending review
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {statusCounts.PENDING_REVIEW ?? 0}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Awaiting vetting
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Background pending
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {backgroundCounts.PENDING ?? 0}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Checks in progress
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Certified
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {statusCounts.CERTIFIED ?? 0}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Ready to work
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card className="admin-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <TableHead>Scooper</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Background</TableHead>
                <TableHead>Home base</TableHead>
                <TableHead>Last update</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-rose-600 dark:text-rose-300">
                    {error instanceof Error ? error.message : "Failed to load applicants"}
                  </TableCell>
                </TableRow>
              ) : null}
              {!error && !applicants.length && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <UserPlus className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span>No scooper applications are waiting right now.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              {applicants.map((row) => {
                const applicantName = row.user?.name || row.user?.email || "Scooper";
                const metadata = row.metadata ?? {};
                const homeBaseParts = [
                  metadata.homeBaseCity,
                  metadata.homeBaseZip,
                ]
                  .map((part) => (typeof part === "string" ? part.trim() : ""))
                  .filter(Boolean);
                const homeBase = homeBaseParts.join(", ") || "Not provided";

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
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-semibold", BACKGROUND_BADGE[row.backgroundCheckStatus] ?? "")}
                      >
                        {row.backgroundCheckStatus.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {homeBase}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(row.updatedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm font-semibold text-brand-mint hover:text-brand-mint/80"
                        onClick={() => openApplicant(row)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Review Dialog */}
        <Dialog open={Boolean(activeApplicant)} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                Review application
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Confirm coverage, notes, and onboarding readiness for this scooper.
              </DialogDescription>
            </DialogHeader>
            {activeApplicant ? (
              <div className="space-y-6 pt-2">
                {/* Application signals */}
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Application signals
                      </p>
                      <div className="mt-3 grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
                        <div>
                          <span className="font-medium">Preferred radius:</span>{" "}
                          {application.preferredRadiusMiles ?? "—"} mi
                        </div>
                        <div>
                          <span className="font-medium">Availability notes:</span>{" "}
                          {application.availabilityNotes ?? "—"}
                        </div>
                        <div>
                          <span className="font-medium">Experience:</span>{" "}
                          {experienceTags.length ? experienceTags.join(", ") : "—"}
                        </div>
                        <div>
                          <span className="font-medium">Consents:</span>{" "}
                          <span className={application.backgroundConsent ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            {application.backgroundConsent ? "✓ Background" : "○ Background"}
                          </span>
                          {", "}
                          <span className={application.termsConsent ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            {application.termsConsent ? "✓ Terms" : "○ Terms"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Applicant + Vehicle cards */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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
                          className="font-medium text-brand-mint hover:underline"
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

                {/* Coverage preferences */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Coverage preferences
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {activeApplicant.availabilities.length ? (
                      activeApplicant.availabilities.map((availability, index) => (
                        <div
                          key={`${availability.tile?.slug}-${index}`}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                        >
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

                {/* Status controls */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Status
                    </Label>
                    <Select value={statusDraft} onValueChange={setStatusDraft}>
                      <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Background check
                    </Label>
                    <Select value={backgroundDraft} onValueChange={setBackgroundDraft}>
                      <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {BACKGROUND_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Ops notes
                  </Label>
                  <Textarea
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    className="min-h-[100px] rounded-lg border-slate-200 dark:border-slate-700"
                    placeholder="Add internal review notes, next steps, or certification blockers."
                  />
                </div>

                {saveError ? (
                  <p className="text-sm text-rose-500">{saveError}</p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter className="mt-6 flex gap-2">
              <Button
                variant="outline"
                className="rounded-full border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full bg-brand-mint px-6 text-white hover:bg-brand-mint/90"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save updates"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
