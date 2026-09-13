import { describe, it, expect } from 'vitest';
import {
  mmToPoints,
  pointsToMm,
  toPdfPoint,
  toPdfDimensions,
  POINTS_PER_MM,
} from '../../../../src/core/compilers/pdf/pdf-units';

describe('PDF Units Conversion (Phase 4 Block 6)', () => {
  it('should convert 25.4 mm to exactly 72 points', () => {
    expect(mmToPoints(25.4)).toBe(72);
  });

  it('should convert 72 points to exactly 25.4 mm', () => {
    expect(pointsToMm(72)).toBe(25.4);
  });

  it('should perform round-trip conversions accurately', () => {
    const testMms = [1, 10, 50, 100, 101.6, 150];
    for (const mm of testMms) {
      const pt = mmToPoints(mm);
      const backToMm = pointsToMm(pt);
      expect(backToMm).toBeCloseTo(mm, 6);
    }
  });

  it('should calculate points per mm correctly', () => {
    expect(POINTS_PER_MM).toBeCloseTo(2.834645, 5);
    expect(mmToPoints(10)).toBeCloseTo(28.34645, 4);
  });

  it('should convert positions and dimensions to PDF points correctly', () => {
    const pt = toPdfPoint(10, 20);
    expect(pt.xPt).toBeCloseTo(mmToPoints(10), 5);
    expect(pt.yPt).toBeCloseTo(mmToPoints(20), 5);

    const dims = toPdfDimensions(100, 50);
    expect(dims.widthPt).toBeCloseTo(mmToPoints(100), 5);
    expect(dims.heightPt).toBeCloseTo(mmToPoints(50), 5);
  });
});
