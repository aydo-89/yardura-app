/**
 * ZIP and geographic data normalization utilities
 */

import { GeoJSON } from 'geojson';

/**
 * ZCTA property keys in various data sources
 */
export const ZCTA_PROP_KEYS = [
  'ZCTA5CE10',
  'ZCTA5CE20',
  'ZCTA5',
  'GEOID10',
  'GEOID',
  'ZIP',
  'zip'
] as const;

/**
 * State name to abbreviation mappings
 */
const STATE_NAME_TO_ABBR: { [key: string]: string } = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

/**
 * Normalize ZIP code to 5-digit string
 */
export function normalizeZip(props: any): string | '' {
  if (!props || typeof props !== 'object') return '';

  // Try each possible property key
  for (const key of ZCTA_PROP_KEYS) {
    const value = props[key];
    if (value !== undefined && value !== null) {
      const zip = value.toString().replace(/\D/g, '');
      if (zip.length > 0) {
        // Pad with zeros to 5 digits or truncate to 5 digits
        return zip.padStart(5, '0').slice(0, 5);
      }
    }
  }

  return '';
}

/**
 * Convert state name to uppercase abbreviation
 */
export function toStateAbbrUpper(input: string): string {
  if (!input) return '';
  if (input.length === 2) return input.toUpperCase();
  return STATE_NAME_TO_ABBR[input] || input.substring(0, 2).toUpperCase();
}

/**
 * Convert state name to lowercase abbreviation
 */
export function toStateAbbrLower(input: string): string {
  return toStateAbbrUpper(input).toLowerCase();
}

/**
 * Convert state name to slug format
 */
export function toStateSlug(input: string): string {
  return (input || '').toLowerCase().replace(/\s+/g, '_');
}

/**
 * Proper capitalization for city names
 */
export function properCapitalize(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize city name by expanding truncated names using Nominatim
 */
export async function normalizeCityName(truncatedName: string, state: string): Promise<string> {
  const cleaned = truncatedName.toLowerCase().trim();

  // If name is reasonably long, it's probably not truncated
  if (cleaned.length > 10) {
    return properCapitalize(cleaned);
  }

  // For potentially truncated names, use Nominatim to find the full name
  try {
    const query = `${cleaned}, ${state}, United States`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&email=contact@yardura.com`;

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'Yardura-ZipSearch/1.0' },
      cache: 'force-cache'
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].address) {
        const address = data[0].address;
        // Try different address components for city name
        const fullCityName = address.city || address.town || address.village || address.municipality;
        if (fullCityName && fullCityName.toLowerCase().startsWith(cleaned.substring(0, 8))) {
          return properCapitalize(fullCityName);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to normalize city name "${truncatedName}":`, error);
  }

  // Fallback to basic capitalization
  return properCapitalize(cleaned);
}
