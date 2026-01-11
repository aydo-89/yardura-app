"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ClipboardList,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import WellnessIndicatorPill, {
  type WellnessIndicator,
} from "@/components/dashboard/mobile/WellnessIndicatorPill";
import { WELLNESS_SYMPTOMS } from "@/lib/wellness/reports";

type DogOption = {
  id: string;
  name: string;
};

type WellnessAccessSummary = {
  tier: string;
  usage: { scansCount: number };
  limits: { scansPerMonth: number };
  maxDogs: number | null;
  planEndsAt: string | null;
};

type WellnessPrivacy = {
  shareWellnessCaptures: boolean;
  autoBlurWellnessPhotos: boolean;
};

type CaptureRecord = {
  id: string;
  capturedAt: string;
  analysisStatus: string;
  analysisResult: Record<string, unknown> | null;
  analysisConfidence: number | null;
  analysisModel: string | null;
  dogId: string | null;
  suspectedDogIds: string[];
  scope?: string | null;
  attribution?: string | null;
  symptomTags?: string[];
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  imageUrl: string | null;
};

type ParsedAnalysis = {
  color?: string;
  consistency?: string;
  content?: string;
  hydrationScore?: number;
  firmnessScale?: number;
  indicator?: WellnessIndicator;
  summary?: string;
  whatThisCouldMean?: string;
  tipsTonight?: string[];
  redFlags?: string[];
  wellnessFlag?: boolean;
  flagReason?: string | null;
  needsReview?: boolean;
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

const parseAnalysis = (result: Record<string, unknown> | null): ParsedAnalysis | null => {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;

  const indicatorRaw =
    typeof record.indicator === "string" ? record.indicator : undefined;
  const indicator =
    indicatorRaw === "watch" || indicatorRaw === "monitor" || indicatorRaw === "vet_now"
      ? indicatorRaw
      : undefined;

  return {
    color: typeof record.color === "string" ? record.color : undefined,
    consistency: typeof record.consistency === "string" ? record.consistency : undefined,
    content: typeof record.content === "string" ? record.content : undefined,
    hydrationScore:
      typeof record.hydration_score === "number" ? record.hydration_score : undefined,
    firmnessScale:
      typeof record.firmness_scale === "number" ? record.firmness_scale : undefined,
    indicator,
    summary: typeof record.summary === "string" ? record.summary : undefined,
    whatThisCouldMean:
      typeof record.what_this_could_mean === "string"
        ? record.what_this_could_mean
        : undefined,
    tipsTonight: Array.isArray(record.tips_tonight)
      ? record.tips_tonight.filter((tip) => typeof tip === "string")
      : undefined,
    redFlags: Array.isArray(record.red_flags)
      ? record.red_flags.filter((flag) => typeof flag === "string")
      : undefined,
    wellnessFlag: typeof record.wellness_flag === "boolean" ? record.wellness_flag : undefined,
    flagReason: typeof record.flag_reason === "string" ? record.flag_reason : null,
    needsReview: typeof record.needs_review === "boolean" ? record.needs_review : undefined,
  };
};

const PHOTO_TIPS = [
  "Stand directly above the sample",
  "Use natural light if possible",
  "Keep the sample centered in frame",
];

const QUICK_SYMPTOMS = [
  { label: "Low energy", tags: ["LETHARGY"] },
  { label: "Vomiting", tags: ["VOMITING"] },
  { label: "Appetite loss", tags: ["APPETITE_LOSS"] },
  { label: "Extra thirsty", tags: ["THIRST_INCREASE"] },
  { label: "Weight loss", tags: ["WEIGHT_LOSS"] },
];

export default function MobileWellnessCapture({
  dogs,
  access,
  privacy,
}: {
  dogs: DogOption[];
  access: WellnessAccessSummary;
  privacy: WellnessPrivacy;
}) {
  const defaultScope = dogs.length === 1 ? "DOG" : "HOUSEHOLD";
  const [scope, setScope] = useState<"HOUSEHOLD" | "DOG">(defaultScope);
  const [dogId, setDogId] = useState<string | null>(
    dogs.length === 1 ? dogs[0].id : null,
  );
  const [attribution, setAttribution] = useState<"OWNER_CONFIRMED" | "OWNER_GUESS">(
    "OWNER_CONFIRMED",
  );
  const [suspectedDogIds, setSuspectedDogIds] = useState<string[]>([]);
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usage, setUsage] = useState(access.usage);
  const [consentToShare, setConsentToShare] = useState(
    privacy.shareWellnessCaptures,
  );
  const [revealPhotos, setRevealPhotos] = useState(
    !privacy.autoBlurWellnessPhotos,
  );
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scansRemaining = Math.max(access.limits.scansPerMonth - usage.scansCount, 0);
  const scansPct =
    access.limits.scansPerMonth > 0
      ? Math.min(100, Math.round((usage.scansCount / access.limits.scansPerMonth) * 100))
      : 0;
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const selectedCapture = useMemo(() => {
    if (!captures.length) return null;
    if (!selectedCaptureId) return captures[0];
    return captures.find((capture) => capture.id === selectedCaptureId) ?? captures[0];
  }, [captures, selectedCaptureId]);

  const analysis = useMemo(
    () => parseAnalysis(selectedCapture?.analysisResult ?? null),
    [selectedCapture],
  );

  const hydrationScore =
    typeof analysis?.hydrationScore === "number" ? analysis.hydrationScore : null;

  const confidencePct = selectedCapture?.analysisConfidence
    ? Math.round(selectedCapture.analysisConfidence * 100)
    : null;

  const handlePhotoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    setSubmitError(null);
    if (file) {
      setSelectedCaptureId(null);
    }
  };

  const handleScopeChange = (value: "HOUSEHOLD" | "DOG") => {
    if (value === "DOG" && multiDogLocked) {
      setSubmitError("Upgrade to scan multiple pups.");
      return;
    }
    setScope(value);
    setSubmitError(null);
    if (value === "DOG" && !dogId && dogs.length > 0) {
      setDogId(dogs[0].id);
    }
    if (value === "HOUSEHOLD") {
      setDogId(null);
      setAttribution("OWNER_CONFIRMED");
    }
    if (value === "DOG") {
      setSuspectedDogIds([]);
    }
  };

  const handleUseLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location services are not available on this device.");
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        });
        setLocationLoading(false);
      },
      (error) => {
        setLocationError(error?.message || "Unable to capture location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async () => {
    if (!photoFile) {
      setSubmitError("Add a clear photo to start the scan.");
      return;
    }
    if (scope === "DOG" && !dogId) {
      setSubmitError("Select a dog before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("image", photoFile);
      formData.append("scope", scope);
      if (scope === "DOG" && dogId) {
        formData.append("dogId", dogId);
        formData.append("attribution", attribution);
      }
      if (scope === "HOUSEHOLD" && suspectedDogIds.length > 0) {
        formData.append("suspectedDogIds", JSON.stringify(suspectedDogIds));
      }
      if (symptomTags.length > 0) {
        formData.append("symptomTags", JSON.stringify(symptomTags));
      }
      if (notes.trim().length) {
        formData.append("notes", notes.trim());
      }
      if (location) {
        formData.append("lat", location.lat.toString());
        formData.append("lng", location.lng.toString());
        if (location.accuracy !== null) {
          formData.append("accuracy", location.accuracy.toString());
        }
      }
      formData.append("consentToShare", String(consentToShare));

      const response = await fetch("/api/customer/wellness-captures", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(
          data?.message || data?.error || "Unable to analyze this photo right now.",
        );
        if (data?.data?.usage) {
          setUsage(data.data.usage);
        }
        return;
      }

      const capture = data?.data?.capture as CaptureRecord | undefined;
      if (!capture) {
        setSubmitError("Unable to read analysis results.");
        return;
      }

      setCaptures((prev) => [capture, ...prev.filter((item) => item.id !== capture.id)]);
      setSelectedCaptureId(capture.id);
      setUsage((prev) => ({ ...prev, scansCount: prev.scansCount + 1 }));
    } catch (error) {
      setSubmitError("Unable to analyze this photo right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  useEffect(() => {
    let isMounted = true;
    setHistoryLoading(true);
    fetch("/api/customer/wellness-captures?limit=6")
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.ok && Array.isArray(data?.data?.captures)) {
          const fetched = data.data.captures as CaptureRecord[];
          setCaptures((prev) => {
            if (prev.length === 0) return fetched;
            const existing = new Set(prev.map((item) => item.id));
            const merged = [...prev];
            fetched.forEach((item) => {
              if (!existing.has(item.id)) {
                merged.push(item);
              }
            });
            return merged;
          });
        }
      })
      .catch(() => null)
      .finally(() => {
        if (isMounted) setHistoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Owner stool scan
            </p>
            <h2 className="text-lg font-semibold text-white">1-tap photo analysis</h2>
            <p className="text-sm text-slate-400">
              Snapshot a stool sample and get hydration, firmness, and guidance in seconds.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Scans this month</span>
            <span>
              {usage.scansCount}/{access.limits.scansPerMonth}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-400"
              style={{ width: `${scansPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {scansRemaining} scans left on the {access.tier.toLowerCase()} plan.
          </p>
          {access.planEndsAt && (
            <p className="mt-1 text-[11px] text-slate-500">
              Access through{" "}
              {new Date(access.planEndsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {access.maxDogs === 1 && dogs.length > 1 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Free scans are limited to one dog. Upgrade to scan multiple pups.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Which pup is this for?</h3>
          <p className="text-xs text-slate-400">
            Choose a specific dog, or keep it at the household level.
          </p>
        </div>

        <RadioGroup
          value={scope}
          onValueChange={(value) => handleScopeChange(value as "HOUSEHOLD" | "DOG")}
          className="space-y-2"
        >
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            <RadioGroupItem value="HOUSEHOLD" />
            Whole yard (not sure which dog)
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
            <RadioGroupItem value="DOG" disabled={dogs.length === 0 || multiDogLocked} />
            Specific dog
          </label>
        </RadioGroup>

        {scope === "DOG" ? (
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Select dog
            </Label>
            <Select value={dogId ?? undefined} onValueChange={setDogId}>
              <SelectTrigger className="bg-slate-950/70 text-slate-200">
                <SelectValue placeholder="Choose a dog" />
              </SelectTrigger>
              <SelectContent>
                {dogs.map((dog) => (
                  <SelectItem key={dog.id} value={dog.id}>
                    {dog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dogs.length === 0 && (
              <p className="text-xs text-slate-500">
                Add a pet profile to unlock per-dog scans.
              </p>
            )}
            {multiDogLocked && (
              <p className="text-xs text-amber-300">
                Multi-dog scans are a premium feature. Upgrade to tag each pup.
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                How confident are you?
              </Label>
              <RadioGroup
                value={attribution}
                onValueChange={(value) =>
                  setAttribution(value as "OWNER_CONFIRMED" | "OWNER_GUESS")
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
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">
                If you have a hunch, select dog(s)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {dogs.map((dog) => (
                  <label
                    key={dog.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                  >
                    <Checkbox
                      checked={suspectedDogIds.includes(dog.id)}
                      onCheckedChange={(checked) =>
                        toggleSelection(
                          dog.id,
                          suspectedDogIds,
                          setSuspectedDogIds,
                          Boolean(checked),
                        )
                      }
                    />
                    {dog.name}
                  </label>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Capture a photo</h3>
            <p className="text-xs text-slate-400">
              Get as close as possible and keep the sample centered in frame.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-700 text-slate-200 hover:border-emerald-400/50 hover:text-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" aria-hidden />
            Take photo
          </Button>
        </div>

        <ul className="text-xs text-slate-400 space-y-1">
          {PHOTO_TIPS.map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoPick}
        />

        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-slate-950/60",
            photoPreview ? "border-solid" : "border-dashed",
          )}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Stool capture preview" className="w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-slate-500">
              <ClipboardList className="h-6 w-6" aria-hidden />
              <p className="text-sm">No photo selected yet</p>
              <p className="text-xs">Use the camera button to capture one.</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
          disabled={!photoFile || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Analyzing..." : "Analyze stool photo"}
        </Button>

      {submitError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {submitError}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Optional add-ons</h3>
          <p className="text-xs text-slate-400">
            Add location for your yard map and confirm data-sharing preferences.
          </p>
        </div>
        <Link
          href="/mobile/dashboard/wellness/poop-map"
          className="text-xs text-emerald-300 hover:text-emerald-200"
        >
          View map
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-slate-700 text-slate-200 hover:border-emerald-400/50 hover:text-white"
          onClick={handleUseLocation}
          disabled={locationLoading}
        >
          {locationLoading ? "Saving..." : "Use current location"}
        </Button>
        {location && (
          <span className="text-xs text-slate-400">
            Location saved
            {location.accuracy
              ? ` (±${Math.round(location.accuracy * 3.28084)} ft)`
              : ""}
          </span>
        )}
      </div>

      {locationError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          {locationError}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <div>
          <p className="text-sm text-slate-200">Share this capture for insights</p>
          <p className="text-xs text-slate-500">
            Allow anonymized photos to improve wellness models.
          </p>
        </div>
        <Switch
          checked={consentToShare}
          onCheckedChange={(checked) => setConsentToShare(Boolean(checked))}
        />
      </div>
      <p className="text-[11px] text-slate-500">
        Manage defaults in{" "}
        <Link href="/mobile/dashboard/wellness/review" className="text-emerald-300">
          Privacy settings
        </Link>
        .
      </p>
    </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Symptoms & notes</h3>
          <p className="text-xs text-slate-400">
            Optional, but helps connect this photo with any symptoms.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_SYMPTOMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                const next = new Set(symptomTags);
                item.tags.forEach((tag) => {
                  if (WELLNESS_SYMPTOMS.includes(tag as any)) {
                    next.add(tag);
                  }
                });
                setSymptomTags(Array.from(next));
              }}
              className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-white"
            >
              + {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
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

        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Notes for your vet (optional)
          </Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: Soft stool after a new treat, low appetite today."
            className="mt-2 bg-slate-950/70 text-slate-200"
          />
        </div>
      </section>

      {selectedCapture && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Latest scan
              </p>
              <h3 className="text-lg font-semibold text-white">
                {selectedCapture.analysisStatus === "FAILED"
                  ? "Scan failed"
                  : analysis?.summary ?? "Processing scan"}
              </h3>
              <p className="text-xs text-slate-400">
                {new Date(selectedCapture.capturedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {analysis?.indicator && (
                <WellnessIndicatorPill indicator={analysis.indicator} size="md" />
              )}
              {privacy.autoBlurWellnessPhotos && (
                <button
                  type="button"
                  onClick={() => setRevealPhotos((prev) => !prev)}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200"
                >
                  {revealPhotos ? "Blur photos" : "Reveal photos"}
                </button>
              )}
            </div>
          </div>

          {selectedCapture.imageUrl && (
            <img
              src={selectedCapture.imageUrl}
              alt="Captured stool sample"
              className={cn(
                "w-full rounded-2xl border border-slate-800 object-cover transition",
                privacy.autoBlurWellnessPhotos && !revealPhotos
                  ? "blur-lg scale-105"
                  : "blur-0",
              )}
            />
          )}

          {analysis?.needsReview && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              We need a clearer photo to confirm results. Try retaking in brighter light.
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <p className="uppercase tracking-wide text-[10px] text-slate-500">
                    Color
                  </p>
                  <p className="text-slate-100 font-semibold">
                    {analysis.color ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <p className="uppercase tracking-wide text-[10px] text-slate-500">
                    Consistency
                  </p>
                  <p className="text-slate-100 font-semibold">
                    {analysis.consistency ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <p className="uppercase tracking-wide text-[10px] text-slate-500">
                    Content
                  </p>
                  <p className="text-slate-100 font-semibold">
                    {analysis.content ?? "—"}
                  </p>
                </div>
              </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Hydration score</span>
                  <span>{hydrationScore ?? "—"}/100</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-400"
                    style={{
                      width: `${Math.min(100, hydrationScore ?? 0)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Firmness scale</span>
                  <span>{analysis.firmnessScale ?? "—"}/7</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const level = index + 1;
                    const active = analysis.firmnessScale
                      ? level <= analysis.firmnessScale
                      : false;
                    return (
                      <span
                        key={level}
                        className={cn(
                          "h-2 flex-1 rounded-full",
                          active ? "bg-amber-400" : "bg-slate-800",
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {analysis.whatThisCouldMean && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    What this could mean
                  </p>
                  <p className="mt-2">{analysis.whatThisCouldMean}</p>
                </div>
              )}

              {analysis.tipsTonight && analysis.tipsTonight.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    What to do tonight
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {analysis.tipsTonight.map((tip) => (
                      <li key={tip}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.redFlags && analysis.redFlags.length > 0 && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
                  <div className="flex items-center gap-2 text-rose-200">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Red flags spotted
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-rose-100">
                    {analysis.redFlags.map((flag) => (
                      <li key={flag}>• {formatLabel(flag)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {confidencePct !== null && (
                <p className="text-xs text-slate-500">
                  Confidence: {confidencePct}% · AI guidance is not a diagnosis.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
        <p className="text-sm font-semibold text-white">Not a diagnosis</p>
        <p className="mt-1">
          Seek vet care for blood in stool, black/tarry stool, repeated vomiting,
          or if your dog seems very unwell.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
        <p className="text-sm font-semibold text-white">Privacy-first storage</p>
        <p className="mt-1">
          Photos stay private by default. You control auto-blur and whether
          anonymized samples help improve wellness models.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2 text-slate-200">
            <Camera className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent scans</h3>
            <p className="text-xs text-slate-400">
              Tap a scan to revisit the summary.
            </p>
          </div>
        </div>

        {historyLoading ? (
          <p className="text-xs text-slate-500">Loading scans...</p>
        ) : captures.length === 0 ? (
          <p className="text-xs text-slate-500">No scans yet.</p>
        ) : (
          <div className="space-y-2">
            {captures.map((capture) => {
              const parsed = parseAnalysis(capture.analysisResult);
              const isActive = capture.id === selectedCapture?.id;
              const summary =
                capture.analysisStatus === "FAILED"
                  ? "Scan failed"
                  : parsed?.summary ?? "Processing scan";
              return (
                <button
                  key={capture.id}
                  type="button"
                  onClick={() => setSelectedCaptureId(capture.id)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                    isActive
                      ? "border-emerald-400/50 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/70 hover:border-slate-700",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">
                        {new Date(capture.capturedAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-slate-100">
                        {summary}
                      </p>
                    </div>
                    {parsed?.indicator && (
                      <WellnessIndicatorPill indicator={parsed.indicator} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
