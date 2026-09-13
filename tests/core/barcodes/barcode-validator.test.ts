import { describe, it, expect } from 'vitest';
import { validateBarcodeData } from '../../../src/core/barcodes/barcode-validator';

describe('Unified Barcode Validator Dispatcher', () => {
  it('should correctly validate Code 128 through dispatcher', () => {
    const res = validateBarcodeData('code128', 'VALID-C128');
    expect(res.valid).toBe(true);
  });

  it('should correctly validate EAN-13 through dispatcher', () => {
    const res = validateBarcodeData('ean13', '841234567890');
    expect(res.valid).toBe(true);
    expect(res.normalizedData).toBe('8412345678905');
  });

  it('should correctly validate QR Code with custom EC level through dispatcher', () => {
    const res = validateBarcodeData('qrcode', 'OPENLABELS-QR', { errorCorrection: 'H' });
    expect(res.valid).toBe(true);
  });

  it('should correctly validate Data Matrix through dispatcher', () => {
    const res = validateBarcodeData('datamatrix', 'DM-PAYLOAD-101');
    expect(res.valid).toBe(true);
  });

  it('should return error for unsupported symbology', () => {
    // @ts-expect-error test unsupported symbology
    const res = validateBarcodeData('pdf417', 'SOME-DATA');
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('UNSUPPORTED_SYMBOLOGY');
    expect(res.error).toContain('Unsupported barcode symbology');
  });
});
