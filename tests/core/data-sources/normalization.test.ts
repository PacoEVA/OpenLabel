import { describe, it, expect } from 'vitest';
import {
  normalizeExternalValue,
  safeNormalizeExternalValue,
  NormalizationError,
} from '../../../src/core/data-sources';

describe('Value Normalization (normalizeExternalValue)', () => {
  describe('String handling', () => {
    it('preserves strings without mutation or speculative parsing', () => {
      expect(normalizeExternalValue('Hello World')).toBe('Hello World');
      // Crucial requirement: ambiguous strings must NEVER be converted to Date
      expect(normalizeExternalValue('01/02/03')).toBe('01/02/03');
      expect(normalizeExternalValue('2026-12-31')).toBe('2026-12-31');
      expect(normalizeExternalValue('12345')).toBe('12345');
    });
  });

  describe('Number handling', () => {
    it('converts finite numbers to string representation', () => {
      expect(normalizeExternalValue(42)).toBe('42');
      expect(normalizeExternalValue(3.14159)).toBe('3.14159');
      expect(normalizeExternalValue(0)).toBe('0');
      expect(normalizeExternalValue(-99)).toBe('-99');
    });

    it('throws NormalizationError on NaN or Infinity', () => {
      expect(() => normalizeExternalValue(NaN, { columnName: 'price' })).toThrowError(
        NormalizationError
      );
      expect(() => normalizeExternalValue(Infinity, { columnName: 'price' })).toThrowError(
        NormalizationError
      );
    });
  });

  describe('Boolean handling', () => {
    it('converts booleans to "true" and "false"', () => {
      expect(normalizeExternalValue(true)).toBe('true');
      expect(normalizeExternalValue(false)).toBe('false');
    });
  });

  describe('Date handling', () => {
    it('converts valid Date instances to ISO 8601 strings', () => {
      const d = new Date('2026-09-12T12:00:00.000Z');
      expect(normalizeExternalValue(d)).toBe('2026-09-12T12:00:00.000Z');
    });

    it('throws NormalizationError on invalid Date objects', () => {
      const invalidDate = new Date('invalid date string');
      expect(() => normalizeExternalValue(invalidDate, { columnName: 'exp_date' })).toThrowError(
        NormalizationError
      );
    });
  });

  describe('Null and Undefined handling', () => {
    it('returns empty string when policy is "empty"', () => {
      expect(normalizeExternalValue(null, { nullHandling: 'empty' })).toBe('');
      expect(normalizeExternalValue(undefined, { nullHandling: 'empty' })).toBe('');
    });

    it('uses defaultValue when policy is "default"', () => {
      expect(
        normalizeExternalValue(null, { nullHandling: 'default', defaultValue: 'N/A' })
      ).toBe('N/A');
      expect(
        normalizeExternalValue(undefined, { nullHandling: 'default', defaultValue: 'DEF_VAL' })
      ).toBe('DEF_VAL');
    });

    it('falls back to empty string when policy is "default" and no defaultValue is provided', () => {
      expect(normalizeExternalValue(null, { nullHandling: 'default' })).toBe('');
    });

    it('throws NormalizationError when policy is "error"', () => {
      expect(() =>
        normalizeExternalValue(null, { nullHandling: 'error', columnName: 'required_field' })
      ).toThrowError(NormalizationError);

      expect(() =>
        normalizeExternalValue(undefined, { nullHandling: 'error', columnName: 'required_field' })
      ).toThrowError(NormalizationError);
    });
  });

  describe('Object and Array handling', () => {
    it('serializes objects and arrays safely into JSON', () => {
      expect(normalizeExternalValue({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
      expect(normalizeExternalValue([1, 2, 3])).toBe('[1,2,3]');
    });
  });

  describe('safeNormalizeExternalValue', () => {
    it('returns success object on valid value', () => {
      const res = safeNormalizeExternalValue(100);
      expect(res).toEqual({ success: true, value: '100' });
    });

    it('returns error object on failure without throwing', () => {
      const res = safeNormalizeExternalValue(null, { nullHandling: 'error', columnName: 'sku' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('sku');
      }
    });
  });
});
