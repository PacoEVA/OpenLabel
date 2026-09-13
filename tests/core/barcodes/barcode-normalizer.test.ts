import { describe, it, expect } from 'vitest';
import { normalizeBarcodeElement } from '../../../src/core/barcodes/barcode-normalizer';
import { BarcodeElement, QrCodeElement } from '../../../src/core/schemas/label.schema';
import { BarcodeDomainError } from '../../../src/core/barcodes/barcode-errors';

describe('Barcode Normalizer', () => {
  it('should normalize a standard Code 128 BarcodeElement', () => {
    const el: BarcodeElement = {
      id: 'bc-1',
      type: 'barcode',
      symbology: 'code128',
      data: 'SHIP-9988',
      x: 10,
      y: 20,
      width: 50,
      height: 25,
      rotation: 0,
      locked: false,
      displayValue: true,
      narrowBarRatio: 3,
    };

    const normalized = normalizeBarcodeElement(el, { dpi: 203 });
    expect(normalized.symbology).toBe('code128');
    expect(normalized.data).toBe('SHIP-9988');
    expect(normalized.widthMm).toBe(50);
    expect(normalized.heightMm).toBe(25);
    expect(normalized.displayValue).toBe(true);
    expect(normalized.xDimensionDots).toBe(3);
    // at 203 DPI, 3 dots = 3 / (203 / 25.4) = ~0.375369 mm
    expect(normalized.xDimensionMm).toBeCloseTo(0.375, 2);
    // Quiet zone for Code 128 is 10X left & right
    expect(normalized.quietZone).toBeDefined();
    expect(normalized.quietZone!.leftMm).toBeCloseTo(3.75, 1);
    expect(normalized.quietZone!.rightMm).toBeCloseTo(3.75, 1);
  });

  it('should normalize a 12-digit EAN-13 BarcodeElement and append the check digit', () => {
    const el: BarcodeElement = {
      id: 'bc-ean',
      type: 'barcode',
      symbology: 'ean13',
      data: '841234567890',
      x: 5,
      y: 5,
      width: 37.29,
      height: 25.93,
      rotation: 0,
      locked: false,
      displayValue: true,
      narrowBarRatio: 2,
    };

    const normalized = normalizeBarcodeElement(el, { dpi: 203 });
    expect(normalized.symbology).toBe('ean13');
    expect(normalized.data).toBe('8412345678905'); // check digit computed!
    expect(normalized.xDimensionDots).toBe(2);
    // EAN-13 quiet zones: 11X left, 7X right
    expect(normalized.quietZone).toBeDefined();
    expect(normalized.quietZone!.leftMm).toBeGreaterThan(normalized.quietZone!.rightMm);
  });

  it('should normalize a legacy or separate QrCodeElement', () => {
    const qrEl: QrCodeElement = {
      id: 'qr-1',
      type: 'qrcode',
      data: 'https://openlabels.io',
      x: 10,
      y: 10,
      width: 30,
      height: 30,
      rotation: 0,
      locked: false,
      errorCorrection: 'Q',
    };

    const normalized = normalizeBarcodeElement(qrEl);
    expect(normalized.symbology).toBe('qrcode');
    expect(normalized.data).toBe('https://openlabels.io');
    expect(normalized.errorCorrection).toBe('Q');
    expect(normalized.displayValue).toBe(false);
    // QR quiet zone is 4 modules on all sides
    expect(normalized.quietZone).toBeDefined();
    expect(normalized.quietZone!.topMm).toBeGreaterThan(0);
    expect(normalized.quietZone!.bottomMm).toBeGreaterThan(0);
  });

  it('should throw BarcodeDomainError when payload is invalid for the symbology', () => {
    const invalidEan: BarcodeElement = {
      id: 'bc-bad',
      type: 'barcode',
      symbology: 'ean13',
      data: '123ABC', // invalid characters and length
      x: 0,
      y: 0,
      width: 30,
      height: 20,
      rotation: 0,
      locked: false,
      displayValue: true,
      narrowBarRatio: 2,
    };

    expect(() => normalizeBarcodeElement(invalidEan)).toThrow(BarcodeDomainError);
    try {
      normalizeBarcodeElement(invalidEan);
    } catch (e) {
      const err = e as BarcodeDomainError;
      expect(err.symbology).toBe('ean13');
      expect(err.code).toBe('INVALID_CHARACTERS');
    }
  });
});
