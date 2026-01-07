import { readFileSync } from "fs";
import { join } from "path";

interface ZipDataCache {
  zipToCity: Map<string, { city: string; state: string }[]>;
  cityToZips: Map<string, string[]>;
  countyToZips: Map<string, string[]>;
}

const ZIP_DATA_PATH = join(process.cwd(), "src", "lib", "zip-city-data.csv");

let cache: ZipDataCache | null = null;

function loadZipData(): ZipDataCache {
  if (cache) {
    return cache;
  }

  const csvData = readFileSync(ZIP_DATA_PATH, "utf-8");
  const lines = csvData.split("\n").slice(1);

  const zipToCity = new Map<string, { city: string; state: string }[]>();
  const cityToZips = new Map<string, string[]>();
  const countyToZips = new Map<string, string[]>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const [stateFips, stateName, stateAbbr, zipcode, county, city] =
      line.split(",");

    if (!zipcode) continue;
    const zip = zipcode.trim();

    if (city) {
      const normalCityKey = `${city.toLowerCase().trim()},${stateAbbr?.trim() ?? ""}`;
      if (!cityToZips.has(normalCityKey)) {
        cityToZips.set(normalCityKey, []);
      }
      cityToZips.get(normalCityKey)!.push(zip);

      const entry = { city: city.trim(), state: stateAbbr?.trim() ?? "" };
      if (!zipToCity.has(zip)) {
        zipToCity.set(zip, [entry]);
      } else {
        zipToCity.get(zip)!.push(entry);
      }
    }

    if (county) {
      const countyKey = `${county.toLowerCase().trim()},${stateAbbr?.trim() ?? ""}`;
      if (!countyToZips.has(countyKey)) {
        countyToZips.set(countyKey, []);
      }
      countyToZips.get(countyKey)!.push(zip);
    }
  }

  cache = { zipToCity, cityToZips, countyToZips };
  return cache;
}

export function getCitiesForZip(zip: string): { city: string; state: string }[] {
  const data = loadZipData();
  return data.zipToCity.get(zip) ?? [];
}

export function getPrimaryCityForZip(zip: string): { city: string; state: string } | null {
  const entries = getCitiesForZip(zip);
  return entries.length ? entries[0] : null;
}

export function getZipsForCity(city: string, state: string): string[] {
  const data = loadZipData();
  const key = `${city.toLowerCase().trim()},${state.trim()}`;
  return data.cityToZips.get(key) ?? [];
}

export function getZipsForCounty(county: string, state: string): string[] {
  const data = loadZipData();
  const key = `${county.toLowerCase().trim()},${state.trim()}`;
  return data.countyToZips.get(key) ?? [];
}
