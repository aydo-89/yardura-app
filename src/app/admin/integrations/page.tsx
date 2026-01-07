"use client";

import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QuickBooksIntegrationData {
  orgId: string;
  enabled: boolean;
  realmId: string | null;
  clientId: string | null;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  needsReconnect: boolean;
  lastSyncAt: string | null;
  counts: {
    pending: number;
    queued: number;
    blocked: number;
  };
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((res) => {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return res.json();
  });

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "MMM d, yyyy h:mm a");
}

export default function AdminIntegrationsPage() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<QuickBooksIntegrationData>>(
    "/api/admin/integrations/quickbooks",
    fetcher,
  );

  const details = data?.data;

  const [enabled, setEnabled] = useState(false);
  const [realmId, setRealmId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!details) return;
    setEnabled(details.enabled);
    setRealmId(details.realmId ?? "");
    setClientId(details.clientId ?? "");
    setNeedsReconnect(details.needsReconnect);
    setClientSecret("");
    setRefreshToken("");
  }, [details]);

  const hasSecretStored = details?.hasClientSecret ?? false;
  const hasRefreshTokenStored = details?.hasRefreshToken ?? false;

  const counts = details?.counts ?? { pending: 0, queued: 0, blocked: 0 };

  const lastSyncAt = useMemo(() => formatDateTime(details?.lastSyncAt ?? null), [details]);

  const handleSubmit = useCallback(async () => {
    if (!details) return;
    setIsSaving(true);
    setStatus(null);

    const payload: Record<string, unknown> = {};

    if (enabled !== details.enabled) {
      payload.enabled = enabled;
    }

    if ((realmId || "") !== (details.realmId ?? "")) {
      payload.realmId = realmId.trim() || null;
    }

    if ((clientId || "") !== (details.clientId ?? "")) {
      payload.clientId = clientId.trim() || null;
    }

    if (clientSecret.trim()) {
      payload.clientSecret = clientSecret.trim();
    }

    if (refreshToken.trim()) {
      payload.refreshToken = refreshToken.trim();
    }

    if (needsReconnect !== details.needsReconnect) {
      payload.needsReconnect = needsReconnect;
    }

    if (Object.keys(payload).length === 0) {
      setStatus({ type: "error", message: "No changes to save." });
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/integrations/quickbooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<QuickBooksIntegrationData> = await response
        .json()
        .catch(() => ({ ok: false }));

      if (!response.ok || !json.ok) {
        const message = json.message || json.error || "Unable to save QuickBooks settings.";
        setStatus({ type: "error", message });
        return;
      }

      setStatus({ type: "success", message: "Integration settings updated." });
      setClientSecret("");
      setRefreshToken("");
      await mutate();
    } catch (error) {
      setStatus({ type: "error", message: "Unexpected error saving settings." });
    } finally {
      setIsSaving(false);
    }
  }, [clientId, clientSecret, details, enabled, mutate, needsReconnect, realmId, refreshToken]);

  const handleManualSync = useCallback(async () => {
    setStatus(null);
    try {
      const response = await fetch("/api/admin/billing/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json: ApiResponse<unknown> = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !json.ok) {
        const message = json.message || json.error || "Unable to queue manual sync.";
        setStatus({ type: "error", message });
        return;
      }
      setStatus({ type: "success", message: "QuickBooks sync job queued." });
      await mutate();
    } catch (error) {
      setStatus({ type: "error", message: "Unexpected error queuing sync." });
    }
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load QuickBooks settings</AlertTitle>
        <AlertDescription>
          {error?.message ?? "An unexpected error occurred while loading the integration."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect QuickBooks to sync manual credits and adjustments. Integration is optional—exports
          remain available even when disabled.
        </p>
      </div>

      {status && (
        <Alert variant={status.type === "error" ? "destructive" : "default"}>
          <AlertTitle>{status.type === "error" ? "Action needed" : "Success"}</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <Card className="border-muted/40">
        <CardHeader>
          <CardTitle>QuickBooks Online</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-md border border-muted/40 p-4">
            <div>
              <p className="font-medium">Integration status</p>
              <p className="text-sm text-muted-foreground">
                Org: <span className="font-semibold">{details.orgId}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="quickbooks-enabled">Enabled</Label>
                <Switch
                  id="quickbooks-enabled"
                  checked={enabled}
                  onCheckedChange={(value) => setEnabled(Boolean(value))}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={!enabled}
              >
                Run sync
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="realmId">Realm ID</Label>
              <Input
                id="realmId"
                placeholder="1234567890"
                value={realmId}
                onChange={(event) => setRealmId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                placeholder="Enter your QuickBooks app client ID"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client secret</Label>
              <Textarea
                id="clientSecret"
                placeholder={hasSecretStored ? "Stored. Enter a new value to replace." : "Client secret"}
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
              />
              {hasSecretStored && (
                <p className="text-xs text-muted-foreground">
                  A client secret is currently stored. Leave blank to keep the existing value.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="refreshToken">Refresh token</Label>
              <Textarea
                id="refreshToken"
                placeholder={
                  hasRefreshTokenStored
                    ? "Stored. Enter a new token to replace."
                    : "Refresh token from QuickBooks"
                }
                value={refreshToken}
                onChange={(event) => setRefreshToken(event.target.value)}
              />
              {hasRefreshTokenStored && (
                <p className="text-xs text-muted-foreground">
                  A refresh token is currently stored. QuickBooks typically issues a new token after
                  reconnecting—update this field when credentials rotate.
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded-md border border-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground mb-1">Pending ledger</p>
              <p className="text-lg font-semibold">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">
                Entries waiting to sync to QuickBooks once credentials are valid.
              </p>
            </div>
            <div className="rounded-md border border-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground mb-1">Queued</p>
              <p className="text-lg font-semibold">{counts.queued}</p>
              <p className="text-xs text-muted-foreground">
                Entries currently flagged for the sync worker.
              </p>
            </div>
            <div className="rounded-md border border-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground mb-1">Blocked</p>
              <p className={cn("text-lg font-semibold", counts.blocked > 0 && "text-amber-600")}>{counts.blocked}</p>
              <p className="text-xs text-muted-foreground">
                Entries we deferred because credentials were missing or need a reconnect.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-muted/40 p-4">
            <div>
              <p className="font-medium">Credential health</p>
              <p className="text-sm text-muted-foreground">
                Last sync attempt: <span className="font-semibold">{lastSyncAt}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="needsReconnect">Needs reconnect</Label>
              <Switch
                id="needsReconnect"
                checked={needsReconnect}
                onCheckedChange={(value) => setNeedsReconnect(Boolean(value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                if (!details) return;
                setEnabled(details.enabled);
                setRealmId(details.realmId ?? "");
                setClientId(details.clientId ?? "");
                setNeedsReconnect(details.needsReconnect);
                setClientSecret("");
                setRefreshToken("");
                setStatus(null);
              }}
            >
              Reset
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

