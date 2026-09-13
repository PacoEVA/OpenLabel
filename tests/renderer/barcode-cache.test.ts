import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBarcodeCacheKey,
  getOrRenderBarcodeSvg,
  clearBarcodeCache,
  getBarcodeCacheSize,
} from '../../src/renderer/barcodes/barcode-cache';

describe('Barcode Vector Cache', () => {
  beforeEach(() => {
    clearBarcodeCache();
  });

  it('should compute consistent deterministic cache keys', () => {
    const key1 = getBarcodeCacheKey({
      symbology: 'code128',
      data: 'TEST',
      displayValue: true,
    });
    const key2 = getBarcodeCacheKey({
      symbology: 'code128',
      data: 'TEST',
      displayValue: true,
    });
    const key3 = getBarcodeCacheKey({
      symbology: 'code128',
      data: 'TEST',
      displayValue: false,
    });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('should cache render results and avoid redundant executions', () => {
    expect(getBarcodeCacheSize()).toBe(0);

    const res1 = getOrRenderBarcodeSvg({
      symbology: 'code128',
      data: 'CACHED-128',
      displayValue: true,
    });

    expect(res1.success).toBe(true);
    expect(getBarcodeCacheSize()).toBe(1);

    const res2 = getOrRenderBarcodeSvg({
      symbology: 'code128',
      data: 'CACHED-128',
      displayValue: true,
    });

    expect(res2).toBe(res1); // exact same object reference returned from cache
    expect(getBarcodeCacheSize()).toBe(1);
  });

  it('should clear cache on demand', () => {
    getOrRenderBarcodeSvg({
      symbology: 'qrcode',
      data: 'QR-TEST',
    });
    expect(getBarcodeCacheSize()).toBe(1);

    clearBarcodeCache();
    expect(getBarcodeCacheSize()).toBe(0);
  });
});
