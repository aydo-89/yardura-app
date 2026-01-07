"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MailPlus,
  Users,
  ShieldCheck,
  Clock3,
  ArrowUpRight,
  Copy,
  Loader2,
  UserPlus,
  MailCheck,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { extractUserRole, getDefaultRedirectForRole } from "@/lib/auth/roles";

interface TeamMemberCounts {
  assignedLeads: number;
  serviceVisits: number;
  accounts: number;
  dogs: number;
}

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  roles: string[];
  orgId: string | null;
  createdAt: string;
  scooperProfile?: {
    id: string;
    status: string | null;
  } | null;
  _count: TeamMemberCounts;
}

const roleLabelMap: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  SALES_REP: "Sales",
  TECH: "Field",
  CUSTOMER: "Customer",
};

const roleBadgeClassMap: Record<string, string> = {
  OWNER:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  ADMIN:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  SALES_REP:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
  TECH:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-100",
  CUSTOMER:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-100",
};

const scooperStatusLabelMap: Record<string, string> = {
  APPLICANT: "Applicant",
  PENDING_REVIEW: "Pending review",
  CERTIFIED: "Certified",
  PAUSED: "Paused",
  DEACTIVATED: "Deactivated",
};

const scooperStatusBadgeClassMap: Record<string, string> = {
  CERTIFIED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  PENDING_REVIEW:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  APPLICANT:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
  PAUSED:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-100",
  DEACTIVATED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
};

const roleFilterOptions = [
  { value: "all", label: "All roles" },
  { value: "OWNER", label: "Owners" },
  { value: "ADMIN", label: "Admins" },
  { value: "SALES_REP", label: "Sales" },
  { value: "TECH", label: "Field techs" },
];

const inviteRoleOptions = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES_REP", label: "Sales rep" },
  { value: "TECH", label: "Field technician" },
];

const manageRoleOptions = [
  ...inviteRoleOptions,
  { value: "CUSTOMER", label: "Customer" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch (error) {
    return "—";
  }
};

const formatSimpleName = (value?: string | null) => {
  if (!value) return "—";
  return value;
};

const roleReadable = (role: string) => roleLabelMap[role] ?? role;
const resolveRoles = (member: TeamMember) =>
  member.roles && member.roles.length > 0 ? member.roles : [member.role];
const memberHasRole = (member: TeamMember, role: string) =>
  resolveRoles(member).includes(role);
const scooperStatusReadable = (status?: string | null) => {
  if (!status) return "No profile";
  return scooperStatusLabelMap[status] ?? status;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [certifyingId, setCertifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState<TeamMember | null>(null);
  const [rolesDraft, setRolesDraft] = useState<string[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");

  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    orgId: "yardura",
    roles: ["TECH"] as string[],
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
  });

  const fetchTeam = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to load team");
      }
      const data = (await response.json()) as TeamMember[];
      setTeam(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load team");
      toast.error(err instanceof Error ? err.message : "Unable to load team");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/users");
      return;
    }

    const role = extractUserRole(session);
    if (!role || !["ADMIN", "OWNER"].includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }

    void fetchTeam();
  }, [session, status, router, fetchTeam]);

  const orgOptions = useMemo(() => {
    const set = new Set<string>();
    team.forEach((member) => {
      if (member.orgId) set.add(member.orgId);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [team]);

  const filteredTeam = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return team.filter((member) => {
      const matchesSearch = !search
        || member.email.toLowerCase().includes(search)
        || (member.name ?? "").toLowerCase().includes(search)
        || (member.orgId ?? "").toLowerCase().includes(search);

      if (!matchesSearch) return false;
      if (roleFilter !== "all" && !memberHasRole(member, roleFilter)) return false;
      if (orgFilter !== "all" && member.orgId !== orgFilter) return false;
      return true;
    });
  }, [team, searchTerm, roleFilter, orgFilter]);

  const totalMembers = team.length;
  const adminCount = team.filter((member) => memberHasRole(member, "ADMIN")).length;
  const ownerCount = team.filter((member) => memberHasRole(member, "OWNER")).length;
  const salesCount = team.filter((member) => memberHasRole(member, "SALES_REP")).length;
  const techCount = team.filter((member) => memberHasRole(member, "TECH")).length;
  const newThisWeek = team.filter((member) => {
    const created = new Date(member.createdAt).getTime();
    return Date.now() - created <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard");
    } catch (err) {
      toast.error("Unable to copy email");
    }
  };

  const handleResendLoginLink = async (member: TeamMember) => {
    try {
      setResendingId(member.id);
      const response = await fetch(`/api/admin/users/${member.id}/login-link`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to send login link");
      }
      toast.success(`Login link sent to ${member.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to send login link");
    } finally {
      setResendingId(null);
    }
  };

  const openRolesEditor = (member: TeamMember) => {
    setRolesTarget(member);
    setRolesDraft(resolveRoles(member));
    setRolesOpen(true);
  };

  const toggleRoleDraft = (role: string) => {
    setRolesDraft((prev) =>
      prev.includes(role)
        ? prev.filter((entry) => entry !== role)
        : [...prev, role],
    );
  };

  const handleSaveRoles = async () => {
    if (!rolesTarget) return;
    if (rolesDraft.length === 0) {
      toast.error("Select at least one role.");
      return;
    }
    try {
      setRolesSaving(true);
      const response = await fetch(`/api/admin/users/${rolesTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: rolesDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to update roles");
      }
      toast.success("Roles updated");
      setRolesOpen(false);
      setRolesTarget(null);
      await fetchTeam(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update roles");
    } finally {
      setRolesSaving(false);
    }
  };

  const handleCertifyScooper = async (member: TeamMember) => {
    if (!member.scooperProfile?.id) {
      toast.error("Scooper profile not found");
      return;
    }
    try {
      setCertifyingId(member.scooperProfile.id);
      const response = await fetch(`/api/admin/scoopers/${member.scooperProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERTIFIED" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to certify scooper");
      }
      toast.success(`${member.name || member.email} certified`);
      await fetchTeam(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to certify scooper");
    } finally {
      setCertifyingId(null);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inviteForm.roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }
    if (
      !inviteForm.addressLine1.trim()
      || !inviteForm.city.trim()
      || !inviteForm.state.trim()
      || !inviteForm.zip.trim()
    ) {
      toast.error("Address is required");
      return;
    }
    setInviteSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          orgId: inviteForm.orgId || "yardura",
          roles: inviteForm.roles,
          addressLine1: inviteForm.addressLine1,
          city: inviteForm.city,
          state: inviteForm.state,
          zip: inviteForm.zip,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to invite teammate");
      }
      toast.success("Invitation email sent");
      setInviteForm({
        email: "",
        name: "",
        orgId: "yardura",
        roles: inviteForm.roles,
        addressLine1: "",
        city: "",
        state: "",
        zip: "",
      });
      setInviteOpen(false);
      await fetchTeam(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to invite teammate");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const toggleRole = (role: string) => {
    setInviteForm((prev) => {
      const hasRole = prev.roles.includes(role);
      if (hasRole) {
        return { ...prev, roles: prev.roles.filter((r) => r !== role) };
      }
      return { ...prev, roles: [...prev.roles, role] };
    });
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch.length) {
      chips.push({
        key: "search",
        label: `Search · "${trimmedSearch.length > 22 ? `${trimmedSearch.slice(0, 22)}…` : trimmedSearch}"`,
        onClear: () => setSearchTerm(""),
      });
    }
    if (roleFilter !== "all") {
      chips.push({
        key: "role",
        label: `Role · ${roleReadable(roleFilter)}`,
        onClear: () => setRoleFilter("all"),
      });
    }
    if (orgFilter !== "all") {
      chips.push({
        key: "org",
        label: `Org · ${orgFilter}`,
        onClear: () => setOrgFilter("all"),
      });
    }
    return chips;
  }, [searchTerm, roleFilter, orgFilter]);

  const renderLoadState = () => (
    <div className="admin-surface flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
    </div>
  );

  if (status === "loading") return renderLoadState();
  if (isLoading && !isRefreshing) return renderLoadState();

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 admin-kicker">
                <Users className="h-4 w-4" />
                <span>Team directory</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">People &amp; access</h1>
                <p className="admin-subtitle">
                  Monitor roles, send login links, and invite teammates whenever you expand the crew.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fetchTeam(false)}
                disabled={isRefreshing}
                className="rounded-xl border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400"
              >
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
              <Button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 text-slate-950 shadow-sm transition hover:bg-emerald-400"
              >
                <UserPlus className="h-4 w-4" /> Invite teammate
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total team</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{totalMembers}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ownerCount} owners · {adminCount} admins</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Sales &amp; ops</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{salesCount + techCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{salesCount} sales · {techCount} field techs</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">New this week</p>
              <p className="mt-2 flex items-baseline gap-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {newThisWeek}
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">+ onboarding</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Created in the last 7 days</p>
            </div>
            <div className="admin-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Health check</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Access policies intact
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use role controls to promote, demote, or deactivate via support if needed.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <Card className="admin-card">
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Directory</CardTitle>
              <CardDescription>
                {filteredTeam.length} teammate{filteredTeam.length === 1 ? "" : "s"} visible
                {activeFilterChips.length ? ` • ${activeFilterChips.length} filter${activeFilterChips.length > 1 ? "s" : ""} applied` : ""}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by name, email, or org"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full rounded-full border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 min-w-[150px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 focus:border-emerald-400 focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-400">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="h-10 min-w-[150px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 focus:border-emerald-400 focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-400">
                    <SelectValue placeholder="Org" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "all" ? "All orgs" : value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeFilterChips.length ? (
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClear}
                    className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200 whitespace-nowrap"
                  >
                    <span className="max-w-[220px] truncate">{chip.label}</span>
                    <ArrowUpRight className="h-3 w-3 rotate-45 text-slate-400 transition group-hover:text-emerald-600 dark:text-slate-300 dark:group-hover:text-emerald-200" />
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" /> {error}
                </div>
                <p className="mt-1 text-xs">Try refreshing or revisit later.</p>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Teammate</TableHead>
                    <TableHead className="min-w-[140px]">Role</TableHead>
                    <TableHead className="min-w-[160px]">Scooper status</TableHead>
                    <TableHead className="min-w-[140px]">Org</TableHead>
                    <TableHead className="min-w-[180px]">Engagement</TableHead>
                    <TableHead className="min-w-[140px]">Joined</TableHead>
                    <TableHead className="min-w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeam.length ? (
                    filteredTeam.map((member) => {
                      const counts = member._count ?? {
                        assignedLeads: 0,
                        serviceVisits: 0,
                        accounts: 0,
                        dogs: 0,
                      };
                      const roles = resolveRoles(member);
                      const isTech = roles.includes("TECH");
                      const scooperStatus = member.scooperProfile?.status ?? null;
                      const scooperStatusLabel = scooperStatusReadable(scooperStatus);
                      const scooperStatusClass = scooperStatus
                        ? scooperStatusBadgeClassMap[scooperStatus] ?? scooperStatusBadgeClassMap.PAUSED
                        : scooperStatusBadgeClassMap.PAUSED;
                      const canCertify = isTech && !!member.scooperProfile?.id && scooperStatus !== "CERTIFIED";
                      const isCertifying = member.scooperProfile?.id === certifyingId;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <Link
                                href={`mailto:${member.email}`}
                                className="inline-block font-medium text-slate-900 transition hover:text-emerald-600 dark:text-white dark:hover:text-emerald-300"
                              >
                                {formatSimpleName(member.name) || member.email}
                              </Link>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-2">
                              {roles.map((role) => (
                                <Badge
                                  key={`${member.id}-${role}`}
                                  variant="outline"
                                  className={`inline-flex w-fit text-[11px] font-normal ${
                                    roleBadgeClassMap[role] ?? roleBadgeClassMap.ADMIN
                                  }`}
                                >
                                  {roleReadable(role)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-700 dark:text-slate-200">
                            {isTech ? (
                              scooperStatus ? (
                                <Badge variant="outline" className={`inline-flex w-fit text-[11px] font-normal ${scooperStatusClass}`}>
                                  {scooperStatusLabel}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">No profile</span>
                              )
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-700 dark:text-slate-200">
                            {member.orgId ?? "—"}
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-500 dark:text-slate-400">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <span>Leads</span>
                              <span className="text-right font-medium text-slate-700 dark:text-slate-200">{counts.assignedLeads}</span>
                              <span>Visits</span>
                              <span className="text-right font-medium text-slate-700 dark:text-slate-200">{counts.serviceVisits}</span>
                              <span>Accounts</span>
                              <span className="text-right font-medium text-slate-700 dark:text-slate-200">{counts.accounts}</span>
                              <span>Pets</span>
                              <span className="text-right font-medium text-slate-700 dark:text-slate-200">{counts.dogs}</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-700 dark:text-slate-200">
                            {formatDate(member.createdAt)}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/admin/users/${member.id}`}
                                className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-brand-coral/40 hover:text-brand-coral dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                View record
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRolesEditor(member)}
                                className="border-slate-200 text-slate-700 hover:border-brand-coral/40 hover:text-brand-coral dark:border-slate-700 dark:text-slate-200"
                              >
                                Roles
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyEmail(member.email)}
                                className="border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-200"
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                              </Button>
                              {canCertify ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCertifyScooper(member)}
                                  disabled={isCertifying}
                                  className="border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-200"
                                >
                                  {isCertifying ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Certify
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendLoginLink(member)}
                                disabled={resendingId === member.id}
                                className="border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-200"
                              >
                                {resendingId === member.id ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <MailCheck className="mr-1 h-3.5 w-3.5" />
                                )}
                                Login link
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-16 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No teammates match your filters yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent className="w-full max-w-lg border-l border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <SheetHeader className="space-y-2">
            <SheetTitle>Invite a teammate</SheetTitle>
            <SheetDescription>
              Send a fresh login link so your teammate can join the platform instantly.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInviteSubmit} className="mt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="teammate@insightscoop.com"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  value={inviteForm.name}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Jordan Carter"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-address">Street address</Label>
                <Input
                  id="invite-address"
                  value={inviteForm.addressLine1}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, addressLine1: event.target.value }))
                  }
                  placeholder="123 Main St"
                  className="h-10"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="invite-city">City</Label>
                  <Input
                    id="invite-city"
                    value={inviteForm.city}
                    onChange={(event) =>
                      setInviteForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    placeholder="Austin"
                    className="h-10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-state">State</Label>
                  <Input
                    id="invite-state"
                    value={inviteForm.state}
                    onChange={(event) =>
                      setInviteForm((prev) => ({ ...prev, state: event.target.value }))
                    }
                    placeholder="TX"
                    className="h-10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-zip">ZIP</Label>
                  <Input
                    id="invite-zip"
                    value={inviteForm.zip}
                    onChange={(event) =>
                      setInviteForm((prev) => ({ ...prev, zip: event.target.value }))
                    }
                    placeholder="78701"
                    className="h-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-org">Organization</Label>
                <Input
                  id="invite-org"
                  value={inviteForm.orgId}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, orgId: event.target.value }))
                  }
                  placeholder="yardura"
                  className="h-10"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use an existing org ID to grant the right permissions.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Select all roles this user should have. Multi-role users can switch views.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {inviteRoleOptions.map((option) => {
                    const isSelected = inviteForm.roles.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleRole(option.value)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400"
                            : "border-slate-300 dark:border-slate-600"
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {inviteForm.roles.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Select at least one role
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                  <MailPlus className="h-4 w-4" /> Invite details
                </h4>
                <ul className="space-y-1">
                  <li>• Sends a one-click login link to the teammate.</li>
                  <li>• They can set a password after signing in.</li>
                  <li>• Owners/Admins can adjust roles later via support tools.</li>
                </ul>
              </div>
            </div>
            <SheetFooter className="gap-2">
              <SheetClose asChild>
                <Button type="button" variant="ghost" className="rounded-xl">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={inviteSubmitting} className="rounded-xl">
                {inviteSubmitting ? "Sending…" : "Send invite"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={rolesOpen}
        onOpenChange={(open) => {
          setRolesOpen(open);
          if (!open) {
            setRolesTarget(null);
            setRolesDraft([]);
          }
        }}
      >
        <SheetContent className="w-full max-w-lg border-l border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <SheetHeader className="space-y-2">
            <SheetTitle>Update roles</SheetTitle>
            <SheetDescription>
              Assign the roles this teammate can switch between.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              {rolesTarget ? (
                <>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {rolesTarget.name || rolesTarget.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{rolesTarget.email}</p>
                </>
              ) : (
                "Select a teammate to update roles."
              )}
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {manageRoleOptions.map((option) => {
                  const isSelected = rolesDraft.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleRoleDraft(option.value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected ? (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </div>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {rolesDraft.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Select at least one role.
                </p>
              ) : null}
            </div>
          </div>
          <SheetFooter className="mt-6 gap-2">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleSaveRoles} disabled={rolesSaving || rolesDraft.length === 0}>
              {rolesSaving ? "Saving…" : "Save roles"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
