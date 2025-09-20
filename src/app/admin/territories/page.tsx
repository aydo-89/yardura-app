'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Map, Upload } from 'lucide-react';

interface TerritoryAssignment {
  user: { id: string; name: string | null; email: string };
  role: string;
  isPrimary: boolean;
}

type GeoShape = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

interface Territory {
  id: string;
  name: string;
  slug: string;
  type: string;
  color?: string | null;
  geometry?: GeoShape | null;
  assignments?: TerritoryAssignment[];
}

export default function TerritoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (status === 'loading') return;
    const role = (session as any)?.userRole;
    const allowed = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER'];
    if (!session || !allowed.includes(role)) {
      router.push('/dashboard');
      return;
    }
    void fetchTerritories();
  }, [session, status, router]);

  const fetchTerritories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/territories?includeAssignments=true');
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load territories');
      setTerritories(json.data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || territories.length === 0) return;
    let disposed = false;

    (async () => {
      await import('maplibre-gl/dist/maplibre-gl.css');
      const maplibreModule = await import('maplibre-gl');
      const maplibre = maplibreModule.default ?? maplibreModule;

      if (disposed || !mapContainerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

    const map = new maplibre.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-93.265, 44.9778],
      zoom: 11,
      });

      map.addControl(new maplibre.NavigationControl(), 'top-right');

      map.on('load', () => {
        const features: Array<{
          type: 'Feature';
          properties: { id: string; name: string; color: string | null | undefined };
          geometry: GeoShape | null;
        }> = territories
          .filter((t) => t.color)
          .map((territory) => ({
            type: 'Feature' as const,
            properties: {
              id: territory.id,
              name: territory.name,
              color: territory.color,
            },
            geometry: territory.geometry ?? null,
          }))
          .filter((feature) => feature.geometry);

        if (!features.length) return;

        map.addSource('territories', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: features as any,
          },
        });

        map.addLayer({
          id: 'territory-fill',
          type: 'fill',
          source: 'territories',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.2,
          },
        });

        map.addLayer({
          id: 'territory-outline',
          type: 'line',
          source: 'territories',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
          },
        });
      });

      mapRef.current = map;
    })();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [territories]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Territories</h1>
          <p className="text-gray-600">Manage canvassing territories and rep assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchTerritories}>
            Refresh
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="w-5 h-5 text-slate-600" /> Map Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={mapContainerRef}
              className="h-[520px] w-full rounded-xl border border-slate-200 overflow-hidden"
            />
            <p className="mt-3 text-xs text-gray-500">
              Territories display based on stored polygons. Drawing tools will be available in a future release.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assignees</TableHead>
                  <TableHead>Pinned Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {territories.map((territory) => (
                  <TableRow key={territory.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{territory.name}</div>
                      <div className="text-xs text-gray-500">{territory.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {territory.type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      {(territory.assignments || []).map((assignment) => (
                        <div key={assignment.user.id} className="text-xs text-gray-600">
                          {assignment.user.name || assignment.user.email}{' '}
                          {assignment.isPrimary ? '(primary)' : ''}
                        </div>
                      ))}
                      {!(territory.assignments || []).length && (
                        <span className="text-xs text-gray-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-400">—</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
