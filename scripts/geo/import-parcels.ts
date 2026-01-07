#!/usr/bin/env npx tsx
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PARCEL_SOURCES } from '../../src/lib/geo/parcel-sources';

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

const sourceFilter = getArg('source');
const stateFilter = getArg('state');
const manifestPath = getArg('manifest');
const where = getArg('where');
const offset = Number(getArg('offset', '0') ?? '0');
const maxSources = Number(getArg('max-sources', '0') ?? '0');
const dryRun = hasFlag('dry-run');
const resetSource = hasFlag('reset-source');
const continueOnError = hasFlag('continue-on-error') || hasFlag('keep-going');
const bbox = getArg('bbox');
const limit = getArg('limit');
const pageSize = getArg('page-size');
const importAll = hasFlag('all');

type ParcelSource = (typeof PARCEL_SOURCES)[number] & {
  where?: string;
  bbox?: string;
};

const loadManifestSources = (): ParcelSource[] => {
  if (!manifestPath) return PARCEL_SOURCES as ParcelSource[];
  const raw = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as ParcelSource[];
  if (parsed && Array.isArray(parsed.sources)) return parsed.sources as ParcelSource[];
  throw new Error(`Manifest at ${manifestPath} must be an array or { sources: [...] }`);
};

const sources = loadManifestSources();
let selectedSources = sources.filter((source) => {
  if (sourceFilter && source.id !== sourceFilter) return false;
  if (stateFilter && source.state && source.state !== stateFilter.toUpperCase()) return false;
  return true;
});

if (offset > 0 || maxSources > 0) {
  const end = maxSources > 0 ? offset + maxSources : undefined;
  selectedSources = selectedSources.slice(offset, end);
}

if (!selectedSources.length) {
  console.error('No parcel sources match the provided filters.');
  process.exit(1);
}

if (!importAll && !sourceFilter && selectedSources.length > 1) {
  console.error(
    `Multiple sources matched (${selectedSources.length}). Use --source=<id> or --all to import all.`,
  );
  process.exit(1);
}

const tsxBin = resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
const importerScript = resolve(process.cwd(), 'scripts/geo/import-arcgis-parcels.ts');

const failures: Array<{ sourceId: string; status: number }> = [];

for (const source of selectedSources) {
  const cliArgs: string[] = [
    importerScript,
    '--source',
    source.id,
    '--source-name',
    source.name,
    '--source-type',
    source.sourceType ?? 'arcgis',
    '--layer-url',
    source.layerUrl,
  ];
  if (source.countyName) {
    cliArgs.push('--county-name', source.countyName);
  }
  if (source.countyFips) {
    cliArgs.push('--county-fips', source.countyFips);
  }
  if (source.state) {
    cliArgs.push('--state', source.state);
  }

  if (source.fieldMap && Object.keys(source.fieldMap).length > 0) {
    cliArgs.push('--field-map', JSON.stringify(source.fieldMap));
  }

  if (source.where) cliArgs.push('--where', source.where);
  if (where) cliArgs.push('--where', where);
  if (source.bbox) cliArgs.push('--bbox', source.bbox);
  if (bbox) cliArgs.push('--bbox', bbox);
  if (limit) cliArgs.push('--limit', limit);
  if (pageSize) cliArgs.push('--page-size', pageSize);
  if (dryRun) cliArgs.push('--dry-run');
  if (resetSource) cliArgs.push('--reset-source');

  const label = [source.countyName, source.state].filter(Boolean).join(', ');
  console.log(`\n📦 Importing parcels for ${label || source.name} (${source.id})`);
  const result = spawnSync(tsxBin, cliArgs, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    const status = result.status ?? 1;
    console.error(`[parcel-import] Source ${source.id} failed with exit code ${status}.`);
    failures.push({ sourceId: source.id, status });
    if (!continueOnError) {
      process.exit(status);
    }
  }
}

if (failures.length) {
  console.error(
    `[parcel-import] Completed with ${failures.length} failure(s): ${failures
      .map((failure) => `${failure.sourceId}(${failure.status})`)
      .join(', ')}`,
  );
  process.exit(1);
}
