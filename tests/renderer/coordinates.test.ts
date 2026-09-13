import { describe, it, expect } from 'vitest';
import {
  CSS_SCREEN_DPI,
  MM_PER_INCH,
  PX_PER_MM,
  mmToCanvasPx,
  canvasPxToMm,
  pointMmToCanvasPx,
  pointCanvasPxToMm,
  dimensionsMmToCanvasPx,
  dimensionsCanvasPxToMm,
  boundsMmToCanvasPx,
  boundsCanvasPxToMm,
  normalizeMm,
} from '../../src/renderer/canvas/coordinates';

describe('Canvas Visual Coordinate Adapter', () => {
  describe('Constants and Screen Standard', () => {
    it('should adhere to CSS Standard 96 DPI', () => {
      expect(CSS_SCREEN_DPI).toBe(96);
      expect(MM_PER_INCH).toBe(25.4);
      expect(PX_PER_MM).toBeCloseTo(96 / 25.4, 6);
    });
  });

  describe('mmToCanvasPx', () => {
    it('should convert 25.4 mm (1 physical inch) to exactly 96 CSS pixels at zoom 1.0 (100%)', () => {
      expect(mmToCanvasPx(25.4, 1.0)).toBe(96);
    });

    it('should accurately scale pixels across standard zoom levels', () => {
      // At zoom 25% (0.25)
      expect(mmToCanvasPx(25.4, 0.25)).toBe(24);
      // At zoom 50% (0.50)
      expect(mmToCanvasPx(25.4, 0.50)).toBe(48);
      // At zoom 150% (1.50)
      expect(mmToCanvasPx(25.4, 1.50)).toBe(144);
      // At zoom 200% (2.0)
      expect(mmToCanvasPx(25.4, 2.0)).toBe(192);
      // At zoom 400% (4.0)
      expect(mmToCanvasPx(25.4, 4.0)).toBe(384);
    });

    it('should handle standard 100mm x 50mm label dimensions', () => {
      const pxWidth = mmToCanvasPx(100, 1.0);
      const pxHeight = mmToCanvasPx(50, 1.0);
      expect(pxWidth).toBeCloseTo(377.9528, 3);
      expect(pxHeight).toBeCloseTo(188.9764, 3);
    });
  });

  describe('canvasPxToMm', () => {
    it('should convert 96 CSS pixels back to 25.4 mm at zoom 1.0', () => {
      expect(canvasPxToMm(96, 1.0)).toBe(25.4);
    });

    it('should invert scaled canvas pixels accurately across zoom levels', () => {
      expect(canvasPxToMm(24, 0.25)).toBe(25.4);
      expect(canvasPxToMm(48, 0.50)).toBe(25.4);
      expect(canvasPxToMm(192, 2.0)).toBe(25.4);
      expect(canvasPxToMm(384, 4.0)).toBe(25.4);
    });

    it('should throw an error when zoom is <= 0', () => {
      expect(() => canvasPxToMm(100, 0)).toThrow('Zoom must be a positive number');
      expect(() => canvasPxToMm(100, -1)).toThrow('Zoom must be a positive number');
    });
  });

  describe('Round-trip consistency (mm -> px -> mm)', () => {
    it('should preserve physical millimeter values without precision drift', () => {
      const testValues = [0.1, 1.5, 10.0, 25.4, 50.0, 75.3333, 100.0, 152.4];
      const zoomLevels = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0];

      for (const mm of testValues) {
        for (const zoom of zoomLevels) {
          const px = mmToCanvasPx(mm, zoom);
          const roundTripMm = canvasPxToMm(px, zoom);
          expect(roundTripMm).toBeCloseTo(mm, 4);
        }
      }
    });
  });

  describe('Point Transformations (with Viewport Pan)', () => {
    it('should transform 2D physical point to canvas coordinates without viewport offset', () => {
      const pointMm = { x: 10, y: 20 };
      const pointPx = pointMmToCanvasPx(pointMm, 1.0);
      expect(pointPx.x).toBeCloseTo(37.7953, 3);
      expect(pointPx.y).toBeCloseTo(75.5906, 3);
    });

    it('should incorporate viewport pan offset and zoom correctly', () => {
      const pointMm = { x: 25.4, y: 25.4 };
      const viewport = { x: 100, y: 50 };
      const zoom = 2.0;

      // 25.4mm @ zoom 2.0 = 192px. With viewport pan: x = 100 + 192 = 292, y = 50 + 192 = 242
      const pointPx = pointMmToCanvasPx(pointMm, zoom, viewport);
      expect(pointPx.x).toBe(292);
      expect(pointPx.y).toBe(242);

      // Inverse
      const backMm = pointCanvasPxToMm(pointPx, zoom, viewport);
      expect(backMm.x).toBe(25.4);
      expect(backMm.y).toBe(25.4);
    });
  });

  describe('Dimensions & Bounds Transformations', () => {
    it('should convert Dimensions correctly', () => {
      const dimsMm = { width: 100, height: 50 };
      const dimsPx = dimensionsMmToCanvasPx(dimsMm, 1.0);
      const backMm = dimensionsCanvasPxToMm(dimsPx, 1.0);

      expect(backMm.width).toBe(100);
      expect(backMm.height).toBe(50);
    });

    it('should convert full Bounds including position and dimensions with zoom and pan', () => {
      const boundsMm = { x: 10, y: 15, width: 40, height: 20 };
      const viewport = { x: 50, y: 30 };
      const zoom = 1.5;

      const boundsPx = boundsMmToCanvasPx(boundsMm, zoom, viewport);
      const backBoundsMm = boundsCanvasPxToMm(boundsPx, zoom, viewport);

      expect(backBoundsMm.x).toBeCloseTo(boundsMm.x, 4);
      expect(backBoundsMm.y).toBeCloseTo(boundsMm.y, 4);
      expect(backBoundsMm.width).toBeCloseTo(boundsMm.width, 4);
      expect(backBoundsMm.height).toBeCloseTo(boundsMm.height, 4);
    });
  });

  describe('normalizeMm', () => {
    it('should clamp float precision to 4 decimal places', () => {
      expect(normalizeMm(12.3456789)).toBe(12.3457);
      expect(normalizeMm(10.0)).toBe(10);
      expect(normalizeMm(0.00012)).toBe(0.0001);
    });
  });
});
