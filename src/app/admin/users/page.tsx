'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Building } from 'lucide-react';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    orgId: '',
    role: 'ADMIN',
  });

  // Redirect if not admin
  if (status === 'loading') return <div>Loading...</div>;

  const userRole = (session as any)?.userRole;
  if (!session || (userRole !== 'ADMIN' && userRole !== 'OWNER')) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();
      toast.success('User created successfully!');

      // Reset form
      setFormData({
        email: '',
        name: '',
        orgId: '',
        role: 'ADMIN',
      });

      // Show temp password in development
      if (result.tempPassword) {
        toast.info(`Temp password: ${result.tempPassword}`, { duration: 10000 });
      }

    } catch (error: any) {
      toast.error(error.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
      <div className="container mx-auto p-6 pt-20">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl shadow-xl">
              <UserPlus className="size-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">User Management</h1>
              <p className="text-lg text-slate-600 font-medium">
                Create accounts for new business partners
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="size-5" />
                Create Business Admin Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="admin@business.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Business Admin"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orgId">Organization ID *</Label>
                    <Input
                      id="orgId"
                      value={formData.orgId}
                      onChange={(e) => setFormData(prev => ({ ...prev, orgId: e.target.value }))}
                      placeholder="business-name"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Unique identifier for the business organization
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="OWNER">Owner</SelectItem>
                        <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Account will be created with a temporary password</li>
                    <li>• User will receive login credentials via email</li>
                    <li>• They can access the admin dashboard at /admin</li>
                    <li>• They can invite additional team members</li>
                  </ul>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating Account...' : 'Create Business Account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

