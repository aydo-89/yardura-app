"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Loader2, ListChecks, PlayCircle, Plus, Target } from "lucide-react";
import {
  SALES_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";

interface CadenceStep {
  id: string;
  order: number;
  channel: string;
  waitMinutes: number;
  slaMinutes?: number | null;
  autoComplete: boolean;
}

interface Cadence {
  id: string;
  name: string;
  description?: string | null;
  targetStage?: string | null;
  createdAt: string;
  steps: CadenceStep[];
  enrollments: Array<{ id: string; status: string }>;
}

const ANY_STAGE_VALUE = "ANY";

const stageOptions = [
  { value: ANY_STAGE_VALUE, label: "Any stage" },
  { value: "cold", label: "Cold" },
  { value: "contacted", label: "Contacted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "follow_up", label: "Follow Up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const channelOptions = [
  { value: "DOOR_KNOCK", label: "Door knock" },
  { value: "CALL", label: "Call" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "TASK", label: "Task" },
  { value: "MEETING", label: "Meeting" },
];

interface StepDraft {
  channel: string;
  waitMinutes: number;
  slaMinutes?: number | null;
  autoComplete: boolean;
}

export default function CadencePlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(ANY_STAGE_VALUE);

  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createName, setCreateName] = useState("Morning follow-up");
  const [createDescription, setCreateDescription] = useState("");
  const [createTargetStage, setCreateTargetStage] = useState<string>(ANY_STAGE_VALUE);
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([
    { channel: "SMS", waitMinutes: 0, slaMinutes: 30, autoComplete: false },
  ]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCadences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cadences", { credentials: "include" });

      if (res.status === 401) {
        setCadences([]);
        setError("You do not have access to cadences.");
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Failed to load cadences (status ${res.status})`);
      }
      setCadences(json.data ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/leads/cadences");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !SALES_PORTAL_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }

    void fetchCadences();
  }, [session, status, router, fetchCadences]);

  const filteredCadences = useMemo(() => {
    return cadences.filter((cadence) =>
      stageFilter === ANY_STAGE_VALUE ? true : cadence.targetStage === stageFilter,
    );
  }, [cadences, stageFilter]);

  const currentStageLabel = useMemo(() => {
    return stageOptions.find((opt) => opt.value === stageFilter)?.label ?? "Any stage";
  }, [stageFilter]);

  const totalEnrollments = useMemo(() => {
    return cadences.reduce((acc, cadence) => acc + cadence.enrollments.length, 0);
  }, [cadences]);

  const resetCreateState = () => {
    setCreateName("Morning follow-up");
    setCreateDescription("");
    setCreateTargetStage(ANY_STAGE_VALUE);
    setStepDrafts([{ channel: "SMS", waitMinutes: 0, slaMinutes: 30, autoComplete: false }]);
    setCreateSubmitting(false);
    setCreateError(null);
  };

  const addStepDraft = () => {
    setStepDrafts((prev) => [
      ...prev,
      { channel: "CALL", waitMinutes: 120, slaMinutes: 60, autoComplete: false },
    ]);
  };

  const updateStepDraft = (index: number, patch: Partial<StepDraft>) => {
    setStepDrafts((prev) =>
      prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)),
    );
  };

  const removeStepDraft = (index: number) => {
    setStepDrafts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submitCadence = async () => {
    if (!createName.trim()) {
      setCreateError("Name is required.");
      return;
    }

    if (!stepDrafts.length) {
      setCreateError("Add at least one step.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const payload = {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        targetStage: createTargetStage === ANY_STAGE_VALUE ? undefined : createTargetStage,
        steps: stepDrafts.map((step) => ({
          channel: step.channel,
          waitMinutes: Number(step.waitMinutes) || 0,
          slaMinutes: step.slaMinutes ?? undefined,
          autoComplete: step.autoComplete,
        })),
      };

      const res = await fetch("/api/cadences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to create cadence");
      }

      resetCreateState();
      setIsCreateSheetOpen(false);
      await fetchCadences();
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-coral" />
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute right-16 top-12 h-32 w-32 rounded-full bg-brand-mint/25 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-40 w-[24rem] -translate-x-1/2 bg-brand-coral/20 blur-3xl" />
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <PlayCircle className="h-4 w-4" />
                <span>Cadence builder</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">Cadence planner</h1>
                <p className="admin-subtitle">
                  Create Spotio-style Autoplay sequences for outbound follow-up. Each cadence keeps leads moving
                  through multi-channel touchpoints with SLA reminders.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-10 w-[200px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => fetchCadences()} className="gap-2 rounded-full">
                <Loader2
                  className={cn(
                    "h-4 w-4",
                    isLoading ? "animate-spin text-slate-500" : "text-slate-400",
                  )}
                />
                Refresh
              </Button>
              <Button className="gap-2 rounded-full" onClick={() => setIsCreateSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                New cadence
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <PlayCircle className="h-5 w-5 text-violet-500" /> Active cadences
              </CardTitle>
              <CardDescription>Enrolled leads include paused &amp; active statuses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900 dark:text-white">{filteredCadences.length}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total sequences available to reps.</p>
            </CardContent>
          </Card>
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <ListChecks className="h-5 w-5 text-emerald-500" /> Enrollments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900 dark:text-white">{totalEnrollments}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leads currently running through cadences.</p>
            </CardContent>
          </Card>
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Target className="h-5 w-5 text-sky-500" /> Stage filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-medium text-slate-900 dark:text-white">{currentStageLabel}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cadences matching the current pipeline stage filter.</p>
            </CardContent>
          </Card>
        </div>

        {filteredCadences.length === 0 ? (
          <div className="admin-card rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No cadences yet. Create a sequence to automate door-knock follow-ups.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCadences.map((cadence) => (
              <Card key={cadence.id} className="admin-card">
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                      {cadence.name}
                    </CardTitle>
                    {cadence.description ? (
                      <CardDescription>{cadence.description}</CardDescription>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                          Target: {cadence.targetStage || "Any"}
                        </Badge>
                      </span>
                      <span>{cadence.steps.length} steps</span>
                      <span>{cadence.enrollments.length} enrollments</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Created {new Date(cadence.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Order</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Wait</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead>Auto-complete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cadence.steps.map((step) => (
                        <TableRow key={step.id}>
                          <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">#{step.order}</TableCell>
                          <TableCell className="capitalize">{step.channel.toLowerCase().replace("_", " ")}</TableCell>
                          <TableCell>{step.waitMinutes} min</TableCell>
                          <TableCell>{step.slaMinutes != null ? `${step.slaMinutes} min` : "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                step.autoComplete ? "text-emerald-600 dark:text-emerald-200" : "text-slate-500 dark:text-slate-400",
                              )}
                            >
                              {step.autoComplete ? "Auto" : "Manual"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </main>

      <Sheet
        open={isCreateSheetOpen}
        onOpenChange={(open) => {
          setIsCreateSheetOpen(open);
          if (!open) resetCreateState();
        }}
      >
        <SheetContent side="right" className="admin-card w-[420px] overflow-y-auto sm:w-[520px]">
          <SheetHeader>
            <SheetTitle>Create cadence</SheetTitle>
            <SheetDescription>
              Define a multi-touch follow-up sequence. These steps mirror Spotio Autoplays and will power SLA alerts.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 pb-6">
            {createError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                {createError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cadence name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Morning follow-up"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
              <Textarea
                rows={3}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="e.g. First-day follow-up on door knocks in Uptown"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Target stage</label>
              <Select value={createTargetStage} onValueChange={setCreateTargetStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Any stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">Steps ({stepDrafts.length})</h4>
                <Button variant="outline" size="sm" className="gap-2" onClick={addStepDraft}>
                  <Plus className="h-3 w-3" /> Add step
                </Button>
              </div>

              <div className="space-y-3">
                {stepDrafts.map((step, index) => (
                  <div
                    key={`${step.channel}-${index}`}
                    className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Step #{index + 1}</div>
                      {stepDrafts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 dark:text-rose-300"
                          onClick={() => removeStepDraft(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Channel</label>
                      <Select
                        value={step.channel}
                        onValueChange={(value) => updateStepDraft(index, { channel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {channelOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Wait minutes</label>
                        <Input
                          type="number"
                          min={0}
                          value={step.waitMinutes}
                          onChange={(e) =>
                            updateStepDraft(index, { waitMinutes: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">SLA minutes</label>
                        <Input
                          type="number"
                          min={0}
                          value={step.slaMinutes ?? ""}
                          onChange={(e) =>
                            updateStepDraft(index, {
                              slaMinutes:
                                e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={step.autoComplete}
                        onCheckedChange={(checked) =>
                          updateStepDraft(index, { autoComplete: Boolean(checked) })
                        }
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-300">Auto-complete when wait timer elapses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button onClick={submitCadence} disabled={createSubmitting} className="gap-2">
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save cadence
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
