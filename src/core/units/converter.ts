/**
 * OpenLabels - Pure Mathematical Unit & DPI Converter
 * Decoupled from Electron, Node.js, and DOM APIs.
 */

export type SupportedDpi = 203 | 300 | 600;
export const SUPPORTED_DPIS: readonly SupportedDpi[] = [203, 300, 600] as const;

export const MM_PER_INCH = 25.4;
export const CSS_SCREEN_DPI = 96;

/**
 * Validates whether a given DPI number is officially supported.
 */
export function isSupportedDpi(dpi: number): dpi is SupportedDpi {
  return (SUPPORTED_DPIS as readonly number[]).includes(dpi);
}

/**
 * Converts millimeters to integer hardware dots for a given printer DPI.
 * Formula: round(mm * (dpi / 25.4))
 */
export function mmToDots(mm: number, dpi: number): number {
  if (dpi <= 0) {
    throw new Error(`DPI must be a positive number, received: ${dpi}`);
  }
  return Math.round(mm * (dpi / MM_PER_INCH));
}

/**
 * Converts hardware dots back to millimeters with 4 decimal places of precision.
 * Formula: (dots * 25.4) / dpi
 */
export function dotsToMm(dots: number, dpi: number): number {
  if (dpi <= 0) {
    throw new Error(`DPI must be a positive number, received: ${dpi}`);
  }
  const rawMm = (dots * MM_PER_INCH) / dpi;
  return Math.round(rawMm * 10000) / 10000;
}

/**
 * Converts millimeters to standard screen pixels using CSS standard 96 DPI.
 * Formula: round(mm * (96 / 25.4))
 */
export function mmToPixels(mm: number): number {
  return Math.round(mm * (CSS_SCREEN_DPI / MM_PER_INCH));
}

/**
 * Converts screen pixels to millimeters using CSS standard 96 DPI with 4 decimal places.
 * Formula: (px * 25.4) / 96
 */
export function pixelsToMm(px: number): number {
  const rawMm = (px * MM_PER_INCH) / CSS_SCREEN_DPI;
  return Math.round(rawMm * 10000) / 10000;
}

/**
 * Converts inches to millimeters with 4 decimal places of precision.
 */
export function inchToMm(inch: number): number {
  return Math.round(inch * MM_PER_INCH * 10000) / 10000;
}

/**
 * Converts millimeters to inches with 4 decimal places of precision.
 */
export function mmToInch(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * 10000) / 10000;
}

export interface BarcodeQuantizationResult {
  dots: number;
  physicalMm: number;
}

/**
 * Calculates the nearest integer multiple of hardware dots k >= 1 for the X-dimension (narrow bar)
 * of a barcode at a specific printer DPI, and returns the dots along with the resulting physical width.
 */
export function quantizeBarcodeX(targetMm: number, dpi: number): BarcodeQuantizationResult {
  if (dpi <= 0) {
    throw new Error(`DPI must be a positive number, received: ${dpi}`);
  }
  // k must be an integer >= 1
  const calculatedDots = Math.round(targetMm * (dpi / MM_PER_INCH));
  const dots = Math.max(1, calculatedDots);
  const physicalMm = dotsToMm(dots, dpi);

  return {
    dots,
    physicalMm,
  };
}
