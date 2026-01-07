"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Users,
  Shield,
  Database,
  Settings,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  roles: string[];
  orgId: string | null;
  createdAt: string;
  _count: {
    assignedLeads: number;
    serviceVisits: number;
    accounts: number;
    dogs: number;
  };
}

interface AdminCustomer {
  id: string;
  orgId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  jobs: Array<{
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
  }>;
  _count: {
    jobs: number;
    dogs: number;
    serviceVisits: number;
  };
}

const OWNER_EMAIL = "ayden@yardura.com";

type InternalRole = "ADMIN" | "OWNER" | "SALES_REP" | "TECH" | "CUSTOMER";

const ROLE_OPTIONS: Array<{ value: InternalRole; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "OWNER", label: "Owner" },
  { value: "SALES_REP", label: "Sales Rep" },
  { value: "TECH", label: "Service Technician" },
  { value: "CUSTOMER", label: "Customer" },
];

const resolveRoles = (user: User) =>
  user.roles && user.roles.length > 0 ? user.roles : [user.role];

const initialNewUser: {
  email: string;
  name: string;
  roles: InternalRole[];
  orgId: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
} = {
  email: "",
  name: "",
  roles: ["ADMIN"],
  orgId: "yardura",
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
};

const initialInviteUser: {
  email: string;
  name: string;
  role: InternalRole;
  orgId: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
} = {
  email: "",
  name: "",
  role: "OWNER",
  orgId: "",
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
};

export default function GodModePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState<User | null>(null);
  const [rolesDraft, setRolesDraft] = useState<InternalRole[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState(initialNewUser);
  const [inviteUser, setInviteUser] = useState(initialInviteUser);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");

  // Only allow the owner/super admin
  const isGodModeUser = session?.user?.email === OWNER_EMAIL;

  useEffect(() => {
    if (status === "loading") return;

    if (!session || !isGodModeUser) {
      router.push("/admin");
      return;
    }

    fetchUsers();
    fetchCustomers();
  }, [session, status, router, isGodModeUser]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch("/api/admin/customers");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers ?? []);
      } else {
        toast.error("Failed to load customers");
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setCustomersLoading(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${email}? This action cannot be undone!`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`User ${email} deleted successfully`);
        fetchUsers(); // Refresh the list
      } else {
        toast.error("Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user");
    }
  };

  const promoteUser = async (userId: string, email: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success(`User ${email} promoted to admin`);
        fetchUsers(); // Refresh the list
      } else {
        toast.error("Failed to promote user");
      }
    } catch (error) {
      console.error("Failed to promote user:", error);
      toast.error("Failed to promote user");
    }
  };

  const openRolesDialog = (user: User) => {
    setRolesTarget(user);
    setRolesDraft(resolveRoles(user) as InternalRole[]);
    setRolesDialogOpen(true);
  };

  const toggleRoleDraft = (role: InternalRole) => {
    setRolesDraft((prev) =>
      prev.includes(role)
        ? prev.filter((entry) => entry !== role)
        : [...prev, role],
    );
  };

  const saveRoles = async () => {
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
        throw new Error(payload?.error ?? "Unable to update roles");
      }
      toast.success("Roles updated.");
      setRolesDialogOpen(false);
      setRolesTarget(null);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update roles");
    } finally {
      setRolesSaving(false);
    }
  };

  const demoteUser = async (userId: string, email: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/demote`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success(`Admin ${email} demoted to customer`);
        fetchUsers(); // Refresh the list
      } else {
        toast.error("Failed to demote user");
      }
    } catch (error) {
      console.error("Failed to demote user:", error);
      toast.error("Failed to demote user");
    }
  };

  const deleteCustomer = async (customerId: string, customerLabel: string) => {
    if (
      !confirm(
        `Delete customer ${customerLabel}? This removes jobs, visits, samples, and associated data.`,
      )
    ) {
      return;
    }

    setDeletingCustomerId(customerId);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`Customer ${customerLabel} deleted`);
        fetchCustomers();
      } else {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error || "Failed to delete customer");
      }
    } catch (error) {
      console.error("Failed to delete customer:", error);
      toast.error("Failed to delete customer");
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const toggleNewUserRole = (role: InternalRole) => {
    setNewUser((prev) => {
      const hasRole = prev.roles.includes(role);
      if (hasRole) {
        return { ...prev, roles: prev.roles.filter((r) => r !== role) };
      }
      return { ...prev, roles: [...prev.roles, role] };
    });
  };

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.name.trim()) {
      toast.error("Email and name are required");
      return;
    }
    if (newUser.roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }
    if (
      !newUser.addressLine1.trim()
      || !newUser.city.trim()
      || !newUser.state.trim()
      || !newUser.zip.trim()
    ) {
      toast.error("Address is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          roles: newUser.roles,
          orgId: newUser.orgId,
          addressLine1: newUser.addressLine1,
          city: newUser.city,
          state: newUser.state,
          zip: newUser.zip,
        }),
      });

      if (response.ok) {
        const createdUser = await response.json();
        toast.success(`User ${createdUser.email} created successfully`);
        setCreateDialogOpen(false);
        setNewUser({
          email: "",
          name: "",
          roles: ["ADMIN"],
          orgId: "yardura",
          addressLine1: "",
          city: "",
          state: "",
          zip: "",
        });
        fetchUsers(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Failed to create user:", error);
      toast.error("Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const sendInvite = async () => {
    if (
      !inviteUser.email.trim() ||
      !inviteUser.name.trim() ||
      !inviteUser.orgId.trim() ||
      !inviteUser.addressLine1.trim() ||
      !inviteUser.city.trim() ||
      !inviteUser.state.trim() ||
      !inviteUser.zip.trim()
    ) {
      toast.error("Email, name, organization ID, and address are required");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inviteUser),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`User ${result.email} created and invitation sent!`);
        setInviteDialogOpen(false);
        setInviteUser({
          email: "",
          name: "",
          role: "OWNER",
          orgId: "",
          addressLine1: "",
          city: "",
          state: "",
          zip: "",
        });
        fetchUsers(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create user and send invitation");
      }
    } catch (error) {
      console.error("Failed to invite user:", error);
      toast.error("Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const internalUsers = useMemo(
    () => users.filter((user) => resolveRoles(user).some((role) => role !== "CUSTOMER")),
    [users],
  );

  const customerUserCount = users.length - internalUsers.length;

  const totalAdmins = internalUsers.filter((user) => resolveRoles(user).includes("ADMIN")).length;
  const totalTechs = internalUsers.filter((user) => resolveRoles(user).includes("TECH")).length;
  const totalServiceVisits = internalUsers.reduce(
    (sum, user) => sum + user._count.serviceVisits,
    0,
  );
  const totalAssignedLeads = internalUsers.reduce(
    (sum, user) => sum + user._count.assignedLeads,
    0,
  );
  const activeCustomers = customers.length;
  const trackedSubscriptions = customers.reduce((sum, customer) => {
    return (
      sum +
      customer.jobs.filter((job) => Boolean(job.stripeSubscriptionId)).length
    );
  }, 0);

  const filteredCustomers = useMemo(() => {
    const term = customerSearchTerm.trim().toLowerCase();
    if (!term) return customers;

    return customers.filter((customer) => {
      const fields = [
        customer.name,
        customer.email,
        customer.phone,
        customer.id,
        customer.orgId,
      ];

      if (fields.some((value) => (value ?? "").toLowerCase().includes(term))) {
        return true;
      }

      return customer.jobs.some((job) => job.id.toLowerCase().includes(term));
    });
  }, [customers, customerSearchTerm]);

  if (status === "loading" || usersLoading || customersLoading) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isGodModeUser) {
    return (
      <div className="admin-surface flex min-h-screen items-center justify-center px-6">
        <Card className="admin-card w-full max-w-md border-rose-200/80 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-500/15">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-rose-700 dark:text-rose-100">
              <Shield className="h-6 w-6" />
              Access denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-rose-600 dark:text-rose-200">
              God Mode is restricted to system owners only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute right-16 top-14 h-40 w-40 rounded-full bg-brand-mint/25 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-48 w-[32rem] -translate-x-1/2 bg-brand-coral/20 blur-[110px]" />
        <div className="container mx-auto space-y-8 px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3 admin-kicker">
                <Shield className="h-4 w-4" />
                <span>System control</span>
              </div>
              <div className="space-y-2">
                <h1 className="admin-title">
                  God Mode Administration
                </h1>
                <p className="admin-subtitle">
                  Provision accounts, purge data, and inspect subscriptions across Yardura Service OS.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setCreateDialogOpen(true)}
                className="rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-sm transition hover:border-brand-mint/40 hover:bg-brand-mint/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/15"
              >
                Create user
              </Button>
              <Button
                variant="secondary"
                onClick={() => setInviteDialogOpen(true)}
                className="rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-sm transition hover:border-brand-mint/40 hover:bg-brand-mint/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-mint/40 dark:hover:bg-brand-mint/15"
              >
                Invite business admin
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="admin-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 dark:text-slate-300">Internal teammates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{internalUsers.length}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totalAdmins} admin{totalAdmins === 1 ? "" : "s"} · {totalTechs} tech{totalTechs === 1 ? "" : "s"}
                  {customerUserCount > 0 ? ` · ${customerUserCount} customer login${customerUserCount === 1 ? "" : "s"}` : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 dark:text-slate-300">Customers tracked</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{activeCustomers}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {trackedSubscriptions} Stripe subscription{trackedSubscriptions === 1 ? "" : "s"}
                  {customerUserCount > 0 ? ` · ${customerUserCount} linked login${customerUserCount === 1 ? "" : "s"}` : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 dark:text-slate-300">Leads under management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{totalAssignedLeads}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Across all owners</p>
              </CardContent>
            </Card>
            <Card className="admin-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 dark:text-slate-300">Service visits logged</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{totalServiceVisits}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lifetime across dispatch</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="admin-pill-tabs w-full justify-start">
            <TabsTrigger
              value="users"
              className="admin-pill-tab flex-1"
            >
              Users
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="admin-pill-tab flex-1"
            >
              Customers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card className="admin-card">
              <CardHeader className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>System users</CardTitle>
                  <CardDescription>Manage internal accounts and access across the platform.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                    Create user
                  </Button>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
                    Invite business admin
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void fetchUsers();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {internalUsers.length ? (
                        internalUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="font-medium text-slate-900 dark:text-slate-100">{user.name || user.email}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                {resolveRoles(user).map((role) => (
                                  <Badge
                                    key={`${user.id}-${role}`}
                                    variant={role === "ADMIN" || role === "OWNER" ? "default" : "secondary"}
                                  >
                                    {role}
                                  </Badge>
                                ))}
                                {user.orgId ? <Badge variant="outline">{user.orgId}</Badge> : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex flex-col gap-1">
                                <span>Leads: {user._count.assignedLeads}</span>
                                <span>Visits: {user._count.serviceVisits}</span>
                                <span>Accounts: {user._count.accounts}</span>
                                <span>Dogs: {user._count.dogs}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {!resolveRoles(user).includes("ADMIN") ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => promoteUser(user.id, user.email)}
                                  >
                                    Promote
                                  </Button>
                                ) : null}
                                {resolveRoles(user).includes("ADMIN") && user.email !== OWNER_EMAIL ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => demoteUser(user.id, user.email)}
                                  >
                                    Demote
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRolesDialog(user)}
                                >
                                  Roles
                                </Button>
                                {user.email !== OWNER_EMAIL ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteUser(user.id, user.email)}
                                  >
                                    Delete
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <Card className="admin-card">
              <CardHeader className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>Customer registry</CardTitle>
                  <CardDescription>
                    Inspect subscriptions, jobs, and visitation footprint.
                    {customerSearchTerm.trim()
                      ? ` Showing ${filteredCustomers.length} match${
                          filteredCustomers.length === 1 ? "" : "es"
                        }.`
                      : null}
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[20rem] sm:flex-row sm:items-center">
                  <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm focus-within:border-slate-400 dark:border-slate-700 dark:bg-slate-900">
                    <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <Input
                      value={customerSearchTerm}
                      onChange={(event) => setCustomerSearchTerm(event.target.value)}
                      placeholder="Search customers by name, email, phone, or ID"
                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void fetchCustomers();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Subscriptions</TableHead>
                        <TableHead>Stats</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.length ? (
                        filteredCustomers.map((customer) => {
                          const subscriptionLabels = customer.jobs.map((job) =>
                            job.stripeSubscriptionId
                              ? `${job.stripeSubscriptionId}${job.status !== "ACTIVE" ? ` (${job.status.toLowerCase()})` : ""}`
                              : `Job #${job.id.slice(0, 6)}`,
                          );

                          return (
                            <TableRow key={customer.id}>
                              <TableCell>
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {customer.name || "Untitled"}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{customer.id}</div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                <div>{customer.email || "—"}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {customer.phone || "No phone"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {subscriptionLabels.length ? (
                                  <div className="flex flex-col gap-1 text-xs font-mono text-slate-600 dark:text-slate-300">
                                    {subscriptionLabels.map((label, idx) => (
                                      <span key={`${customer.id}-sub-${idx}`}>{label}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">No subscriptions</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                <div>{customer._count.jobs} jobs</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {customer._count.serviceVisits} visits • {customer._count.dogs} dogs
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(customer.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-2"
                                  onClick={() =>
                                    deleteCustomer(
                                      customer.id,
                                      customer.name || customer.email || customer.id,
                                    )
                                  }
                                  disabled={deletingCustomerId === customer.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {deletingCustomerId === customer.id ? "Deleting…" : "Delete"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            {customerSearchTerm.trim()
                              ? "No customers matched your search."
                              : "No customers available."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="admin-card border-rose-200/80 bg-rose-50/70 dark:border-rose-500/40 dark:bg-rose-500/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-100">
              <AlertTriangle className="h-5 w-5" />
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-rose-700 dark:text-rose-200">
            Deletions performed here are irreversible. Double check with the business owner before wiping customers or technician accounts.
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setNewUser(initialNewUser);
          }
        }}
      >
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>Provision an internal account with immediate access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUser.email}
                onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-user-name">Full name</Label>
              <Input
                id="new-user-name"
                value={newUser.name}
                onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-user-address">Street address</Label>
              <Input
                id="new-user-address"
                value={newUser.addressLine1}
                onChange={(event) =>
                  setNewUser({ ...newUser, addressLine1: event.target.value })
                }
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="new-user-city">City</Label>
                <Input
                  id="new-user-city"
                  value={newUser.city}
                  onChange={(event) => setNewUser({ ...newUser, city: event.target.value })}
                  placeholder="Austin"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-user-state">State</Label>
                <Input
                  id="new-user-state"
                  value={newUser.state}
                  onChange={(event) => setNewUser({ ...newUser, state: event.target.value })}
                  placeholder="TX"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-user-zip">ZIP</Label>
                <Input
                  id="new-user-zip"
                  value={newUser.zip}
                  onChange={(event) => setNewUser({ ...newUser, zip: event.target.value })}
                  placeholder="78701"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Roles</Label>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Select all roles for this user</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const isSelected = newUser.roles.includes(option.value as InternalRole);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleNewUserRole(option.value as InternalRole)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500"
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
              {newUser.roles.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">Select at least one role</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-user-org">Organization</Label>
              <Input
                id="new-user-org"
                value={newUser.orgId}
                onChange={(event) => setNewUser({ ...newUser, orgId: event.target.value })}
                placeholder="yardura"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createUser} disabled={creating}>
                {creating ? "Creating…" : "Create user"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) {
            setInviteUser(initialInviteUser);
          }
        }}
      >
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite business admin</DialogTitle>
            <DialogDescription>Send a welcome email and create an owner account for a partner organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteUser.email}
                onChange={(event) => setInviteUser({ ...inviteUser, email: event.target.value })}
                placeholder="owner@business.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name">Contact name</Label>
              <Input
                id="invite-name"
                value={inviteUser.name}
                onChange={(event) => setInviteUser({ ...inviteUser, name: event.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-address">Street address</Label>
              <Input
                id="invite-address"
                value={inviteUser.addressLine1}
                onChange={(event) =>
                  setInviteUser({ ...inviteUser, addressLine1: event.target.value })
                }
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="invite-city">City</Label>
                <Input
                  id="invite-city"
                  value={inviteUser.city}
                  onChange={(event) => setInviteUser({ ...inviteUser, city: event.target.value })}
                  placeholder="Austin"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-state">State</Label>
                <Input
                  id="invite-state"
                  value={inviteUser.state}
                  onChange={(event) => setInviteUser({ ...inviteUser, state: event.target.value })}
                  placeholder="TX"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-zip">ZIP</Label>
                <Input
                  id="invite-zip"
                  value={inviteUser.zip}
                  onChange={(event) => setInviteUser({ ...inviteUser, zip: event.target.value })}
                  placeholder="78701"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-org">Organization ID</Label>
              <Input
                id="invite-org"
                value={inviteUser.orgId}
                onChange={(event) => setInviteUser({ ...inviteUser, orgId: event.target.value })}
                placeholder="smith-landscaping"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Use lowercase, no spaces. This becomes the org slug.</p>
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={inviteUser.role}
                onValueChange={(value) =>
                  setInviteUser({ ...inviteUser, role: value as InternalRole })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendInvite} disabled={inviting}>
                {inviting ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rolesDialogOpen}
        onOpenChange={(open) => {
          setRolesDialogOpen(open);
          if (!open) {
            setRolesTarget(null);
            setRolesDraft([]);
          }
        }}
      >
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle>Update roles</DialogTitle>
            <DialogDescription>Adjust which portals this teammate can access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                {ROLE_OPTIONS.map((option) => {
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
                      <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500"
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
              {rolesDraft.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">Select at least one role.</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveRoles} disabled={rolesSaving || rolesDraft.length === 0}>
                {rolesSaving ? "Saving…" : "Save roles"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
