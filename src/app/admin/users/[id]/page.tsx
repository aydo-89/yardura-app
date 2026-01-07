"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, ShieldCheck, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractUserRole, getDefaultRedirectForRole } from "@/lib/auth/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DisciplineSummaryEntry = {
  count: number;
  limit: number;
  windowStart: string;
  lastAt: string | null;
  lastReason: string | null;
};

type DisciplineSummary = {
  missed: DisciplineSummaryEntry;
  lateRelease: DisciplineSummaryEntry;
  earlyRelease: DisciplineSummaryEntry;
  jobRelease: DisciplineSummaryEntry;
};

type DisciplineEvent = {
  id: string;
  type: "MISSED_VISIT" | "LATE_RELEASE" | "EARLY_RELEASE" | "JOB_RELEASE";
  source: "SYSTEM" | "ADMIN";
  reason: string | null;
  createdAt: string;
  serviceVisitId: string | null;
  jobId: string | null;
  createdBy: { id: string; name: string | null; email: string | null } | null;
};

type TeamMemberDetail = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  roles: string[];
  orgId: string | null;
  createdAt: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  commissionRate: number | null;
  scooperProfile: {
    id: string;
    status: string | null;
    backgroundCheckStatus: string | null;
    trainingCompletedAt: string | null;
    vehicleVerified: boolean;
    insuranceProofUrl: string | null;
  } | null;
};

type DetailPayload = {
  user: TeamMemberDetail;
};

type DisciplinePayload = {
  summary: DisciplineSummary | null;
  events: DisciplineEvent[];
};

const roleBadgeClassMap: Record<string, string> = {
  OWNER:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  ADMIN:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  SALES_REP:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
  TECH:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-100",
  CUSTOMER:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-100",
};

const roleLabelMap: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  SALES_REP: "Sales Rep",
  TECH: "Scooper",
  CUSTOMER: "Customer",
};

const roleOptions = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES_REP", label: "Sales Rep" },
  { value: "TECH", label: "Scooper" },
  { value: "CUSTOMER", label: "Customer" },
];

const disciplineTypeLabelMap: Record<DisciplineEvent["type"], string> = {
  MISSED_VISIT: "Missed visit",
  LATE_RELEASE: "Late release",
  EARLY_RELEASE: "Early release",
  JOB_RELEASE: "Job release",
};

const disciplineTypeTone: Record<DisciplineEvent["type"], string> = {
  MISSED_VISIT:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
  LATE_RELEASE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  EARLY_RELEASE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
  JOB_RELEASE:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-100",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function DisciplineStatCard({
  title,
  description,
  entry,
}: {
  title: string;
  description: string;
  entry: DisciplineSummaryEntry | null;
}) {
  const percent =
    entry && entry.limit > 0 ? Math.min(100, Math.round((entry.count / entry.limit) * 100)) : 0;

  return (
    <div className="admin-card space-y-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {entry ? entry.count : 0}/{entry ? entry.limit : 0}
          </p>
          <p>this quarter</p>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800">
        <div
          className="h-2 rounded-full bg-brand-coral transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {entry?.lastAt ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last update {formatDateTime(entry.lastAt)} {entry.lastReason ? `• ${entry.lastReason}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export default function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [disciplineSummary, setDisciplineSummary] = useState<DisciplineSummary | null>(null);
  const [disciplineEvents, setDisciplineEvents] = useState<DisciplineEvent[]>([]);
  const [disciplineLoading, setDisciplineLoading] = useState(true);
  const [disciplineError, setDisciplineError] = useState<string | null>(null);
  const [newDisciplineType, setNewDisciplineType] = useState<DisciplineEvent["type"]>("MISSED_VISIT");
  const [newDisciplineReason, setNewDisciplineReason] = useState<string>("");
  const [disciplineSubmitting, setDisciplineSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventType, setEditingEventType] = useState<DisciplineEvent["type"]>("MISSED_VISIT");
  const [editingEventReason, setEditingEventReason] = useState<string>("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [rolesDraft, setRolesDraft] = useState<string[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    status: "",
    backgroundCheckStatus: "",
    trainingCompletedAt: "",
    vehicleVerified: false,
    insuranceProofUrl: "",
  });

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to load team member");
      }
      const payload = (await response.json()) as DetailPayload;
      setDetail(payload);
      const profile = payload.user.scooperProfile;
      const resolvedRoles =
        payload.user.roles && payload.user.roles.length > 0
          ? payload.user.roles
          : [payload.user.role];
      setRolesDraft(resolvedRoles);
      setProfileDraft({
        status: profile?.status ?? "",
        backgroundCheckStatus: profile?.backgroundCheckStatus ?? "",
        trainingCompletedAt: formatDateInput(profile?.trainingCompletedAt ?? null),
        vehicleVerified: profile?.vehicleVerified ?? false,
        insuranceProofUrl: profile?.insuranceProofUrl ?? "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load team member");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadDiscipline = useCallback(async () => {
    setDisciplineLoading(true);
    setDisciplineError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}/discipline`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to load discipline activity");
      }
      const payload = (await response.json()) as DisciplinePayload;
      setDisciplineSummary(payload.summary);
      setDisciplineEvents(payload.events ?? []);
    } catch (error) {
      setDisciplineError(error instanceof Error ? error.message : "Unable to load discipline activity");
    } finally {
      setDisciplineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace(`/signin?callbackUrl=/admin/users/${id}`);
      return;
    }
    const role = extractUserRole(session);
    if (!role || (role !== "ADMIN" && role !== "OWNER")) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }
    void loadDetail();
    void loadDiscipline();
  }, [session, status, router, id, loadDetail, loadDiscipline]);

  const handleCreateDisciplineEvent = async () => {
    if (!newDisciplineType) return;
    setDisciplineSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${id}/discipline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newDisciplineType,
          reason: newDisciplineReason.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to add discipline event");
      }
      await loadDiscipline();
      setNewDisciplineReason("");
      toast.success("Discipline event recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add discipline event");
    } finally {
      setDisciplineSubmitting(false);
    }
  };

  const handleUpdateDisciplineEvent = async (eventId: string) => {
    setDisciplineSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${id}/discipline/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editingEventType,
          reason: editingEventReason.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to update discipline event");
      }
      await loadDiscipline();
      setEditingEventId(null);
      toast.success("Discipline event updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update discipline event");
    } finally {
      setDisciplineSubmitting(false);
    }
  };

  const handleDeleteDisciplineEvent = async (eventId: string) => {
    if (!confirm("Remove this discipline event? This will update the scooper's counts.")) {
      return;
    }
    setDisciplineSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${id}/discipline/${eventId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to delete discipline event");
      }
      await loadDiscipline();
      toast.success("Discipline event removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete discipline event");
    } finally {
      setDisciplineSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!detail?.user?.scooperProfile) return;
    setProfileSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scooperProfile: {
            status: profileDraft.status || null,
            backgroundCheckStatus: profileDraft.backgroundCheckStatus || null,
            trainingCompletedAt: profileDraft.trainingCompletedAt || null,
            vehicleVerified: profileDraft.vehicleVerified,
            insuranceProofUrl: profileDraft.insuranceProofUrl || null,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to update scooper profile");
      }
      await loadDetail();
      toast.success("Scooper profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update scooper profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleRoleDraft = (role: string) => {
    setRolesDraft((prev) =>
      prev.includes(role)
        ? prev.filter((entry) => entry !== role)
        : [...prev, role],
    );
  };

  const handleSaveRoles = async () => {
    if (!detail) return;
    if (rolesDraft.length === 0) {
      toast.error("Select at least one role.");
      return;
    }
    try {
      setRolesSaving(true);
      const response = await fetch(`/api/admin/users/${detail.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: rolesDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to update roles");
      }
      await loadDetail();
      toast.success("Roles updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update roles");
    } finally {
      setRolesSaving(false);
    }
  };

  if (isLoading || !detail) {
    return (
      <div className="admin-surface min-h-screen">
        <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
          <div className="container mx-auto px-6 pb-8 pt-20 md:pb-10 md:pt-16">
            <Link href="/admin/users" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ChevronLeft className="h-4 w-4" />
              Back to team
            </Link>
            <h1 className="admin-title mt-3">Team member record</h1>
          </div>
        </header>
        <main className="container mx-auto max-w-6xl px-6 py-10">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>
        </main>
      </div>
    );
  }

  const { user } = detail;
  const resolvedRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const isScooper = resolvedRoles.includes("TECH");
  const isSalesRep = resolvedRoles.includes("SALES_REP");

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-10 pt-20 md:pb-12 md:pt-16">
          <Link href="/admin/users" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <ChevronLeft className="h-4 w-4" />
            Back to team
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="admin-kicker">Team member record</p>
              <h1 className="admin-title mt-2">{user.name ?? user.email}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {resolvedRoles.map((role) => (
                <Badge
                  key={`${user.id}-${role}`}
                  className={roleBadgeClassMap[role] ?? ""}
                >
                  {roleLabelMap[role] ?? role}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Profile basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                <span className="text-slate-900 dark:text-white">Org:</span> {user.orgId ?? "—"}
              </p>
              <p>
                <span className="text-slate-900 dark:text-white">Joined:</span> {formatDate(user.createdAt)}
              </p>
              <p>
                <span className="text-slate-900 dark:text-white">Phone:</span> {user.phone ?? "—"}
              </p>
              <p>
                <span className="text-slate-900 dark:text-white">Address:</span>{" "}
                {[user.address, user.city, user.zipCode].filter(Boolean).join(", ") || "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>{isScooper ? "Scooper compliance" : isSalesRep ? "Sales rep details" : "Role details"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              {isScooper ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="scooper-status">Status</Label>
                      <Select
                        value={profileDraft.status}
                        onValueChange={(value) =>
                          setProfileDraft((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger id="scooper-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {["APPLICANT", "PENDING_REVIEW", "CERTIFIED", "PAUSED", "DEACTIVATED"].map(
                            (status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace("_", " ")}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="background-check">Background check</Label>
                      <Select
                        value={profileDraft.backgroundCheckStatus}
                        onValueChange={(value) =>
                          setProfileDraft((prev) => ({ ...prev, backgroundCheckStatus: value }))
                        }
                      >
                        <SelectTrigger id="background-check">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {["NOT_SUBMITTED", "PENDING", "PASSED", "FAILED"].map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="training-complete">Training completed</Label>
                      <Input
                        id="training-complete"
                        type="date"
                        value={profileDraft.trainingCompletedAt}
                        onChange={(event) =>
                          setProfileDraft((prev) => ({
                            ...prev,
                            trainingCompletedAt: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance-url">Insurance proof URL</Label>
                      <Input
                        id="insurance-url"
                        value={profileDraft.insuranceProofUrl}
                        onChange={(event) =>
                          setProfileDraft((prev) => ({
                            ...prev,
                            insuranceProofUrl: event.target.value,
                          }))
                        }
                        placeholder="Paste insurance file URL"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="vehicle-verified"
                      checked={profileDraft.vehicleVerified}
                      onCheckedChange={(checked) =>
                        setProfileDraft((prev) => ({
                          ...prev,
                          vehicleVerified: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="vehicle-verified">Vehicle verified</Label>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? "Saving..." : "Save compliance updates"}
                  </Button>
                </>
              ) : isSalesRep ? (
                <>
                  <p>
                    <span className="text-slate-900 dark:text-white">Commission rate:</span>{" "}
                    {user.commissionRate != null ? `${(user.commissionRate * 100).toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sales rep fields are visible here. Add more as you expand sales ops.
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No role-specific compliance data is tracked for this team member.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Roles & access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose every portal this teammate should access. They can switch roles from their account menu.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {roleOptions.map((option) => {
                  const isSelected = rolesDraft.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleRoleDraft(option.value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected ? (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </div>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {rolesDraft.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Select at least one role.
                </p>
              ) : null}
              <Button onClick={handleSaveRoles} disabled={rolesSaving || rolesDraft.length === 0}>
                {rolesSaving ? "Saving..." : "Save roles"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Discipline summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Counts reset each quarter. Late releases are capped at five; recurring job releases at three.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              {disciplineSummary?.missed.limit ?? 0} missed visit cap
            </div>
          </div>
          {!isScooper ? (
            <div className="admin-card p-6 text-sm text-slate-500 dark:text-slate-400">
              Discipline tracking only applies to scoopers.
            </div>
          ) : disciplineLoading ? (
            <div className="admin-card p-6 text-sm text-slate-500 dark:text-slate-400">
              Loading discipline summary...
            </div>
          ) : disciplineError ? (
            <div className="admin-card p-6 text-sm text-rose-600 dark:text-rose-300">
              {disciplineError}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DisciplineStatCard
                title="Missed visits"
                description="3 per quarter"
                entry={disciplineSummary?.missed ?? null}
              />
              <DisciplineStatCard
                title="Late releases"
                description="48 hours or less"
                entry={disciplineSummary?.lateRelease ?? null}
              />
              <DisciplineStatCard
                title="Early releases"
                description="48+ hours"
                entry={disciplineSummary?.earlyRelease ?? null}
              />
              <DisciplineStatCard
                title="Job releases"
                description="Recurring route drops"
                entry={disciplineSummary?.jobRelease ?? null}
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Add discipline action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isScooper ? (
                <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="discipline-type">Type</Label>
                  <Select
                    value={newDisciplineType}
                    onValueChange={(value) => setNewDisciplineType(value as DisciplineEvent["type"])}
                  >
                    <SelectTrigger id="discipline-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(disciplineTypeLabelMap) as DisciplineEvent["type"][]).map(
                        (type) => (
                          <SelectItem key={type} value={type}>
                            {disciplineTypeLabelMap[type]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discipline-reason">Reason</Label>
                  <Input
                    id="discipline-reason"
                    value={newDisciplineReason}
                    onChange={(event) => setNewDisciplineReason(event.target.value)}
                    placeholder="Add internal note for the record"
                  />
                </div>
                  <div className="flex items-end">
                    <Button onClick={handleCreateDisciplineEvent} disabled={disciplineSubmitting}>
                      {disciplineSubmitting ? "Saving..." : "Record action"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Discipline actions are only recorded for scoopers.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <CardTitle>Discipline event log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isScooper ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No discipline log available for this role.
                </p>
              ) : disciplineLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading event log...
                </p>
              ) : disciplineEvents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No discipline events recorded this quarter.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                      {disciplineEvents.map((event) => {
                        const isEditing = editingEventId === event.id;
                        return (
                          <tr key={event.id} className="bg-white/70 dark:bg-slate-900/40">
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <Select
                                  value={editingEventType}
                                  onValueChange={(value) =>
                                    setEditingEventType(value as DisciplineEvent["type"])
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(disciplineTypeLabelMap) as DisciplineEvent["type"][]).map(
                                      (type) => (
                                        <SelectItem key={type} value={type}>
                                          {disciplineTypeLabelMap[type]}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge className={disciplineTypeTone[event.type]}>
                                  {disciplineTypeLabelMap[event.type]}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <Input
                                  value={editingEventReason}
                                  onChange={(event) => setEditingEventReason(event.target.value)}
                                  placeholder="Add reason"
                                />
                              ) : (
                                <span className="text-slate-600 dark:text-slate-300">
                                  {event.reason ?? "—"}
                                </span>
                              )}
                              {event.serviceVisitId ? (
                                <p className="mt-1 text-xs text-slate-400">Visit {event.serviceVisitId}</p>
                              ) : null}
                              {event.jobId ? (
                                <p className="mt-1 text-xs text-slate-400">Job {event.jobId}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              {formatDateTime(event.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {event.source}
                              {event.createdBy?.email ? (
                                <p className="text-xs text-slate-400">{event.createdBy.email}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateDisciplineEvent(event.id)}
                                    disabled={disciplineSubmitting}
                                  >
                                    <Save className="mr-1 h-4 w-4" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setEditingEventId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setEditingEventId(event.id);
                                      setEditingEventType(event.type);
                                      setEditingEventReason(event.reason ?? "");
                                    }}
                                  >
                                    <Pencil className="mr-1 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteDisciplineEvent(event.id)}
                                    disabled={disciplineSubmitting}
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
