import { SymbologyValidationResult } from '../barcode.types';

/**
 * OpenLabels - Pure Data Matrix Validation Engine
 * Validates payload and size constraints for ECC 200 standards.
 */

export const DATAMATRIX_MAX_CHARS = 1556;

export function validateDataMatrix(data: string): SymbologyValidationResult {
  if (!data || typeof data !== 'string' || data.length === 0) {
    return {
      valid: false,
      error: 'Data Matrix data cannot be empty',
      errorCode: 'INVALID_DATA',
    };
  }

  if (data.length > DATAMATRIX_MAX_CHARS) {
    return {
      valid: false,
      error: `Data Matrix data exceeds maximum capacity (${DATAMATRIX_MAX_CHARS} characters), received: ${data.length}`,
      errorCode: 'INVALID_LENGTH',
    };
  }

  return {
    valid: true,
    normalizedData: data,
  };
}
