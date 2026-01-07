"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut,
  Mail,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
  User,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  ROLE_DISPLAY_NAME,
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
  type AppUserRole,
} from "@/lib/auth/roles";

interface AccountPageClientProps {
  userEmail: string;
}

export default function AccountPageClient({
  userEmail,
}: AccountPageClientProps) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<AppUserRole | null>(null);
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const availableRoles = useMemo(() => extractUserRoles(session), [session]);
  const activeRole = useMemo(() => extractActiveRole(session), [session]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          setName(user?.name || "");
          setPhone(user?.phone || "");
          setAddress(user?.address || "");
          setCity(user?.city || "");
          setZipCode(user?.zipCode || "");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, city, zipCode, phone }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = event.target.value as AppUserRole;
    if (!nextRole || nextRole === activeRole) {
      return;
    }
    try {
      setRoleSwitchError(null);
      setSwitchingRole(nextRole);
      await update?.({ activeRole: nextRole });
      router.replace(getDefaultRedirectForRole(nextRole));
    } catch (error) {
      console.error("[Account] Failed to switch roles", error);
      setRoleSwitchError("Unable to switch roles right now.");
    } finally {
      setSwitchingRole(null);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/signin" });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-graphite/5 dark:border-white/10 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-1">
        <div className="rounded-[22px] bg-white/90 dark:bg-slate-900/70 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-graphite/50 dark:text-white/50 font-semibold">
            Account
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-graphite dark:text-white mt-2">
            Account & Access
          </h1>
          <p className="text-sm text-graphite/60 dark:text-white/60 mt-2 max-w-2xl">
            Update contact details for service updates, manage roles, and set your dashboard theme.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5">
          <CardHeader>
            <CardTitle className="text-lg font-heading font-semibold text-graphite dark:text-white flex items-center gap-2">
              <ShieldCheck className="size-5 text-coral" />
              Access & Roles
            </CardTitle>
            <p className="text-sm text-graphite/60 dark:text-white/60">
              Your login details and available workspaces.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-slate-600 dark:text-slate-300">Loading…</div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">
                    Email
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-graphite/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
                    <Mail className="size-4 text-graphite/50 dark:text-white/60" />
                    <span className="text-sm font-medium text-graphite dark:text-white">
                      {userEmail}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">
                    Name
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-graphite/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
                    <User className="size-4 text-graphite/50 dark:text-white/60" />
                    <span className="text-sm font-medium text-graphite dark:text-white">
                      {name || "Not provided"}
                    </span>
                  </div>
                  <p className="text-xs text-graphite/50 dark:text-white/50">
                    Name updates are managed through your login provider.
                  </p>
                </div>
                {availableRoles.length > 1 ? (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">
                      Active role
                    </label>
                    <div className="relative">
                      <select
                        value={activeRole ?? ""}
                        onChange={handleRoleChange}
                        disabled={switchingRole !== null || !activeRole}
                        className="h-11 w-full appearance-none rounded-xl border border-graphite/10 dark:border-white/15 bg-white dark:bg-slate-900 px-4 pr-10 text-sm font-semibold text-graphite dark:text-white"
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_DISPLAY_NAME[role]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40 dark:text-white/50" />
                    </div>
                    {roleSwitchError ? (
                      <p className="text-xs text-red-500 dark:text-red-400">
                        {roleSwitchError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-center justify-between rounded-xl border border-graphite/10 dark:border-white/15 bg-white/80 dark:bg-slate-900 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-graphite dark:text-white">
                      Appearance
                    </p>
                    <p className="text-xs text-graphite/50 dark:text-white/50">
                      Toggle dark mode
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDark ? <Moon className="size-4 text-slate-400" /> : <Sun className="size-4 text-amber-500" />}
                    <Switch
                      checked={isDark}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      className="data-[state=checked]:bg-emerald-400"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full rounded-xl border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10"
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5">
          <CardHeader>
            <CardTitle className="text-lg font-heading font-semibold text-graphite dark:text-white flex items-center gap-2">
              <MapPin className="size-5 text-mint" />
              Contact & Service Details
            </CardTitle>
            <p className="text-sm text-graphite/60 dark:text-white/60">
              Used for visit updates and service scheduling.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-slate-600 dark:text-slate-300">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    value={phone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPhone(e.target.value)
                    }
                    placeholder="Enter your phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Address
                  </label>
                  <AddressAutocomplete
                    value={address}
                    onChange={(val: string) => setAddress(val)}
                    onSelect={(addr: {
                      formattedAddress: string;
                      city?: string;
                      postalCode?: string;
                    }) => {
                      if (addr.formattedAddress)
                        setAddress(addr.formattedAddress);
                      if (addr.city) setCity(addr.city || "");
                      if (addr.postalCode) setZipCode(addr.postalCode || "");
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      City
                    </label>
                    <Input
                      value={city}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setCity(e.target.value)
                      }
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      ZIP Code
                    </label>
                    <Input
                      value={zipCode}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setZipCode(e.target.value)
                      }
                      placeholder="Enter ZIP code"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
