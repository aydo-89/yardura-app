"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Dog, PlusCircle, Scale, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type WellnessAccessSummary = {
  tier: string;
  maxDogs: number | null;
  planEndsAt?: string | null;
};

type DogProfile = {
  id: string;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  allergies: string | null;
  medications: string | null;
  dietNotes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  vetClinic: string | null;
  photoUrl: string | null;
};

type WeightEntry = {
  id: string;
  dogId: string;
  dogName?: string | null;
  weightLbs: number;
  recordedAt: string;
  notes?: string | null;
  source?: string | null;
};

type DogDraft = {
  id: string;
  name: string;
  breed: string;
  age: string;
  weight: string;
  allergies: string;
  medications: string;
  dietNotes: string;
  vetName: string;
  vetPhone: string;
  vetClinic: string;
  photoUrl: string | null;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const toDrafts = (dogs: DogProfile[]): Record<string, DogDraft> =>
  dogs.reduce((acc, dog) => {
    acc[dog.id] = {
      id: dog.id,
      name: dog.name ?? "",
      breed: dog.breed ?? "",
      age: typeof dog.age === "number" ? String(dog.age) : "",
      weight: typeof dog.weight === "number" ? String(dog.weight) : "",
      allergies: dog.allergies ?? "",
      medications: dog.medications ?? "",
      dietNotes: dog.dietNotes ?? "",
      vetName: dog.vetName ?? "",
      vetPhone: dog.vetPhone ?? "",
      vetClinic: dog.vetClinic ?? "",
      photoUrl: dog.photoUrl ?? null,
    };
    return acc;
  }, {} as Record<string, DogDraft>);

const toWeightDrafts = (dogs: DogProfile[]): Record<string, WeightDraft> =>
  dogs.reduce((acc, dog) => {
    acc[dog.id] = { weight: "", date: "", notes: "" };
    return acc;
  }, {} as Record<string, WeightDraft>);

type WeightDraft = {
  weight: string;
  date: string;
  notes: string;
};

const WeightTrendSparkline = ({ entries }: { entries: WeightEntry[] }) => {
  if (entries.length < 2) {
    return (
      <div className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 text-[10px] text-slate-500 flex items-center justify-center">
        Add at least 2 weigh-ins to see a trend line.
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const values = sorted.map((entry) => entry.weightLbs);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = sorted
    .map((entry, index) => {
      const x = (index / (sorted.length - 1)) * 100;
      const y = 28 - ((entry.weightLbs - min) / range) * 24 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" className="h-10 w-full">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
        className="text-emerald-300"
      />
    </svg>
  );
};

export default function MobileWellnessDogHub({
  dogs,
  weightEntries,
  access,
}: {
  dogs: DogProfile[];
  weightEntries: WeightEntry[];
  access: WellnessAccessSummary;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, DogDraft>>(() => toDrafts(dogs));
  const [weightDrafts, setWeightDrafts] = useState<Record<string, WeightDraft>>(() =>
    toWeightDrafts(dogs),
  );
  const [entries, setEntries] = useState<WeightEntry[]>(weightEntries);
  const [savingDogId, setSavingDogId] = useState<string | null>(null);
  const [uploadingDogId, setUploadingDogId] = useState<string | null>(null);
  const [weightSavingDogId, setWeightSavingDogId] = useState<string | null>(null);
  const [addDogOpen, setAddDogOpen] = useState(false);
  const [addDogDraft, setAddDogDraft] = useState({
    name: "",
    breed: "",
    age: "",
    weight: "",
  });
  const [addDogError, setAddDogError] = useState<string | null>(null);
  const [addDogSaving, setAddDogSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(toDrafts(dogs));
    setWeightDrafts(toWeightDrafts(dogs));
  }, [dogs]);

  useEffect(() => {
    setEntries(weightEntries);
  }, [weightEntries]);

  const entriesByDog = useMemo(() => {
    return entries.reduce((acc, entry) => {
      acc[entry.dogId] = acc[entry.dogId] ?? [];
      acc[entry.dogId].push(entry);
      return acc;
    }, {} as Record<string, WeightEntry[]>);
  }, [entries]);

  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;
  const addDogLocked =
    access.maxDogs !== null && dogs.length >= access.maxDogs;

  const handleDraftChange = (dogId: string, field: keyof DogDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [dogId]: {
        ...prev[dogId],
        [field]: value,
      },
    }));
  };

  const handleSaveDog = async (dogId: string) => {
    const draft = drafts[dogId];
    if (!draft?.name.trim()) {
      setGlobalError("Please enter your dog's name.");
      return;
    }

    setSavingDogId(dogId);
    setGlobalError(null);
    try {
      const payload = {
        id: dogId,
        name: draft.name.trim(),
        breed: draft.breed.trim() || null,
        age: draft.age ? Number.parseInt(draft.age, 10) : null,
        weight: draft.weight ? Number.parseFloat(draft.weight) : null,
        allergies: draft.allergies.trim() || null,
        medications: draft.medications.trim() || null,
        dietNotes: draft.dietNotes.trim() || null,
        vetName: draft.vetName.trim() || null,
        vetPhone: draft.vetPhone.trim() || null,
        vetClinic: draft.vetClinic.trim() || null,
      };

      const res = await fetch("/api/dogs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to update dog profile.");
      }
      router.refresh();
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Unable to update dog profile.",
      );
    } finally {
      setSavingDogId(null);
    }
  };

  const handlePhotoUpload = async (dogId: string, file: File) => {
    setUploadingDogId(dogId);
    setGlobalError(null);
    try {
      const formData = new FormData();
      formData.append("dogId", dogId);
      formData.append("file", file);
      const res = await fetch("/api/dogs/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to upload photo.");
      }
      router.refresh();
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setUploadingDogId(null);
    }
  };

  const handleWeightDraftChange = (
    dogId: string,
    field: keyof WeightDraft,
    value: string,
  ) => {
    setWeightDrafts((prev) => ({
      ...prev,
      [dogId]: {
        ...prev[dogId],
        [field]: value,
      },
    }));
  };

  const handleAddWeight = async (dogId: string) => {
    const draft = weightDrafts[dogId];
    const weightValue = Number.parseFloat(draft?.weight ?? "");
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setGlobalError("Enter a valid weight in pounds.");
      return;
    }

    setWeightSavingDogId(dogId);
    setGlobalError(null);
    try {
      const payload = {
        dogId,
        weightLbs: weightValue,
        recordedAt: draft?.date ? new Date(draft.date).toISOString() : undefined,
        notes: draft?.notes?.trim() || null,
        source: "OWNER_LOG",
      };
      const res = await fetch("/api/customer/dogs/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save weight.");
      }
      if (data?.data?.entry) {
        setEntries((prev) => [data.data.entry, ...prev]);
      }
      setWeightDrafts((prev) => ({
        ...prev,
        [dogId]: { weight: "", date: "", notes: "" },
      }));
      router.refresh();
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Unable to save weight.");
    } finally {
      setWeightSavingDogId(null);
    }
  };

  const handleAddDog = async () => {
    if (!addDogDraft.name.trim()) {
      setAddDogError("Please enter your dog's name.");
      return;
    }

    setAddDogSaving(true);
    setAddDogError(null);
    try {
      const payload = {
        name: addDogDraft.name.trim(),
        breed: addDogDraft.breed.trim() || null,
        age: addDogDraft.age ? Number.parseInt(addDogDraft.age, 10) : null,
        weight: addDogDraft.weight ? Number.parseFloat(addDogDraft.weight) : null,
      };
      const res = await fetch("/api/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Unable to add dog.");
      }
      setAddDogDraft({ name: "", breed: "", age: "", weight: "" });
      setAddDogOpen(false);
      router.refresh();
    } catch (error) {
      setAddDogError(error instanceof Error ? error.message : "Unable to add dog.");
    } finally {
      setAddDogSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Dog profile hub
            </p>
            <h2 className="text-lg font-semibold text-white">
              Profiles, weight trends, and care notes
            </h2>
            <p className="text-sm text-slate-400">
              Keep medical details and weight logs in one place.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Dog className="h-5 w-5" aria-hidden />
          </div>
        </div>

        {addDogLocked ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Upgrade to add more dogs to your household.
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-700 text-slate-200"
            onClick={() => setAddDogOpen((prev) => !prev)}
          >
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
            {addDogOpen ? "Close add dog" : "Add a dog"}
          </Button>
        )}

        {addDogOpen && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Name
                </Label>
                <Input
                  value={addDogDraft.name}
                  onChange={(event) =>
                    setAddDogDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Bella"
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Breed
                </Label>
                <Input
                  value={addDogDraft.breed}
                  onChange={(event) =>
                    setAddDogDraft((prev) => ({ ...prev, breed: event.target.value }))
                  }
                  placeholder="Labrador"
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Age (years)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={40}
                  value={addDogDraft.age}
                  onChange={(event) =>
                    setAddDogDraft((prev) => ({ ...prev, age: event.target.value }))
                  }
                  placeholder="3"
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Weight (lbs)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={addDogDraft.weight}
                  onChange={(event) =>
                    setAddDogDraft((prev) => ({ ...prev, weight: event.target.value }))
                  }
                  placeholder="45"
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
            </div>
            {addDogError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
                {addDogError}
              </div>
            )}
            <Button
              type="button"
              className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
              disabled={addDogSaving}
              onClick={handleAddDog}
            >
              {addDogSaving ? "Saving..." : "Save dog profile"}
            </Button>
          </div>
        )}
      </section>

      {multiDogLocked && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          You&apos;ve unlocked multiple dogs in this household. Premium keeps multi-dog
          insights, shared wellness, and family sharing enabled.
        </section>
      )}

      {globalError && (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {globalError}
        </section>
      )}

      {dogs.map((dog) => {
        const draft = drafts[dog.id];
        const dogEntries = (entriesByDog[dog.id] ?? []).sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        );
        const latestEntry = dogEntries[0];
        const earliestEntry = dogEntries[dogEntries.length - 1];
        const delta =
          latestEntry && earliestEntry
            ? latestEntry.weightLbs - earliestEntry.weightLbs
            : null;
        const deltaLabel =
          delta === null
            ? "Log weights to see a trend."
            : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} lbs since ${formatDate(
                earliestEntry.recordedAt,
              )}`;

        return (
          <section
            key={dog.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-950/70 flex items-center justify-center text-emerald-200">
                {draft?.photoUrl ? (
                  <img
                    src={draft.photoUrl}
                    alt={draft.name ? `${draft.name} photo` : "Dog photo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Dog className="h-6 w-6" aria-hidden />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{draft?.name || dog.name}</p>
                <p className="text-xs text-slate-400">
                  {draft?.breed || dog.breed || "Breed not set"}
                </p>
                <p className="text-xs text-slate-500">
                  {draft?.age || dog.age ? `${draft?.age || dog.age} yrs` : "Age not set"} ·{" "}
                  {draft?.weight || dog.weight ? `${draft?.weight || dog.weight} lbs` : "Weight pending"}
                </p>
              </div>
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300",
                  uploadingDogId === dog.id && "opacity-60",
                )}
              >
                <Camera className="h-3 w-3" aria-hidden />
                {uploadingDogId === dog.id ? "Uploading..." : "Photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handlePhotoUpload(dog.id, file);
                    }
                  }}
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  Weight trend
                </div>
                <span>{latestEntry ? `${latestEntry.weightLbs.toFixed(1)} lbs latest` : "No logs"}</span>
              </div>
              <WeightTrendSparkline entries={dogEntries.slice(0, 6)} />
              <p className="text-[11px] text-slate-500">{deltaLabel}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Scale className="h-3 w-3" aria-hidden />
                Log a weigh-in
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={weightDrafts[dog.id]?.weight ?? ""}
                  onChange={(event) =>
                    handleWeightDraftChange(dog.id, "weight", event.target.value)
                  }
                  placeholder="Weight (lbs)"
                  className="bg-slate-950/70 text-slate-200"
                />
                <Input
                  type="date"
                  value={weightDrafts[dog.id]?.date ?? ""}
                  onChange={(event) =>
                    handleWeightDraftChange(dog.id, "date", event.target.value)
                  }
                  className="bg-slate-950/70 text-slate-200"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 text-slate-200"
                  disabled={weightSavingDogId === dog.id}
                  onClick={() => handleAddWeight(dog.id)}
                >
                  {weightSavingDogId === dog.id ? "Saving..." : "Save weight"}
                </Button>
              </div>
              <Textarea
                rows={2}
                value={weightDrafts[dog.id]?.notes ?? ""}
                onChange={(event) =>
                  handleWeightDraftChange(dog.id, "notes", event.target.value)
                }
                placeholder="Notes (vet visit, scale, etc.)"
                className="bg-slate-950/70 text-slate-200"
              />
              {dogEntries.length > 0 && (
                <div className="space-y-1 text-xs text-slate-500">
                  {dogEntries.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex justify-between">
                      <span>
                        {formatDate(entry.recordedAt)} · {entry.weightLbs.toFixed(1)} lbs
                      </span>
                      <span>{entry.notes ? "Notes" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Name
                </Label>
                <Input
                  value={draft?.name ?? ""}
                  onChange={(event) => handleDraftChange(dog.id, "name", event.target.value)}
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Breed
                </Label>
                <Input
                  value={draft?.breed ?? ""}
                  onChange={(event) =>
                    handleDraftChange(dog.id, "breed", event.target.value)
                  }
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Age (years)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={40}
                  value={draft?.age ?? ""}
                  onChange={(event) => handleDraftChange(dog.id, "age", event.target.value)}
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Weight (lbs)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={draft?.weight ?? ""}
                  onChange={(event) =>
                    handleDraftChange(dog.id, "weight", event.target.value)
                  }
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Allergies
              </Label>
              <Textarea
                rows={2}
                value={draft?.allergies ?? ""}
                onChange={(event) =>
                  handleDraftChange(dog.id, "allergies", event.target.value)
                }
                placeholder="Chicken, beef, seasonal pollen..."
                className="bg-slate-950/70 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Medications
              </Label>
              <Textarea
                rows={2}
                value={draft?.medications ?? ""}
                onChange={(event) =>
                  handleDraftChange(dog.id, "medications", event.target.value)
                }
                placeholder="Heartworm, probiotics..."
                className="bg-slate-950/70 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                Diet notes
              </Label>
              <Textarea
                rows={2}
                value={draft?.dietNotes ?? ""}
                onChange={(event) =>
                  handleDraftChange(dog.id, "dietNotes", event.target.value)
                }
                placeholder="Current food, transition notes, treats..."
                className="bg-slate-950/70 text-slate-200"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Vet contact
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={draft?.vetName ?? ""}
                  onChange={(event) =>
                    handleDraftChange(dog.id, "vetName", event.target.value)
                  }
                  placeholder="Vet name"
                  className="bg-slate-950/70 text-slate-200"
                />
                <Input
                  value={draft?.vetPhone ?? ""}
                  onChange={(event) =>
                    handleDraftChange(dog.id, "vetPhone", event.target.value)
                  }
                  placeholder="Vet phone"
                  className="bg-slate-950/70 text-slate-200"
                />
                <Input
                  value={draft?.vetClinic ?? ""}
                  onChange={(event) =>
                    handleDraftChange(dog.id, "vetClinic", event.target.value)
                  }
                  placeholder="Clinic name"
                  className="bg-slate-950/70 text-slate-200"
                />
              </div>
            </div>

            <Button
              type="button"
              className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
              disabled={savingDogId === dog.id}
              onClick={() => handleSaveDog(dog.id)}
            >
              {savingDogId === dog.id ? "Saving..." : "Save profile updates"}
            </Button>
          </section>
        );
      })}

      {dogs.length === 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
          <p className="text-sm text-slate-400">
            Add your first dog profile to unlock weight tracking and vet notes.
          </p>
        </section>
      )}
    </div>
  );
}
