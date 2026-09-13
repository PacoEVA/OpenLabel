import { describe, it, expect } from 'vitest';
import { renderBarcodeSvg } from '../../src/renderer/barcodes/bwip-adapter';

describe('bwip-js Adapter', () => {
  it('should render valid Code 128 as SVG', () => {
    const res = renderBarcodeSvg({
      symbology: 'code128',
      data: 'TEST-128',
      displayValue: true,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.svg).toContain('<svg');
      expect(res.svg).toContain('</svg>');
    }
  });

  it('should render valid EAN-13 with 12 digits (computing check digit automatically)', () => {
    const res = renderBarcodeSvg({
      symbology: 'ean13',
      data: '841234567890',
      displayValue: true,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.svg).toContain('<svg');
    }
  });

  it('should render valid EAN-13 with 13 digits when checksum is correct', () => {
    const res = renderBarcodeSvg({
      symbology: 'ean13',
      data: '8412345678905',
      displayValue: true,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.svg).toContain('<svg');
    }
  });

  it('should render valid QR Code with specified error correction', () => {
    const res = renderBarcodeSvg({
      symbology: 'qrcode',
      data: 'https://openlabels.io/spec',
      errorCorrection: 'H',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.svg).toContain('<svg');
    }
  });

  it('should render valid Data Matrix ECC 200', () => {
    const res = renderBarcodeSvg({
      symbology: 'datamatrix',
      data: 'BATCH-2026-DM',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.svg).toContain('<svg');
    }
  });

  it('should safely return failure when EAN-13 has wrong check digit without throwing', () => {
    const res = renderBarcodeSvg({
      symbology: 'ean13',
      data: '8412345678909', // wrong check digit (expected 5)
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errorCode).toBe('INVALID_CHECK_DIGIT');
      expect(res.error).toContain('Invalid EAN-13 check digit');
    }
  });

  it('should safely return failure when data is empty without throwing', () => {
    const res = renderBarcodeSvg({
      symbology: 'code128',
      data: '',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errorCode).toBe('INVALID_DATA');
    }
  });

  it('should safely return failure when QR error correction is invalid without throwing', () => {
    const res = renderBarcodeSvg({
      symbology: 'qrcode',
      data: 'VALID-DATA',
      // @ts-expect-error test invalid EC level
      errorCorrection: 'Z',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errorCode).toBe('INVALID_DATA');
      expect(res.error).toContain('Invalid QR Code error correction level');
    }
  });
});
