import { Metadata } from 'next';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SalesRepForm from '@/components/admin/SalesRepForm';

export const metadata: Metadata = {
  title: 'Create Sales Rep • Yardura Admin',
};

export default async function CreateSalesRepPage() {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string };
  } | null;

  if (!session?.user?.id) {
    redirect('/signin');
  }

  // Check if user is admin
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!session.user.email || !adminEmails.includes(session.user.email.toLowerCase())) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Sales Representative</h1>
          <p className="text-gray-600 mt-2">
            Create a new sales rep account with commission tracking.
          </p>
        </div>

        <SalesRepForm />
      </div>
    </div>
  );
}
