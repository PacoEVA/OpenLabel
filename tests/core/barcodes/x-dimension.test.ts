import { describe, it, expect } from 'vitest';
import { calculateXDimension } from '../../../src/core/barcodes';

describe('Barcode X Dimension - Physical Quantization', () => {
  it('should calculate dots and physical mm for 203 DPI', () => {
    // 0.25 mm at 203 DPI -> 2 dots -> (2 * 25.4) / 203 = 0.2502 mm
    const res203 = calculateXDimension(0.25, 203);
    expect(res203.dots).toBe(2);
    expect(res203.physicalMm).toBe(0.2502);
    expect(res203.requestedMm).toBe(0.25);
    expect(res203.dpi).toBe(203);
  });

  it('should calculate dots and physical mm for 300 DPI', () => {
    // 0.25 mm at 300 DPI -> 3 dots -> (3 * 25.4) / 300 = 0.254 mm
    const res300 = calculateXDimension(0.25, 300);
    expect(res300.dots).toBe(3);
    expect(res300.physicalMm).toBe(0.254);
  });

  it('should calculate dots and physical mm for 600 DPI', () => {
    // 0.25 mm at 600 DPI -> 6 dots -> (6 * 25.4) / 600 = 0.254 mm
    const res600 = calculateXDimension(0.25, 600);
    expect(res600.dots).toBe(6);
    expect(res600.physicalMm).toBe(0.254);
  });

  it('should enforce at least 1 dot for microscopic requests', () => {
    const tiny = calculateXDimension(0.001, 203);
    expect(tiny.dots).toBe(1);
    expect(tiny.physicalMm).toBe(0.1251);
  });
});
