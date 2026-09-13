import { describe, it, expect } from 'vitest';
import { mmToZplDots, toZplPoint, toZplDimensions } from '../../../../src/core/compilers/zpl/zpl-units';

describe('ZPL Units Conversion', () => {
  it('should convert millimeters to integer hardware dots at 203 DPI', () => {
    // 25.4 mm = 1 inch = exactly 203 dots
    expect(mmToZplDots(25.4, 203)).toBe(203);
    // 50 mm = 50 / 25.4 * 203 = 399.606 -> 400 dots
    expect(mmToZplDots(50, 203)).toBe(400);
  });

  it('should convert millimeters to integer hardware dots at 300 DPI', () => {
    // 25.4 mm = 1 inch = exactly 300 dots
    expect(mmToZplDots(25.4, 300)).toBe(300);
    // 100 mm = 100 / 25.4 * 300 = 1181.10 -> 1181 dots
    expect(mmToZplDots(100, 300)).toBe(1181);
  });

  it('should convert millimeters to integer hardware dots at 600 DPI', () => {
    // 25.4 mm = 1 inch = exactly 600 dots
    expect(mmToZplDots(25.4, 600)).toBe(600);
  });

  it('should convert points and dimensions correctly', () => {
    const pt = toZplPoint(10, 20, 203);
    expect(pt.xDots).toBe(mmToZplDots(10, 203));
    expect(pt.yDots).toBe(mmToZplDots(20, 203));

    const dims = toZplDimensions(50, 30, 203);
    expect(dims.widthDots).toBe(mmToZplDots(50, 203));
    expect(dims.heightDots).toBe(mmToZplDots(30, 203));
  });
});
