"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Camera, MessageCircle, Star } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import type { VisitDetailForUser } from "@/lib/service-visits/getVisitDetail";
import {
  extractPreferredTimeWindow,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";

interface VisitDetailClientProps {
  visit: VisitDetailForUser;
}

export default function VisitDetailClient({ visit }: VisitDetailClientProps) {
  const router = useRouter();
  const scheduledDate = useMemo(
    () => new Date(visit.scheduledDate),
    [visit.scheduledDate],
  );
  const completedDate = useMemo(
    () => (visit.completedDate ? new Date(visit.completedDate) : null),
    [visit.completedDate],
  );
  const preferredWindow = useMemo(() => {
    const { slug, label } = extractPreferredTimeWindow({
      preferredTimeWindowSlug: visit.preferredTimeWindowSlug,
      preferredTimeWindow: visit.preferredTimeWindow,
    });
    const shortLabel = resolvePreferredTimeWindowShortLabel(slug, label);
    return shortLabel ? `${shortLabel} window` : null;
  }, [visit.preferredTimeWindow, visit.preferredTimeWindowSlug]);
  const [ratingScore, setRatingScore] = useState<number | null>(
    visit.rating?.score ?? null,
  );
  const [ratingComment, setRatingComment] = useState(
    visit.rating?.comment ?? "",
  );
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(Boolean(visit.rating));

  const handleSubmitRating = async () => {
    if (!ratingScore || ratingSubmitting) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const response = await fetch(
        `/api/customer/visits/${visit.id}/rating`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score: ratingScore,
            comment: ratingComment.trim() ? ratingComment.trim() : null,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setRatingError(payload?.error ?? "Unable to submit rating.");
        return;
      }
      setRatingSubmitted(true);
    } catch (error) {
      setRatingError("Unable to submit rating.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 pb-24">
      <Button
        variant="ghost"
        className="w-fit gap-2 px-0"
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Button>

      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Visit summary</h1>
        <p className="text-sm text-muted-foreground">
          {format(scheduledDate, "EEEE, MMMM d")}
          {preferredWindow ? ` • ${preferredWindow}` : ""}
        </p>
        <Badge variant="secondary" className="w-fit uppercase tracking-wide">
          {visit.status.toLowerCase()}
        </Badge>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>3Cs insight</CardTitle>
            <CardDescription>
              Logged by your field tech after the visit. Flags generate support follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {visit.insight ? (
              <>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-muted-foreground">Color</span>
                  <span className="font-medium">{visit.insight.colorIndicator}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-muted-foreground">Consistency</span>
                  <span className="font-medium">
                    {visit.insight.consistencyIndicator}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-muted-foreground">Content</span>
                  <span className="font-medium">
                    {visit.insight.contentIndicator}
                  </span>
                </div>
                {visit.insight.observations ? (
                  <div className="rounded-lg border px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">
                      Notes
                    </p>
                    <p className="text-sm">{visit.insight.observations}</p>
                  </div>
                ) : null}
                {visit.insight.wellnessFlag ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                    <p className="text-xs uppercase text-amber-700">
                      Flagged for review
                    </p>
                    <p className="text-sm text-amber-900">
                      {visit.insight.flagReason ||
                        "Our support team is reviewing this visit."}
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Recorded {format(new Date(visit.insight.recordedAt), "MMM d, h:mmaaa")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Insight data will appear here once the field team logs the 3Cs checklist.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visit timeline</CardTitle>
            <CardDescription>
              Completion unlocks proof shots and the SMS recap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border px-3 py-2">
              <p className="text-xs uppercase text-muted-foreground">Scheduled</p>
              <p>{format(scheduledDate, "MMM d, yyyy")}</p>
              {preferredWindow ? (
                <p className="text-xs text-muted-foreground">
                  Window: {preferredWindow}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-xs uppercase text-muted-foreground">Completed</p>
              <p>
                {completedDate
                  ? format(completedDate, "MMM d, yyyy")
                  : "Pending"}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-xs uppercase text-muted-foreground">Service type</p>
              <p className="capitalize">{visit.serviceType.toLowerCase()}</p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-xs uppercase text-muted-foreground">Yard size</p>
              <p className="capitalize">{visit.yardSize.toLowerCase()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {visit.status === "COMPLETED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Rate your scooper</CardTitle>
            <CardDescription>
              Optional—share feedback and earn care credits for completed visits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                const isActive = (ratingScore ?? 0) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (!ratingSubmitted) {
                        setRatingScore(value);
                      }
                    }}
                    className="text-amber-400 transition"
                    aria-label={`Rate ${value} stars`}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        isActive ? "fill-amber-400" : "fill-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {ratingSubmitted ? (
              <p className="text-xs text-muted-foreground">
                Thanks for rating! Your feedback helps us keep service quality high.
              </p>
            ) : (
              <>
                <Textarea
                  value={ratingComment}
                  onChange={(event) => setRatingComment(event.target.value)}
                  placeholder="Optional note for the team"
                  rows={3}
                />
                {ratingError ? (
                  <p className="text-xs text-rose-500">{ratingError}</p>
                ) : null}
                <Button
                  onClick={handleSubmitRating}
                  disabled={!ratingScore || ratingSubmitting}
                >
                  {ratingSubmitting ? "Submitting..." : "Submit rating"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Proof photos
            </CardTitle>
            <CardDescription>
              Gate close photos and InsightScoop detail shots expire after 10 minutes for security.
            </CardDescription>
          </div>
          <Badge variant="secondary">{visit.media.length} photos</Badge>
        </CardHeader>
        <CardContent>
          {visit.media.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Photos will appear once your technician uploads them.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visit.media.map((media) => (
                <figure
                  key={media.id}
                  className="overflow-hidden rounded-lg border"
                >
                  {media.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.url}
                      alt={`${media.assetType} photo`}
                      className="h-48 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                      Photo ready shortly
                    </div>
                  )}
                  <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                    <span>{labelForMedia(media.assetType)}</span>
                    <span>{format(new Date(media.capturedAt), "h:mmaaa")}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> SMS status
            </CardTitle>
            <CardDescription>
              Post-visit messages include your gate photo and InsightScoop recap.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {visit.communications.length === 0 ? (
            <p className="text-muted-foreground">
              You&apos;ll see message events here as soon as the visit closes.
            </p>
          ) : (
            visit.communications.map((message) => (
              <div key={message.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="uppercase">
                      {message.channel.toLowerCase()}
                    </Badge>
                    <span className="font-medium">
                      {message.status.toLowerCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {message.sentAt
                      ? format(new Date(message.sentAt), "MMM d, h:mmaaa")
                      : "Pending"}
                  </span>
                </div>
                {message.statusDetail ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {message.statusDetail.replaceAll("_", " ")}
                  </p>
                ) : null}
                {message.deliveryConfirmedAt ? (
                  <p className="mt-2 text-xs text-emerald-600">
                    Delivered {format(new Date(message.deliveryConfirmedAt), "h:mmaaa")}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Need a re-clean or have feedback? Reply directly to the visit SMS or
          email <a href="mailto:hello@yardura.com" className="text-primary underline">hello@yardura.com</a>.
        </p>
      </div>
    </main>
  );
}

function labelForMedia(assetType: string) {
  switch (assetType) {
    case "INSIGHTSCOOP":
      return "Insight detail";
    case "PROOF":
      return "Proof shot";
    case "GATE":
      return "Gate closed";
    case "ARRIVAL":
      return "Arrival";
    case "ISSUE":
      return "Issue";
    default:
      return "Photo";
  }
}
