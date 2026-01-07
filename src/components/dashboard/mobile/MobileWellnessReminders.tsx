"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarCheck, CheckCircle2, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DogOption = {
  id: string;
  name: string;
};

type WellnessAccessSummary = {
  tier: string;
  maxDogs: number | null;
  planEndsAt?: string | null;
};

type ReminderRecord = {
  id: string;
  dogId: string | null;
  dogName: string | null;
  title: string;
  category: ReminderCategory;
  notes: string | null;
  nextDueAt: string;
  frequencyDays: number | null;
  active: boolean;
  lastCompletedAt: string | null;
};

const CATEGORY_OPTIONS = [
  { value: "MEDS", label: "Meds" },
  { value: "VACCINE", label: "Vaccine" },
  { value: "DEWORMING", label: "Deworming" },
  { value: "FLEA_TICK", label: "Flea and tick" },
  { value: "FOOD_TRANSITION", label: "Food transition" },
  { value: "VET_VISIT", label: "Vet visit" },
  { value: "CUSTOM", label: "Custom" },
] as const;
type ReminderCategory = (typeof CATEGORY_OPTIONS)[number]["value"];

const QUICK_TEMPLATES = [
  {
    label: "Monthly meds",
    title: "Monthly meds dose",
    category: "MEDS",
    frequencyDays: 30,
  },
  {
    label: "Flea and tick",
    title: "Flea and tick treatment",
    category: "FLEA_TICK",
    frequencyDays: 30,
  },
  {
    label: "Deworming",
    title: "Deworming dose",
    category: "DEWORMING",
    frequencyDays: 90,
  },
  {
    label: "Vaccine booster",
    title: "Vaccine booster",
    category: "VACCINE",
    frequencyDays: 365,
  },
  {
    label: "Vet checkup",
    title: "Vet checkup",
    category: "VET_VISIT",
    frequencyDays: 180,
  },
  {
    label: "Food transition",
    title: "Food transition check-in",
    category: "FOOD_TRANSITION",
    frequencyDays: 14,
  },
] as const;

const quickFrequencyOptions = [7, 14, 30, 60, 90, 180, 365];

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

export default function MobileWellnessReminders({
  dogs,
  access,
}: {
  dogs: DogOption[];
  access: WellnessAccessSummary;
}) {
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeToggleId, setActiveToggleId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReminderCategory>(
    "CUSTOM",
  );
  const [dogId, setDogId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return toDateInput(nextWeek);
  });
  const [frequencyDays, setFrequencyDays] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const categoryLabels = useMemo(
    () => new Map<ReminderCategory, string>(
      CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
    ),
    [],
  );

  const fetchReminders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/customer/reminders?includeInactive=true");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load reminders.");
      }
      setReminders(Array.isArray(data?.data?.reminders) ? data.data.reminders : []);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to load reminders.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders().catch(() => null);
  }, []);

  useEffect(() => {
    if (multiDogLocked) {
      setDogId(null);
    }
  }, [multiDogLocked]);

  const handleTemplate = (template: (typeof QUICK_TEMPLATES)[number]) => {
    setTitle(template.title);
    setCategory(template.category);
    setFrequencyDays(template.frequencyDays);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 7);
    setDueDate(toDateInput(nextDue));
  };

  const handleCreate = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!title.trim()) {
      setSubmitError("Add a reminder title.");
      return;
    }

    const parsedDate = parseDateInput(dueDate);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      category,
    };
    if (dogId) payload.dogId = dogId;
    if (parsedDate) payload.nextDueAt = parsedDate.toISOString();
    if (frequencyDays) payload.frequencyDays = frequencyDays;
    if (notes.trim()) payload.notes = notes.trim();

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customer/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to create reminder.");
      }
      const reminder = data?.data?.reminder as ReminderRecord | undefined;
      if (reminder) {
        setReminders((prev) => [reminder, ...prev.filter((item) => item.id !== reminder.id)]);
      }
      setSubmitSuccess("Reminder created.");
      setTitle("");
      setCategory("CUSTOM");
      setDogId(null);
      setFrequencyDays(null);
      setNotes("");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create reminder.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async (reminderId: string) => {
    setActionId(reminderId);
    try {
      const res = await fetch(`/api/customer/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markComplete: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to update reminder.");
      }
      const updated = data?.data?.reminder as ReminderRecord | undefined;
      if (updated) {
        setReminders((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to update reminder.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (reminderId: string, nextActive: boolean) => {
    setActiveToggleId(reminderId);
    try {
      const res = await fetch(`/api/customer/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to update reminder.");
      }
      const updated = data?.data?.reminder as ReminderRecord | undefined;
      if (updated) {
        setReminders((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to update reminder.",
      );
    } finally {
      setActiveToggleId(null);
    }
  };

  const handleDelete = async (reminderId: string) => {
    setActionId(reminderId);
    try {
      const res = await fetch(`/api/customer/reminders/${reminderId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to delete reminder.");
      }
      setReminders((prev) => prev.filter((item) => item.id !== reminderId));
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to delete reminder.",
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Wellness reminders
            </p>
            <h2 className="text-lg font-semibold text-white">
              Stay ahead of meds, vaccines, and visits
            </h2>
            <p className="text-sm text-slate-400">
              Create gentle nudges for every dog in the household.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Quick templates
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => handleTemplate(template)}
                className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-white"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Reminder title
            </Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Heartworm meds"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ReminderCategory)}
              >
                <SelectTrigger className="bg-slate-950/70 text-slate-200">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Dog (optional)
              </Label>
              <Select
                value={dogId ?? "HOUSEHOLD"}
                onValueChange={(value) =>
                  setDogId(value === "HOUSEHOLD" ? null : value)
                }
                disabled={multiDogLocked}
              >
                <SelectTrigger className="bg-slate-950/70 text-slate-200">
                  <SelectValue placeholder="Whole household" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOUSEHOLD">Whole household</SelectItem>
                  {dogs.map((dog) => (
                    <SelectItem key={dog.id} value={dog.id}>
                      {dog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {multiDogLocked && (
                <p className="text-xs text-amber-300">
                  Premium is required for per-dog reminders.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Next due date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="bg-slate-950/70 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Repeat every (days)
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={frequencyDays ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setFrequencyDays(null);
                    return;
                  }
                  const value = Number(raw);
                  setFrequencyDays(Number.isNaN(value) ? null : value);
                }}
                placeholder="Optional"
                className="bg-slate-950/70 text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickFrequencyOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFrequencyDays(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  frequencyDays === value
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600",
                )}
              >
                Every {value} days
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Notes (optional)
            </Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Any special instructions"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>

          <Button
            type="button"
            className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
            disabled={isSubmitting}
            onClick={handleCreate}
          >
            {isSubmitting ? "Saving..." : "Add reminder"}
          </Button>
        </div>
      </section>

      {submitError && (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {submitError}
        </section>
      )}
      {submitSuccess && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {submitSuccess}
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Upcoming reminders
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400 hover:text-slate-100"
            onClick={() => fetchReminders()}
          >
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-500">Loading reminders...</p>
        ) : reminders.length === 0 ? (
          <p className="text-xs text-slate-500">No reminders yet.</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => {
              const dueDateValue = new Date(reminder.nextDueAt);
              const isOverdue = reminder.active && dueDateValue.getTime() < Date.now();
              return (
                <div
                  key={reminder.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {reminder.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {categoryLabels.get(reminder.category as ReminderCategory) ??
                          reminder.category}
                        {reminder.dogName ? ` • ${reminder.dogName}` : " • Household"}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          isOverdue ? "text-rose-300" : "text-slate-400",
                        )}
                      >
                        Due {dueDateValue.toLocaleDateString()}
                        {isOverdue ? " (overdue)" : ""}
                      </p>
                      {reminder.frequencyDays && (
                        <p className="text-xs text-slate-500">
                          Repeats every {reminder.frequencyDays} days
                        </p>
                      )}
                      {reminder.lastCompletedAt && (
                        <p className="text-xs text-slate-500">
                          Last done {new Date(reminder.lastCompletedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={reminder.active}
                        disabled={activeToggleId === reminder.id}
                        onCheckedChange={(checked) =>
                          handleToggleActive(reminder.id, checked)
                        }
                      />
                      <span className="text-[10px] text-slate-500">
                        {reminder.active ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>

                  {reminder.notes && (
                    <p className="text-xs text-slate-400">{reminder.notes}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-800 text-slate-200"
                      disabled={actionId === reminder.id}
                      onClick={() => handleMarkComplete(reminder.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                      Mark done
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-800 text-slate-200"
                      disabled={actionId === reminder.id}
                      onClick={() => handleDelete(reminder.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
