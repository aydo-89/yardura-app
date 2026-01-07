import type { DashboardServiceVisit } from "@/components/dashboard/types";
import { CalendarDays, Camera } from "lucide-react";

interface Props {
  visits: DashboardServiceVisit[];
}

export default function MobileVisitTimeline({ visits }: Props) {
  if (!visits.length) {
    return (
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-slate-400">
        No visits yet. Your next visit will appear here once scheduled.
      </section>
    );
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
      <header className="flex items-center gap-2 text-slate-300 text-sm">
        <CalendarDays className="h-4 w-4" aria-hidden />
        Upcoming & recent visits
      </header>
      <ul className="space-y-3">
        {visits.map((visit) => {
          const visitDate = new Date(visit.scheduledDate);
          const isUpcoming = visitDate.getTime() > Date.now();
          return (
            <li key={visit.id} className="flex items-start gap-3">
              <span
                className={`mt-1 block h-2 w-2 rounded-full ${
                  isUpcoming ? "bg-brand-mint" : "bg-slate-500"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">
                  {visitDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-slate-400">
                  {visit.status.toLowerCase()} • {visit.serviceType}
                </p>
                {visit.media?.length ? (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Camera className="h-3 w-3" aria-hidden />
                    {visit.media.length} media item
                    {visit.media.length > 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
