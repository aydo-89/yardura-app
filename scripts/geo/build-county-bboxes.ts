#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name: string, fallback: string | null = null): string | null => {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index !== -1) {
    return args[index + 1] ?? fallback;
  }
  const prefix = `${flag}=`;
  const withEquals = args.find((arg) => arg.startsWith(prefix));
  if (withEquals) {
    return withEquals.slice(prefix.length) || fallback;
  }
  return fallback;
};

const DEFAULT_GEOJSON_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const inputPath = getArg('input');
const geojsonUrl = getArg('url', DEFAULT_GEOJSON_URL) ?? DEFAULT_GEOJSON_URL;
const outputPath =
  getArg('output', resolve(process.cwd(), 'src/data/geo/us-county-bboxes.json')) ??
  resolve(process.cwd(), 'src/data/geo/us-county-bboxes.json');

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json();
};

const updateBounds = (
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  lng: number,
  lat: number,
) => {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return bounds;
  if (!bounds) {
    return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
  }
  return {
    minLng: Math.min(bounds.minLng, lng),
    minLat: Math.min(bounds.minLat, lat),
    maxLng: Math.max(bounds.maxLng, lng),
    maxLat: Math.max(bounds.maxLat, lat),
  };
};

const computeBounds = (coords: any, bounds: any = null) => {
  if (!Array.isArray(coords)) return bounds;
  if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return updateBounds(bounds, coords[0], coords[1]);
  }
  return coords.reduce((acc, entry) => computeBounds(entry, acc), bounds);
};

const run = async () => {
  const geojson = inputPath ? JSON.parse(readFileSync(inputPath, 'utf8')) : await fetchJson(geojsonUrl);
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const bboxes: Record<string, { minLng: number; minLat: number; maxLng: number; maxLat: number }> =
    {};

  features.forEach((feature: any) => {
    const fips = String(feature?.id ?? feature?.properties?.GEOID ?? '').padStart(5, '0');
    if (!fips || fips === '00000') return;
    const geometry = feature?.geometry;
    if (!geometry?.coordinates) return;
    const bounds = computeBounds(geometry.coordinates);
    if (!bounds) return;
    bboxes[fips] = bounds;
  });

  const output = {
    generatedAt: new Date().toISOString(),
    source: inputPath ?? geojsonUrl,
    bboxes,
  };

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(bboxes).length} county bboxes to ${outputPath}`);
};

run().catch((error) => {
  console.error('Failed to build county bboxes:', error);
  process.exit(1);
});
