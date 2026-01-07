"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Utensils } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { COMMON_ALLERGENS } from "@/lib/wellness/allergen-scan";
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

type FoodLogRecord = {
  id: string;
  dogId: string | null;
  dogName: string | null;
  loggedAt: string;
  type: FoodLogTypeValue;
  brand: string | null;
  productName: string | null;
  ingredients: string | null;
  portion: string | null;
  notes: string | null;
  allergenMatches: string[];
};

const TYPE_OPTIONS = [
  { value: "FOOD", label: "Food" },
  { value: "TREAT", label: "Treat" },
  { value: "SUPPLEMENT", label: "Supplement" },
  { value: "MEDICATION", label: "Medication" },
] as const;
type FoodLogTypeValue = (typeof TYPE_OPTIONS)[number]["value"];

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

const detectAllergensClient = (ingredients: string) => {
  if (!ingredients.trim()) return [];
  const normalized = ingredients.toLowerCase();
  return COMMON_ALLERGENS.filter((allergen) => normalized.includes(allergen));
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function MobileWellnessFoodLog({
  dogs,
  access,
}: {
  dogs: DogOption[];
  access: WellnessAccessSummary;
}) {
  const [logs, setLogs] = useState<FoodLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [type, setType] = useState<FoodLogTypeValue>("FOOD");
  const [dogId, setDogId] = useState<string | null>(null);
  const [filterDogId, setFilterDogId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [portion, setPortion] = useState("");
  const [notes, setNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(() => toDateInput(new Date()));
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const allergenPreview = useMemo(
    () => detectAllergensClient(ingredients),
    [ingredients],
  );

  const fetchLogs = async (selectedDogId?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (selectedDogId) params.set("dogId", selectedDogId);
      const res = await fetch(`/api/customer/food-log?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load food logs.");
      }
      setLogs(Array.isArray(data?.data?.logs) ? data.data.logs : []);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to load food logs.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(filterDogId).catch(() => null);
  }, [filterDogId]);

  useEffect(() => {
    if (multiDogLocked) {
      setDogId(null);
      setFilterDogId(null);
    }
  }, [multiDogLocked]);

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!productName.trim() && !brand.trim()) {
      setSubmitError("Add a name or brand.");
      return;
    }

    const parsedDate = parseDateInput(loggedAt);
    const payload: Record<string, unknown> = {
      type,
      ...(dogId ? { dogId } : {}),
      ...(parsedDate ? { loggedAt: parsedDate.toISOString() } : {}),
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(productName.trim() ? { productName: productName.trim() } : {}),
      ...(ingredients.trim() ? { ingredients: ingredients.trim() } : {}),
      ...(portion.trim() ? { portion: portion.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customer/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save food log.");
      }
      const log = data?.data?.log as FoodLogRecord | undefined;
      if (log) {
        setLogs((prev) => [log, ...prev.filter((item) => item.id !== log.id)]);
        setSubmitSuccess(
          log.allergenMatches.length
            ? `Allergens flagged: ${log.allergenMatches
                .map((allergen) => formatLabel(allergen))
                .join(", ")}`
            : "Food log saved. No common allergens detected.",
        );
      } else {
        setSubmitSuccess("Food log saved.");
      }
      setBrand("");
      setProductName("");
      setIngredients("");
      setPortion("");
      setNotes("");
      setDogId(null);
      setType("FOOD");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save food log.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Utensils className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Food and treat log
            </p>
            <h2 className="text-lg font-semibold text-white">
              Track ingredients and flag allergens
            </h2>
            <p className="text-sm text-slate-400">
              Paste ingredients to spot common triggers quickly.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Type
            </Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as FoodLogTypeValue)}
            >
              <SelectTrigger className="bg-slate-950/70 text-slate-200">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
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
                Premium unlocks per-dog food logs. Household-only for now.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Brand
            </Label>
            <Input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Example: Purina"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Product name
            </Label>
            <Input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="Example: Sensitive Skin"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Date
            </Label>
            <Input
              type="date"
              value={loggedAt}
              onChange={(event) => setLoggedAt(event.target.value)}
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Portion
            </Label>
            <Input
              value={portion}
              onChange={(event) => setPortion(event.target.value)}
              placeholder="1 cup, 2 chews"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Notes
            </Label>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes"
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Ingredients (paste label)
          </Label>
          <Textarea
            value={ingredients}
            onChange={(event) => setIngredients(event.target.value)}
            rows={4}
            placeholder="Chicken, oats, salmon oil, etc."
            className="mt-2 bg-slate-950/70 text-slate-200"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Common allergens we scan for
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((allergen) => (
              <span
                key={allergen}
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  allergenPreview.includes(allergen)
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                    : "border-slate-800 bg-slate-900 text-slate-400",
                )}
              >
                {formatLabel(allergen)}
              </span>
            ))}
          </div>
        </div>

        {allergenPreview.length > 0 && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            <div className="flex items-center gap-2 text-rose-200">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Possible allergens spotted:{" "}
              {allergenPreview.map((allergen) => formatLabel(allergen)).join(", ")}
            </div>
          </div>
        )}

        <Button
          type="button"
          className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Saving..." : "Save food log"}
        </Button>
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Recent logs
            </p>
            <h3 className="text-sm font-semibold text-white">
              Food and treat history
            </h3>
          </div>
          <Select
            value={filterDogId ?? "ALL"}
            onValueChange={(value) =>
              setFilterDogId(value === "ALL" ? null : value)
            }
            disabled={multiDogLocked}
          >
            <SelectTrigger className="w-40 bg-slate-950/70 text-slate-200">
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

        {isLoading ? (
          <p className="text-xs text-slate-500">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-slate-500">No food logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {log.productName || log.brand || "Food log"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {TYPE_OPTIONS.find((option) => option.value === log.type)?.label ??
                        log.type}
                      {log.dogName ? ` • ${log.dogName}` : " • Household"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(log.loggedAt).toLocaleDateString()}
                  </span>
                </div>

                {log.allergenMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {log.allergenMatches.map((allergen) => (
                      <span
                        key={allergen}
                        className="rounded-full border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-rose-200"
                      >
                        {formatLabel(allergen)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No common allergens flagged.
                  </p>
                )}

                {(log.brand || log.ingredients || log.portion || log.notes) && (
                  <div className="text-xs text-slate-400 space-y-1">
                    {log.brand && <p>Brand: {log.brand}</p>}
                    {log.portion && <p>Portion: {log.portion}</p>}
                    {log.ingredients && (
                      <p className="line-clamp-2">Ingredients: {log.ingredients}</p>
                    )}
                    {log.notes && <p>Notes: {log.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
