/**
 * OpenLabels - Canvas Visual Coordinate Transformer
 * Handles conversions between physical document units (mm) and Konva visual canvas pixels (px)
 * taking viewport zoom and pan into account.
 *
 * NOTE: The visual canvas strictly uses CSS Standard 96 DPI.
 * Physical printing uses printer hardware DPI and converter.ts.
 */

export const CSS_SCREEN_DPI = 96;
export const MM_PER_INCH = 25.4;
export const PX_PER_MM = CSS_SCREEN_DPI / MM_PER_INCH; // ~3.779527559 px/mm

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Bounds extends Point, Dimensions {}

/**
 * Normalizes a millimeter float value to 4 decimal places to prevent floating-point drift.
 */
export function normalizeMm(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Converts a physical millimeter length to visual canvas pixels at a given zoom level.
 * Formula: mm * (96 / 25.4) * zoom
 */
export function mmToCanvasPx(mm: number, zoom: number = 1): number {
  return mm * PX_PER_MM * zoom;
}

/**
 * Converts visual canvas pixels back to physical millimeters at a given zoom level,
 * with 4 decimal places of precision.
 * Formula: px / ((96 / 25.4) * zoom)
 */
export function canvasPxToMm(px: number, zoom: number = 1): number {
  if (zoom <= 0) {
    throw new Error(`Zoom must be a positive number greater than 0, received: ${zoom}`);
  }
  const rawMm = px / (PX_PER_MM * zoom);
  return normalizeMm(rawMm);
}

/**
 * Converts a 2D physical point in millimeters to visual canvas coordinates,
 * optionally applying viewport pan offset.
 */
export function pointMmToCanvasPx(
  point: Point,
  zoom: number = 1,
  viewport: Point = { x: 0, y: 0 }
): Point {
  return {
    x: viewport.x + mmToCanvasPx(point.x, zoom),
    y: viewport.y + mmToCanvasPx(point.y, zoom),
  };
}

/**
 * Converts a 2D visual canvas coordinate in pixels back to a physical point in millimeters,
 * taking viewport pan offset and zoom into account.
 */
export function pointCanvasPxToMm(
  canvasPoint: Point,
  zoom: number = 1,
  viewport: Point = { x: 0, y: 0 }
): Point {
  return {
    x: canvasPxToMm(canvasPoint.x - viewport.x, zoom),
    y: canvasPxToMm(canvasPoint.y - viewport.y, zoom),
  };
}

/**
 * Converts physical dimensions in millimeters to visual dimensions in canvas pixels.
 */
export function dimensionsMmToCanvasPx(
  dims: Dimensions,
  zoom: number = 1
): Dimensions {
  return {
    width: mmToCanvasPx(dims.width, zoom),
    height: mmToCanvasPx(dims.height, zoom),
  };
}

/**
 * Converts visual dimensions in canvas pixels to physical dimensions in millimeters.
 */
export function dimensionsCanvasPxToMm(
  canvasDims: Dimensions,
  zoom: number = 1
): Dimensions {
  return {
    width: canvasPxToMm(canvasDims.width, zoom),
    height: canvasPxToMm(canvasDims.height, zoom),
  };
}

/**
 * Converts full bounding box from millimeters to canvas pixels.
 */
export function boundsMmToCanvasPx(
  bounds: Bounds,
  zoom: number = 1,
  viewport: Point = { x: 0, y: 0 }
): Bounds {
  const origin = pointMmToCanvasPx({ x: bounds.x, y: bounds.y }, zoom, viewport);
  const dims = dimensionsMmToCanvasPx({ width: bounds.width, height: bounds.height }, zoom);
  return {
    x: origin.x,
    y: origin.y,
    width: dims.width,
    height: dims.height,
  };
}

/**
 * Converts full bounding box from canvas pixels back to physical millimeters.
 */
export function boundsCanvasPxToMm(
  canvasBounds: Bounds,
  zoom: number = 1,
  viewport: Point = { x: 0, y: 0 }
): Bounds {
  const origin = pointCanvasPxToMm({ x: canvasBounds.x, y: canvasBounds.y }, zoom, viewport);
  const dims = dimensionsCanvasPxToMm({ width: canvasBounds.width, height: canvasBounds.height }, zoom);
  return {
    x: origin.x,
    y: origin.y,
    width: dims.width,
    height: dims.height,
  };
}
