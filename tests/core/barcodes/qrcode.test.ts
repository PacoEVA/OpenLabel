import { describe, it, expect } from 'vitest';
import { validateQrCode } from '../../../src/core/barcodes/symbologies/qrcode';

describe('Pure QR Code Domain Validation', () => {
  it('should accept valid text or URL payload with default M error correction', () => {
    const res = validateQrCode('https://openlabels.org/spec/phase3');
    expect(res.valid).toBe(true);
    expect(res.normalizedData).toBe('https://openlabels.org/spec/phase3');
  });

  it('should accept all valid ISO error correction levels (L, M, Q, H) case-insensitively', () => {
    for (const ec of ['L', 'M', 'Q', 'H', 'l', 'm', 'q', 'h']) {
      const res = validateQrCode('TEST-DATA', ec);
      expect(res.valid).toBe(true);
    }
  });

  it('should reject empty payload', () => {
    const res = validateQrCode('');
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_DATA');
    expect(res.error).toContain('cannot be empty');
  });

  it('should reject invalid error correction levels', () => {
    const res = validateQrCode('TEST-DATA', 'X');
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_DATA');
    expect(res.error).toContain('Invalid QR Code error correction level');
  });
});
