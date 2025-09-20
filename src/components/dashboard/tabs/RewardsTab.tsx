// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import type { User } from '../types';

interface RewardsTabProps {
  user: User;
}

export default function RewardsTab({ user }: RewardsTabProps) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🏆</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Rewards Tab</h3>
      <p className="text-slate-600">Earn and redeem rewards for your loyalty.</p>
    </div>
  );
}
