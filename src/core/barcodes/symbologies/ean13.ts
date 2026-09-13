import { SymbologyValidationResult } from '../barcode.types';
import { BarcodeDomainError } from '../barcode-errors';

/**
 * OpenLabels - Pure EAN-13 Checksum and Validation Domain Engine
 * Decoupled from React, Konva, DOM, Electron, and bwip-js.
 */

/**
 * Calculates the standard GS1 Modulo 10 check digit for a 12-digit EAN-13 payload.
 *
 * Weighting:
 * - Digits at odd positions (1st, 3rd, 5th, 7th, 9th, 11th) have weight 1.
 * - Digits at even positions (2nd, 4th, 6th, 8th, 10th, 12th) have weight 3.
 * Formula: checkDigit = (10 - (sum % 10)) % 10
 */
export function calculateEan13CheckDigit(data12: string): number {
  if (typeof data12 !== 'string') {
    throw new BarcodeDomainError('INVALID_DATA', 'EAN-13 payload must be a string', 'ean13');
  }

  if (data12.length !== 12) {
    throw new BarcodeDomainError(
      'INVALID_LENGTH',
      `EAN-13 check digit calculation requires exactly 12 digits, received length: ${data12.length}`,
      'ean13'
    );
  }

  if (!/^\d{12}$/.test(data12)) {
    throw new BarcodeDomainError(
      'INVALID_CHARACTERS',
      'EAN-13 payload must contain digits only',
      'ean13'
    );
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(data12[i], 10);
    // 0-indexed: index 0 is position 1 (odd -> weight 1), index 1 is position 2 (even -> weight 3)
    const weight = i % 2 === 0 ? 1 : 3;
    sum += digit * weight;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates an EAN-13 data string.
 *
 * Rules:
 * - 12 digits: Computes check digit automatically and returns normalized 13-digit code.
 * - 13 digits: Verifies the 13th digit against calculated checksum.
 * - Rejects non-digits, spaces, empty string, lengths !== 12 and !== 13, and incorrect checksums.
 */
export function validateEan13(data: string): SymbologyValidationResult {
  if (!data || typeof data !== 'string' || data.trim() === '') {
    return {
      valid: false,
      error: 'EAN-13 data cannot be empty',
      errorCode: 'INVALID_DATA',
    };
  }

  if (data.includes(' ')) {
    return {
      valid: false,
      error: 'EAN-13 data cannot contain whitespace or spaces',
      errorCode: 'INVALID_CHARACTERS',
    };
  }

  if (!/^\d+$/.test(data)) {
    return {
      valid: false,
      error: 'EAN-13 data must contain numeric digits only (0-9)',
      errorCode: 'INVALID_CHARACTERS',
    };
  }

  if (data.length !== 12 && data.length !== 13) {
    return {
      valid: false,
      error: `EAN-13 data must have exactly 12 or 13 digits, received length: ${data.length}`,
      errorCode: 'INVALID_LENGTH',
    };
  }

  const data12 = data.slice(0, 12);
  const calculatedCheckDigit = calculateEan13CheckDigit(data12);

  if (data.length === 12) {
    // Automatically appends check digit to 12-digit payload
    return {
      valid: true,
      normalizedData: `${data12}${calculatedCheckDigit}`,
    };
  }

  // 13 digits case
  const providedCheckDigit = parseInt(data[12], 10);
  if (providedCheckDigit !== calculatedCheckDigit) {
    return {
      valid: false,
      error: `Invalid EAN-13 check digit. Expected ${calculatedCheckDigit}, received ${providedCheckDigit}`,
      errorCode: 'INVALID_CHECK_DIGIT',
    };
  }

  return {
    valid: true,
    normalizedData: data,
  };
}

/**
 * Normalizes an EAN-13 payload to its full 13-digit representation and returns component details.
 * Throws BarcodeDomainError if data is invalid.
 */
export function normalizeEan13(data: string): {
  fullCode: string;
  data12: string;
  checkDigit: number;
} {
  const validation = validateEan13(data);
  if (!validation.valid || !validation.normalizedData) {
    throw new BarcodeDomainError(
      validation.errorCode || 'INVALID_DATA',
      validation.error || 'Invalid EAN-13 data',
      'ean13'
    );
  }

  const fullCode = validation.normalizedData;
  const data12 = fullCode.slice(0, 12);
  const checkDigit = parseInt(fullCode[12], 10);

  return {
    fullCode,
    data12,
    checkDigit,
  };
}
