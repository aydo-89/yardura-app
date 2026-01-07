"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface LeadActivity {
  id: string;
  type: string;
  channel?: string | null;
  occurredAt: string;
  result?: string | null;
  notes?: string | null;
  followUpAt?: string | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface LeadActivityResponse {
  ok: boolean;
  data?: {
    activities: LeadActivity[];
    pageInfo: { nextCursor?: string | null };
  };
  error?: string;
}

const ACTIVITY_OPTIONS: Array<{ value: string; label: string; channel?: string }> = [
  { value: "CALL", label: "Phone call", channel: "phone" },
  { value: "TEXT", label: "Text message", channel: "sms" },
  { value: "EMAIL", label: "Email", channel: "email" },
  { value: "LINKEDIN", label: "LinkedIn message", channel: "social" },
  { value: "DOOR_KNOCK", label: "Door knock", channel: "in_person" },
  { value: "NOTE", label: "Internal note" },
];

const NO_RESULT_VALUE = "__none__";

const RESULT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "CONNECTED", label: "Connected" },
  { value: "LEFT_MESSAGE", label: "Left message" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "INTERESTED", label: "Interested" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
}

function humanizeType(type?: string | null) {
  if (!type) return "Activity";
  const option = ACTIVITY_OPTIONS.find((item) => item.value === type);
  if (option) return option.label;
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function humanizeResult(result?: string | null) {
  if (!result) return null;
  const option = RESULT_OPTIONS.find((item) => item.value === result);
  if (option) return option.label;
  return result
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function LeadActivityPanel({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formType, setFormType] = useState<string>(ACTIVITY_OPTIONS[0]?.value ?? "CALL");
  const [formResult, setFormResult] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formFollowUp, setFormFollowUp] = useState<string>("");

  const selectedChannel = useMemo(() => {
    return ACTIVITY_OPTIONS.find((option) => option.value === formType)?.channel;
  }, [formType]);

  const loadActivities = useCallback(
    async (cursor?: string | null, append = false) => {
      try {
        const params = new URLSearchParams({ limit: "25" });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(
          `/api/leads/${leadId}/activities?${params.toString()}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as LeadActivityResponse;
        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.error || "Unable to load activities");
        }
        const { activities: fetchedActivities, pageInfo } = json.data;
        setActivities((prev) =>
          append ? [...prev, ...fetchedActivities] : fetchedActivities,
        );
        setNextCursor(pageInfo?.nextCursor ?? null);
      } catch (error) {
        console.error("lead-activity: load", error);
        toast.error("Couldn't load activity history");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    setLoading(true);
    void loadActivities();
  }, [loadActivities]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        type: formType,
        notes: formNotes.trim() || undefined,
      };
      if (selectedChannel) payload.channel = selectedChannel;
      if (formResult) payload.result = formResult;
      if (formFollowUp) payload.followUpAt = new Date(formFollowUp).toISOString();

      const response = await fetch(`/api/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as {
        ok: boolean;
        data?: LeadActivity;
        error?: string;
      };

      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error || "Unable to log activity");
      }

      const created = json.data;
      setActivities((prev) => [created, ...prev]);
      setFormNotes("");
      setFormResult("");
      setFormFollowUp("");
      toast.success("Activity added");
    } catch (error) {
      console.error("lead-activity: submit", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to log activity",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="admin-card">
      <CardHeader className="flex flex-col gap-2">
        <div>
          <CardTitle className="text-xl text-slate-900 dark:text-white">
            Activity & notes
          </CardTitle>
          <CardDescription>
            Keep a running log of calls, site visits, and follow-ups.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-type" className="text-slate-600 dark:text-slate-300">
                Activity
              </Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger
                  id="activity-type"
                  className="h-10 border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-result" className="text-slate-600 dark:text-slate-300">
                Outcome
              </Label>
              <Select
                value={formResult || NO_RESULT_VALUE}
                onValueChange={(value) =>
                  setFormResult(value === NO_RESULT_VALUE ? "" : value)
                }
              >
                <SelectTrigger
                  id="activity-result"
                  className="h-10 border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <SelectValue placeholder="Select outcome (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RESULT_VALUE}>No outcome noted</SelectItem>
                  {RESULT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-notes" className="text-slate-600 dark:text-slate-300">
              Notes
            </Label>
            <Textarea
              id="activity-notes"
              value={formNotes}
              onChange={(event) => setFormNotes(event.target.value)}
              placeholder="What happened?"
              maxLength={1500}
              rows={4}
              className="border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-followup" className="text-slate-600 dark:text-slate-300">
                Follow-up reminder
              </Label>
              <Input
                id="activity-followup"
                type="datetime-local"
                value={formFollowUp}
                onChange={(event) => setFormFollowUp(event.target.value)}
                className="border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Log activity
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFormNotes("");
                setFormResult("");
                setFormFollowUp("");
              }}
            >
              Clear
            </Button>
          </div>
        </form>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Timeline
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  void loadActivities();
                }}
              >
                Refresh
              </Button>
              {nextCursor ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    void loadActivities(nextCursor, true);
                  }}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
              No activity logged yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const occurredLabel = formatDateTime(activity.occurredAt);
                const relative = formatDistanceToNow(new Date(activity.occurredAt), {
                  addSuffix: true,
                });
                const resultLabel = humanizeResult(activity.result);
                const followUpLabel = formatDateTime(activity.followUpAt);
                return (
                  <div
                    key={activity.id}
                    className="admin-card rounded-2xl p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="capitalize border-brand-mint/40 text-brand-mint dark:border-brand-mint/40 dark:text-brand-mint"
                        >
                          {humanizeType(activity.type)}
                        </Badge>
                        {resultLabel ? (
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {resultLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span>{occurredLabel}</span>
                        <span className="mx-1">•</span>
                        <span>{relative}</span>
                      </div>
                    </div>
                    {activity.user ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Logged by {activity.user.name || activity.user.email || "Unknown"}
                      </p>
                    ) : null}
                    {activity.notes ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                        {activity.notes}
                      </p>
                    ) : null}
                    {activity.followUpAt ? (
                      <p className="mt-3 text-xs text-brand-mint">
                        Follow-up scheduled for {followUpLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
