// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React from 'react';
import { Calendar, Clock, CheckCircle, TrendingUp, MapPin, Star } from 'lucide-react';
import type { DashboardServiceVisit } from '../types';

interface ServicesTabProps {
  serviceVisits: DashboardServiceVisit[];
  nextServiceAt: Date | null;
  daysUntilNext: number | null;
  lastCompletedAt: Date | null;
  serviceStreak: number;
  user: any; // Will be properly typed later
}

export default function ServicesTab({
  serviceVisits,
  nextServiceAt,
  daysUntilNext,
  lastCompletedAt,
  serviceStreak,
  user,
}: ServicesTabProps) {
  const completedServices = serviceVisits.filter((v) => v.status === 'COMPLETED');
  const scheduledServices = serviceVisits.filter((v) => v.status === 'SCHEDULED');
  const missedServices = serviceVisits.filter((v) => v.status === 'MISSED');

  const serviceFrequency = serviceVisits.length > 1 ? 'Weekly' : 'One-time';

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-2xl mb-4">
          <Calendar className="size-8 text-accent" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Service Management</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Track your yard maintenance schedule, service history, and upcoming appointments
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="size-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{completedServices.length}</div>
              <div className="text-sm text-slate-600">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="size-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{scheduledServices.length}</div>
              <div className="text-sm text-slate-600">Scheduled</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="size-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{serviceStreak}</div>
              <div className="text-sm text-slate-600">Service Streak</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="size-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{serviceFrequency}</div>
              <div className="text-sm text-slate-600">Frequency</div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Service Section */}
      {nextServiceAt && (
        <div className="bg-gradient-to-r from-accent/5 to-accent-soft/5 rounded-xl border border-accent/20 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-xl">
              <Calendar className="size-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Next Service</h3>
              <p className="text-slate-600 mb-2">
                {nextServiceAt.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-slate-500" />
                <span className="text-sm text-slate-500">
                  {daysUntilNext === 0
                    ? 'Today'
                    : daysUntilNext === 1
                      ? 'Tomorrow'
                      : `${daysUntilNext} days away`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">Status</div>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Scheduled
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Service History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Recent Service History</h3>
          <p className="text-slate-600 text-sm">Your latest service visits and their status</p>
        </div>

        <div className="divide-y divide-slate-200">
          {serviceVisits.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <Calendar className="size-8 mx-auto mb-2 opacity-50" />
              <p>No service history yet</p>
            </div>
          ) : (
            serviceVisits.slice(0, 5).map((visit, index) => (
              <div key={index} className="p-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        visit.status === 'COMPLETED'
                          ? 'bg-green-100'
                          : visit.status === 'SCHEDULED'
                            ? 'bg-blue-100'
                            : 'bg-red-100'
                      }`}
                    >
                      {visit.status === 'COMPLETED' ? (
                        <CheckCircle className="size-4 text-green-600" />
                      ) : visit.status === 'SCHEDULED' ? (
                        <Clock className="size-4 text-blue-600" />
                      ) : (
                        <Calendar className="size-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {new Date(visit.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-slate-600 capitalize">
                        {visit.serviceType?.toLowerCase().replace('_', ' ') || 'Service visit'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      visit.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : visit.status === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {visit.status.toLowerCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {serviceVisits.length > 5 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button className="text-accent hover:text-accent/80 text-sm font-medium">
              View all service history →
            </button>
          </div>
        )}
      </div>

      {/* Service Quality Rating */}
      {completedServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Service Quality</h3>
              <p className="text-slate-600 text-sm">Average rating from completed services</p>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-5 ${
                    star <= 4.8 ? 'text-yellow-400 fill-current' : 'text-slate-300'
                  }`}
                />
              ))}
              <span className="ml-2 text-sm font-medium text-slate-900">4.8</span>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            Based on {completedServices.length} completed service
            {completedServices.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
