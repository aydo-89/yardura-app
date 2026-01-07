"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Eye,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { preferredTimeWindowOptions, normalizePreferredTimeWindowSlug } from "@/lib/time-window";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  formatZonedDate,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

type VisitStatus = (typeof STATUS_OPTIONS)[number]["value"];

type Visit = {
  id: string;
  scheduledDate: string;
  status: VisitStatus;
  preferredTimeWindowSlug: string | null;
  preferredTimeWindow: string | null;
  assignedTo: { id: string; name: string | null } | null;
};

type JobSummary = {
  id: string;
  frequency: string;
  status: string;
  dayOfWeek: number | null;
  nextVisitAt: string | null;
  preferredTimeWindow: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
};

type JobVisitManagerProps = {
  job: JobSummary;
  visits: Visit[];
  timeZone: string;
};

type VisitFormState = {
  date: string;
  time: string;
  windowSlug: string | null;
  status: VisitStatus;
};

const STATUS_BADGE_VARIANT: Record<VisitStatus, "default" | "secondary" | "outline" | "destructive"> = {
  SCHEDULED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "outline",
  SKIPPED: "secondary",
  CANCELLED: "destructive",
};

export function JobVisitManager({ job, visits, timeZone }: JobVisitManagerProps) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<Visit | null>(null);
  const [editForm, setEditForm] = useState<VisitFormState | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<VisitFormState>(() => {
    const initialDate = formatDateInput(job.nextVisitAt ?? new Date().toISOString(), timeZone);
    const initialTime = formatTimeInput(job.nextVisitAt ?? new Date().toISOString(), timeZone);
    const initialWindow = resolveWindowSlug(job.preferredTimeWindow);
    return {
      date: initialDate,
      time: initialTime,
      windowSlug: initialWindow,
      status: "SCHEDULED",
    };
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const upcomingVisits = useMemo(() => {
    const now = Date.now();
    return visits
      .filter((visit) => new Date(visit.scheduledDate).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [visits]);

  const pastVisits = useMemo(() => {
    const now = Date.now();
    return visits
      .filter((visit) => new Date(visit.scheduledDate).getTime() < now)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }, [visits]);

  const openEditDialog = (visit: Visit) => {
    setEditTarget(visit);
    setEditForm({
      date: formatDateInput(visit.scheduledDate, timeZone),
      time: formatTimeInput(visit.scheduledDate, timeZone),
      windowSlug: resolveWindowSlug(visit.preferredTimeWindowSlug ?? visit.preferredTimeWindow ?? null),
      status: visit.status,
    });
  };

  const resetEditDialog = () => {
    setEditTarget(null);
    setEditForm(null);
    setEditSubmitting(false);
  };

  const handleEditSubmit = async () => {
    if (!editTarget || !editForm) return;
    const payload = buildVisitPayload(editForm, timeZone);
    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/admin/service-visits/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Unable to update visit");
      }

      toast.success("Visit updated");
      resetEditDialog();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update visit");
      setEditSubmitting(false);
    }
  };

  const handleDeleteVisit = async (visit: Visit) => {
    const confirmed = confirm("Delete this visit? This cannot be undone.");
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/service-visits/${visit.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Unable to delete visit");
      }
      toast.success("Visit removed");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to delete visit");
    }
  };

  const handleToggleSkip = async (visit: Visit) => {
    const nextStatus = visit.status === "SKIPPED" ? "SCHEDULED" : "SKIPPED";
    try {
      const response = await fetch(`/api/admin/service-visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Unable to update visit");
      }
      toast.success(nextStatus === "SKIPPED" ? "Visit marked skipped" : "Visit restored");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to update visit status");
    }
  };

  const handleResetVisit = async (visit: Visit) => {
    const confirmed = confirm(
      "Reset this visit? This will delete all media, insights, communications, QA records, payouts/ledger entries, and reward events, and return the visit to SCHEDULED. This cannot be undone.",
    );
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/field-ops/visits/${visit.id}/reset`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Unable to reset visit");
      }
      toast.success("Visit reset");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to reset visit");
    }
  };

  const handleCreateVisit = async () => {
    setCreateSubmitting(true);
    try {
      const payload = buildVisitPayload(createForm, timeZone);
      const response = await fetch(`/api/admin/jobs/${job.id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Unable to create visit");
      }
      toast.success("New visit scheduled");
      setCreateSubmitting(false);
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to add visit");
      setCreateSubmitting(false);
    }
  };

  const cadenceWarning = editTarget && editForm
    ? getCadenceWarning(job, buildVisitIso(editForm, timeZone), timeZone)
    : null;

  const createWarning = createOpen ? getCadenceWarning(job, buildVisitIso(createForm, timeZone), timeZone) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Service visits</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Manage scheduled stops and keep the cadence aligned to {job.frequency.toLowerCase()} service.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add visit
        </Button>
      </div>

      <section className="space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <CalendarDays className="h-4 w-4" /> Upcoming visits ({upcomingVisits.length})
        </header>
        {upcomingVisits.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 dark:border-slate-600/60 p-4 text-sm text-slate-500 dark:text-slate-400">
            No upcoming visits scheduled.
          </p>
        ) : (
          <VisitTable
            visits={upcomingVisits}
            timeZone={timeZone}
            onEdit={openEditDialog}
            onDelete={handleDeleteVisit}
            onReset={handleResetVisit}
            onToggleSkip={handleToggleSkip}
          />
        )}
      </section>

      <section className="space-y-3">
        <header className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <RefreshCcw className="h-4 w-4" /> Past visits ({pastVisits.length})
        </header>
        {pastVisits.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 dark:border-slate-600/60 p-4 text-sm text-slate-500 dark:text-slate-400">
            No past visits recorded yet.
          </p>
        ) : (
          <VisitTable
            visits={pastVisits}
            timeZone={timeZone}
            onEdit={openEditDialog}
            onDelete={handleDeleteVisit}
            onReset={handleResetVisit}
            onToggleSkip={handleToggleSkip}
            disableSkip
          />
        )}
      </section>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && resetEditDialog()}>
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit visit</DialogTitle>
            <DialogDescription>
              Adjust the visit schedule or status. Significant changes may impact the recurring cadence.
            </DialogDescription>
          </DialogHeader>

          {editForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="visit-date">Service date</Label>
                  <Input
                    id="visit-date"
                    type="date"
                    value={editForm.date}
                    onChange={(event) =>
                      setEditForm((prev) => prev && { ...prev, date: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visit-time">Arrival window anchor</Label>
                  <Input
                    id="visit-time"
                    type="time"
                    value={editForm.time}
                    onChange={(event) =>
                      setEditForm((prev) => prev && { ...prev, time: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred window</Label>
              <Select
                value={editForm.windowSlug ?? "none"}
                onValueChange={(value) =>
                  setEditForm((prev) => {
                    if (!prev) return prev;
                    const slug = value === "none" ? null : value;
                    const anchorTime = resolveWindowAnchorTime(slug);
                    return {
                      ...prev,
                      windowSlug: slug,
                      ...(anchorTime ? { time: anchorTime } : {}),
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {preferredTimeWindowOptions.map((option) => (
                    <SelectItem key={option.slug} value={option.slug}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: VisitStatus) =>
                    setEditForm((prev) => prev && { ...prev, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cadenceWarning ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  {cadenceWarning}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="mt-6 flex justify-between space-y-2 sm:space-y-0">
            <Button
              variant="outline"
              onClick={resetEditDialog}
              type="button"
              className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
            >
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={editSubmitting} className="rounded-xl bg-brand-coral text-white hover:bg-brand-coral/90">
              {editSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            const seed = job.nextVisitAt ?? new Date().toISOString();
            setCreateForm({
              date: formatDateInput(seed, timeZone),
              time: formatTimeInput(seed, timeZone),
              windowSlug: resolveWindowSlug(job.preferredTimeWindow),
              status: "SCHEDULED",
            });
          } else {
            setCreateSubmitting(false);
          }
        }}
      >
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Schedule a new visit</DialogTitle>
            <DialogDescription>
              Choose the date and window to add an additional stop for this job.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-date">Service date</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={createForm.date}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time">Arrival window anchor</Label>
                <Input
                  id="create-time"
                  type="time"
                  value={createForm.time}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, time: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred window</Label>
              <Select
                value={createForm.windowSlug ?? "none"}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    windowSlug: value === "none" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {preferredTimeWindowOptions.map((option) => (
                    <SelectItem key={option.slug} value={option.slug}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createWarning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                {createWarning}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6 flex justify-between space-y-2 sm:space-y-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-mint/40"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateVisit} disabled={createSubmitting} className="rounded-xl bg-brand-coral text-white hover:bg-brand-coral/90">
              {createSubmitting ? "Scheduling…" : "Schedule visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type VisitTableProps = {
  visits: Visit[];
  timeZone: string;
  onEdit: (visit: Visit) => void;
  onDelete: (visit: Visit) => void;
  onReset: (visit: Visit) => void;
  onToggleSkip: (visit: Visit) => void;
  disableSkip?: boolean;
};

function VisitTable({ visits, timeZone, onEdit, onDelete, onReset, onToggleSkip, disableSkip }: VisitTableProps) {
  const router = useRouter();

  return (
    <div className="admin-card overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-slate-900/70">
          <TableRow>
            <TableHead className="min-w-[160px] text-slate-600 dark:text-slate-300">Scheduled</TableHead>
            <TableHead className="min-w-[150px] text-slate-600 dark:text-slate-300">Window</TableHead>
            <TableHead className="min-w-[140px] text-slate-600 dark:text-slate-300">Status</TableHead>
            <TableHead className="min-w-[160px] text-slate-600 dark:text-slate-300">Assigned tech</TableHead>
            <TableHead className="w-[200px] text-right text-slate-600 dark:text-slate-300">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((visit) => (
            <TableRow key={visit.id} className="text-sm">
              <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                {formatZonedDate(new Date(visit.scheduledDate), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }, timeZone)}
              </TableCell>
              <TableCell>
                {visit.preferredTimeWindow ? (
                  <Badge variant="outline">{visit.preferredTimeWindow}</Badge>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Not specified</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[visit.status]}> {statusLabel(visit.status)} </Badge>
              </TableCell>
              <TableCell>
                {visit.assignedTo?.name ? (
                  <span className="text-slate-900 dark:text-slate-100">{visit.assignedTo.name}</span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => router.push(`/admin/visits/${visit.id}`)}
                    title="View visit details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(visit)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!disableSkip ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onToggleSkip(visit)}
                      title={visit.status === "SKIPPED" ? "Restore visit" : "Mark as skipped"}
                    >
                      <RefreshCcw
                        className={cn(
                          "h-4 w-4",
                          visit.status === "SKIPPED"
                            ? "text-brand-mint"
                            : "text-slate-600 dark:text-slate-300",
                        )}
                      />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onReset(visit)}
                    title="Reset visit"
                  >
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(visit)}
                    title="Delete visit"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatDateInput(iso: string, timeZone: string): string {
  const parts = convertUtcToZonedParts(new Date(iso), timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatTimeInput(iso: string, timeZone: string): string {
  const parts = convertUtcToZonedParts(new Date(iso), timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

function resolveWindowAnchorTime(slug: string | null): string | null {
  if (!slug) return null;
  const config = preferredTimeWindowOptions.find((option) => option.slug === slug);
  if (!config) return null;
  return `${pad(config.startHour)}:${pad(config.startMinute)}`;
}

function buildVisitPayload(form: VisitFormState, timeZone: string) {
  const iso = buildVisitIso(form, timeZone);
  const payload: Record<string, unknown> = {
    scheduledDate: iso,
    status: form.status,
  };
  if (form.windowSlug) {
    payload.preferredTimeWindowSlug = form.windowSlug;
  } else {
    payload.preferredTimeWindowSlug = null;
  }
  return payload;
}

function buildVisitIso(form: VisitFormState, timeZone: string): string {
  const fallbackParts = convertUtcToZonedParts(new Date(), timeZone);
  const [year, month, day] = form.date && form.date.length === 10
    ? form.date.split("-").map((value) => Number.parseInt(value, 10))
    : [fallbackParts.year, fallbackParts.month, fallbackParts.day];
  const [hour, minute] = form.time && form.time.length >= 4
    ? form.time.split(":").map((value) => Number.parseInt(value, 10))
    : [fallbackParts.hour, fallbackParts.minute];
  const zoned = constructZonedDate(year, month, day, hour ?? 9, minute ?? 0, 0, 0, timeZone);
  return zoned.toISOString();
}

function getCadenceWarning(job: JobSummary, iso: string, timeZone: string): string | null {
  if (!iso) return null;
  if (!job.dayOfWeek || Number.isNaN(job.dayOfWeek)) return null;
  const visitParts = convertUtcToZonedParts(new Date(iso), timeZone);
  const visitWeekday = new Date(Date.UTC(visitParts.year, visitParts.month - 1, visitParts.day)).getUTCDay();
  if (job.frequency === "WEEKLY" || job.frequency === "BI_WEEKLY" || job.frequency === "TWICE_WEEKLY") {
    if (visitWeekday !== job.dayOfWeek) {
      return `This visit falls on ${weekdayLabel(visitWeekday)}, but the cadence is anchored to ${weekdayLabel(job.dayOfWeek)}.`;
    }
  }
  return null;
}

function weekdayLabel(dayIndex: number) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[dayIndex] ?? "Unknown day";
}

function statusLabel(status: VisitStatus) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option?.label ?? status;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function resolveWindowSlug(value: string | null | undefined) {
  const normalized = normalizePreferredTimeWindowSlug(value ?? undefined);
  if (normalized) return normalized;
  if (!value) return null;
  const match = preferredTimeWindowOptions.find((option) => {
    const target = value.toLowerCase();
    return (
      option.label.toLowerCase() === target ||
      option.shortLabel.toLowerCase() === target ||
      option.range.toLowerCase() === target
    );
  });
  return match?.slug ?? null;
}
