/**
 * Tests for geo/normalize utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeZip,
  toStateAbbrUpper,
  toStateAbbrLower,
  toStateSlug,
  properCapitalize,
  ZCTA_PROP_KEYS
} from '../../geo/normalize';

describe('normalizeZip', () => {
  it('should extract 5-digit ZIP from various property formats', () => {
    expect(normalizeZip({ ZCTA5CE10: '12345' })).toBe('12345');
    expect(normalizeZip({ ZCTA5: '67890' })).toBe('67890');
    expect(normalizeZip({ GEOID: '11111' })).toBe('11111');
    expect(normalizeZip({ ZIP: '22222' })).toBe('22222');
    expect(normalizeZip({ zip: '33333' })).toBe('33333');
  });

  it('should pad short ZIP codes', () => {
    expect(normalizeZip({ ZCTA5CE10: '123' })).toBe('00123');
  });

  it('should truncate long ZIP codes', () => {
    expect(normalizeZip({ ZCTA5CE10: '123456789' })).toBe('12345');
  });

  it('should return empty string for invalid input', () => {
    expect(normalizeZip({})).toBe('');
    expect(normalizeZip({ invalid: 'abc' })).toBe('');
    expect(normalizeZip(null)).toBe('');
  });
});

describe('state utilities', () => {
  it('should convert state names to abbreviations', () => {
    expect(toStateAbbrUpper('California')).toBe('CA');
    expect(toStateAbbrUpper('Texas')).toBe('TX');
    expect(toStateAbbrUpper('New York')).toBe('NY');
  });

  it('should handle already abbreviated states', () => {
    expect(toStateAbbrUpper('CA')).toBe('CA');
    expect(toStateAbbrLower('TX')).toBe('tx');
  });

  it('should create state slugs', () => {
    expect(toStateSlug('New York')).toBe('new_york');
    expect(toStateSlug('California')).toBe('california');
    expect(toStateSlug('District of Columbia')).toBe('district_of_columbia');
  });
});

describe('properCapitalize', () => {
  it('should capitalize properly', () => {
    expect(properCapitalize('minneapolis')).toBe('Minneapolis');
    expect(properCapitalize('saint paul')).toBe('Saint Paul');
    expect(properCapitalize('new york')).toBe('New York');
  });
});

describe('ZCTA_PROP_KEYS', () => {
  it('should contain all expected property keys', () => {
    expect(ZCTA_PROP_KEYS).toContain('ZCTA5CE10');
    expect(ZCTA_PROP_KEYS).toContain('ZCTA5');
    expect(ZCTA_PROP_KEYS).toContain('GEOID');
    expect(ZCTA_PROP_KEYS).toContain('ZIP');
    expect(ZCTA_PROP_KEYS).toContain('zip');
  });
});


