#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

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
const hasFlag = (name: string): boolean =>
  args.includes(`--${name}`) || args.some((arg) => arg.startsWith(`--${name}=`));

const countiesPath =
  getArg('counties', resolve(process.cwd(), 'src/data/geo/metro-counties.json')) ??
  resolve(process.cwd(), 'src/data/geo/metro-counties.json');
const bboxPath =
  getArg('bboxes', resolve(process.cwd(), 'src/data/geo/us-county-bboxes.json')) ??
  resolve(process.cwd(), 'src/data/geo/us-county-bboxes.json');
const outputPath =
  getArg('output', resolve(process.cwd(), 'src/data/geo/parcel-sources.generated.json')) ??
  resolve(process.cwd(), 'src/data/geo/parcel-sources.generated.json');
const maxCounties = Number(getArg('max-counties', '0') ?? '0');
const offset = Number(getArg('offset', '0') ?? '0');
const concurrency = Number(getArg('concurrency', '3') ?? '3');
const dryRun = hasFlag('dry-run');
const register = hasFlag('register');
const append = hasFlag('append');

type PostgisModule = {
  query: (sql: string, params?: any[]) => Promise<unknown>;
  closePostgisPool: () => Promise<void>;
};

let postgisClient: PostgisModule | null = null;

const loadPostgis = async () => {
  if (postgisClient) return postgisClient;
  const mod = (await import('../../src/lib/geo/postgis')) as any;
  const resolved = (mod?.default ?? mod) as PostgisModule;
  postgisClient = resolved;
  return postgisClient;
};

type County = {
  countyFips: string;
  countyName: string;
  state: string;
};

type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const FIELD_CANDIDATES = [
  'parcelid',
  'parcel_id',
  'parcelnumber',
  'parcelno',
  'parcelnum',
  'apn',
  'pin',
  'pinnum',
  'pid',
  'propid',
  'prop_id',
  'account',
  'accountno',
  'taxparcel',
  'tax_parcel',
];

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const hasParcelIdField = (fields: Array<{ name?: string }> | null | undefined) => {
  if (!fields?.length) return false;
  const normalized = fields.map((field) => normalizeKey(field.name ?? ''));
  return normalized.some((field) =>
    FIELD_CANDIDATES.some((candidate) => field.includes(candidate)),
  );
};

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json();
};

const loadCounties = (): County[] => {
  const raw = JSON.parse(readFileSync(countiesPath, 'utf8'));
  if (Array.isArray(raw)) return raw as County[];
  if (raw && Array.isArray(raw.counties)) return raw.counties as County[];
  return [];
};

const loadBboxes = (): Record<string, BBox> => {
  try {
    const raw = JSON.parse(readFileSync(bboxPath, 'utf8'));
    if (raw?.bboxes) return raw.bboxes as Record<string, BBox>;
  } catch {
    return {};
  }
  return {};
};

const bboxIntersects = (a: BBox, b: BBox) =>
  !(a.maxLng < b.minLng || a.minLng > b.maxLng || a.maxLat < b.minLat || a.minLat > b.maxLat);

const webMercatorToWgs84 = (x: number, y: number) => {
  const origin = 6378137;
  const lng = (x / origin) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / origin)) - Math.PI / 2) * (180 / Math.PI);
  return { lng, lat };
};

const normalizeExtent = (extent: any): BBox | null => {
  if (!extent) return null;
  const { xmin, ymin, xmax, ymax } = extent;
  if (![xmin, ymin, xmax, ymax].every((value) => Number.isFinite(value))) return null;
  const wkid = extent?.spatialReference?.wkid ?? extent?.spatialReference?.latestWkid ?? 4326;
  if (wkid === 4326) {
    return { minLng: xmin, minLat: ymin, maxLng: xmax, maxLat: ymax };
  }
  if (wkid === 3857 || wkid === 102100) {
    const sw = webMercatorToWgs84(xmin, ymin);
    const ne = webMercatorToWgs84(xmax, ymax);
    return { minLng: sw.lng, minLat: sw.lat, maxLng: ne.lng, maxLat: ne.lat };
  }
  return null;
};

const buildSearchQuery = (county: County) => {
  const countyLabel = county.countyName
    ? `("${county.countyName}" OR "${county.countyName} County")`
    : '';
  const keywords =
    '(parcel OR parcels OR "tax parcel" OR "tax parcels" OR "property parcel" OR cadastral)';
  const parts = [
    keywords,
    '(type:"Feature Service" OR type:"Map Service")',
    countyLabel,
  ].filter(Boolean);
  return parts.join(' AND ');
};

const searchArcgis = async (county: County, bbox: BBox | null) => {
  const url = new URL('https://www.arcgis.com/sharing/rest/search');
  url.searchParams.set('f', 'json');
  url.searchParams.set('q', buildSearchQuery(county));
  url.searchParams.set('num', '20');
  if (bbox) {
    url.searchParams.set(
      'bbox',
      `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`,
    );
  }
  const data = await fetchJson(url.toString());
  return Array.isArray(data?.results) ? data.results : [];
};

const scoreLayerName = (name: string) => {
  const lowered = name.toLowerCase();
  let score = 0;
  if (lowered.includes('parcel')) score += 10;
  if (lowered.includes('tax')) score += 4;
  if (lowered.includes('property')) score += 3;
  return score;
};

const normalizeArcgisUrl = (url: string) => {
  const match = url.match(/^(.*\/(?:MapServer|FeatureServer))(?:\/(\d+))?$/);
  if (!match) return null;
  return {
    serviceUrl: match[1],
    layerId: match[2] ? Number(match[2]) : null,
  };
};

const pickBestLayer = async (serviceUrl: string, countyBBox: BBox | null) => {
  const serviceInfo = await fetchJson(`${serviceUrl}?f=pjson`);
  const layers = Array.isArray(serviceInfo?.layers) ? serviceInfo.layers : [];
  const polygonLayers = layers.filter(
    (layer: any) => String(layer?.geometryType ?? '').toLowerCase() === 'esrigeometrypolygon',
  );
  if (!polygonLayers.length) return null;

  const ranked = polygonLayers
    .map((layer: any) => ({
      layer,
      score: scoreLayerName(layer.name ?? '') + (layer.id === 0 ? 1 : 0),
    }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const top = ranked[0];
  const layerUrl = `${serviceUrl}/${top.layer.id}`;
  const layerInfo = await fetchJson(`${layerUrl}?f=pjson`);
  const extent = normalizeExtent(layerInfo?.extent ?? serviceInfo?.fullExtent ?? null);
  const fields = Array.isArray(layerInfo?.fields) ? layerInfo.fields : [];
  const hasParcelId = hasParcelIdField(fields);
  const score = top.score + (hasParcelId ? 5 : 0);
  const intersects = countyBBox && extent ? bboxIntersects(extent, countyBBox) : true;

  return {
    layerUrl,
    layerName: top.layer.name ?? layerInfo?.name ?? serviceInfo?.name ?? '',
    extent,
    score,
    hasParcelId,
    intersects,
  };
};

const selectLayerForItem = async (itemUrl: string, countyBBox: BBox | null) => {
  const normalized = normalizeArcgisUrl(itemUrl);
  if (!normalized) return null;
  if (normalized.layerId !== null) {
    const layerInfo = await fetchJson(`${itemUrl}?f=pjson`);
    const extent = normalizeExtent(layerInfo?.extent ?? null);
    const fields = Array.isArray(layerInfo?.fields) ? layerInfo.fields : [];
    const name = layerInfo?.name ?? '';
    const score = scoreLayerName(name) + (hasParcelIdField(fields) ? 5 : 0);
    const intersects = countyBBox && extent ? bboxIntersects(extent, countyBBox) : true;
    return {
      layerUrl: itemUrl,
      layerName: name,
      extent,
      score,
      hasParcelId: hasParcelIdField(fields),
      intersects,
    };
  }
  return pickBestLayer(normalized.serviceUrl, countyBBox);
};

const buildSourceId = (county: County) =>
  `${county.state.toLowerCase()}-${county.countyFips}-parcels`;

const asyncPool = async <T>(
  limit: number,
  list: T[],
  iterator: (item: T, index: number) => Promise<void>,
) => {
  const executing: Promise<void>[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const p = Promise.resolve().then(() => iterator(item, i));
    if (limit <= list.length) {
      const e = p.then(() => {
        const index = executing.indexOf(e);
        if (index >= 0) executing.splice(index, 1);
      });
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  await Promise.all(executing);
};

const run = async () => {
  const counties = loadCounties();
  const bboxes = loadBboxes();
  const sliced = offset > 0 ? counties.slice(offset) : counties;
  const targets = maxCounties > 0 ? sliced.slice(0, maxCounties) : sliced;

  const sources: any[] = [];
  const missing: County[] = [];
  const failures: Array<{ county: County; error: string }> = [];

  const upsertStatus = async (county: County, status: string, source?: any) => {
    if (!register || dryRun) return;
    const { query } = await loadPostgis();
    const sql = `INSERT INTO admin.parcel_source (
        source_id,
        name,
        county_name,
        state,
        county_fips,
        source_type,
        source_url,
        status,
        last_imported_at,
        record_count,
        notes,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, $9, now())
      ON CONFLICT (source_id) DO UPDATE SET
        name = EXCLUDED.name,
        county_name = EXCLUDED.county_name,
        state = EXCLUDED.state,
        county_fips = EXCLUDED.county_fips,
        source_type = EXCLUDED.source_type,
        source_url = EXCLUDED.source_url,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = now();`;
    const id = source?.id ?? buildSourceId(county);
    await query(sql, [
      id,
      source?.name ?? `${county.countyName} Parcels`,
      county.countyName,
      county.state,
      county.countyFips,
      source?.sourceType ?? 'arcgis',
      source?.layerUrl ?? '',
      status,
      source?.notes ?? null,
    ]);
  };

  await asyncPool(Math.max(1, concurrency), targets, async (county) => {
    try {
      const bbox = bboxes[county.countyFips] ?? null;
      const results = await searchArcgis(county, bbox);
      const candidates = results.filter((item: any) => typeof item?.url === 'string');
      let best: any = null;
      for (const candidate of candidates) {
        if (!candidate.url.includes('FeatureServer') && !candidate.url.includes('MapServer')) {
          continue;
        }
        const selection = await selectLayerForItem(candidate.url, bbox);
        if (!selection || !selection.intersects) continue;
        if (!best || selection.score > best.score) {
          best = { selection, candidate };
        }
      }

      if (!best) {
        missing.push(county);
        await upsertStatus(county, 'MISSING');
        return;
      }

      const sourceEntry = {
        id: buildSourceId(county),
        name: best.selection.layerName || `${county.countyName} Parcels`,
        countyName: county.countyName,
        countyFips: county.countyFips,
        state: county.state,
        sourceType: 'arcgis',
        layerUrl: best.selection.layerUrl,
        bbox: bbox
          ? `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
          : undefined,
        notes: best.selection.hasParcelId ? undefined : 'Parcel ID field not detected',
      };

      sources.push(sourceEntry);
      await upsertStatus(county, 'DISCOVERED', sourceEntry);
    } catch (error) {
      failures.push({ county, error: (error as Error).message });
      await upsertStatus(county, 'ERROR', {
        id: buildSourceId(county),
        name: `${county.countyName} Parcels`,
        countyName: county.countyName,
        countyFips: county.countyFips,
        state: county.state,
        sourceType: 'arcgis',
        layerUrl: '',
        notes: (error as Error).message,
      });
    }
  });

  let output = {
    generatedAt: new Date().toISOString(),
    counties: targets.length,
    sources,
    missing,
    failures,
  } as any;

  if (append && !dryRun) {
    try {
      const existing = JSON.parse(readFileSync(outputPath, 'utf8'));
      const mergeById = (items: any[], incoming: any[], key: string) => {
        const map = new Map(items.map((item) => [item[key], item]));
        incoming.forEach((item) => map.set(item[key], item));
        return Array.from(map.values());
      };
      output = {
        generatedAt: output.generatedAt,
        counties: existing?.counties ?? targets.length,
        sources: mergeById(existing?.sources ?? [], output.sources, 'id'),
        missing: mergeById(existing?.missing ?? [], output.missing, 'countyFips'),
        failures: mergeById(existing?.failures ?? [], output.failures, 'countyFips'),
      };
    } catch {
      // ignore merge failures
    }
  }

  if (!dryRun) {
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }

  console.log(
    `Discovery complete. Sources: ${sources.length}, missing: ${missing.length}, failures: ${failures.length}.`,
  );
  if (dryRun) {
    console.log('Dry-run enabled: no manifest written.');
  } else {
    console.log(`Manifest written to ${outputPath}`);
  }
};

run().catch((error) => {
  console.error('ArcGIS parcel discovery failed:', error);
  process.exit(1);
}).finally(async () => {
  if (postgisClient) {
    await postgisClient.closePostgisPool();
  }
});
