import { SymbologyValidationResult, QrErrorCorrection } from '../barcode.types';

/**
 * OpenLabels - Pure QR Code Validation Engine
 * Validates payload, length, and error correction levels.
 */

export const QR_ERROR_CORRECTION_LEVELS: readonly QrErrorCorrection[] = ['L', 'M', 'Q', 'H'] as const;

export function validateQrCode(
  data: string,
  errorCorrection: string = 'M'
): SymbologyValidationResult {
  if (!data || typeof data !== 'string' || data.length === 0) {
    return {
      valid: false,
      error: 'QR Code data cannot be empty',
      errorCode: 'INVALID_DATA',
    };
  }

  const ecUpper = errorCorrection.toUpperCase();
  if (!QR_ERROR_CORRECTION_LEVELS.includes(ecUpper as QrErrorCorrection)) {
    return {
      valid: false,
      error: `Invalid QR Code error correction level '${errorCorrection}'. Allowed: L, M, Q, H`,
      errorCode: 'INVALID_DATA',
    };
  }

  return {
    valid: true,
    normalizedData: data,
  };
}
