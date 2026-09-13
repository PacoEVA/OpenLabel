import { describe, it, expect } from 'vitest';
import { validateCode128, CODE128_MAX_LENGTH } from '../../../src/core/barcodes/symbologies/code128';

describe('Pure Code 128 Domain Validation', () => {
  it('should accept valid standard alphanumeric text', () => {
    const res = validateCode128('ABC-12345_xyz');
    expect(res.valid).toBe(true);
    expect(res.normalizedData).toBe('ABC-12345_xyz');
    expect(res.error).toBeUndefined();
  });

  it('should accept purely numeric data', () => {
    const res = validateCode128('12345678901234567890');
    expect(res.valid).toBe(true);
    expect(res.normalizedData).toBe('12345678901234567890');
  });

  it('should accept printable ASCII punctuation and symbols', () => {
    const res = validateCode128('P#10492-REV.B/2026');
    expect(res.valid).toBe(true);
  });

  it('should reject empty string', () => {
    const res = validateCode128('');
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_DATA');
    expect(res.error).toContain('cannot be empty');
  });

  it('should reject non-string input or nullish values', () => {
    // @ts-expect-error test invalid types
    const resNull = validateCode128(null);
    expect(resNull.valid).toBe(false);
    expect(resNull.errorCode).toBe('INVALID_DATA');
  });

  it('should reject payload exceeding maximum supported length', () => {
    const tooLong = 'A'.repeat(CODE128_MAX_LENGTH + 1);
    const res = validateCode128(tooLong);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_LENGTH');
    expect(res.error).toContain('exceeds maximum supported length');
  });

  it('should reject non-ASCII characters (e.g. accented letters, emojis, UTF-8 beyond 127)', () => {
    const withAccent = validateCode128('Código128');
    expect(withAccent.valid).toBe(false);
    expect(withAccent.errorCode).toBe('INVALID_CHARACTERS');
    expect(withAccent.error).toContain('non-ASCII character');

    const withEmoji = validateCode128('BOX-📦');
    expect(withEmoji.valid).toBe(false);
    expect(withEmoji.errorCode).toBe('INVALID_CHARACTERS');
  });
});
