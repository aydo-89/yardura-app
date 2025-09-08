// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React from 'react';
import type { ServiceVisit } from '../types';

interface ServicesTabProps {
  serviceVisits: ServiceVisit[];
  nextServiceAt: Date | null;
  daysUntilNext: number | null;
  lastCompletedAt: Date | null;
  serviceStreak: number;
  user: any; // Will be properly typed later
}

export default function ServicesTab({ serviceVisits, nextServiceAt, daysUntilNext, lastCompletedAt, serviceStreak, user }: ServicesTabProps) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📅</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Services Tab</h3>
      <p className="text-slate-600 mb-4">
        Service scheduling and history will be available here.
      </p>
      <div className="text-sm text-slate-500">
        <p>Total services: {serviceVisits.length}</p>
        <p>Service streak: {serviceStreak}</p>
        {nextServiceAt && <p>Next service: {nextServiceAt.toLocaleDateString()}</p>}
      </div>
    </div>
  );
}
