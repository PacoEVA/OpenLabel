/**
 * OpenLabels - Pure PDF Units & Coordinate Conversions
 *
 * Standard PDF points are defined as 1/72 of an international inch:
 * 1 inch = 25.4 mm = 72 points
 * 1 mm = 72 / 25.4 points ≈ 2.834645669 pt
 */

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;
export const POINTS_PER_MM = POINTS_PER_INCH / MM_PER_INCH;

/**
 * Converts millimeters to standard PDF points (1/72 in).
 */
export function mmToPoints(mm: number): number {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH;
}

/**
 * Converts standard PDF points to millimeters.
 */
export function pointsToMm(points: number): number {
  return (points * MM_PER_INCH) / POINTS_PER_INCH;
}

export interface PdfPointPt {
  xPt: number;
  yPt: number;
}

export interface PdfDimensionsPt {
  widthPt: number;
  heightPt: number;
}

/**
 * Converts physical mm position to PDF points.
 */
export function toPdfPoint(xMm: number, yMm: number): PdfPointPt {
  return {
    xPt: mmToPoints(xMm),
    yPt: mmToPoints(yMm),
  };
}

/**
 * Converts physical mm dimensions to PDF points.
 */
export function toPdfDimensions(widthMm: number, heightMm: number): PdfDimensionsPt {
  return {
    widthPt: mmToPoints(widthMm),
    heightPt: mmToPoints(heightMm),
  };
}
