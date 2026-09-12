import { describe, it, expect } from 'vitest';
import {
  mmToDots,
  dotsToMm,
  mmToPixels,
  pixelsToMm,
  quantizeBarcodeX,
  isSupportedDpi,
  SUPPORTED_DPIS,
  inchToMm,
  mmToInch,
} from '../../src/core/units/converter';

describe('Unit Converter - Pure Mathematical Domain Engine', () => {
  describe('Supported DPI Verification', () => {
    it('should correctly recognize 203, 300, and 600 DPI', () => {
      expect(SUPPORTED_DPIS).toEqual([203, 300, 600]);
      expect(isSupportedDpi(203)).toBe(true);
      expect(isSupportedDpi(300)).toBe(true);
      expect(isSupportedDpi(600)).toBe(true);
      expect(isSupportedDpi(150)).toBe(false);
      expect(isSupportedDpi(72)).toBe(false);
    });
  });

  describe('mmToDots conversion', () => {
    it('should convert 25.4 mm (1 inch) to exact DPI dots', () => {
      expect(mmToDots(25.4, 203)).toBe(203);
      expect(mmToDots(25.4, 300)).toBe(300);
      expect(mmToDots(25.4, 600)).toBe(600);
    });

    it('should accurately round mm to hardware dots for standard label dimensions', () => {
      // 100mm label width
      expect(mmToDots(100, 203)).toBe(799); // round(100 * 203 / 25.4 = 799.21)
      expect(mmToDots(100, 300)).toBe(1181); // round(100 * 300 / 25.4 = 1181.10)
      expect(mmToDots(100, 600)).toBe(2362); // round(100 * 600 / 25.4 = 2362.20)

      // 50mm label height
      expect(mmToDots(50, 203)).toBe(400); // round(50 * 203 / 25.4 = 399.60)
      expect(mmToDots(50, 300)).toBe(591); // round(50 * 300 / 25.4 = 590.55)
      expect(mmToDots(50, 600)).toBe(1181); // round(50 * 600 / 25.4 = 1181.10)
    });

    it('should throw when DPI is invalid (<= 0)', () => {
      expect(() => mmToDots(10, 0)).toThrow('DPI must be a positive number');
      expect(() => mmToDots(10, -203)).toThrow('DPI must be a positive number');
    });
  });

  describe('dotsToMm conversion', () => {
    it('should convert DPI dots back to 25.4 mm', () => {
      expect(dotsToMm(203, 203)).toBe(25.4);
      expect(dotsToMm(300, 300)).toBe(25.4);
      expect(dotsToMm(600, 600)).toBe(25.4);
    });

    it('should preserve 4 decimal places of physical precision', () => {
      // 8 dots at 203 DPI: (8 * 25.4) / 203 = 1.00098522... -> 1.001
      expect(dotsToMm(8, 203)).toBe(1.001);
      // 1 dot at 203 DPI: 25.4 / 203 = 0.125123... -> 0.1251
      expect(dotsToMm(1, 203)).toBe(0.1251);
      // 1 dot at 300 DPI: 25.4 / 300 = 0.084666... -> 0.0847
      expect(dotsToMm(1, 300)).toBe(0.0847);
      // 1 dot at 600 DPI: 25.4 / 600 = 0.042333... -> 0.0423
      expect(dotsToMm(1, 600)).toBe(0.0423);
    });

    it('should throw when DPI is invalid (<= 0)', () => {
      expect(() => dotsToMm(100, 0)).toThrow('DPI must be a positive number');
      expect(() => dotsToMm(100, -300)).toThrow('DPI must be a positive number');
    });
  });

  describe('CSS Pixel <-> Millimeter conversions', () => {
    it('should convert 25.4 mm to 96 CSS pixels', () => {
      expect(mmToPixels(25.4)).toBe(96);
    });

    it('should convert 96 CSS pixels to 25.4 mm', () => {
      expect(pixelsToMm(96)).toBe(25.4);
    });

    it('should handle typical screen dimensions', () => {
      // 10mm
      expect(mmToPixels(10)).toBe(38); // round(10 * 96 / 25.4 = 37.79)
      // 38px to mm
      expect(pixelsToMm(38)).toBe(10.0542);
    });
  });

  describe('Inch <-> Millimeter conversions', () => {
    it('should convert inches to millimeters', () => {
      expect(inchToMm(1)).toBe(25.4);
      expect(inchToMm(4)).toBe(101.6);
      expect(inchToMm(6)).toBe(152.4);
    });

    it('should convert millimeters to inches', () => {
      expect(mmToInch(25.4)).toBe(1);
      expect(mmToInch(101.6)).toBe(4);
      expect(mmToInch(152.4)).toBe(6);
    });
  });

  describe('quantizeBarcodeX (Narrow bar X-dimension quantization)', () => {
    it('should quantize target narrow bar width to integer dots >= 1 at 203 DPI', () => {
      // 0.25 mm target at 203 DPI -> 0.25 * (203 / 25.4) = 1.998 -> 2 dots
      const result = quantizeBarcodeX(0.25, 203);
      expect(result.dots).toBe(2);
      expect(Number.isInteger(result.dots)).toBe(true);
      expect(result.physicalMm).toBe(dotsToMm(2, 203));
      expect(result.physicalMm).toBe(0.2502);
    });

    it('should quantize target narrow bar width to integer dots >= 1 at 300 DPI', () => {
      // 0.25 mm target at 300 DPI -> 0.25 * (300 / 25.4) = 2.95 -> 3 dots
      const result = quantizeBarcodeX(0.25, 300);
      expect(result.dots).toBe(3);
      expect(Number.isInteger(result.dots)).toBe(true);
      expect(result.physicalMm).toBe(dotsToMm(3, 300));
      expect(result.physicalMm).toBe(0.254);
    });

    it('should quantize target narrow bar width to integer dots >= 1 at 600 DPI', () => {
      // 0.25 mm target at 600 DPI -> 0.25 * (600 / 25.4) = 5.9 -> 6 dots
      const result = quantizeBarcodeX(0.25, 600);
      expect(result.dots).toBe(6);
      expect(Number.isInteger(result.dots)).toBe(true);
      expect(result.physicalMm).toBe(dotsToMm(6, 600));
      expect(result.physicalMm).toBe(0.254);
    });

    it('should enforce minimum of 1 dot even if target width is extremely small', () => {
      const tinyResult = quantizeBarcodeX(0.001, 203);
      expect(tinyResult.dots).toBe(1);
      expect(tinyResult.physicalMm).toBe(0.1251);

      const zeroResult = quantizeBarcodeX(0, 300);
      expect(zeroResult.dots).toBe(1);
      expect(zeroResult.physicalMm).toBe(0.0847);
    });

    it('should throw when DPI is invalid (<= 0)', () => {
      expect(() => quantizeBarcodeX(0.25, 0)).toThrow('DPI must be a positive number');
    });
  });
});
