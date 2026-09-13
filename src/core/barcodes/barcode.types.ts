/**
 * OpenLabels - Core Barcode Domain Types
 * Pure TypeScript models for 1D and 2D barcode representations.
 */

import { BarcodeSymbology } from '../schemas/label.schema';
export type { BarcodeSymbology };

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QuietZoneConfig {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
}

export interface NormalizedBarcode {
  symbology: BarcodeSymbology;
  data: string;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90 | 180 | 270;
  displayValue: boolean;
  xDimensionMm?: number;
  xDimensionDots?: number;
  errorCorrection?: QrErrorCorrection;
  quietZone?: QuietZoneConfig;
}

export interface SymbologyValidationResult {
  valid: boolean;
  normalizedData?: string;
  error?: string;
  errorCode?: import('./barcode-errors').BarcodeErrorCode;
}
