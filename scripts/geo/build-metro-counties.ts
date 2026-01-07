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
const hasFlag = (name: string): boolean =>
  args.includes(`--${name}`) || args.some((arg) => arg.startsWith(`--${name}=`));

const DEFAULT_LIST_URL =
  'https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx';
const DEFAULT_POP_URL =
  'https://api.census.gov/data/2022/acs/acs5?get=NAME,B01001_001E&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:*';

const inputPath = getArg('input');
const listUrl = getArg('url', DEFAULT_LIST_URL) ?? DEFAULT_LIST_URL;
const popUrl = getArg('pop-url', DEFAULT_POP_URL) ?? DEFAULT_POP_URL;
const outputPath =
  getArg('output', resolve(process.cwd(), 'src/data/geo/metro-counties.json')) ??
  resolve(process.cwd(), 'src/data/geo/metro-counties.json');
const includeMicro = hasFlag('include-micro');
const top = Number(getArg('top', '50') ?? '50');
const skipPopulation = hasFlag('skip-population');

const STATE_FIPS_TO_ABBR: Record<string, string> = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
};

const fetchBuffer = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const parseExcel = async (buffer: Buffer) => {
  const mod = await import('xlsx');
  const workbook = mod.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = mod.utils.sheet_to_csv(sheet);
  return parseCsv(csv);
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const flushField = () => {
    row.push(current);
    current = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      flushField();
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      flushField();
      if (row.length > 1 || row[0]?.trim()) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    current += char;
  }

  if (current.length || row.length) {
    flushField();
    if (row.length > 1 || row[0]?.trim()) {
      rows.push(row);
    }
  }
  return rows;
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedCandidates = candidates.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    normalizedCandidates.some((candidate) => header.includes(candidate)),
  );
};

const parseList1 = (rows: string[][]) => {
  if (rows.length < 2) return [];
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(String(cell ?? '')).includes('cbsacode')),
  );
  if (headerRowIndex === -1) {
    throw new Error('Unable to locate List1 header row.');
  }
  const headers = rows[headerRowIndex];

  const idxCbsa = findHeaderIndex(headers, ['cbsa code', 'cbsa']);
  const idxCbsaName = findHeaderIndex(headers, ['cbsa title', 'cbsa name', 'cbsa']);
  const idxMetro = findHeaderIndex(headers, [
    'metropolitan/micropolitan statistical area',
    'metro',
    'micropolitan',
  ]);
  const idxCountyName = findHeaderIndex(headers, ['county/county equivalent', 'county']);
  const idxStateFips = findHeaderIndex(headers, ['fips state code', 'state code', 'state fips']);
  const idxCountyFips = findHeaderIndex(headers, ['fips county code', 'county code', 'county fips']);

  const required = [idxCbsa, idxCbsaName, idxCountyName, idxStateFips, idxCountyFips];
  if (required.some((idx) => idx === -1)) {
    throw new Error(
      'Unable to parse List1 CSV: missing required columns for CBSA, county, or state FIPS.',
    );
  }

  return rows.slice(headerRowIndex + 1).flatMap((row) => {
    const cbsa = row[idxCbsa]?.trim();
    if (!cbsa) return [];
    const cbsaName = row[idxCbsaName]?.trim() ?? '';
    const metroType = idxMetro !== -1 ? row[idxMetro]?.trim() ?? '' : '';
    if (!includeMicro && metroType && !metroType.toLowerCase().includes('metropolitan')) {
      return [];
    }
    const stateFipsRaw = row[idxStateFips]?.trim() ?? '';
    const countyFipsRaw = row[idxCountyFips]?.trim() ?? '';
    const stateFips = stateFipsRaw.padStart(2, '0');
    const countyFips = countyFipsRaw.padStart(3, '0');
    const countyName = row[idxCountyName]?.trim() ?? '';
    const state = STATE_FIPS_TO_ABBR[stateFips];
    if (!state) return [];
    return [
      {
        cbsa,
        cbsaName,
        metroType,
        countyName,
        state,
        stateFips,
        countyFips,
        countyFipsFull: `${stateFips}${countyFips}`,
      },
    ];
  });
};

const fetchPopulationByCbsa = async () => {
  if (skipPopulation) return new Map<string, number>();
  try {
    const res = await fetch(popUrl);
    if (!res.ok) {
      return new Map<string, number>();
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return new Map<string, number>();
    const header = data[0] as string[];
    const idxCbsa = findHeaderIndex(header, [
      'metropolitan statistical area/micropolitan statistical area',
      'metropolitan statistical area',
      'cbsa',
    ]);
    const idxPop = findHeaderIndex(header, ['b01001_001e', 'population']);
    if (idxCbsa === -1 || idxPop === -1) return new Map<string, number>();
    const map = new Map<string, number>();
    data.slice(1).forEach((row) => {
      const cbsa = String(row[idxCbsa] ?? '').trim();
      const pop = Number(row[idxPop]);
      if (!cbsa) return;
      map.set(cbsa, Number.isFinite(pop) ? pop : 0);
    });
    return map;
  } catch {
    return new Map<string, number>();
  }
};

const run = async () => {
  let rows: string[][] = [];
  if (inputPath) {
    if (inputPath.endsWith('.xlsx') || inputPath.endsWith('.xls')) {
      rows = await parseExcel(readFileSync(inputPath));
    } else {
      rows = parseCsv(readFileSync(inputPath, 'utf8'));
    }
  } else if (listUrl.endsWith('.xlsx') || listUrl.endsWith('.xls')) {
    rows = await parseExcel(await fetchBuffer(listUrl));
  } else {
    const csvText = (await fetchBuffer(listUrl)).toString('utf8');
    rows = parseCsv(csvText);
  }
  const entries = parseList1(rows);
  const populationMap = await fetchPopulationByCbsa();

  const cbsaMap = new Map<
    string,
    {
      cbsa: string;
      name: string;
      population: number;
      counties: typeof entries;
    }
  >();

  entries.forEach((entry) => {
    const existing = cbsaMap.get(entry.cbsa);
    const population = populationMap.get(entry.cbsa) ?? 0;
    if (!existing) {
      cbsaMap.set(entry.cbsa, {
        cbsa: entry.cbsa,
        name: entry.cbsaName,
        population,
        counties: [entry],
      });
    } else {
      existing.counties.push(entry);
      if (!existing.population && population) {
        existing.population = population;
      }
    }
  });

  let metros = Array.from(cbsaMap.values());
  if (top > 0) {
    metros = metros.sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, top);
  }

  const allowed = new Set(metros.map((metro) => metro.cbsa));
  const counties = entries.filter((entry) => allowed.has(entry.cbsa));

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      listUrl,
      populationUrl: skipPopulation ? null : popUrl,
      includeMicro,
      top,
    },
    metros: metros.map((metro) => ({
      cbsa: metro.cbsa,
      name: metro.name,
      population: metro.population,
      countyCount: metro.counties.length,
    })),
    counties: counties.map((entry) => ({
      cbsa: entry.cbsa,
      cbsaName: entry.cbsaName,
      countyName: entry.countyName,
      countyFips: entry.countyFipsFull,
      state: entry.state,
      stateFips: entry.stateFips,
    })),
  };

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${counties.length} counties from ${metros.length} metros to ${outputPath}`);
};

run().catch((error) => {
  console.error('Failed to build metro county list:', error);
  process.exit(1);
});
