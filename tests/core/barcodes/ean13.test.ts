import { describe, it, expect } from 'vitest';
import {
  calculateEan13CheckDigit,
  validateEan13,
  normalizeEan13,
  BarcodeDomainError,
} from '../../../src/core/barcodes';

describe('EAN-13 Domain Engine - Pure Checksum and Validation', () => {
  describe('calculateEan13CheckDigit', () => {
    it('should accurately calculate GS1 Modulo 10 check digits for standard 12-digit payloads', () => {
      // Test Case 1: Standard product barcode
      // 400638133393 -> sum = (4+0+3+1+3+9)*1 + (0+6+8+3+3+3)*3 = 20 + 69 = 89 -> 10 - 9 = 1
      expect(calculateEan13CheckDigit('400638133393')).toBe(1);

      // Test Case 2: ISBN EAN
      // 978020137962 -> sum = (9+8+2+1+7+6)*1 + (7+0+0+3+9+2)*3 = 33 + 63 = 96 -> 10 - 6 = 4
      expect(calculateEan13CheckDigit('978020137962')).toBe(4);

      // Test Case 3: Leading zero payload
      // 012345678901 -> sum = (0+2+4+6+8+0)*1 + (1+3+5+7+9+1)*3 = 20 + 78 = 98 -> 10 - 8 = 2
      expect(calculateEan13CheckDigit('012345678901')).toBe(2);

      // Test Case 4: Sum multiple of 10 -> check digit 0
      // 000000000000 -> sum = 0 -> remainder 0 -> check digit 0
      expect(calculateEan13CheckDigit('000000000000')).toBe(0);

      // Test Case 5: 735135370415 -> check digit 6
      expect(calculateEan13CheckDigit('735135370415')).toBe(6);
    });

    it('should throw BarcodeDomainError when length is not 12', () => {
      expect(() => calculateEan13CheckDigit('12345')).toThrow(BarcodeDomainError);
      expect(() => calculateEan13CheckDigit('1234567890123')).toThrow(BarcodeDomainError);
      expect(() => calculateEan13CheckDigit('')).toThrow(BarcodeDomainError);
    });

    it('should throw BarcodeDomainError when non-digits are passed', () => {
      expect(() => calculateEan13CheckDigit('40063813339A')).toThrow(BarcodeDomainError);
      expect(() => calculateEan13CheckDigit('400638 13339')).toThrow(BarcodeDomainError);
    });
  });

  describe('validateEan13', () => {
    it('should accept and automatically append check digit for valid 12-digit payloads', () => {
      const result = validateEan13('400638133393');
      expect(result.valid).toBe(true);
      expect(result.normalizedData).toBe('4006381333931');
      expect(result.error).toBeUndefined();

      const result2 = validateEan13('978020137962');
      expect(result2.valid).toBe(true);
      expect(result2.normalizedData).toBe('9780201379624');
    });

    it('should accept valid 13-digit payloads matching the check digit', () => {
      const result = validateEan13('4006381333931');
      expect(result.valid).toBe(true);
      expect(result.normalizedData).toBe('4006381333931');

      const result2 = validateEan13('7351353704156');
      expect(result2.valid).toBe(true);
      expect(result2.normalizedData).toBe('7351353704156');
    });

    it('should reject 13-digit payloads with invalid check digit', () => {
      // 4006381333931 is valid, so 4006381333932 must fail
      const result = validateEan13('4006381333932');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHECK_DIGIT');
      expect(result.error).toContain('Expected 1, received 2');

      // 9780201379624 is valid, so 9780201379620 must fail
      const result2 = validateEan13('9780201379620');
      expect(result2.valid).toBe(false);
      expect(result2.errorCode).toBe('INVALID_CHECK_DIGIT');
      expect(result2.error).toContain('Expected 4, received 0');
    });

    it('should reject empty or whitespace-only data', () => {
      expect(validateEan13('').valid).toBe(false);
      expect(validateEan13('').errorCode).toBe('INVALID_DATA');

      expect(validateEan13('   ').valid).toBe(false);
      expect(validateEan13('   ').errorCode).toBe('INVALID_DATA');
    });

    it('should reject data with spaces inside', () => {
      const result = validateEan13('4006 3813 3393');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARACTERS');
    });

    it('should reject letters or special characters', () => {
      const result = validateEan13('40063813339A');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARACTERS');

      const result2 = validateEan13('ABCDEFGHIJKLM');
      expect(result2.valid).toBe(false);
      expect(result2.errorCode).toBe('INVALID_CHARACTERS');
    });

    it('should reject length 11 (too short)', () => {
      const result = validateEan13('40063813339');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_LENGTH');
    });

    it('should reject length 14 (too long)', () => {
      const result = validateEan13('40063813339315');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_LENGTH');
    });
  });

  describe('normalizeEan13', () => {
    it('should return decomposed components for valid 12-digit input', () => {
      const normalized = normalizeEan13('400638133393');
      expect(normalized.fullCode).toBe('4006381333931');
      expect(normalized.data12).toBe('400638133393');
      expect(normalized.checkDigit).toBe(1);
    });

    it('should return decomposed components for valid 13-digit input', () => {
      const normalized = normalizeEan13('9780201379624');
      expect(normalized.fullCode).toBe('9780201379624');
      expect(normalized.data12).toBe('978020137962');
      expect(normalized.checkDigit).toBe(4);
    });

    it('should throw BarcodeDomainError on corrupt inputs', () => {
      expect(() => normalizeEan13('12345')).toThrow(BarcodeDomainError);
      expect(() => normalizeEan13('4006381333939')).toThrow(BarcodeDomainError);
    });
  });
});
