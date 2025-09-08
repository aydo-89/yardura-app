// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import type { User } from '../types';

interface BillingTabProps {
  user: User;
}

export default function BillingTab({ user }: BillingTabProps) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">💳</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Billing Tab</h3>
      <p className="text-slate-600">
        Manage your billing and payment information.
      </p>
      <div className="mt-4 text-sm text-slate-500">
        <p>Status: {user.stripeCustomerId ? 'Active' : 'Not set'}</p>
      </div>
    </div>
  );
}
