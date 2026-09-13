import { quantizeBarcodeX, SupportedDpi } from '../units/converter';

/**
 * OpenLabels - Barcode X-Dimension Physical Calculator
 * Reuses core metric quantization logic from Phase 1.
 */

export interface XDimensionResult {
  requestedMm: number;
  dots: number;
  physicalMm: number;
  dpi: SupportedDpi;
}

/**
 * Calculates physical X Dimension in dots and resulting millimeters for a given printer DPI.
 */
export function calculateXDimension(
  requestedMm: number,
  dpi: SupportedDpi
): XDimensionResult {
  const quantization = quantizeBarcodeX(requestedMm, dpi);

  return {
    requestedMm,
    dots: quantization.dots,
    physicalMm: quantization.physicalMm,
    dpi,
  };
}
