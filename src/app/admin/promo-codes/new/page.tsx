"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewPromoCodePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxUses: "",
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = {
        code: formData.code.toUpperCase(),
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: parseInt(formData.discountValue),
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
        validFrom: new Date(formData.validFrom),
        validUntil: formData.validUntil ? new Date(formData.validUntil) : undefined,
      };

      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create promo code");
      }

      router.push("/admin/promo-codes");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create promo code");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute right-16 top-12 h-28 w-28 rounded-full bg-brand-mint/25 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-36 w-[22rem] -translate-x-1/2 bg-brand-coral/20 blur-3xl" />
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <Save className="h-4 w-4" />
                <span>Promo codes</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">Create promo code</h1>
                <p className="admin-subtitle">
                  Define incentives for new or returning customers and control their usage windows.
                </p>
              </div>
            </div>
            <Link href="/admin/promo-codes">
              <Button variant="outline" size="sm" className="rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to promo codes
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-6 pb-24 pt-12">
        {error && (
          <div className="admin-card rounded-2xl border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {error}
          </div>
        )}

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Promo code details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="code">Promo Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleInputChange("code", e.target.value)}
                  placeholder="SUMMER2024"
                  required
                  className="uppercase"
                />
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Code will be automatically converted to uppercase
                </p>
              </div>

              <div>
                <Label htmlFor="discountType">Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) => handleInputChange("discountType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discountValue">
                  Discount Value * ({formData.discountType === "percentage" ? "%" : "$"})
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => handleInputChange("discountValue", e.target.value)}
                  placeholder={formData.discountType === "percentage" ? "20" : "2500"}
                  required
                  min="1"
                  max={formData.discountType === "percentage" ? "100" : "10000"}
                />
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {formData.discountType === "percentage"
                    ? "Percentage off the first visit (1-100%)"
                    : "Fixed amount in cents (e.g., 2500 = $25.00)"}
                </p>
              </div>

              <div>
                <Label htmlFor="maxUses">Max Uses (Optional)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => handleInputChange("maxUses", e.target.value)}
                  placeholder="100"
                  min="1"
                />
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Leave empty for unlimited uses
                </p>
              </div>

              <div>
                <Label htmlFor="validFrom">Valid From *</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => handleInputChange("validFrom", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="validUntil">Valid Until (Optional)</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => handleInputChange("validUntil", e.target.value)}
                />
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Leave empty for no expiration
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Summer promotion - 20% off first visit"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Promo Code
                  </>
                )}
              </Button>

              <Link href="/admin/promo-codes">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
