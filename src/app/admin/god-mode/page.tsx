"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Users,
  Shield,
  Database,
  Settings,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string | null;
  createdAt: string;
  _count: {
    assignedLeads: number;
    serviceVisits: number;
    accounts: number;
    dogs: number;
  };
}

export default function GodModePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    role: "CUSTOMER" as "ADMIN" | "CUSTOMER",
    orgId: "yardura",
  });
  const [inviteUser, setInviteUser] = useState({
    email: "",
    name: "",
    role: "ADMIN" as "ADMIN" | "CUSTOMER",
    orgId: "",
  });
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Only allow the owner/super admin
  const isGodModeUser = session?.user?.email === "ayden@yardura.com";

  useEffect(() => {
    if (status === "loading") return;

    if (!session || !isGodModeUser) {
      router.push("/admin");
      return;
    }

    fetchUsers();
  }, [session, status, router, isGodModeUser]);

  const fetchUsers = async () => {
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
      setLoading(false);
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

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.name.trim()) {
      toast.error("Email and name are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        const createdUser = await response.json();
        toast.success(`User ${createdUser.email} created successfully`);
        setShowCreateUser(false);
        setNewUser({
          email: "",
          name: "",
          role: "CUSTOMER",
          orgId: "yardura",
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
      !inviteUser.orgId.trim()
    ) {
      toast.error("Email, name, and organization ID are required");
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
        setShowInviteUser(false);
        setInviteUser({
          email: "",
          name: "",
          role: "ADMIN",
          orgId: "",
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

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isGodModeUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Shield className="h-6 w-6 text-red-500" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              God Mode is restricted to system administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">God Mode Admin Panel</h1>
        </div>
        <p className="text-muted-foreground">
          Ultimate system control - Owner access only
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === "ADMIN").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u._count.assignedLeads, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Service Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u._count.serviceVisits, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => {
                  setShowCreateUser(!showCreateUser);
                  setShowInviteUser(false);
                }}
                variant={showCreateUser ? "default" : "outline"}
              >
                {showCreateUser ? "Cancel" : "Create User"}
              </Button>
              <Button
                onClick={() => {
                  setShowInviteUser(!showInviteUser);
                  setShowCreateUser(false);
                }}
                variant={showInviteUser ? "default" : "outline"}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {showInviteUser ? "Cancel" : "Invite Business Admin"}
              </Button>
            </div>

            {showCreateUser && (
              <Card className="p-4 bg-slate-50 border-slate-200">
                <h3 className="text-lg font-medium mb-4">Create New User</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          role: e.target.value as "ADMIN" | "CUSTOMER",
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={newUser.orgId}
                      onChange={(e) =>
                        setNewUser({ ...newUser, orgId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="yardura"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createUser}
                    disabled={creating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {creating ? "Creating..." : "Create User"}
                  </Button>
                  <Button
                    onClick={() => setShowCreateUser(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {showInviteUser && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-medium mb-4">
                  Invite Business Admin
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  Create an admin account for a new business and send them an
                  invitation email with setup instructions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteUser.email}
                      onChange={(e) =>
                        setInviteUser({ ...inviteUser, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin@business.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">
                      Business Contact Name
                    </label>
                    <input
                      type="text"
                      value={inviteUser.name}
                      onChange={(e) =>
                        setInviteUser({ ...inviteUser, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">
                      Organization ID
                    </label>
                    <input
                      type="text"
                      value={inviteUser.orgId}
                      onChange={(e) =>
                        setInviteUser({ ...inviteUser, orgId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="businessname"
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      Use lowercase, no spaces (e.g., "smithlandscaping")
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">
                      Role
                    </label>
                    <select
                      value={inviteUser.role}
                      onChange={(e) =>
                        setInviteUser({
                          ...inviteUser,
                          role: e.target.value as "ADMIN" | "CUSTOMER",
                        })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ADMIN">Admin (Business Owner)</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={sendInvite}
                    disabled={inviting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {inviting
                      ? "Sending Invitation..."
                      : "Create Account & Send Invite"}
                  </Button>
                  <Button
                    onClick={() => setShowInviteUser(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{user.email}</h3>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                    {user.orgId && (
                      <Badge variant="outline">{user.orgId}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.name && <span>Name: {user.name} • </span>}
                    <span>
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                    <span className="ml-4">
                      Leads: {user._count.assignedLeads}
                    </span>
                    <span className="ml-4">
                      Visits: {user._count.serviceVisits}
                    </span>
                    <span className="ml-4">Dogs: {user._count.dogs}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.role !== "ADMIN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promoteUser(user.id, user.email)}
                    >
                      Promote
                    </Button>
                  )}
                  {user.role === "ADMIN" &&
                    user.email !== "ayden@yardura.com" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => demoteUser(user.id, user.email)}
                      >
                        Demote
                      </Button>
                    )}
                  {user.email !== "ayden@yardura.com" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(user.id, user.email)}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800">God Mode Warning</h3>
            <p className="text-sm text-yellow-700 mt-1">
              This panel provides ultimate system control. Actions here can
              permanently delete data. Only the system owner has access to this
              panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
