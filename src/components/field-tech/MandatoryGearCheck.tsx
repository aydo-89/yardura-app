"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  MapPin,
  PackageCheck,
  PackageMinus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SinglePhotoCamera } from "@/app/field-tech/components/SinglePhotoCamera";
import { LostGearFlow } from "./LostGearFlow";

interface MandatoryGearCheckProps {
  onComplete: (data: { file: File; location?: { latitude: number; longitude: number } }) => Promise<void>;
  uploading: boolean;
  scheduledJobsCount?: number;
  onLostGearOrder?: (missingItems: string[], totalCost: number) => Promise<void>;
  onReturnJobs?: () => Promise<void>;
}

type GearStatus = "ready" | "restock" | "missing";
type GearKey =
  | "scooperKit"
  | "bags"
  | "gloves"
  | "sanitation"
  | "enzyme"
  | "sprayer";

const GEAR_ITEMS: Array<{
  key: GearKey;
  label: string;
  description: string;
  requiresStop?: boolean;
}> = [
  {
    key: "scooperKit",
    label: "Scooper bucket + mount + Bluetooth remote",
    description:
      "Required for hands-free capture. If you're missing the mount or remote, operate InsightScoop manually via the on-screen shutter or the volume button until you replace it.",
  },
  {
    key: "bags",
    label: "Biodegradable bags",
    description:
      "Used for client bins and haul-away services. Keep a backup roll so you never run out mid-route.",
  },
  {
    key: "gloves",
    label: "Disposable gloves",
    description:
      "Fresh gloves for every visit keep our sanitation standard in place.",
  },
  {
    key: "sanitation",
    label: "Kennel-grade sanitation concentrate",
    description:
      "Mandatory between every visit. Restock before you start if you're low or out - no sanitation means no payout.",
    requiresStop: true,
  },
  {
    key: "enzyme",
    label: "Pet-safe enzyme deodorizer",
    description:
      "Applied after scoops for odor control. Pick up more before your first stop if you're out.",
    requiresStop: true,
  },
  {
    key: "sprayer",
    label: "Pressurized sprayer",
    description:
      "Delivers sanitation and deodorizer evenly. You must have this on the truck before heading out.",
    requiresStop: true,
  },
];

type GearSelections = Record<GearKey, GearStatus | null>;

const INITIAL_SELECTIONS: GearSelections = {
  scooperKit: null,
  bags: null,
  gloves: null,
  sanitation: null,
  enzyme: null,
  sprayer: null,
};

export function MandatoryGearCheck({
  onComplete,
  uploading,
  scheduledJobsCount = 0,
  onLostGearOrder,
  onReturnJobs,
}: MandatoryGearCheckProps) {
  const [step, setStep] = useState<"gear" | "location" | "complete">("gear");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showLostGearFlow, setShowLostGearFlow] = useState(false);
  const [gearSelections, setGearSelections] = useState<GearSelections>(INITIAL_SELECTIONS);

  const handleCapture = useCallback(async (file: File) => {
    const preview = URL.createObjectURL(file);
    setCapturedImage(preview);
    setCaptureFile(file);
  }, []);

  const handleRetake = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCaptureFile(null);
  }, [capturedImage]);

  const criticalMissing = useMemo(
    () =>
      GEAR_ITEMS.filter((item) => item.requiresStop).some(
        (item) => gearSelections[item.key] && gearSelections[item.key] !== "ready",
      ),
    [gearSelections],
  );

  const unresolvedSelections = useMemo(
    () => GEAR_ITEMS.some((item) => gearSelections[item.key] === null),
    [gearSelections],
  );

  const advisoryMessages = useMemo(() => {
    const messages: string[] = [];
    const kitStatus = gearSelections.scooperKit;
    if (kitStatus && kitStatus !== "ready") {
      messages.push(
        kitStatus === "missing"
          ? "Bring a spare bucket or container and use manual camera controls until your kit is replaced."
          : "Flag a replacement kit with ops after today’s route and use manual controls in the meantime.",
      );
    }
    if (gearSelections.bags && gearSelections.bags !== "ready") {
      messages.push("Pick up a backup roll of biodegradable bags before tomorrow’s haul-away stops.");
    }
    if (gearSelections.gloves && gearSelections.gloves !== "ready") {
      messages.push("Grab fresh gloves - sanitation requires a new pair at every visit.");
    }
    return messages;
  }, [gearSelections]);

  const handleGearConfirm = useCallback(() => {
    if (!captureFile) {
      toast.error("Take your selfie before continuing.");
      return;
    }

    if (unresolvedSelections) {
      toast.error("Confirm every supply status before you continue.");
      return;
    }

    if (criticalMissing) {
      toast.error("Restock sanitation supplies before starting your route.");
      return;
    }

    setStep("location");
  }, [captureFile, criticalMissing, unresolvedSelections]);

  const getStartLocation = useCallback(async () => {
    setGettingLocation(true);
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location services not available");
      setGettingLocation(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              reject(new Error("Location permission denied. Enable location services in Settings."));
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              reject(new Error("Location unavailable. Make sure GPS is enabled."));
            } else if (error.code === error.TIMEOUT) {
              reject(new Error("Location request timed out. Try again."));
            } else {
              reject(error);
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          },
        );
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      toast.success("Start location captured");
    } catch (error: any) {
      console.error("location.start", error);
      setLocationError(error?.message ?? "Unable to get location");
      toast.error(error?.message ?? "Unable to get location");
    } finally {
      setGettingLocation(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!captureFile) {
      toast.error("Take your selfie before completing check-in.");
      return;
    }
    await onComplete({ file: captureFile, location: location ?? undefined });
  }, [captureFile, location, onComplete]);

  useEffect(() => {
    if (step === "location" && !location && !gettingLocation && !locationError) {
      getStartLocation();
    }
  }, [step, location, gettingLocation, locationError, getStartLocation]);

  const handleLostGearOrder = useCallback(
    async (missingItems: string[], totalCost: number) => {
      if (onLostGearOrder) {
        await onLostGearOrder(missingItems, totalCost);
      }
      setShowLostGearFlow(false);
      setGearSelections((prev) => ({ ...prev, sanitation: "ready", enzyme: "ready", sprayer: "ready" }));
    },
    [onLostGearOrder],
  );

  const handleReturnJobs = useCallback(async () => {
    if (onReturnJobs) {
      await onReturnJobs();
    }
    setShowLostGearFlow(false);
  }, [onReturnJobs]);

  if (showLostGearFlow) {
    return (
      <LostGearFlow
        onCancel={() => setShowLostGearFlow(false)}
        onOrderAndContinue={handleLostGearOrder}
        onReturnJobs={handleReturnJobs}
        scheduledJobsCount={scheduledJobsCount}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="px-6 py-8 text-center space-y-3">
        <h1 className="text-2xl font-bold text-white">
          {step === "gear" ? "Daily Check-In" : "Ready to start your route?"}
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          {step === "gear"
            ? "Snap a selfie with your InsightScoop hat, badge, and branded top in frame."
            : "Check in so ops know where you're kicking off and can plan your finish for the day."}
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm">
          {step === "gear" && (
            <>
              <SinglePhotoCamera
                onCapture={handleCapture}
                label="Take gear selfie"
                defaultFacing="user"
                capturedImageUrl={capturedImage}
                uploading={uploading}
              />

              <div className="mt-6 space-y-5">
                <section className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">Photo reminders</p>
                    <ul className="mt-3 space-y-2 text-xs text-white/70">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-300 flex-shrink-0">•</span>
                        <span>Hat, badge, and branded shirt or hoodie clearly visible.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-300 flex-shrink-0">•</span>
                        <span>Bright, even lighting - avoid harsh shadows or blur.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-300 flex-shrink-0">•</span>
                        <span>Center your upper body so credentials are easy to read.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    {GEAR_ITEMS.map((item) => {
                      const status = gearSelections[item.key];
                      return (
                        <div
                          key={item.key}
                          className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.label}</p>
                              <p className="mt-1 text-xs text-white/60">{item.description}</p>
                            </div>
                            {status ? <BadgeChip status={status} /> : null}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <StatusButton
                              active={status === "ready"}
                              tone="ready"
                              onClick={() =>
                                setGearSelections((prev) => ({
                                  ...prev,
                                  [item.key]: "ready",
                                }))
                              }
                            >
                              Ready
                            </StatusButton>
                            <StatusButton
                              active={status === "restock"}
                              tone="restock"
                              onClick={() =>
                                setGearSelections((prev) => ({
                                  ...prev,
                                  [item.key]: "restock",
                                }))
                              }
                            >
                              Need restock
                            </StatusButton>
                            <StatusButton
                              active={status === "missing"}
                              tone="missing"
                              onClick={() =>
                                setGearSelections((prev) => ({
                                  ...prev,
                                  [item.key]: "missing",
                                }))
                              }
                            >
                              Missing
                            </StatusButton>
                          </div>
                          {item.requiresStop && status && status !== "ready" ? (
                            <p className="text-xs text-amber-300">
                              Sanitation supplies are required. Restock before you head out.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {advisoryMessages.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
                    <p className="mb-2 font-semibold text-emerald-100">Heads-up for today</p>
                    <ul className="space-y-2">
                      {advisoryMessages.map((message, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <PackageCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>{message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {criticalMissing ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Sanitation required
                    </p>
                    <p className="mt-1 text-amber-200/80">
                      Restock sanitation supplies before you can start routes or capture gate photos.
                    </p>
                  </div>
                ) : null}

                {unresolvedSelections && !criticalMissing ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    <p className="flex items-center gap-2">
                      <PackageMinus className="h-4 w-4" />
                      Confirm each item to continue.
                    </p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleRetake}
                    variant="outline"
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20"
                  >
                    Retake photo
                  </Button>
                  <Button
                    onClick={handleGearConfirm}
                    disabled={
                      uploading ||
                      !capturedImage ||
                      unresolvedSelections ||
                      criticalMissing
                    }
                    className="h-12 rounded-2xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Continue
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => setShowLostGearFlow(true)}
                  className="w-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Can't complete check-in? Missing gear?
                </Button>
              </div>
            </>
          )}

          {step === "location" && (
            <div className="space-y-6">
              {gettingLocation && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
                  <Loader2 className="h-12 w-12 text-emerald-300 mx-auto mb-4 animate-spin" />
                  <p className="text-sm font-semibold text-emerald-200 mb-2">
                    Checking you in...
                  </p>
                  <p className="text-xs text-emerald-300/70">
                    We use this to map your starting point and wrap-up plan for today’s route.
                  </p>
                </div>
              )}

              {location && !gettingLocation && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <MapPin className="h-8 w-8 text-emerald-300" />
                    <Check className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-200 mb-1">
                      Check-in confirmed!
                    </p>
                    <p className="text-xs text-emerald-300/70">
                      We’ll share your starting point with dispatch so the route ends near your last stop.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={uploading}
                    className="w-full h-12 rounded-2xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Checking in...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Complete Check-In
                      </>
                    )}
                  </Button>
                </div>
              )}

              {locationError && !gettingLocation && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-red-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-red-200 mb-2">
                      Location Error
                    </p>
                    <p className="text-xs text-red-300/70 mb-4">
                      {locationError}
                    </p>
                    <Button
                      onClick={getStartLocation}
                      variant="outline"
                      className="w-full border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    >
                      Try Again
                    </Button>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={uploading}
                    variant="ghost"
                    className="w-full text-white/60 hover:text-white"
                  >
                    Skip location (not recommended)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-white/10">
        <div className="max-w-sm mx-auto space-y-2">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
            {step === "gear" ? "Gear requirements" : "Why we capture location"}
          </p>
          {step === "gear" && (
            <ul className="space-y-1.5 text-xs text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                <span>Photo: hat, badge, and branded shirt or hoodie clearly visible.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                <span>Checklist: confirm every supply so ops can support you before routes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                <span>Sanitation supplies are non-negotiable - restock before the first stop.</span>
              </li>
            </ul>
          )}
          {step === "location" && (
            <ul className="space-y-1.5 text-xs text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Anchors your starting point so ops can plan your finish for the day.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Keeps dispatch in sync if we need to reshuffle stops.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Gives ops a record of where your day started in case support is needed later.</span>
              </li>
            </ul>
          )}
        </div>
      </footer>
    </div>
  );
}

type StatusButtonProps = {
  active: boolean;
  tone: GearStatus;
  children: ReactNode;
  onClick: () => void;
};

function StatusButton({ active, tone, children, onClick }: StatusButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl border text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        tone === "ready" && "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
        tone === "restock" && "border-amber-400/40 bg-amber-500/15 text-amber-200",
        tone === "missing" && "border-rose-400/40 bg-rose-500/15 text-rose-200",
        !active && "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function BadgeChip({ status }: { status: GearStatus }) {
  const label =
    status === "ready" ? "Ready" : status === "restock" ? "Restock" : "Missing";
  const toneClasses =
    status === "ready"
      ? "bg-emerald-500/20 text-emerald-200"
      : status === "restock"
        ? "bg-amber-500/20 text-amber-200"
        : "bg-rose-500/20 text-rose-200";

  return (
    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", toneClasses)}>
      {label}
    </span>
  );
}
