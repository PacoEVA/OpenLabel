import { LabelDpi } from '../../schemas/label.schema';
import { mmToDots } from '../../units/converter';

/**
 * OpenLabels - ZPL Unit Conversions
 * Converts physical millimeters to discrete hardware dots at printer DPI.
 * Always rounds to the nearest integer dot (no fractional dots on hardware).
 */

export function mmToZplDots(mm: number, dpi: LabelDpi): number {
  const dots = mmToDots(mm, dpi);
  return Math.round(dots);
}

export interface ZplPointDots {
  xDots: number;
  yDots: number;
}

export interface ZplDimensionsDots {
  widthDots: number;
  heightDots: number;
}

export function toZplPoint(xMm: number, yMm: number, dpi: LabelDpi): ZplPointDots {
  return {
    xDots: mmToZplDots(xMm, dpi),
    yDots: mmToZplDots(yMm, dpi),
  };
}

export function toZplDimensions(widthMm: number, heightMm: number, dpi: LabelDpi): ZplDimensionsDots {
  return {
    widthDots: Math.max(1, mmToZplDots(widthMm, dpi)),
    heightDots: Math.max(1, mmToZplDots(heightMm, dpi)),
  };
}
