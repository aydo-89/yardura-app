#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'path';

const envLocal = resolve(process.cwd(), '.env.local');
const envDefault = resolve(process.cwd(), '.env');
config({ path: existsSync(envLocal) ? envLocal : envDefault });

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

const DEFAULT_LAYER_URL =
  'https://services.arcgis.com/8df8p0NlLFEShl0r/arcgis/rest/services/Hennepin_Parcel/FeatureServer/0';
const DEFAULT_FIELD_MAP = {
  parcelId: 'PID',
  houseNo: 'HOUSE_NO',
  streetName: 'STREET_NM',
  zipCode: 'ZIP_CD',
  municipName: 'MUNIC_NM',
};
const FIELD_CANDIDATES = {
  parcelId: [
    'parcelid',
    'parcel_id',
    'parcelidnum',
    'parcelnumber',
    'parcelno',
    'parcel_no',
    'parcelnum',
    'parid',
    'par_id',
    'apn',
    'pin',
    'pinnum',
    'pin_num',
    'pid',
    'propid',
    'prop_id',
    'account',
    'accountno',
    'account_no',
    'taxparcel',
    'tax_parcel',
    'taxparcelid',
    'tax_parcel_id',
  ],
  houseNo: [
    'house_no',
    'houseno',
    'house_num',
    'addr_num',
    'addressnum',
    'addnum',
    'street_no',
    'streetnum',
    'stnum',
    'sitenum',
    'site_num',
    'situsnum',
    'situs_no',
  ],
  streetName: [
    'street_nm',
    'streetname',
    'street_name',
    'stname',
    'st_name',
    'street',
    'roadname',
    'road_name',
    'sitestreet',
    'site_street',
    'situsstreet',
    'situs_street',
  ],
  zipCode: ['zip', 'zipcode', 'zip_code', 'zip_cd', 'postal', 'postalcode', 'post_code'],
  municipName: [
    'municip',
    'municipality',
    'municip_name',
    'munic_nm',
    'munic_name',
    'muni',
    'city',
    'town',
    'township',
    'jurisdiction',
  ],
};

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

const parseNumber = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBBox = (value: string | null) => {
  if (!value) return null;
  const parts = value.split(',').map((entry) => Number(entry.trim()));
  if (parts.length !== 4 || parts.some((entry) => !Number.isFinite(entry))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  return { minLng, minLat, maxLng, maxLat };
};

const layerUrl = getArg('layer-url', DEFAULT_LAYER_URL) ?? DEFAULT_LAYER_URL;
const queryUrl = `${layerUrl}/query`;
const where = getArg('where', '1=1') ?? '1=1';
const bbox = parseBBox(getArg('bbox', null));
const limit = parseNumber(getArg('limit', '0'), 0);
const pageSizeArg = parseNumber(getArg('page-size', '0'), 0);
const source = getArg('source', 'hennepin-umn') ?? 'hennepin-umn';
const sourceName = getArg('source-name', 'Hennepin Parcel (UMN)') ?? 'Hennepin Parcel (UMN)';
const countyName = getArg('county-name', null);
const countyFips = getArg('county-fips', null);
const state = getArg('state', null);
const sourceType = getArg('source-type', 'arcgis') ?? 'arcgis';
const fieldMapRaw = getArg('field-map', null);
const dryRun = hasFlag('dry-run');
const resetSource = hasFlag('reset-source');

const parseFieldMap = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as typeof DEFAULT_FIELD_MAP;
    }
  } catch {
    const entries = value.split(',').map((entry) => entry.trim());
    const map: Record<string, string> = {};
    entries.forEach((entry) => {
      const [key, field] = entry.split('=').map((part) => part.trim());
      if (key && field) {
        map[key] = field;
      }
    });
    return map as typeof DEFAULT_FIELD_MAP;
  }
  return null;
};

type FieldMap = Partial<typeof DEFAULT_FIELD_MAP>;

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const buildFieldLookup = (fields: string[]) => {
  const lookup = new Map<string, string>();
  fields.forEach((field) => {
    lookup.set(normalizeKey(field), field);
  });
  return lookup;
};

const findField = (
  lookup: Map<string, string>,
  candidates: string[],
  allowContains = false,
) => {
  for (const candidate of candidates) {
    const match = lookup.get(normalizeKey(candidate));
    if (match) return match;
  }
  if (!allowContains) return null;
  const normalizedCandidates = candidates.map(normalizeKey);
  for (const [key, field] of lookup.entries()) {
    if (normalizedCandidates.some((candidate) => key.includes(candidate))) {
      return field;
    }
  }
  return null;
};

const resolveFieldMap = (
  fieldMapInput: FieldMap,
  fields: string[],
  objectIdField: string,
) => {
  const lookup = buildFieldLookup(fields);
  const resolved: FieldMap = { ...fieldMapInput };
  if (!resolved.parcelId) {
    resolved.parcelId =
      findField(lookup, FIELD_CANDIDATES.parcelId, true) ?? objectIdField;
  }
  if (!resolved.houseNo) {
    resolved.houseNo = findField(lookup, FIELD_CANDIDATES.houseNo) ?? undefined;
  }
  if (!resolved.streetName) {
    resolved.streetName = findField(lookup, FIELD_CANDIDATES.streetName) ?? undefined;
  }
  if (!resolved.zipCode) {
    resolved.zipCode = findField(lookup, FIELD_CANDIDATES.zipCode) ?? undefined;
  }
  if (!resolved.municipName) {
    resolved.municipName = findField(lookup, FIELD_CANDIDATES.municipName) ?? undefined;
  }

  (Object.entries(resolved) as Array<[keyof FieldMap, string | undefined]>).forEach(
    ([key, value]) => {
      if (!value) return;
      if (!lookup.has(normalizeKey(value))) {
        console.warn(
          `[parcel-import] Field "${value}" for "${key}" not found in layer fields.`,
        );
      }
    },
  );

  return resolved;
};

const buildOutFields = (fieldMap: FieldMap, objectIdField: string) =>
  Array.from(
    new Set(
      [fieldMap.parcelId, fieldMap.houseNo, fieldMap.streetName, fieldMap.zipCode, fieldMap.municipName, objectIdField]
        .filter(Boolean) as string[],
    ),
  );

const ensureParcelIdQuality = async (
  fieldMap: FieldMap,
  outFields: string[],
  objectIdField: string,
) => {
  if (!fieldMap.parcelId || fieldMap.parcelId === objectIdField) return fieldMap;
  const params = buildParams(outFields, {
    resultOffset: '0',
    resultRecordCount: '200',
    orderByFields: objectIdField,
  });
  const data = await fetchJson(`${queryUrl}?${params.toString()}`);
  const features = Array.isArray(data?.features) ? (data.features as unknown[]) : [];
  if (!features.length) return fieldMap;

  const parcelIds = features
    .map((feature) => (feature as any)?.properties?.[fieldMap.parcelId as string])
    .map((value) => normalizeText(value))
    .filter(Boolean) as string[];
  const uniqueCount = new Set(parcelIds).size;
  const ratio = parcelIds.length ? uniqueCount / parcelIds.length : 0;

  if (ratio < 0.5) {
    console.warn(
      `[parcel-import] Parcel ID field "${fieldMap.parcelId}" appears low-quality (unique ratio ${(ratio * 100).toFixed(1)}%). Falling back to ${objectIdField}.`,
    );
    return { ...fieldMap, parcelId: objectIdField };
  }
  return fieldMap;
};

const buildParams = (outFields: string[], overrides: Record<string, string> = {}) => {
  const params = new URLSearchParams({
    f: 'geojson',
    where,
    outFields: outFields.length ? outFields.join(',') : '*',
    returnGeometry: 'true',
    outSR: '4326',
    ...overrides,
  });
  if (bbox) {
    params.set('geometry', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`);
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  return params;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const truncate = (value: string, maxLen: number) => {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
};

const fetchJson = async (
  url: string,
  opts: { retries?: number; retryDelayMs?: number } = {},
) => {
  const retries = Math.max(0, opts.retries ?? 2);
  const retryDelayMs = Math.max(0, opts.retryDelayMs ?? 750);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          // Some ArcGIS servers behave differently without a UA.
          'user-agent': 'insightscoop-parcel-import/1.0',
          accept: 'application/json, application/geo+json, */*',
        },
      });

      const contentType = res.headers.get('content-type') ?? '';
      const text = await res.text();
      const trimmed = text.replace(/\s+/g, ' ').trim();

      // Retry transient failures.
      if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status <= 599))) {
        if (attempt < retries) {
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
      }

      if (!res.ok) {
        throw new Error(
          `Request failed (${res.status}). content-type=${contentType}. body=${truncate(
            trimmed,
            500,
          )}`,
        );
      }

      // Many ArcGIS servers incorrectly return JSON with text/plain; prefer parsing when payload looks like JSON.
      // Still explicitly reject HTML error pages that often come back as 200 OK.
      const looksLikeJson =
        trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
      const looksLikeHtml = trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<');

      // Some upstream servers return transient HTML error pages with 200 OK.
      if (looksLikeHtml) {
        if (attempt < retries) {
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
        throw new Error(
          `Non-JSON response (200). content-type=${contentType}. body=${truncate(trimmed, 500)}`,
        );
      }

      if (!contentType.toLowerCase().includes('json') && !looksLikeJson) {
        throw new Error(
          `Non-JSON response (200). content-type=${contentType}. body=${truncate(trimmed, 500)}`,
        );
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON. content-type=${contentType}. body=${truncate(trimmed, 500)}`);
      }
    } catch (error) {
      if (attempt < retries) {
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }

  // Unreachable, but satisfies TS control flow.
  throw new Error('fetchJson: failed after retries');
};

const loadLayerInfo = async () => {
  const info = await fetchJson(`${layerUrl}?f=pjson`);
  return {
    maxRecordCount: Number(info?.maxRecordCount) || 2000,
    objectIdField: info?.objectIdField ?? 'OBJECTID',
    fields: Array.isArray(info?.fields) ? info.fields.map((field: any) => field?.name) : [],
  };
};

const fetchCount = async (outFields: string[]) => {
  const params = buildParams(outFields, {
    f: 'json',
    returnCountOnly: 'true',
  });
  const data = await fetchJson(`${queryUrl}?${params.toString()}`);
  return Number(data?.count ?? 0);
};

type ParcelRow = {
  parcelId: string;
  houseNo: number | null;
  streetName: string | null;
  zipCode: string | null;
  municipName: string | null;
  geomJson: string;
};

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseFeature =
  (fieldMap: FieldMap, objectIdField: string) =>
  (feature: unknown): ParcelRow | null => {
    if (!feature || typeof feature !== 'object') return null;
    const record = feature as { geometry?: unknown; properties?: Record<string, unknown> };
    if (!record.geometry) return null;
    const props = record.properties ?? {};
    const parcelIdField = fieldMap.parcelId;
    const parcelId = normalizeText(parcelIdField ? props[parcelIdField] : null)
      ?? normalizeText(objectIdField ? props[objectIdField] : null)
      ?? normalizeText(props.PID_TEXT);
    if (!parcelId) return null;

  const houseNoValue = fieldMap.houseNo ? props[fieldMap.houseNo] : null;
  const houseNo = Number.isFinite(Number(houseNoValue))
    ? Number(houseNoValue)
    : null;
  const streetName = fieldMap.streetName ? normalizeText(props[fieldMap.streetName]) : null;
  const zipCode = fieldMap.zipCode ? normalizeText(props[fieldMap.zipCode]) : null;
  const municipName = fieldMap.municipName
    ? normalizeText(props[fieldMap.municipName])
    : null;

  return {
    parcelId,
    houseNo,
    streetName,
    zipCode,
    municipName,
    geomJson: JSON.stringify(record.geometry),
  };
};

const insertBatch = async (rows: ParcelRow[], dryRun: boolean) => {
  if (!rows.length) return 0;
  const deduped = Array.from(new Map(rows.map((row) => [row.parcelId, row])).values());
  if (deduped.length !== rows.length) {
    console.log(
      `[parcel-import] Deduped ${rows.length - deduped.length} rows with duplicate parcel IDs.`,
    );
  }
  if (dryRun) return deduped.length;
  const { query } = await loadPostgis();
  const values: Array<string | number | null> = [];
  const placeholders: string[] = [];
  deduped.forEach((row, index) => {
    const offset = index * 10;
    values.push(
      row.parcelId,
      source,
      row.houseNo,
      row.streetName,
      row.zipCode,
      row.municipName,
      countyFips,
      countyName,
      state,
      row.geomJson,
    );
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, ` +
        `$${offset + 7}, $${offset + 8}, $${offset + 9}, ` +
        `ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${offset + 10}), 4326)), ` +
        `ST_Centroid(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${offset + 10}), 4326))))`,
    );
  });

  const sql = `INSERT INTO geo.parcel (
      parcel_id,
      source,
      house_no,
      street_name,
      zip_code,
      municip_name,
      county_fips,
      county_name,
      state,
      geom,
      centroid
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (parcel_id, source) DO UPDATE SET
      house_no = EXCLUDED.house_no,
      street_name = EXCLUDED.street_name,
      zip_code = EXCLUDED.zip_code,
      municip_name = EXCLUDED.municip_name,
      county_fips = EXCLUDED.county_fips,
      county_name = EXCLUDED.county_name,
      state = EXCLUDED.state,
      geom = EXCLUDED.geom,
      centroid = EXCLUDED.centroid,
      updated_at = now();`;

  await query(sql, values);
  return deduped.length;
};

const upsertParcelSource = async (recordCount: number) => {
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
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', now(), $8, now())
    ON CONFLICT (source_id) DO UPDATE SET
      name = EXCLUDED.name,
      county_name = EXCLUDED.county_name,
      state = EXCLUDED.state,
      county_fips = EXCLUDED.county_fips,
      source_type = EXCLUDED.source_type,
      source_url = EXCLUDED.source_url,
      status = EXCLUDED.status,
      last_imported_at = EXCLUDED.last_imported_at,
      record_count = EXCLUDED.record_count,
      updated_at = now();`;

  await query(sql, [
    source,
    sourceName,
    countyName,
    state,
    countyFips,
    sourceType,
    layerUrl,
    recordCount,
  ]);
};

const run = async () => {
  const { maxRecordCount, objectIdField, fields } = await loadLayerInfo();
  const fieldMapInput =
    parseFieldMap(fieldMapRaw) ??
    (layerUrl === DEFAULT_LAYER_URL || source === 'hennepin-umn' ? DEFAULT_FIELD_MAP : {});
  let fieldMap = resolveFieldMap(fieldMapInput, fields, objectIdField);
  let outFields = buildOutFields(fieldMap, objectIdField);
  fieldMap = await ensureParcelIdQuality(fieldMap, outFields, objectIdField);
  outFields = buildOutFields(fieldMap, objectIdField);
  const pageSize = pageSizeArg > 0 ? Math.min(pageSizeArg, maxRecordCount) : maxRecordCount;

  if (resetSource && !dryRun) {
    const { query } = await loadPostgis();
    await query('DELETE FROM geo.parcel WHERE source = $1', [source]);
    console.log(`[parcel-import] Cleared existing parcels for source ${source}.`);
  }

  const totalCount = await fetchCount(outFields);
  console.log(`Parcels available: ${totalCount}`);
  console.log(
    `[parcel-import] Field map: ${JSON.stringify(fieldMap)} (objectId: ${objectIdField})`,
  );

  let offset = 0;
  let inserted = 0;

  while (true) {
    if (limit > 0 && inserted >= limit) break;
    const remaining = limit > 0 ? limit - inserted : pageSize;
    const batchSize = limit > 0 ? Math.min(pageSize, remaining) : pageSize;

    const params = buildParams(outFields, {
      resultOffset: String(offset),
      resultRecordCount: String(batchSize),
      orderByFields: objectIdField,
    });

    const data = await fetchJson(`${queryUrl}?${params.toString()}`);
    const features = Array.isArray(data?.features) ? (data.features as unknown[]) : [];
    if (!features.length) break;

    const rows = features
      .map(parseFeature(fieldMap, objectIdField))
      .filter((row): row is ParcelRow => Boolean(row));

    const insertedCount = await insertBatch(rows, dryRun);
    inserted += insertedCount;
    offset += batchSize;

    console.log(
      `Processed ${inserted} parcels (offset ${offset})${dryRun ? ' [dry-run]' : ''}`,
    );

    if (features.length < batchSize) break;
  }

  if (!dryRun) {
    await upsertParcelSource(inserted);
  }

  console.log(`Done. Total inserted/updated: ${inserted}.`);
};

run()
  .catch((error) => {
    console.error('Parcel import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    if (postgisClient) {
      await postgisClient.closePostgisPool();
    }
  });
