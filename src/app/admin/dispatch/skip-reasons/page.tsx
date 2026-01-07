"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2, Edit2, Plus, RefreshCcw } from "lucide-react";

type SkipBillingBehavior =
  | "NO_CHARGE"
  | "BILL_STANDARD"
  | "BILL_PARTIAL"
  | "BILL_CUSTOM";

interface SkipReasonDto {
  id: string;
  orgId: string;
  code: string;
  label: string;
  description: string | null;
  billingBehavior: SkipBillingBehavior;
  notifyCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  code: string;
  label: string;
  description: string;
  billingBehavior: SkipBillingBehavior;
  notifyCustomer: boolean;
}

const billingBehaviorOptions: Array<{
  value: SkipBillingBehavior;
  label: string;
  helper: string;
}> = [
  {
    value: "NO_CHARGE",
    label: "No charge",
    helper: "Skip visit without billing the client",
  },
  {
    value: "BILL_STANDARD",
    label: "Bill standard rate",
    helper: "Charge as if service occurred",
  },
  {
    value: "BILL_PARTIAL",
    label: "Bill partial",
    helper: "Apply partial fee (manually adjusted later)",
  },
  {
    value: "BILL_CUSTOM",
    label: "Bill custom",
    helper: "Requires manual follow-up for billing",
  },
];

const defaultFormState: FormState = {
  code: "",
  label: "",
  description: "",
  billingBehavior: "NO_CHARGE",
  notifyCustomer: true,
};

export default function SkipReasonAdminPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as any)?.orgId || "yardura";

  const [skipReasons, setSkipReasons] = useState<SkipReasonDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  const parseJson = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    const text = await response.text();
    throw new Error(text || `Unexpected response (${response.status})`);
  };

  const title = useMemo(
    () => (editingId ? "Edit skip reason" : "Add new skip reason"),
    [editingId],
  );

  const loadSkipReasons = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dispatch/skip-reasons?orgId=${encodeURIComponent(orgId)}`,
        { credentials: "include" },
      );
      const json = await parseJson<{ ok: boolean; skipReasons: SkipReasonDto[] }>(res);
      if (!res.ok || !json?.ok) {
        throw new Error("Failed to load skip reasons");
      }
      setSkipReasons(json.skipReasons as SkipReasonDto[]);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to load skip reasons",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkipReasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const resetForm = () => {
    setEditingId(null);
    setFormState(defaultFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    setSaving(true);

    try {
      if (!editingId) {
        const res = await fetch("/api/dispatch/skip-reasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            orgId,
            code: formState.code.trim().toUpperCase(),
            label: formState.label.trim(),
            description: formState.description.trim() || undefined,
            billingBehavior: formState.billingBehavior,
            notifyCustomer: formState.notifyCustomer,
          }),
        });
        const json = await parseJson<{ ok: boolean; skipReason: SkipReasonDto; error?: string }>(res);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to create skip reason");
        }
        toast.success("Skip reason created");
      } else {
        const res = await fetch(`/api/dispatch/skip-reasons/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            orgId,
            label: formState.label.trim(),
            description: formState.description.trim(),
            billingBehavior: formState.billingBehavior,
            notifyCustomer: formState.notifyCustomer,
          }),
        });
        const json = await parseJson<{ ok: boolean; skipReason: SkipReasonDto; error?: string }>(res);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to update skip reason");
        }
        toast.success("Skip reason updated");
      }
      resetForm();
      await loadSkipReasons();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to save skip reason",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reason: SkipReasonDto) => {
    setEditingId(reason.id);
    setFormState({
      code: reason.code,
      label: reason.label,
      description: reason.description ?? "",
      billingBehavior: reason.billingBehavior,
      notifyCustomer: reason.notifyCustomer,
    });
  };

  const handleDelete = async (reason: SkipReasonDto) => {
    if (!orgId) return;
    const confirmed = window.confirm(
      `Delete skip reason "${reason.label}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(reason.id);
    try {
      const res = await fetch(`/api/dispatch/skip-reasons/${reason.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      });
      const json = await parseJson<{ ok: boolean; error?: string }>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to delete skip reason");
      }
      toast.success("Skip reason deleted");
      await loadSkipReasons();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to delete skip reason",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            Skip Reason Catalog
          </h1>
          <p className="mt-2 text-slate-600">
            Configure weather/safety reasons and billing behavior for skipped
            visits.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {editingId
                  ? "Update the reason used when technicians skip a visit."
                  : "Create a new skip reason with billing and notification rules."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <div className="space-y-2">
                    <Label htmlFor="code">Reason code</Label>
                    <Input
                      id="code"
                      value={formState.code}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          code: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="WEATHER"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      Uppercase identifier (e.g. WEATHER, LOCKED_GATE)
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="label">Display name</Label>
                  <Input
                    id="label"
                    value={formState.label}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="Unsafe dog on property"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Internal notes</Label>
                  <Textarea
                    id="description"
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Technician should contact dispatcher before returning."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Billing behavior</Label>
                  <Select
                    value={formState.billingBehavior}
                    onValueChange={(value: SkipBillingBehavior) =>
                      setFormState((prev) => ({
                        ...prev,
                        billingBehavior: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select billing behavior" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingBehaviorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {option.label}
                            </span>
                            <span className="text-xs text-slate-500">
                              {option.helper}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Notify customer
                    </p>
                    <p className="text-xs text-slate-500">
                      Send automatic skip notification based on this reason.
                    </p>
                  </div>
                  <Switch
                    checked={formState.notifyCustomer}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({
                        ...prev,
                        notifyCustomer: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingId ? (
                      <Edit2 className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingId ? "Save changes" : "Add reason"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Existing reasons</CardTitle>
                <CardDescription>
                  {skipReasons.length} reason
                  {skipReasons.length === 1 ? "" : "s"} configured
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadSkipReasons}
                disabled={loading}
              >
                <RefreshCcw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                <span className="sr-only">Refresh</span>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Code</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Notify</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : skipReasons.length ? (
                      skipReasons.map((reason) => (
                        <TableRow key={reason.id}>
                          <TableCell className="font-mono text-xs uppercase">
                            {reason.code}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {reason.label}
                            </div>
                            {reason.description ? (
                              <div className="text-xs text-slate-500 truncate max-w-xs">
                                {reason.description}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            {
                              billingBehaviorOptions.find(
                                (option) => option.value === reason.billingBehavior,
                              )?.label ?? reason.billingBehavior
                            }
                          </TableCell>
                          <TableCell className="text-sm">
                            {reason.notifyCustomer ? "Yes" : "No"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {new Date(reason.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(reason)}
                            >
                              <Edit2 className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDelete(reason)}
                              disabled={deletingId === reason.id}
                            >
                              {deletingId === reason.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center">
                          <p className="text-sm text-slate-500">
                            No skip reasons configured yet. Create your first
                            reason to control skip automation.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
