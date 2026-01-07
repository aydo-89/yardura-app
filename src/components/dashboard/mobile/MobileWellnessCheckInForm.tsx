"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  WELLNESS_APPETITE,
  WELLNESS_ATTRIBUTION,
  WELLNESS_DIAGNOSIS_SOURCE,
  WELLNESS_HYDRATION,
  WELLNESS_REPORT_SCOPE,
  WELLNESS_STOOL_COLORS,
  WELLNESS_STOOL_CONSISTENCY,
  WELLNESS_STOOL_CONTENT,
  WELLNESS_SYMPTOMS,
} from "@/lib/wellness/reports";

type DogOption = {
  id: string;
  name: string;
};

type WellnessAccessSummary = {
  tier: string;
  maxDogs: number | null;
  planEndsAt?: string | null;
};

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

const QUICK_TEMPLATES = [
  {
    label: "All normal",
    apply: (setters: { setNoIssues: (value: boolean) => void }) => {
      setters.setNoIssues(true);
    },
  },
  {
    label: "Soft stool",
    apply: (setters: {
      setNoIssues: (value: boolean) => void;
      setShowStoolDetails: (value: boolean) => void;
      setStoolConsistency: (values: string[]) => void;
    }) => {
      setters.setNoIssues(false);
      setters.setShowStoolDetails(true);
      setters.setStoolConsistency(["SOFT"]);
    },
  },
  {
    label: "Vomiting",
    apply: (setters: {
      setNoIssues: (value: boolean) => void;
      setSymptomTags: (values: string[]) => void;
    }) => {
      setters.setNoIssues(false);
      setters.setSymptomTags(["VOMITING"]);
    },
  },
  {
    label: "Low appetite",
    apply: (setters: {
      setNoIssues: (value: boolean) => void;
      setAppetite: (value: string | null) => void;
    }) => {
      setters.setNoIssues(false);
      setters.setAppetite("LOW");
    },
  },
  {
    label: "Low energy",
    apply: (setters: {
      setNoIssues: (value: boolean) => void;
      setSymptomTags: (values: string[]) => void;
    }) => {
      setters.setNoIssues(false);
      setters.setSymptomTags(["LETHARGY"]);
    },
  },
] as const;

interface MobileWellnessCheckInFormProps {
  dogs: DogOption[];
  access: WellnessAccessSummary;
}

export default function MobileWellnessCheckInForm({
  dogs,
  access,
}: MobileWellnessCheckInFormProps) {
  const defaultScope = dogs.length === 1 ? "DOG" : "HOUSEHOLD";
  const [scope, setScope] = useState<(typeof WELLNESS_REPORT_SCOPE)[number]>(
    defaultScope,
  );
  const [dogId, setDogId] = useState<string | null>(
    dogs.length === 1 ? dogs[0].id : null,
  );
  const [attribution, setAttribution] = useState<
    (typeof WELLNESS_ATTRIBUTION)[number]
  >("OWNER_CONFIRMED");
  const [suspectedDogIds, setSuspectedDogIds] = useState<string[]>([]);
  const [noIssues, setNoIssues] = useState(true);
  const [stoolColors, setStoolColors] = useState<string[]>([]);
  const [stoolConsistency, setStoolConsistency] = useState<string[]>([]);
  const [stoolContents, setStoolContents] = useState<string[]>([]);
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [appetite, setAppetite] = useState<string | null>(null);
  const [hydration, setHydration] = useState<string | null>(null);
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [stoolNotes, setStoolNotes] = useState("");
  const [showStoolDetails, setShowStoolDetails] = useState(false);
  const [diagnosisLabel, setDiagnosisLabel] = useState("");
  const [diagnosisSource, setDiagnosisSource] = useState<string | null>(null);
  const [diagnosisDate, setDiagnosisDate] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const dogOptions = useMemo(
    () => dogs.map((dog) => ({ value: dog.id, label: dog.name })),
    [dogs],
  );

  const handleScopeChange = (nextScope: typeof WELLNESS_REPORT_SCOPE[number]) => {
    if (nextScope === "DOG" && multiDogLocked) {
      setSubmitError("Upgrade to log weekly check-ins per dog.");
      return;
    }
    setScope(nextScope);
    setSubmitError(null);
    if (nextScope === "DOG") {
      if (!dogId && dogs.length > 0) {
        setDogId(dogs[0].id);
      }
    } else {
      setDogId(null);
    }
  };

  const handleNoIssuesToggle = (checked: boolean) => {
    setNoIssues(checked);
    setSubmitError(null);
    if (checked) {
      setStoolColors([]);
      setStoolConsistency([]);
      setStoolContents([]);
      setSymptomTags([]);
      setAppetite(null);
      setHydration(null);
      setBehaviorNotes("");
      setStoolNotes("");
      setDiagnosisLabel("");
      setDiagnosisSource(null);
      setDiagnosisDate("");
      setDiagnosisNotes("");
      setShowStoolDetails(false);
    }
  };

  const handleStoolDetailsToggle = (checked: boolean) => {
    setShowStoolDetails(checked);
    if (!checked) {
      setStoolColors([]);
      setStoolConsistency([]);
      setStoolContents([]);
      setStoolNotes("");
    }
  };

  const resetTemplateState = () => {
    setNoIssues(false);
    setStoolColors([]);
    setStoolConsistency([]);
    setStoolContents([]);
    setSymptomTags([]);
    setAppetite(null);
    setHydration(null);
    setBehaviorNotes("");
    setStoolNotes("");
    setDiagnosisLabel("");
    setDiagnosisSource(null);
    setDiagnosisDate("");
    setDiagnosisNotes("");
    setShowStoolDetails(false);
  };

  const applyQuickTemplate = (template: (typeof QUICK_TEMPLATES)[number]) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (template.label === "All normal") {
      handleNoIssuesToggle(true);
      return;
    }
    resetTemplateState();
    template.apply({
      setNoIssues,
      setShowStoolDetails,
      setStoolConsistency,
      setSymptomTags,
      setAppetite,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (scope === "DOG" && !dogId) {
      setSubmitError("Select a dog before submitting.");
      return;
    }

    const payload: Record<string, unknown> = {
      reportDate: new Date().toISOString(),
      scope,
      noIssues,
    };

    if (scope === "DOG") {
      payload.dogId = dogId;
      payload.attribution = attribution;
    } else if (!multiDogLocked && suspectedDogIds.length > 0) {
      payload.suspectedDogIds = suspectedDogIds;
    }

    if (!noIssues) {
      if (showStoolDetails) {
        payload.stoolColors = stoolColors;
        payload.stoolConsistency = stoolConsistency;
        payload.stoolContents = stoolContents;
        if (stoolNotes.trim().length) payload.stoolNotes = stoolNotes.trim();
      }
      payload.symptomTags = symptomTags;
      if (appetite) payload.appetite = appetite;
      if (hydration) payload.hydration = hydration;
      if (behaviorNotes.trim().length) payload.behaviorNotes = behaviorNotes.trim();
      if (diagnosisLabel.trim().length) {
        payload.diagnosisLabel = diagnosisLabel.trim();
        if (diagnosisSource) payload.diagnosisSource = diagnosisSource;
        if (diagnosisDate) {
          payload.diagnosisDate = new Date(diagnosisDate).toISOString();
        }
        if (diagnosisNotes.trim().length) {
          payload.diagnosisNotes = diagnosisNotes.trim();
        }
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/customer/wellness-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody?.error || "Unable to submit check-in. Please try again.",
        );
      }

      setSubmitSuccess(
        "Thanks for the update. We will match this to this week's samples.",
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit check-in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2 text-slate-200">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Weekly check-in
            </p>
            <h2 className="text-lg font-semibold text-white">
              Share anything you noticed
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Optional. This helps us pair owner notes with the weekly samples.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Quick taps
          </p>
          <p className="text-xs text-slate-400">
            Start with a common template if you&apos;re short on time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => applyQuickTemplate(template)}
              className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-white"
            >
              {template.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
        <h3 className="text-sm font-semibold text-white">Who is this about?</h3>
        <p className="mt-1 text-xs text-slate-400">
          Use household mode when you are not sure which dog it belongs to.
        </p>
        <RadioGroup
          value={scope}
          onValueChange={(value) =>
            handleScopeChange(value as typeof WELLNESS_REPORT_SCOPE[number])
          }
          className="mt-3 space-y-2"
        >
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            <RadioGroupItem value="HOUSEHOLD" />
            Whole yard (not sure which dog)
          </label>
          <label
            className={cn(
              "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm",
              multiDogLocked && "opacity-60",
            )}
          >
            <RadioGroupItem value="DOG" disabled={dogs.length === 0 || multiDogLocked} />
            Specific dog
          </label>
        </RadioGroup>
        {multiDogLocked && (
          <p className="mt-2 text-xs text-amber-300">
            Multi-dog weekly check-ins are part of Premium wellness.
          </p>
        )}

        {scope === "DOG" ? (
          <div className="mt-4 space-y-3">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Select dog
            </Label>
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
            {dogs.length === 0 && (
              <p className="text-xs text-slate-500">
                Add a pet in your profile to report per-dog observations.
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                How confident are you?
              </Label>
              <RadioGroup
                value={attribution}
                onValueChange={(value) =>
                  setAttribution(value as typeof WELLNESS_ATTRIBUTION[number])
                }
                className="space-y-2"
              >
                <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                  <RadioGroupItem value="OWNER_CONFIRMED" />
                  I am sure it was this dog
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                  <RadioGroupItem value="OWNER_GUESS" />
                  Best guess
                </label>
              </RadioGroup>
            </div>
          </div>
        ) : (
          dogs.length > 1 && (
            <div className="mt-4 space-y-3">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                If you have a hunch, select dog(s)
              </Label>
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
            </div>
          )
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Everything looked normal
            </h3>
            <p className="text-xs text-slate-400">
              Leave this on for a fast check-in. Turn it off to report symptoms.
            </p>
          </div>
          <Switch checked={noIssues} onCheckedChange={handleNoIssuesToggle} />
        </div>
      </section>

      {!noIssues && (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Symptoms noticed
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WELLNESS_SYMPTOMS.map((symptom) => (
                <label
                  key={symptom}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                >
                  <Checkbox
                    checked={symptomTags.includes(symptom)}
                    onCheckedChange={(checked) =>
                      toggleSelection(
                        symptom,
                        symptomTags,
                        setSymptomTags,
                        Boolean(checked),
                      )
                    }
                  />
                  {formatLabel(symptom)}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Appetite
                </Label>
                <Select value={appetite ?? undefined} onValueChange={setAppetite}>
                  <SelectTrigger className="bg-slate-950/70 text-slate-200">
                    <SelectValue placeholder="Select appetite" />
                  </SelectTrigger>
                  <SelectContent>
                    {WELLNESS_APPETITE.map((value) => (
                      <SelectItem key={value} value={value}>
                        {formatLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Hydration
                </Label>
                <Select value={hydration ?? undefined} onValueChange={setHydration}>
                  <SelectTrigger className="bg-slate-950/70 text-slate-200">
                    <SelectValue placeholder="Select hydration" />
                  </SelectTrigger>
                  <SelectContent>
                    {WELLNESS_HYDRATION.map((value) => (
                      <SelectItem key={value} value={value}>
                        {formatLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Behavior notes
            </Label>
            <Textarea
              value={behaviorNotes}
              onChange={(event) => setBehaviorNotes(event.target.value)}
              rows={3}
              placeholder="Low energy, unusual pacing, etc."
              className="mt-2 bg-slate-950/70 text-slate-200"
            />
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Add stool details (optional)
                </h3>
                <p className="text-xs text-slate-400">
                  Only if you noticed something the photo analysis missed.
                </p>
              </div>
              <Switch
                checked={showStoolDetails}
                onCheckedChange={handleStoolDetailsToggle}
              />
            </div>

            {showStoolDetails && (
              <div className="mt-4 space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Color
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {WELLNESS_STOOL_COLORS.map((color) => (
                      <label
                        key={color}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                      >
                        <Checkbox
                          checked={stoolColors.includes(color)}
                          onCheckedChange={(checked) =>
                            toggleSelection(
                              color,
                              stoolColors,
                              setStoolColors,
                              Boolean(checked),
                            )
                          }
                        />
                        {formatLabel(color)}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Consistency
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {WELLNESS_STOOL_CONSISTENCY.map((consistency) => (
                      <label
                        key={consistency}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                      >
                        <Checkbox
                          checked={stoolConsistency.includes(consistency)}
                          onCheckedChange={(checked) =>
                            toggleSelection(
                              consistency,
                              stoolConsistency,
                              setStoolConsistency,
                              Boolean(checked),
                            )
                          }
                        />
                        {formatLabel(consistency)}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Content
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {WELLNESS_STOOL_CONTENT.map((content) => (
                      <label
                        key={content}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                      >
                        <Checkbox
                          checked={stoolContents.includes(content)}
                          onCheckedChange={(checked) =>
                            toggleSelection(
                              content,
                              stoolContents,
                              setStoolContents,
                              Boolean(checked),
                            )
                          }
                        />
                        {formatLabel(content)}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Stool notes
                  </Label>
                  <Textarea
                    value={stoolNotes}
                    onChange={(event) => setStoolNotes(event.target.value)}
                    rows={3}
                    placeholder="Anything else you want us to know"
                    className="mt-2 bg-slate-950/70 text-slate-200"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <h3 className="text-sm font-semibold text-white">
              Vet diagnosis (optional)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Sharing confirmed diagnoses helps improve future insights.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Diagnosis label
                </Label>
                <Input
                  value={diagnosisLabel}
                  onChange={(event) => setDiagnosisLabel(event.target.value)}
                  placeholder="Example: Parasites, GI upset"
                  className="mt-2 bg-slate-950/70 text-slate-200"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Source
                  </Label>
                  <Select
                    value={diagnosisSource ?? undefined}
                    onValueChange={setDiagnosisSource}
                  >
                    <SelectTrigger className="bg-slate-950/70 text-slate-200">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {WELLNESS_DIAGNOSIS_SOURCE.map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">
                    Diagnosis date
                  </Label>
                  <Input
                    type="date"
                    value={diagnosisDate}
                    onChange={(event) => setDiagnosisDate(event.target.value)}
                    className="mt-2 bg-slate-950/70 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-400">
                  Notes
                </Label>
                <Textarea
                  value={diagnosisNotes}
                  onChange={(event) => setDiagnosisNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional details or treatment notes"
                  className="mt-2 bg-slate-950/70 text-slate-200"
                />
              </div>
            </div>
          </section>
        </>
      )}

      {submitError && (
        <section className="rounded-2xl border border-red-700/60 bg-red-900/20 p-4 text-sm text-red-200">
          {submitError}
        </section>
      )}
      {submitSuccess && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {submitSuccess}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
        >
          {isSubmitting
            ? "Submitting..."
            : noIssues
              ? "Confirm no issues"
              : "Submit weekly check-in"}
        </Button>
        <p className="text-center text-xs text-slate-400">
          You can update this any time during the week.
        </p>
      </div>
    </form>
  );
}
