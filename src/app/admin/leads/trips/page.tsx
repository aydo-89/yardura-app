'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Calendar, Map as MapIcon, MapPin, Route, ListChecks, Loader2, ArrowUpDown, Users } from 'lucide-react';

interface TripStopLead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  pipelineStage?: string | null;
  stageColor?: string | null;
  nextActionAt?: string | null;
}

interface TripStop {
  id: string;
  order: number;
  status: string;
  plannedAt?: string | null;
  arrivalAt?: string | null;
  lead?: TripStopLead | null;
}

interface Trip {
  id: string;
  name?: string | null;
  optimization: string;
  status: string;
  plannedStart?: string | null;
  createdAt: string;
  owner?: { id: string; name?: string | null; email?: string | null } | null;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
  territory?: { id: string; name: string; color?: string | null } | null;
  stops?: TripStop[];
}

interface OutboundLeadForTrip {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  pipelineStage?: string | null;
  stageColor?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  nextActionAt?: string | null;
  territory?: { id: string; name: string; color?: string | null } | null;
}

interface TerritoryOption {
  id: string;
  name: string;
  color?: string | null;
}

function stageBadgeColor(stageColor?: string | null) {
  switch (stageColor) {
    case 'cyan':
      return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case 'blue':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'green':
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'amber':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'rose':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ') || 'Unnamed';
}

function haversineDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3; // metres
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const aa = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c;
}

export default function TripPlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [leads, setLeads] = useState<OutboundLeadForTrip[]>([]);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [tripName, setTripName] = useState('Morning Canvass');
  const [tripTerritoryId, setTripTerritoryId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    const userRole = (session as any)?.userRole;
    const allowed = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER', 'SALES_REP'];

    if (!session || !allowed.includes(userRole)) {
      router.push('/dashboard');
      return;
    }

    void fetchTrips();
    void fetchLeads();
    void fetchTerritories();
  }, [session, status, router]);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load trips');
      setTrips(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/outbound?leadType=outbound&limit=250');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load outbound leads');
      setLeads(json.data.leads ?? []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTerritories = useCallback(async () => {
    try {
      const res = await fetch('/api/territories');
      if (res.status === 403) {
        setTerritories([]);
        return;
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load territories');
      setTerritories(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const moveLead = (leadId: string, direction: 'up' | 'down') => {
    setSelectedLeadIds((prev) => {
      const index = prev.indexOf(leadId);
      if (index === -1) return prev;
      const newOrder = [...prev];
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= newOrder.length) return prev;
      [newOrder[index], newOrder[swapWith]] = [newOrder[swapWith], newOrder[index]];
      return newOrder;
    });
  };

  const selectedLeads = useMemo(
    () => selectedLeadIds.map((id) => leads.find((lead) => lead.id === id)).filter(Boolean) as OutboundLeadForTrip[],
    [selectedLeadIds, leads]
  );

  const formattedTrips = useMemo(
    () =>
      trips.map((trip) => ({
        ...trip,
        stops: (trip.stops ?? []).sort((a, b) => a.order - b.order),
      })),
    [trips]
  );

  const optimizeOrder = () => {
    if (selectedLeadIds.length < 3) return; // already trivial order

    const lookup = new Map<string, OutboundLeadForTrip>(
      leads.map((lead) => [lead.id, lead] as const)
    );
    const candidates = selectedLeadIds
      .map((id) => lookup.get(id))
      .filter((lead): lead is OutboundLeadForTrip => Boolean(lead && lead.latitude != null && lead.longitude != null));

    if (candidates.length !== selectedLeadIds.length) {
      setCreateError('One or more selected stops is missing coordinates.');
      return;
    }

    const remaining = new Set(candidates.map((lead) => lead.id));
    const ordered: string[] = [];
    let current = candidates[0];
    remaining.delete(current.id);
    ordered.push(current.id);

    while (remaining.size) {
      let nextId: string | null = null;
      let bestDistance = Infinity;

      for (const id of remaining) {
        const candidate = lookup.get(id)!;
        const distance = haversineDistance(
          { latitude: current.latitude!, longitude: current.longitude! },
          { latitude: candidate.latitude!, longitude: candidate.longitude! }
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          nextId = id;
        }
      }

      if (!nextId) break;

      remaining.delete(nextId);
      ordered.push(nextId);
      current = lookup.get(nextId)!;
    }

    setSelectedLeadIds(ordered);
  };

  const createTrip = async () => {
    setCreateError(null);
    setCreateSubmitting(true);

    if (!tripName.trim()) {
      setCreateError('Give your trip a name.');
      setCreateSubmitting(false);
      return;
    }

    if (selectedLeadIds.length === 0) {
      setCreateError('Select at least one lead to build a trip.');
      setCreateSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: tripName.trim(),
        territoryId: tripTerritoryId || undefined,
        leadIds: selectedLeadIds,
        optimization: 'fastest' as const,
      };

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to create trip');
      }

      setIsCreateSheetOpen(false);
      setTripName('Morning Canvass');
      setTripTerritoryId('');
      setSelectedLeadIds([]);
      await fetchTrips();
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Derived state used by jump selector; guard when no coordinates
  const leadsWithCoordinates: OutboundLeadForTrip[] = useMemo(
    () => leads.filter((l) => l.latitude != null && l.longitude != null),
    [leads]
  );
  const [mapLeadSelection, setMapLeadSelection] = useState<string>('');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trips & Route Planner</h1>
          <p className="text-slate-600">
            Build canvassing loops, log mileage, and review stop-by-stop plans across territories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {leadsWithCoordinates.length > 0 && (
            <Select
              value={mapLeadSelection}
              onValueChange={(value) => {
                setMapLeadSelection(value);
                if (value) {
                  const params = new URLSearchParams({ focus: value });
                  router.push(`/admin/leads/outbound?${params.toString()}`);
                }
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Jump to lead" />
              </SelectTrigger>
              <SelectContent>
                {leadsWithCoordinates.map((lead) => {
                  const name = formatName(lead.firstName, lead.lastName);
                  const subtitle = [lead.city, lead.state].filter(Boolean).join(', ');
                  return (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex flex-col text-left">
                        <span>{name}</span>
                        {subtitle ? <span className="text-xs text-slate-500">{subtitle}</span> : null}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => fetchTrips()} className="gap-2">
            <ArrowUpDown className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateSheetOpen(true)}>
            <Route className="w-4 h-4" />
            New trip
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-slate-600" /> Active Trips
            </CardTitle>
            <CardDescription>
              Trips sync automatically with the outbound map; stops stay ordered for the day’s run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formattedTrips.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-500">
                No trips yet. Use “New trip” to select a set of canvass stops.
              </div>
            ) : (
              <div className="space-y-6">
                {formattedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {trip.name || 'Untitled Trip'}
                          </h3>
                          <Badge variant="outline" className="capitalize">
                            {trip.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" /> {trip.stops?.length ?? 0} stops
                          </span>
                          {trip.plannedStart && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(trip.plannedStart)}
                            </span>
                          )}
                          {trip.owner && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />{' '}
                              {trip.owner.name || trip.owner.email}
                            </span>
                          )}
                          {trip.territory && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {trip.territory.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          if (!trip.stops?.length) return;
                          const firstStop = trip.stops[0];
                          if (firstStop?.lead?.id) {
                            const params = new URLSearchParams({ focus: firstStop.lead.id });
                            router.push(`/admin/leads/outbound?${params.toString()}`);
                          }
                        }}
                      >
                        <MapIcon className="w-4 h-4" /> View on map
                      </Button>
                    </div>
                    <Separator className="my-4" />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Stop</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Next Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(trip.stops ?? []).map((stop) => (
                          <TableRow key={stop.id}>
                            <TableCell className="font-mono text-xs text-slate-500">{stop.order}</TableCell>
                            <TableCell>
                              {stop.lead ? (
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {formatName(stop.lead.firstName, stop.lead.lastName)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {[stop.lead.city, stop.lead.state].filter(Boolean).join(', ')}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Lead removed</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {stop.lead?.pipelineStage ? (
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs capitalize', stageBadgeColor(stop.lead.stageColor))}
                                >
                                  {stop.lead.pipelineStage}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">unknown</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {formatDate(stop.lead?.nextActionAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-600" /> Trip Builder Tips
            </CardTitle>
            <CardDescription>Quick reminders while we finish the full route optimizer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              Select leads with latitude/longitude. You can grab them from the outbound map by dropping pins.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              Trips keep the order you pick; drag/drop optimization and distance estimates are coming next.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              Once created, the trip appears on the outbound map. Use the map’s jump selector to bring it into view.
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create a canvassing trip</SheetTitle>
            <SheetDescription>
              Pick the stops to visit today. We’ll keep them in this order until optimization is available.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 pb-6">
            {createError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Trip name</label>
              <Input value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="North loop" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Territory</label>
              <Select value={tripTerritoryId} onValueChange={setTripTerritoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {territories.map((territory) => (
                    <SelectItem key={territory.id} value={territory.id}>
                      {territory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Stops ({selectedLeadIds.length})</label>
                <div className="text-xs text-slate-500">Check to add, reorder below.</div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                {leads.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No outbound leads available. Add some first.</div>
                ) : (
                  leads.map((lead) => {
                    const disabled = lead.latitude == null || lead.longitude == null;
                    const checked = selectedLeadIds.includes(lead.id);
                    return (
                      <label
                        key={lead.id}
                        className={cn('flex items-start gap-3 p-3 text-sm', disabled && 'opacity-50')}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleLead(lead.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {formatName(lead.firstName, lead.lastName)}
                            </span>
                            {lead.pipelineStage && (
                              <Badge
                                variant="outline"
                                className={cn('text-xs capitalize', stageBadgeColor(lead.stageColor))}
                              >
                                {lead.pipelineStage}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {[lead.city, lead.state].filter(Boolean).join(', ') || 'No address'}
                          </div>
                          {disabled && (
                            <div className="text-[11px] text-amber-600">
                              Add coordinates from the outbound map before using this lead in a trip.
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {selectedLeads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-700">Trip order</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={optimizeOrder}
                      disabled={selectedLeadIds.length < 3}
                    >
                      <ArrowUpDown className="w-3 h-3" /> Optimize order
                    </Button>
                    <div className="text-xs text-slate-500">First stop at the top</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedLeads.map((lead, index) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 bg-slate-50"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {index + 1}. {formatName(lead.firstName, lead.lastName)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {[lead.city, lead.state].filter(Boolean).join(', ') || 'No address'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => moveLead(lead.id, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => moveLead(lead.id, 'down')}
                          disabled={index === selectedLeads.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <SheetFooter>
            <Button onClick={createTrip} disabled={createSubmitting} className="gap-2">
              {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save trip
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
