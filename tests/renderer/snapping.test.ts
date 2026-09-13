import { describe, it, expect } from 'vitest';
import {
  snapValue,
  snapToGrid,
  snapPointToBoundsAndGrid,
} from '../../src/renderer/canvas/snapping';

describe('Snapping Engine - Pure Spatial Calculation', () => {
  describe('snapValue', () => {
    it('should snap to target when distance in pixels is within threshold', () => {
      // 0.2mm distance @ zoom 1.0 = 0.2 * (96/25.4) ≈ 0.75px. With threshold 6px -> snaps
      const result = snapValue(10.2, 10.0, 6, 1.0);
      expect(result.snapped).toBe(true);
      expect(result.value).toBe(10.0);
    });

    it('should not snap when distance in pixels exceeds threshold', () => {
      // 3mm distance @ zoom 1.0 = 3 * (96/25.4) ≈ 11.34px. With threshold 6px -> does not snap
      const result = snapValue(13.0, 10.0, 6, 1.0);
      expect(result.snapped).toBe(false);
      expect(result.value).toBe(13.0);
    });

    it('should scale pixel distance with zoom correctly', () => {
      // 1mm distance @ zoom 1.0 = ~3.78px -> within 6px threshold
      const snapAtZoom1 = snapValue(11.0, 10.0, 6, 1.0);
      expect(snapAtZoom1.snapped).toBe(true);

      // 1mm distance @ zoom 2.0 = ~7.56px -> exceeds 6px threshold
      const snapAtZoom2 = snapValue(11.0, 10.0, 6, 2.0);
      expect(snapAtZoom2.snapped).toBe(false);
    });
  });

  describe('snapToGrid', () => {
    it('should snap to nearest grid step (1mm grid)', () => {
      // 10.1mm is close to 10.0mm grid line
      const result = snapToGrid(10.1, 1.0, 6, 1.0);
      expect(result.snapped).toBe(true);
      expect(result.value).toBe(10.0);

      // 10.9mm is close to 11.0mm grid line
      const result2 = snapToGrid(10.9, 1.0, 6, 1.0);
      expect(result2.snapped).toBe(true);
      expect(result2.value).toBe(11.0);
    });

    it('should not snap if position is in the middle of grid cells beyond threshold', () => {
      // In a 10mm grid, 14.5mm is 4.5mm away from 10 and 5.5mm from 20 -> well beyond 6px threshold
      const result = snapToGrid(14.5, 10.0, 6, 1.0);
      expect(result.snapped).toBe(false);
      expect(result.value).toBe(14.5);
    });
  });

  describe('snapPointToBoundsAndGrid', () => {
    const docDims = { width: 100, height: 50 };
    const elemDims = { width: 30, height: 10 };

    it('should snap to Left border (x = 0) when close', () => {
      const point = { x: 0.3, y: 20 };
      const res = snapPointToBoundsAndGrid(point, elemDims, docDims, 1.0, 6, 1.0);

      expect(res.snappedX).toBe(true);
      expect(res.point.x).toBe(0);
    });

    it('should snap to Top border (y = 0) when close', () => {
      const point = { x: 20, y: 0.2 };
      const res = snapPointToBoundsAndGrid(point, elemDims, docDims, 1.0, 6, 1.0);

      expect(res.snappedY).toBe(true);
      expect(res.point.y).toBe(0);
    });

    it('should snap to Right border (x = doc.width - elem.width = 70) when close', () => {
      const point = { x: 69.8, y: 20 };
      const res = snapPointToBoundsAndGrid(point, elemDims, docDims, 1.0, 6, 1.0);

      expect(res.snappedX).toBe(true);
      expect(res.point.x).toBe(70);
    });

    it('should snap to Bottom border (y = doc.height - elem.height = 40) when close', () => {
      const point = { x: 20, y: 39.8 };
      const res = snapPointToBoundsAndGrid(point, elemDims, docDims, 1.0, 6, 1.0);

      expect(res.snappedY).toBe(true);
      expect(res.point.y).toBe(40);
    });

    it('should respect snapEnabled: false flag', () => {
      const point = { x: 0.3, y: 0.3 };
      const res = snapPointToBoundsAndGrid(point, elemDims, docDims, 1.0, 6, 1.0, false);

      expect(res.snappedX).toBe(false);
      expect(res.snappedY).toBe(false);
      expect(res.point.x).toBe(0.3);
      expect(res.point.y).toBe(0.3);
    });
  });
});
