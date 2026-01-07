import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { differenceInMinutes, format } from "date-fns";
import { ArrowLeft, User, MapPin, Calendar, Eye, MessageSquare, AlertTriangle, CheckCircle } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { createSignedUrl } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { ResetVisitButton } from "@/components/admin/ResetVisitButton";

export default async function AdminVisitDetailPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const session = await safeGetServerSession(authOptions as any);
  const userRole = (session as any)?.userRole ?? (session?.user as any)?.role;

  if (!session?.user || !["OWNER", "ADMIN"].includes(userRole)) {
    redirect("/signin");
  }

  const { visitId } = await params;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      media: {
        orderBy: { capturedAt: "asc" },
      },
      insights: true,
      communications: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!visit || !visit.customer) {
    notFound();
  }

  const metadata =
    visit.metadata && typeof visit.metadata === "object" && !Array.isArray(visit.metadata)
      ? (visit.metadata as Record<string, unknown>)
      : null;
  const arrivalVerifiedAt =
    metadata && typeof metadata.arrivalVerifiedAt === "string"
      ? new Date(metadata.arrivalVerifiedAt)
      : null;
  const onSiteMinutes =
    visit.actualStart && visit.actualEnd
      ? Math.max(1, differenceInMinutes(visit.actualEnd, visit.actualStart))
      : null;

  // Generate signed URLs for media
  const bucket = env.STORAGE_BUCKET;
  const mediaWithUrls = await Promise.all(
    visit.media.map(async (item) => {
      let url: string | null = null;
      if (bucket) {
        try {
          url = await createSignedUrl(bucket, item.storagePath, 60 * 60 * 24); // 24 hours
        } catch (error) {
          console.error("Failed to sign media URL", { mediaId: item.id, error });
        }
      }
      return { ...item, url };
    })
  );

  const gatePhotos = mediaWithUrls.filter((m) => m.assetType === "GATE");
  const proofPhotos = mediaWithUrls.filter((m) => m.assetType === "PROOF");
  const insightPhotos = mediaWithUrls.filter((m) => m.assetType === "INSIGHTSCOOP");
  const issuePhotos = mediaWithUrls.filter((m) => m.assetType === "ISSUE");
  const otherPhotos = mediaWithUrls.filter((m) => m.assetType === "OTHER");

  const insight = visit.insights[0];

  // Customer-facing samples link
  const samplesUrl = `https://www.getinsightscoop.com/visits/${visit.id}/samples`;

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto max-w-7xl px-6 pb-10 pt-20">
          <Link
            href={`/admin/customers/${visit.customer.id}`}
            className="inline-flex items-center gap-2 text-sm text-brand-coral hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {visit.customer.name}
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
                Visit Details
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {format(visit.scheduledDate, "MMMM d, yyyy")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <Badge
                className={
                  visit.status === "COMPLETED"
                    ? "bg-brand-mint text-white"
                    : visit.status === "IN_PROGRESS"
                    ? "bg-brand-coral/10 text-brand-coral"
                    : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                }
                variant={visit.status === "COMPLETED" ? "default" : "outline"}
              >
                {visit.status}
              </Badge>
              <ResetVisitButton visitId={visit.id} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl p-6">

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Visit Info */}
        <div className="md:col-span-1 space-y-6">
          {/* Customer Info */}
          <Card className="admin-card">
<CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Link
                  href={`/admin/customers/${visit.customer.id}`}
                  className="font-semibold text-brand-coral hover:text-brand-coral/80"
                >
                  {visit.customer.name}
                </Link>
              </div>
              {visit.customer.email && (
                <div className="text-muted-foreground">{visit.customer.email}</div>
              )}
              {visit.customer.phone && (
                <div className="text-muted-foreground">{visit.customer.phone}</div>
              )}
              <Separator />
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {visit.customer.addressLine1}
                  <br />
                  {visit.customer.city}, {visit.customer.state} {visit.customer.zip}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visit Info */}
          <Card className="admin-card">
<CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Visit Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Scheduled:</span>{" "}
                <span className="font-medium">
                  {format(visit.scheduledDate, "MMM d, yyyy")}
                </span>
              </div>
              {visit.actualStart && (
                <div>
                  <span className="text-muted-foreground">Started:</span>{" "}
                  <span className="font-medium">
                    {format(visit.actualStart, "h:mm a")}
                  </span>
                </div>
              )}
              {visit.actualEnd && (
                <div>
                  <span className="text-muted-foreground">Completed:</span>{" "}
                  <span className="font-medium">
                    {format(visit.actualEnd, "h:mm a")}
                  </span>
                </div>
              )}
              {arrivalVerifiedAt && (
                <div>
                  <span className="text-muted-foreground">Arrival verified:</span>{" "}
                  <span className="font-medium">
                    {format(arrivalVerifiedAt, "h:mm a")}
                  </span>
                </div>
              )}
              {onSiteMinutes !== null && (
                <div>
                  <span className="text-muted-foreground">On-site duration:</span>{" "}
                  <span className="font-medium">{onSiteMinutes} min</span>
                </div>
              )}
              <Separator />
              <div>
                <span className="text-muted-foreground">Tech:</span>{" "}
                <span className="font-medium">{visit.assignedTo?.name || "Unassigned"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Frequency:</span>{" "}
                <span className="font-medium capitalize">{visit.job?.frequency}</span>
              </div>
            </CardContent>
          </Card>

          {/* SMS Communications */}
          {visit.communications.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Sent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {visit.communications.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-3 rounded-lg bg-slate-50 border dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {comm.channel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(comm.createdAt, "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {comm.messageBody}
                    </p>
                    {comm.status && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Status: {comm.status}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Media & Insights */}
        <div className="md:col-span-2 space-y-6">
          {/* 3C Summary */}
          {insight && (
            <Card className="admin-card">
<CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>InsightScoop Summary</CardTitle>
                    <CardDescription>
                      Health assessment from this visit
                    </CardDescription>
                  </div>
                  {insight.wellnessFlag && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Flagged
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 3Cs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-brand-mint/10 border border-brand-mint/30">
                    <div className="text-xs font-medium text-brand-mint mb-1">Color</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {insight.colorIndicator || "N/A"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <div className="text-xs font-medium text-blue-700 mb-1 dark:text-blue-200">Consistency</div>
                    <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {insight.consistencyIndicator || "N/A"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 dark:border-purple-900/50 dark:bg-purple-950/30">
                    <div className="text-xs font-medium text-purple-700 mb-1 dark:text-purple-200">Content</div>
                    <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                      {insight.contentIndicator || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Observations */}
                {insight.observations && (
                  <div className="p-4 rounded-lg bg-slate-50 border dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-700 mb-2 dark:text-slate-200">
                      Observations
                    </div>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {insight.observations}
                    </p>
                  </div>
                )}

                {/* Wellness Flag */}
                {insight.wellnessFlag && insight.flagReason && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 dark:text-amber-300" />
                      <div>
                        <div className="text-xs font-medium text-amber-700 mb-1 dark:text-amber-200">
                          Wellness Alert
                        </div>
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          {insight.flagReason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analysis Metadata */}
                {insight.source && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Source: {insight.source === "AUTOMATED" ? "AI Analysis" : "Manual Entry"}
                    </span>
                    {insight.autoConfidence && (
                      <span>Confidence: {(insight.autoConfidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                )}

                {/* Customer Link */}
                <Button asChild variant="outline" className="w-full">
                  <a href={samplesUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" />
                    View Customer-Facing Samples Page
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* InsightScoop Photos */}
          {insightPhotos.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle>InsightScoop Samples ({insightPhotos.length})</CardTitle>
                <CardDescription>AI-analyzed samples from this visit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {insightPhotos.map((media, idx) => {
                    const result = media.analysisResult as any;
                    return (
                      <div key={media.id} className="space-y-2">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                          {media.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={media.url}
                              alt={`Sample ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                              Image unavailable
                            </div>
                          )}
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="font-medium">Sample {idx + 1}</div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                media.analysisStatus === "COMPLETED"
                                  ? "default"
                                  : media.analysisStatus === "NEEDS_REVIEW"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {media.analysisStatus}
                            </Badge>
                            {media.analysisConfidence && (
                              <span className="text-muted-foreground">
                                {(media.analysisConfidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          {result && (
                            <div className="text-muted-foreground">
                              {result.color} • {result.consistency} • {result.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gate Photos */}
          {gatePhotos.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle>Gate Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {gatePhotos.map((media) => (
                    <div key={media.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {media.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.url}
                            alt="Gate"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                            Image unavailable
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(media.capturedAt, "h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Proof Photos */}
          {proofPhotos.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle>Proof Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {proofPhotos.map((media) => (
                    <div key={media.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {media.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.url}
                            alt="Proof"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                            Image unavailable
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(media.capturedAt, "h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issue Photos */}
          {issuePhotos.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Issue Photos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {issuePhotos.map((media) => (
                    <div key={media.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border-2 border-amber-300 dark:border-amber-500/60 dark:bg-slate-800">
                        {media.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.url}
                            alt="Issue"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                            Image unavailable
                          </div>
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="text-muted-foreground">
                          {format(media.capturedAt, "h:mm a")}
                        </div>
                        {media.notes && (
                          <div className="mt-1 text-amber-700">{media.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Photos */}
          {otherPhotos.length > 0 && (
            <Card className="admin-card">
<CardHeader>
                <CardTitle>Other Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {otherPhotos.map((media) => (
                    <div key={media.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {media.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.url}
                            alt="Other"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                            Image unavailable
                          </div>
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="text-muted-foreground">
                          {format(media.capturedAt, "h:mm a")}
                        </div>
                        {media.notes && (
                          <div className="mt-1 text-slate-700 dark:text-slate-200">
                            {media.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  </div>
  );
}
