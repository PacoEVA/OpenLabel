import { SymbologyValidationResult } from '../barcode.types';

/**
 * OpenLabels - Pure Code 128 Validation Engine
 * Supports standard ASCII characters (0 - 127) and enforces length limits.
 */

export const CODE128_MAX_LENGTH = 100;

export function validateCode128(data: string): SymbologyValidationResult {
  if (!data || typeof data !== 'string' || data.length === 0) {
    return {
      valid: false,
      error: 'Code 128 data cannot be empty',
      errorCode: 'INVALID_DATA',
    };
  }

  if (data.length > CODE128_MAX_LENGTH) {
    return {
      valid: false,
      error: `Code 128 data exceeds maximum supported length (${CODE128_MAX_LENGTH} characters), received: ${data.length}`,
      errorCode: 'INVALID_LENGTH',
    };
  }

  // Verify all characters are in standard 7-bit ASCII range (0-127)
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    if (charCode > 127) {
      return {
        valid: false,
        error: `Code 128 does not support non-ASCII character '${data[i]}' (code ${charCode})`,
        errorCode: 'INVALID_CHARACTERS',
      };
    }
  }

  return {
    valid: true,
    normalizedData: data,
  };
}
