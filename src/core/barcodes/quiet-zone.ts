import { BarcodeSymbology, QuietZoneConfig } from './barcode.types';

/**
 * OpenLabels - Barcode Quiet Zone Rules
 * Strictly models ISO and GS1 physical quiet zone margins.
 */

/**
 * Calculates standard minimum physical quiet zone margins based on symbology standards.
 */
export function calculateQuietZone(
  symbology: BarcodeSymbology,
  xDimensionMm: number
): QuietZoneConfig {
  const x = Math.max(0.01, xDimensionMm);

  switch (symbology) {
    case 'ean13':
      // GS1 standard: 11X left margin, 7X right margin
      return {
        leftMm: Math.round(11 * x * 10000) / 10000,
        rightMm: Math.round(7 * x * 10000) / 10000,
        topMm: 0,
        bottomMm: 0,
      };

    case 'code128':
      // ISO/IEC 15417: at least 10X on both left and right
      return {
        leftMm: Math.round(10 * x * 10000) / 10000,
        rightMm: Math.round(10 * x * 10000) / 10000,
        topMm: 0,
        bottomMm: 0,
      };

    case 'qrcode':
      // ISO/IEC 18004: 4 modules on all four sides
      return {
        leftMm: Math.round(4 * x * 10000) / 10000,
        rightMm: Math.round(4 * x * 10000) / 10000,
        topMm: Math.round(4 * x * 10000) / 10000,
        bottomMm: Math.round(4 * x * 10000) / 10000,
      };

    case 'datamatrix':
      // ISO/IEC 16022: 1 module on all four sides
      return {
        leftMm: Math.round(1 * x * 10000) / 10000,
        rightMm: Math.round(1 * x * 10000) / 10000,
        topMm: Math.round(1 * x * 10000) / 10000,
        bottomMm: Math.round(1 * x * 10000) / 10000,
      };
  }
}
