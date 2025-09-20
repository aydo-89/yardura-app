'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Activity,
  TimerReset,
  Filter,
  Plus,
  Loader2,
  Map,
  List,
  UserPlus,
  MapPinPlus,
  Crosshair,
  LocateFixed,
  Users as UsersIcon,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface OutboundLead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadType: string;
  pipelineStage?: string | null;
  stageColor?: string;
  owner?: { id: string; name?: string | null; email?: string | null } | null;
  territory?: { id: string; name: string; color?: string | null } | null;
  address?: string | null;
  lastActivity?: {
    id: string;
    type: string;
    result?: string | null;
    occurredAt: string;
  } | null;
  submittedAt: string;
  lastActivityAt?: string | null;
  nextActionAt?: string | null;
  nextActionSlaMinutes?: number | null;
  preferredStartDate?: string | null;
  preferredContactMethods?: string[] | null;
  howDidYouHear?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface TerritoryOption {
  id: string;
  name: string;
  color?: string | null;
}

interface NewLeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  pipelineStage: string;
  territoryId: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface FocusTarget extends Coordinates {
  key: number;
}

interface TeamLocation {
  userId: string;
  name?: string | null;
  email?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  occurredAt: string;
}

const activityTypes = [
  { value: 'DOOR_KNOCK', label: 'Door Knock' },
  { value: 'CALL', label: 'Call' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Note' },
];

interface ApiResponse {
  ok: boolean;
  data: {
    leads: OutboundLead[];
    pageInfo: { nextCursor?: string | null };
  };
  error?: string;
}

const stageOptions = [
  { value: 'all', label: 'All stages' },
  { value: 'cold', label: 'Cold' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

function makeNewLeadForm(): NewLeadForm {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    pipelineStage: 'cold',
    territoryId: 'UNASSIGNED',
  };
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

function formatRelativeMinutes(diffMinutes: number | null | undefined) {
  if (diffMinutes === null || diffMinutes === undefined) return '—';
  if (!Number.isFinite(diffMinutes)) return '—';
  if (diffMinutes === 0) return 'Due now';
  if (diffMinutes > 0) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = Math.abs(Math.round(diffMinutes % 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }
  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = Math.abs(Math.round(abs % 60));
  if (hours > 0) return `${hours}h ${minutes}m overdue`;
  return `${minutes}m overdue`;
}

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function stageBadgeColor(stageColor?: string) {
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

export default function OutboundLeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<OutboundLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<OutboundLead | null>(null);
  const [selectedLead, setSelectedLead] = useState<OutboundLead | null>(null);
  const [activityType, setActivityType] = useState<string>('DOOR_KNOCK');
  const [activityNotes, setActivityNotes] = useState('');
  const [activityResult, setActivityResult] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NewLeadForm>(() => makeNewLeadForm());
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<Coordinates | null>(null);
  const [isDroppingPin, setIsDroppingPin] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'pending' | 'ready' | 'denied'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<FocusTarget | null>(null);
  const [mapLeadSelection, setMapLeadSelection] = useState<string>('');
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [showTeamRadar, setShowTeamRadar] = useState(false);
  const [locationErrorDismissed, setLocationErrorDismissed] = useState(false);

  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    setUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    setLocationStatus('ready');
    setLocationError(null);
    setLocationErrorDismissed(false);
  }, []);

  const handleLocationError = useCallback((geoError: GeolocationPositionError) => {
    console.warn('Geolocation error', geoError);
    setLocationStatus('denied');
    const message =
      geoError.code === geoError.PERMISSION_DENIED
        ? 'Location permission denied. Enable location access to use “Locate me”.'
        : 'Unable to determine your current location.';
    setLocationError(message);
    setLocationErrorDismissed(false);
  }, []);

  const fetchLeads = useCallback(async (cursor?: string | null) => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('leadType', 'outbound');
    params.set('limit', '100');
    if (searchTerm) params.set('search', searchTerm);
    if (stageFilter !== 'all') params.set('pipelineStage', stageFilter);
    if (cursor) params.set('cursor', cursor);

    try {
      const res = await fetch(`/api/leads/outbound?${params.toString()}`);
      const json: ApiResponse = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Failed to load outbound leads');
      }

      setLeads(json.data.leads);
      setNextCursor(json.data.pageInfo.nextCursor ?? null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, stageFilter]);

  const fetchTerritories = useCallback(async () => {
    try {
      const response = await fetch('/api/territories');
      if (!response.ok) {
        if (response.status === 403) {
          // Sales reps don't have territory management access yet; skip silently.
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load territories');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load territories');
      }

      setTerritories(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    const userRole = (session as any)?.userRole;
    const allowed = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER', 'SALES_REP'];

    if (!session || !allowed.includes(userRole)) {
      router.push('/dashboard');
      return;
    }

    void fetchLeads();
    void fetchTerritories();
  }, [session, status, router, fetchLeads, fetchTerritories]);

  useEffect(() => {
    if (!searchParams) return;
    const focusId = searchParams.get('focus');
    if (focusId) {
      setPendingFocusId(focusId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'loading') return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchTeamLocations = async () => {
      try {
        const res = await fetch('/api/leads/outbound/team');
        if (res.status === 403) {
          setTeamLocations([]);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Failed to load team locations');
        if (!cancelled) {
          setTeamLocations(Array.isArray(json.data) ? json.data : []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setTeamLocations([]);
        }
      }
    };

    void fetchTeamLocations();
    intervalId = setInterval(fetchTeamLocations, 30000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [status]);

  useEffect(() => {
    if (!locationError) {
      setLocationErrorDismissed(false);
    }
  }, [locationError]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus('denied');
      setLocationError('Location services are unavailable in this browser.');
      return;
    }

    const geo = navigator.geolocation;
    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 15_000,
    };

    setLocationStatus('pending');
    setLocationError(null);
    setLocationErrorDismissed(false);

    const watchId = geo.watchPosition(handleLocationSuccess, handleLocationError, options);
    geo.getCurrentPosition(handleLocationSuccess, handleLocationError, options);

    return () => {
      geo.clearWatch(watchId);
    };
  }, [handleLocationError, handleLocationSuccess]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void fetchLeads();
  };

  useEffect(() => {
    if (viewMode !== 'map') {
      setSelectedLead(null);
      if (isDroppingPin) {
        setIsDroppingPin(false);
      }
    }
  }, [viewMode, isDroppingPin]);

  const resetActivityForm = () => {
    setActivityType('DOOR_KNOCK');
    setActivityNotes('');
    setActivityResult('');
  };

  const handleCreateFieldChange = useCallback((field: keyof NewLeadForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const beginCreateLead = useCallback(
    (coords?: Coordinates | null) => {
      setCreateForm(makeNewLeadForm());
      setPendingCoordinates(coords ?? null);
      setCreateError(null);
      setIsDroppingPin(false);
      setIsCreateSheetOpen(true);
    },
    []
  );

  const handlePinCaptured = useCallback(
    (coords: Coordinates) => {
      beginCreateLead(coords);
    },
    [beginCreateLead]
  );

  const requestLocationRefresh = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus('denied');
      setLocationError('Location services are unavailable in this browser.');
      return;
    }

    setLocationStatus('pending');
    setLocationError(null);
    setLocationErrorDismissed(false);

    navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  }, [handleLocationError, handleLocationSuccess]);

const jumpToLeadOnMap = useCallback((lead: OutboundLead) => {
  setPendingFocusId(lead.id);
  setViewMode('map');
}, []);

  useEffect(() => {
    if (!pendingFocusId || !leads.length) return;
    const target = leads.find((lead) => lead.id === pendingFocusId);
    if (!target) return;

    setSelectedLead(target);
    setIsDroppingPin(false);
    setViewMode('map');
    if (target.latitude != null && target.longitude != null) {
      setMapFocus({ latitude: target.latitude, longitude: target.longitude, key: Date.now() });
    }
    setMapLeadSelection(target.id);
    setPendingFocusId(null);
  }, [pendingFocusId, leads]);

  const submitNewLead = useCallback(async () => {
    setCreateSubmitting(true);
    setCreateError(null);

    const trimmedFirst = createForm.firstName.trim();
    const trimmedLast = createForm.lastName.trim();
    const trimmedEmail = createForm.email.trim();
    const trimmedPhone = createForm.phone.trim();
    const trimmedAddress = createForm.address.trim();
    const trimmedCity = createForm.city.trim();
    const trimmedState = createForm.state.trim();
    const trimmedZip = createForm.zipCode.trim();

    const hasName = Boolean(trimmedFirst || trimmedLast);
    const hasContact = Boolean(trimmedEmail || trimmedPhone);
    const hasLocation = Boolean(
      trimmedAddress || trimmedCity || trimmedState || trimmedZip || pendingCoordinates
    );

    if (!hasName && !hasContact && !hasLocation) {
      setCreateError('Please add at least a name, contact method, or address before saving.');
      setCreateSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      pipelineStage: createForm.pipelineStage || 'cold',
    };

    if (trimmedFirst) payload.firstName = trimmedFirst;
    if (trimmedLast) payload.lastName = trimmedLast;
    if (trimmedEmail) payload.email = trimmedEmail;
    if (trimmedPhone) payload.phone = trimmedPhone;
    const territoryId = createForm.territoryId === 'UNASSIGNED' ? '' : createForm.territoryId;
    if (territoryId) payload.territoryId = territoryId;

    const includeAddress = hasLocation;
    if (includeAddress) {
      payload.address = {
        line1: trimmedAddress || undefined,
        city: trimmedCity || undefined,
        state: trimmedState ? trimmedState.toUpperCase() : undefined,
        zip: trimmedZip || undefined,
        latitude: pendingCoordinates?.latitude,
        longitude: pendingCoordinates?.longitude,
      };
    }

    try {
      const response = await fetch('/api/leads/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create lead');
      }

      setIsCreateSheetOpen(false);
      setCreateForm(makeNewLeadForm());
      setPendingCoordinates(null);
      await fetchLeads();
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, pendingCoordinates, fetchLeads]);

  const openActivitySheet = (lead: OutboundLead) => {
    setActiveLead(lead);
    resetActivityForm();
    setIsSheetOpen(true);
  };

  const submitActivity = async () => {
    if (!activeLead) return;
    setActivitySubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${activeLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activityType,
          notes: activityNotes,
          result: activityResult,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to log activity');
      }

      setIsSheetOpen(false);
      await fetchLeads();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setActivitySubmitting(false);
    }
  };

  const leadCountByStage = useMemo(() => {
    return leads.reduce<Record<string, number>>((acc, lead) => {
      const stage = (lead.pipelineStage || 'unknown').toLowerCase();
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});
  }, [leads]);

  const leadsWithCoordinates = useMemo(
    () => leads.filter((lead) => lead.latitude != null && lead.longitude != null),
    [leads]
  );

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Outbound Pipeline</h1>
          <p className="text-gray-600">Territory canvassing, door-knock tracking, and follow-up workload.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4" /> Table
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setViewMode('map')}
            >
              <Map className="w-4 h-4" /> Map
            </Button>
          </div>
          {viewMode === 'map' && leadsWithCoordinates.length > 0 && (
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
                  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unnamed lead';
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
          {viewMode === 'map' && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setViewMode('map');
                requestLocationRefresh();
              }}
              disabled={locationStatus === 'pending'}
            >
              <LocateFixed className="w-4 h-4" />
              {locationStatus === 'pending' ? 'Locating…' : 'Locate me'}
            </Button>
          )}
          {viewMode === 'map' && (
            <Button
              variant={showTeamRadar ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setShowTeamRadar((prev) => !prev)}
            >
              <UsersIcon className="w-4 h-4" />
              {showTeamRadar ? 'Hide team' : 'Team radar'}
            </Button>
          )}
          {viewMode === 'map' && (
            <Button
              variant={isDroppingPin ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setIsDroppingPin((prev) => !prev)}
            >
              <MapPinPlus className="w-4 h-4" />
              {isDroppingPin ? 'Cancel drop' : 'Drop pin'}
            </Button>
          )}
          <Button variant="outline" onClick={() => fetchLeads()} className="gap-2">
            <Filter className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => beginCreateLead()}>
            <UserPlus className="w-4 h-4" />
            New prospect
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stageOptions
          .filter((option) => option.value !== 'all')
          .map((option) => (
            <Card key={option.value}>
              <CardContent className="py-4">
                <div className="text-xs uppercase text-gray-500">{option.label}</div>
                <div className="text-2xl font-semibold">
                  {leadCountByStage[option.value] ?? 0}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {viewMode === 'table' ? (
        <Card>
          <CardHeader>
            <CardTitle>Lead List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px]">
              <Input
                placeholder="Search by name, email, phone, or city"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-[200px]">
              <Select value={stageFilter} onValueChange={(value) => setStageFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="gap-2">
              <Filter className="w-4 h-4" /> Apply
            </Button>
          </form>

          {error && (
            <div className="p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage & Owner</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Last Touch</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unnamed lead';
                  const ownerName = lead.owner?.name || lead.owner?.email || 'Unassigned';
                  const territoryLabel = lead.territory?.name || 'Unassigned';
                  const nextSlaClass = lead.nextActionSlaMinutes && lead.nextActionSlaMinutes < 0
                    ? 'text-rose-600'
                    : 'text-slate-600';

                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{fullName}</div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" /> {lead.email || 'No email'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" /> {lead.phone || 'No phone'}
                          </div>
                          {(lead.city || lead.zipCode) && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="w-3 h-3" />
                              {[lead.city, lead.state, lead.zipCode].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant="outline"
                            className={cn('border text-xs capitalize', stageBadgeColor(lead.stageColor))}
                          >
                            {lead.pipelineStage || 'Unknown'}
                          </Badge>
                          <div className="text-sm text-gray-600">{ownerName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="font-medium text-gray-900">{territoryLabel}</div>
                          {lead.territory?.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: lead.territory.color }}
                            />
                          )}
                          {lead.howDidYouHear && (
                            <div className="text-xs text-gray-500">Source: {lead.howDidYouHear}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className={cn('font-medium', nextSlaClass)}>
                            {formatRelativeMinutes(lead.nextActionSlaMinutes)}
                          </div>
                          <div className="text-gray-500 text-xs flex items-center gap-1">
                            <TimerReset className="w-3 h-3" />
                            {formatDate(lead.nextActionAt)}
                          </div>
                          {lead.preferredStartDate && (
                            <div className="text-xs text-gray-500">
                              Prefers start: {formatDate(lead.preferredStartDate)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-gray-600">
                          {lead.lastActivity ? (
                            <>
                              <div className="flex items-center gap-1 text-gray-700 font-medium">
                                <Activity className="w-3 h-3" />
                                {lead.lastActivity.type.toLowerCase().replace('_', ' ')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(lead.lastActivity.occurredAt)}
                              </div>
                              {lead.lastActivity.result && (
                                <div className="text-xs text-gray-500">
                                  Result: {lead.lastActivity.result}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">No activity yet</span>
                          )}
                        </div>
                      </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(lead.submittedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 text-slate-600"
                          onClick={() => jumpToLeadOnMap(lead)}
                          disabled={lead.latitude == null || lead.longitude == null}
                        >
                          <MapPin className="w-3 h-3" /> Map
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => openActivitySheet(lead)}>
                          <Plus className="w-3 h-3" /> Log activity
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                      No outbound leads found. Try adjusting filters or adding new prospects.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

         {nextCursor && (
            <div className="text-center">
              <Button variant="outline" onClick={() => fetchLeads(nextCursor)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              {error}
            </div>
          )}
          <OutboundMap
            leads={leads}
            onMarkerSelect={(lead) => {
              setSelectedLead(lead);
              if (lead.latitude != null && lead.longitude != null) {
                setMapFocus({ latitude: lead.latitude, longitude: lead.longitude, key: Date.now() });
              }
            }}
            stageColorFor={stageBadgeColor}
            dropMode={isDroppingPin}
            onNewPin={handlePinCaptured}
            pendingPin={pendingCoordinates}
            userLocation={userLocation}
            focusTarget={mapFocus}
            onFocusConsumed={() => setMapFocus(null)}
            teamLocations={teamLocations}
            showTeamRadar={showTeamRadar}
          />
          {isDroppingPin && (
            <div className="absolute top-4 right-4 max-w-xs rounded-xl border border-dashed border-slate-300 bg-white/95 shadow-sm p-4 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                <Crosshair className="w-4 h-4" /> Drop mode active
              </div>
              <p>Click anywhere on the map to capture coordinates for a new prospect. Press “Cancel drop” to exit.</p>
            </div>
          )}
          {showTeamRadar && teamLocations.length > 0 && (
            <div className={cn(
              'absolute right-4 z-[5] max-w-xs rounded-xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-sm text-xs text-slate-600 space-y-2',
              isDroppingPin ? 'top-32' : 'top-4'
            )}>
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <UsersIcon className="w-4 h-4" /> Team radar
              </div>
              <div className="space-y-2">
                {teamLocations.slice(0, 4).map((member) => (
                  <div key={member.userId} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {member.name || member.email || 'Unassigned rep'}
                      </div>
                      <div className="text-[11px] text-slate-500">{formatRelativeTime(member.occurredAt)}</div>
                    </div>
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                      <span className="block h-2.5 w-2.5 rounded-full bg-purple-600 border-2 border-white shadow-[0_0_0_3px_rgba(147,51,234,0.35)]"></span>
                    </span>
                  </div>
                ))}
                {teamLocations.length > 4 && (
                  <div className="text-[11px] text-slate-500">+{teamLocations.length - 4} more active reps</div>
                )}
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col gap-2">
            <Button
              variant={isDroppingPin ? 'default' : 'outline'}
              className="pointer-events-auto gap-2"
              onClick={() => setIsDroppingPin((prev) => !prev)}
            >
              <MapPinPlus className="w-4 h-4" />
              {isDroppingPin ? 'Cancel drop' : 'Drop pin'}
            </Button>
            <Button
              variant="outline"
              className="pointer-events-auto gap-2"
              onClick={() => {
                setViewMode('map');
                requestLocationRefresh();
              }}
              disabled={locationStatus === 'pending'}
            >
              <LocateFixed className="w-4 h-4" />
              {locationStatus === 'pending' ? 'Locating…' : 'Locate me'}
            </Button>
          </div>
          {userLocation && (
            <div className="absolute bottom-4 left-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <span className="block h-2.5 w-2.5 rounded-full bg-blue-600 border-2 border-white shadow-[0_0_0_3px_rgba(37,99,235,0.35)]"></span>
              </span>
              You are here
            </div>
          )}
          {locationError && !locationErrorDismissed && (
            <div className="absolute bottom-4 right-4 max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-amber-800">{locationError}</div>
                <button
                  type="button"
                  aria-label="Dismiss location message"
                  className="text-amber-600 hover:text-amber-700"
                  onClick={() => setLocationErrorDismissed(true)}
                >
                  ×
                </button>
              </div>
              {locationStatus === 'denied' && (
                <div className="text-[11px] text-amber-700">
                  Use “Locate me” after enabling location permissions in your browser settings.
                </div>
              )}
            </div>
          )}
          {selectedLead && (
            <div className="absolute top-4 left-4 w-72 rounded-xl border bg-white/95 shadow-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {[selectedLead.firstName, selectedLead.lastName].filter(Boolean).join(' ') || 'Unnamed lead'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedLead.city}, {selectedLead.state} {selectedLead.zipCode}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize border', stageBadgeColor(selectedLead.stageColor))}
                >
                  {selectedLead.pipelineStage || 'unknown'}
                </Badge>
              </div>
              {selectedLead.address && (
                <div className="flex items-start gap-1 text-xs text-slate-500">
                  <MapPin className="w-3 h-3 mt-0.5" />
                  <span>{selectedLead.address}</span>
                </div>
              )}
              <div className="text-xs text-slate-600 space-y-1">
                {selectedLead.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedLead.email}
                  </div>
                )}
                {selectedLead.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedLead.phone}
                  </div>
                )}
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-medium text-slate-600">Territory:</span>
                  <span>{selectedLead.territory?.name ?? 'Unassigned'}</span>
                </div>
                {selectedLead.preferredContactMethods?.length ? (
                  <div>
                    <span className="font-medium text-slate-600">Preferred contact:</span>{' '}
                    <span>{selectedLead.preferredContactMethods.join(', ')}</span>
                  </div>
                ) : null}
                {selectedLead.preferredStartDate ? (
                  <div>
                    <span className="font-medium text-slate-600">Preferred start:</span>{' '}
                    <span>{formatDate(selectedLead.preferredStartDate)}</span>
                  </div>
                ) : null}
                {selectedLead.howDidYouHear ? (
                  <div>
                    <span className="font-medium text-slate-600">Source:</span>{' '}
                    <span>{selectedLead.howDidYouHear}</span>
                  </div>
                ) : null}
                {selectedLead.nextActionAt && (
                  <div className="space-y-0.5">
                    <div>
                      <span className="font-medium text-slate-600">Next action:</span>{' '}
                      <span
                        className={cn(
                          selectedLead.nextActionSlaMinutes && selectedLead.nextActionSlaMinutes < 0
                            ? 'text-rose-600'
                            : 'text-slate-700'
                        )}
                      >
                        {formatDate(selectedLead.nextActionAt)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatRelativeMinutes(selectedLead.nextActionSlaMinutes ?? null)}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => openActivitySheet(selectedLead)}
                >
                  <Plus className="w-3 h-3" /> Log activity
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedLead(null)}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet
        open={isCreateSheetOpen}
        onOpenChange={(open) => {
          setIsCreateSheetOpen(open);
          if (!open) {
            setCreateError(null);
            setPendingCoordinates(null);
            setCreateForm(makeNewLeadForm());
          }
        }}
      >
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader className="space-y-2">
            <SheetTitle>New outbound prospect</SheetTitle>
            <SheetDescription>
              Capture a door knock, referral, or canvassing lead. Leave email blank if unknown and we will track them by
              address.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5 pb-6">
            {createError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createError}
              </div>
            )}
            {pendingCoordinates && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Map pin captured</span>
                  <Button variant="ghost" size="sm" onClick={() => setPendingCoordinates(null)}>
                    Clear
                  </Button>
                </div>
                <div className="font-mono text-sm">Lat: {pendingCoordinates.latitude.toFixed(6)}</div>
                <div className="font-mono text-sm">Lng: {pendingCoordinates.longitude.toFixed(6)}</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">First name</label>
                <Input
                  value={createForm.firstName}
                  onChange={(e) => handleCreateFieldChange('firstName', e.target.value)}
                  placeholder="Jordan"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Last name</label>
                <Input
                  value={createForm.lastName}
                  onChange={(e) => handleCreateFieldChange('lastName', e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => handleCreateFieldChange('email', e.target.value)}
                  placeholder="prospect@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => handleCreateFieldChange('phone', e.target.value)}
                  placeholder="555-0100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Street address</label>
              <Input
                value={createForm.address}
                onChange={(e) => handleCreateFieldChange('address', e.target.value)}
                placeholder="5630 Colfax Ave S"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">City</label>
                <Input
                  value={createForm.city}
                  onChange={(e) => handleCreateFieldChange('city', e.target.value)}
                  placeholder="Minneapolis"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">State</label>
                <Input
                  value={createForm.state}
                  onChange={(e) => handleCreateFieldChange('state', e.target.value)}
                  placeholder="MN"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ZIP</label>
                <Input
                  value={createForm.zipCode}
                  onChange={(e) => handleCreateFieldChange('zipCode', e.target.value)}
                  placeholder="55419"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Pipeline stage</label>
                <Select
                  value={createForm.pipelineStage}
                  onValueChange={(value) => handleCreateFieldChange('pipelineStage', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Territory</label>
                <Select
                  value={createForm.territoryId}
                  onValueChange={(value) => handleCreateFieldChange('territoryId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                    {territories.map((territory) => (
                      <SelectItem key={territory.id} value={territory.id}>
                        {territory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={submitNewLead} disabled={createSubmitting} className="gap-2">
              {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save prospect
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader className="space-y-2">
            <SheetTitle>Log activity</SheetTitle>
            <SheetDescription>
              {activeLead ? `For ${activeLead.firstName ?? ''} ${activeLead.lastName ?? ''}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Activity type</label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Outcome</label>
              <Input
                placeholder="e.g. Interested, requested brochure"
                value={activityResult}
                onChange={(e) => setActivityResult(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <Textarea
                rows={5}
                placeholder="Add context from the visit or next steps"
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button
              onClick={submitActivity}
              disabled={activitySubmitting}
              className="gap-2"
            >
              {activitySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save activity
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface OutboundMapProps {
  leads: OutboundLead[];
  onMarkerSelect: (lead: OutboundLead) => void;
  stageColorFor: (color?: string) => string;
  dropMode?: boolean;
  onNewPin?: (coords: Coordinates) => void;
  pendingPin?: Coordinates | null;
  userLocation?: Coordinates | null;
  focusTarget?: FocusTarget | null;
  onFocusConsumed?: () => void;
  teamLocations?: TeamLocation[];
  showTeamRadar?: boolean;
}

function OutboundMap({
  leads,
  onMarkerSelect,
  stageColorFor,
  dropMode = false,
  onNewPin,
  pendingPin = null,
  userLocation = null,
  focusTarget = null,
  onFocusConsumed,
  teamLocations = [],
  showTeamRadar = false,
}: OutboundMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pendingMarkerRef = useRef<any | null>(null);
  const userMarkerRef = useRef<any | null>(null);
  const teamMarkersRef = useRef<any[]>([]);
  const defaultCenterRef = useRef<[number, number]>([-93.265, 44.9778]);
  const defaultZoomRef = useRef<number>(12);
  const dropModeRef = useRef(dropMode);
  const skipFitRef = useRef(false);
  const lastManualFocusRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusTarget) {
      skipFitRef.current = true;
      lastManualFocusRef.current = Date.now();
    }
  }, [focusTarget]);

  useEffect(() => {
    if (userLocation) {
      defaultCenterRef.current = [userLocation.longitude, userLocation.latitude];
      defaultZoomRef.current = 13;
      return;
    }

    const firstWithCoords = leads.find((lead) => lead.latitude != null && lead.longitude != null);
    if (firstWithCoords) {
      defaultCenterRef.current = [firstWithCoords.longitude!, firstWithCoords.latitude!];
      defaultZoomRef.current = 12;
    }
  }, [userLocation, leads]);

  useEffect(() => {
    async function initMap() {
      if (typeof window === 'undefined' || mapRef.current || !mapContainerRef.current) {
        return;
      }

      await import('maplibre-gl/dist/maplibre-gl.css');
      const maplibreModule = await import('maplibre-gl');
      const maplibre = maplibreModule.default ?? maplibreModule;

      const map = new maplibre.Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: defaultCenterRef.current,
        zoom: defaultZoomRef.current,
      });

      mapRef.current = map;

      map.addControl(new maplibre.NavigationControl(), 'top-right');
      map.addControl(
        new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: false,
          showAccuracyCircle: false,
        }),
        'top-right'
      );
    }

    initMap();

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      teamMarkersRef.current.forEach((marker) => marker.remove());
      teamMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const dropModeChanged = dropModeRef.current !== dropMode;
    dropModeRef.current = dropMode;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    import('maplibre-gl').then((maplibreModule) => {
      const maplibre = maplibreModule.default ?? maplibreModule;

      const bounds = new maplibre.LngLatBounds();
      let hasBounds = false;
      let firstLeadCoords: [number, number] | null = null;
      let leadCoordCount = 0;
      let teamCoordCount = 0;

      leads.forEach((lead) => {
        if (lead.longitude == null || lead.latitude == null) return;

        const el = document.createElement('div');
        el.className = 'rounded-full border shadow-sm';
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.backgroundColor = stageColorFor(lead.stageColor).includes('emerald')
          ? '#10b981'
          : stageColorFor(lead.stageColor).includes('cyan')
            ? '#06b6d4'
            : stageColorFor(lead.stageColor).includes('blue')
              ? '#3b82f6'
              : stageColorFor(lead.stageColor).includes('amber')
                ? '#f59e0b'
                : stageColorFor(lead.stageColor).includes('rose')
                  ? '#f43f5e'
                  : '#64748b';
        el.style.cursor = 'pointer';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.3)';

        el.addEventListener('click', (event) => {
          if (dropMode) {
            event.stopPropagation();
            event.preventDefault();
            return;
          }
          onMarkerSelect(lead);
        });

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([lead.longitude!, lead.latitude!])
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([lead.longitude!, lead.latitude!]);
        hasBounds = true;
        leadCoordCount += 1;
        if (!firstLeadCoords) {
          firstLeadCoords = [lead.longitude!, lead.latitude!];
        }
      });

      if (userLocation) {
        bounds.extend([userLocation.longitude, userLocation.latitude]);
        hasBounds = true;
      }

      if (showTeamRadar) {
        teamLocations.forEach((member) => {
          if (typeof member.longitude !== 'number' || typeof member.latitude !== 'number') return;
          bounds.extend([member.longitude, member.latitude]);
          hasBounds = true;
          teamCoordCount += 1;
        });
      }

      const recentlyFocused =
        lastManualFocusRef.current != null && Date.now() - lastManualFocusRef.current < 1500;
      const shouldAdjustView =
        !(dropMode && dropModeChanged) && !focusTarget && !skipFitRef.current && !recentlyFocused;

      if (hasBounds && shouldAdjustView) {
        if (leadCoordCount > 1 || teamCoordCount > 1 || (leadCoordCount && teamCoordCount)) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        } else if (leadCoordCount === 1 && firstLeadCoords) {
          map.easeTo({ center: firstLeadCoords, zoom: Math.max(map.getZoom(), 13) });
        } else if (!leadCoordCount && userLocation) {
          map.easeTo({ center: [userLocation.longitude, userLocation.latitude], zoom: Math.max(map.getZoom(), 13) });
        } else if (!leadCoordCount && showTeamRadar && teamLocations.length === 1) {
          const member = teamLocations[0];
          map.easeTo({ center: [member.longitude, member.latitude], zoom: Math.max(map.getZoom(), 13) });
        }
      }

      if (skipFitRef.current) {
        skipFitRef.current = false;
      }
    });
  }, [leads, onMarkerSelect, stageColorFor, dropMode, userLocation, showTeamRadar, teamLocations, focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null;

    const handleClick = (event: any) => {
      if (!dropMode) {
        return;
      }
      if (typeof event.originalEvent?.preventDefault === 'function') {
        event.originalEvent.preventDefault();
      }
      if (typeof event.originalEvent?.stopPropagation === 'function') {
        event.originalEvent.stopPropagation();
      }
      if (canvas) {
        canvas.style.cursor = '';
      }
      map.off('click', handleClick);
      onNewPin?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };

    if (dropMode) {
      if (canvas) {
        canvas.style.cursor = 'crosshair';
      }
      map.on('click', handleClick);
    } else if (canvas) {
      canvas.style.cursor = '';
    }

    return () => {
      map.off('click', handleClick);
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [dropMode, onNewPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (!pendingPin) {
      return;
    }

    const setup = async () => {
      const maplibreModule = await import('maplibre-gl');
      const maplibre = maplibreModule.default ?? maplibreModule;

      const el = document.createElement('div');
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '9999px';
      el.style.backgroundColor = '#f59e0b';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.35)';
      el.style.cursor = 'pointer';

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([pendingPin.longitude, pendingPin.latitude])
        .addTo(map);

      pendingMarkerRef.current = marker;
    };

    void setup();

    return () => {
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
    };
  }, [pendingPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    let cancelled = false;

    (async () => {
      const maplibreModule = await import('maplibre-gl');
      if (cancelled) return;
      const maplibre = maplibreModule.default ?? maplibreModule;

      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '9999px';
      el.style.backgroundColor = '#2563eb';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.3)';

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    teamMarkersRef.current.forEach((marker) => marker.remove());
    teamMarkersRef.current = [];

    if (!showTeamRadar || !teamLocations.length) {
      return;
    }

    (async () => {
      const maplibreModule = await import('maplibre-gl');
      const maplibre = maplibreModule.default ?? maplibreModule;

      teamLocations.forEach((member) => {
        if (typeof member.longitude !== 'number' || typeof member.latitude !== 'number') return;

        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '9999px';
        el.style.backgroundColor = '#9333ea';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 0 0 4px rgba(147, 51, 234, 0.25)';

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([member.longitude, member.latitude])
          .addTo(map);

        teamMarkersRef.current.push(marker);
      });
    })();

    return () => {
      teamMarkersRef.current.forEach((marker) => marker.remove());
      teamMarkersRef.current = [];
    };
  }, [teamLocations, showTeamRadar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;

    lastManualFocusRef.current = Date.now();
    map.easeTo({
      center: [focusTarget.longitude, focusTarget.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 750,
    });

    onFocusConsumed?.();
  }, [focusTarget, onFocusConsumed]);

  return (
    <div
      ref={mapContainerRef}
      className="h-[600px] w-full rounded-xl border border-slate-200 overflow-hidden"
    />
  );
}
