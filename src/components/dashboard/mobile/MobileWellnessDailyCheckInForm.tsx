"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Droplet, Pill, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const LEVEL_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
] as const;

const QUICK_CHECKINS = [
  {
    label: "All good",
    apply: (setters: {
      setAppetite: (value: string | null) => void;
      setEnergy: (value: string | null) => void;
      setWater: (value: string | null) => void;
      setStoolFrequency: (value: number | null) => void;
      setVomiting: (value: boolean) => void;
      setDiarrhea: (value: boolean) => void;
      setMedsGiven: (value: boolean) => void;
      setMedsNotes: (value: string) => void;
      setNotes: (value: string) => void;
    }) => {
      setters.setAppetite("NORMAL");
      setters.setEnergy("NORMAL");
      setters.setWater("NORMAL");
      setters.setStoolFrequency(1);
      setters.setVomiting(false);
      setters.setDiarrhea(false);
      setters.setMedsGiven(false);
      setters.setMedsNotes("");
      setters.setNotes("");
    },
  },
  {
    label: "Low appetite + energy",
    apply: (setters: {
      setAppetite: (value: string | null) => void;
      setEnergy: (value: string | null) => void;
    }) => {
      setters.setAppetite("LOW");
      setters.setEnergy("LOW");
    },
  },
  {
    label: "Extra thirsty",
    apply: (setters: { setWater: (value: string | null) => void }) => {
      setters.setWater("HIGH");
    },
  },
  {
    label: "Vomiting",
    apply: (setters: { setVomiting: (value: boolean) => void }) => {
      setters.setVomiting(true);
    },
  },
  {
    label: "Diarrhea",
    apply: (setters: { setDiarrhea: (value: boolean) => void }) => {
      setters.setDiarrhea(true);
    },
  },
  {
    label: "Meds given",
    apply: (setters: { setMedsGiven: (value: boolean) => void }) => {
      setters.setMedsGiven(true);
    },
  },
] as const;

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toggleSelection = <T extends string>(
  value: T,
  list: T[],
  setList: (next: T[]) => void,
  checked: boolean,
) => {
  if (checked) {
    setList([...list, value]);
  } else {
    setList(list.filter((item) => item !== value));
  }
};

export default function MobileWellnessDailyCheckInForm({
  dogs,
  access,
  lastCheckInAt,
}: {
  dogs: DogOption[];
  access: WellnessAccessSummary;
  lastCheckInAt?: string | null;
}) {
  const defaultScope = dogs.length === 1 ? "DOG" : "HOUSEHOLD";
  const [scope, setScope] = useState<"HOUSEHOLD" | "DOG">(defaultScope);
  const [dogId, setDogId] = useState<string | null>(
    dogs.length === 1 ? dogs[0].id : null,
  );
  const [suspectedDogIds, setSuspectedDogIds] = useState<string[]>([]);
  const [appetite, setAppetite] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [waterIntake, setWaterIntake] = useState<string | null>(null);
  const [stoolFrequency, setStoolFrequency] = useState<number | null>(null);
  const [vomiting, setVomiting] = useState(false);
  const [diarrhea, setDiarrhea] = useState(false);
  const [medsGiven, setMedsGiven] = useState(false);
  const [medsNotes, setMedsNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const dogOptions = useMemo(
    () => dogs.map((dog) => ({ value: dog.id, label: dog.name })),
    [dogs],
  );

  const missedDay = useMemo(() => {
    if (!lastCheckInAt) return false;
    const last = new Date(lastCheckInAt);
    if (Number.isNaN(last.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return last < yesterday;
  }, [lastCheckInAt]);

  const handleScopeChange = (value: "HOUSEHOLD" | "DOG") => {
    if (value === "DOG" && multiDogLocked) {
      setSubmitError("Upgrade to log daily check-ins per dog.");
      return;
    }
    setScope(value);
    if (value === "DOG" && !dogId && dogs.length > 0) {
      setDogId(dogs[0].id);
    }
    if (value === "HOUSEHOLD") {
      setDogId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const payload: Record<string, unknown> = {};
    if (scope === "DOG" && dogId) {
      payload.dogId = dogId;
    }
    if (scope === "HOUSEHOLD") {
      if (suspectedDogIds.length > 0) {
        payload.suspectedDogIds = suspectedDogIds;
      } else if (dogs.length > 0) {
        payload.suspectedDogIds = dogs.map((dog) => dog.id);
      }
    }
    if (appetite) payload.appetite = appetite;
    if (energy) payload.energy = energy;
    if (waterIntake) payload.waterIntake = waterIntake;
    if (stoolFrequency !== null) payload.stoolFrequency = stoolFrequency;
    payload.vomiting = vomiting;
    payload.diarrhea = diarrhea;
    payload.medsGiven = medsGiven;
    if (medsGiven && medsNotes.trim().length) payload.medsNotes = medsNotes.trim();
    if (notes.trim().length) payload.notes = notes.trim();

    if (
      Object.keys(payload).length === 0 ||
      Object.keys(payload).every((key) => ["dogId", "suspectedDogIds"].includes(key))
    ) {
      setSubmitError("Tap at least one check-in item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/customer/wellness-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to submit daily check-in.");
      }
      setSubmitSuccess("Daily check-in saved. Thanks for the update!");
      setAppetite(null);
      setEnergy(null);
      setWaterIntake(null);
      setStoolFrequency(null);
      setVomiting(false);
      setDiarrhea(false);
      setMedsGiven(false);
      setMedsNotes("");
      setNotes("");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit daily check-in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLevelButtons = (
    value: string | null,
    onChange: (next: string | null) => void,
  ) => (
    <div className="flex gap-2">
      {LEVEL_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(value === option.value ? null : option.value)}
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
            value === option.value
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
              : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const applyQuickCheckIn = (entry: (typeof QUICK_CHECKINS)[number]) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    entry.apply({
      setAppetite,
      setEnergy,
      setWater: setWaterIntake,
      setStoolFrequency,
      setVomiting,
      setDiarrhea,
      setMedsGiven,
      setMedsNotes,
      setNotes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <h2 className="text-lg font-semibold text-white">10-second daily check-in</h2>
        <p className="text-xs text-slate-400">
          Tap the items that match today. Skip anything that doesn&apos;t apply.
        </p>
      </section>

      {missedDay && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 space-y-2">
          <p className="text-sm font-semibold text-amber-100">
            Missed a day?
          </p>
          <p className="text-xs text-amber-200/80">
            Let a pro keep your data consistent with auto-captures and a verified
            wellness timeline.
          </p>
          <Link
            href="/mobile/dashboard/wellness/upgrade"
            className="inline-flex items-center gap-2 text-xs font-semibold text-amber-100"
          >
            Compare DIY vs Pro-assisted wellness →
          </Link>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Quick taps
          </p>
          <p className="text-xs text-slate-400">
            Pre-fill common check-ins if you&apos;re in a hurry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_CHECKINS.map((entry) => (
            <button
              key={entry.label}
              type="button"
              onClick={() => applyQuickCheckIn(entry)}
              className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-white"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-white">Who is this about?</h3>
        <p className="text-xs text-slate-400">
          Household check-ins apply to the full yard if you skip dog selection.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            <input
              type="radio"
              name="scope"
              value="HOUSEHOLD"
              checked={scope === "HOUSEHOLD"}
              onChange={() => handleScopeChange("HOUSEHOLD")}
            />
            Whole yard
          </label>
          <label
            className={cn(
              "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm",
              multiDogLocked && "opacity-60",
            )}
          >
            <input
              type="radio"
              name="scope"
              value="DOG"
              checked={scope === "DOG"}
              onChange={() => handleScopeChange("DOG")}
              disabled={multiDogLocked}
            />
            Specific dog
          </label>
        </div>
        {multiDogLocked && (
          <p className="text-xs text-amber-300">
            Multi-dog tracking is included with Premium wellness.
            {" "}
            <Link href="/mobile/dashboard/wellness/upgrade" className="underline">
              Compare plans
            </Link>
            .
          </p>
        )}

        {scope === "DOG" ? (
          <Select value={dogId ?? undefined} onValueChange={setDogId} disabled={multiDogLocked}>
            <SelectTrigger className="bg-slate-950/70 text-slate-200">
              <SelectValue placeholder="Choose a dog" />
            </SelectTrigger>
            <SelectContent>
              {dogOptions.map((dog) => (
                <SelectItem key={dog.value} value={dog.value}>
                  {dog.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          dogs.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {dogOptions.map((dog) => (
                <label
                  key={dog.value}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                >
                  <Checkbox
                    checked={suspectedDogIds.includes(dog.value)}
                    disabled={multiDogLocked}
                    onCheckedChange={(checked) =>
                      toggleSelection(
                        dog.value,
                        suspectedDogIds,
                        setSuspectedDogIds,
                        Boolean(checked),
                      )
                    }
                  />
                  {dog.label}
                </label>
              ))}
            </div>
          )
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Utensils className="h-4 w-4" aria-hidden />
          Appetite
        </div>
        {renderLevelButtons(appetite, setAppetite)}

        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Activity className="h-4 w-4" aria-hidden />
          Energy
        </div>
        {renderLevelButtons(energy, setEnergy)}

        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Droplet className="h-4 w-4" aria-hidden />
          Water intake
        </div>
        {renderLevelButtons(waterIntake, setWaterIntake)}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <Label className="text-xs uppercase tracking-wide text-slate-400">
          Stool frequency
        </Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-slate-800 text-slate-200"
            onClick={() =>
              setStoolFrequency((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)))
            }
          >
            -
          </Button>
          <span className="text-sm text-slate-200">
            {stoolFrequency ?? "—"} today
          </span>
          <Button
            type="button"
            variant="outline"
            className="border-slate-800 text-slate-200"
            onClick={() =>
              setStoolFrequency((prev) => (prev === null ? 1 : Math.min(prev + 1, 10)))
            }
          >
            +
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            Vomiting
            <Switch checked={vomiting} onCheckedChange={setVomiting} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            Diarrhea
            <Switch checked={diarrhea} onCheckedChange={setDiarrhea} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Pill className="h-4 w-4" aria-hidden />
            Meds given
          </div>
          <Switch checked={medsGiven} onCheckedChange={setMedsGiven} />
        </div>
        {medsGiven && (
          <Input
            value={medsNotes}
            onChange={(event) => setMedsNotes(event.target.value)}
            placeholder="Name or dose"
            className="bg-slate-950/70 text-slate-200"
          />
        )}
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Optional notes"
          className="bg-slate-950/70 text-slate-200"
        />
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

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
      >
        {isSubmitting ? "Submitting..." : "Save daily check-in"}
      </Button>
    </form>
  );
}
