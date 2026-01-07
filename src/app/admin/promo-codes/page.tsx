"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses?: number;
  usedCount: number;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
  createdAt: string;
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPromoCodes();
  }, []);

  const loadPromoCodes = async () => {
    try {
      const response = await fetch("/api/admin/promo-codes");
      if (!response.ok) throw new Error("Failed to load promo codes");
      const data = await response.json();
      setPromoCodes(data);
    } catch (error) {
      setError("Failed to load promo codes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deletePromoCode = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promo code?")) return;

    try {
      const response = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete promo code");

      setPromoCodes(promoCodes.filter(code => code.id !== id));
    } catch (error) {
      setError("Failed to delete promo code");
      console.error(error);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!response.ok) throw new Error("Failed to update promo code");

      setPromoCodes(promoCodes.map(code =>
        code.id === id ? { ...code, isActive: !isActive } : code
      ));
    } catch (error) {
      setError("Failed to update promo code");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center">
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading promo codes...</span>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute right-16 top-12 h-28 w-28 rounded-full bg-brand-mint/25 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-36 w-[22rem] -translate-x-1/2 bg-brand-coral/20 blur-3xl" />
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-6 px-6 py-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3 admin-kicker">
              <Tag className="h-4 w-4" />
              <span>Promo codes</span>
            </div>
            <div className="space-y-2">
              <h1 className="admin-title">Discount campaigns</h1>
              <p className="admin-subtitle">
                Launch limited offers, toggle availability, and monitor promo usage across active customers.
              </p>
            </div>
          </div>
          <Link href="/admin/promo-codes/new">
            <Button className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              Create promo code
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-6 pb-24 pt-12">
        {error && (
          <div className="admin-card rounded-2xl border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="grid gap-4">
        {promoCodes.map((promoCode) => (
          <Card key={promoCode.id} className="admin-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-brand-coral" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{promoCode.code}</h3>
                    {promoCode.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">{promoCode.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={promoCode.isActive ? "default" : "secondary"}>
                    {promoCode.isActive ? "Active" : "Inactive"}
                  </Badge>

                  <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                    <div>
                      {promoCode.discountType === "percentage"
                        ? `${promoCode.discountValue}% off`
                        : `$${promoCode.discountValue / 100} off`}
                    </div>
                    {promoCode.maxUses && (
                      <div>
                        Used: {promoCode.usedCount}/{promoCode.maxUses}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(promoCode.id, promoCode.isActive)}
                    >
                      {promoCode.isActive ? "Deactivate" : "Activate"}
                    </Button>

                    <Link href={`/admin/promo-codes/${promoCode.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePromoCode(promoCode.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span>Valid from: {new Date(promoCode.validFrom).toLocaleDateString()}</span>
                {promoCode.validUntil && (
                  <span className="ml-4">
                    Valid until: {new Date(promoCode.validUntil).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {promoCodes.length === 0 && (
          <Card className="admin-card">
            <CardContent className="p-8 text-center">
              <Tag className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
                No promo codes yet
              </h3>
              <p className="mb-4 text-slate-600 dark:text-slate-300">
                Create your first promo code to offer discounts to customers.
              </p>
              <Link href="/admin/promo-codes/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Promo Code
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  );
}

