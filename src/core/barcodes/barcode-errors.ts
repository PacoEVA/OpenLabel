/**
 * OpenLabels - Core Barcode Domain Error Types
 * Strongly typed error representation decoupled from UI and external libraries.
 */

export type BarcodeErrorCode =
  | 'INVALID_DATA'
  | 'INVALID_LENGTH'
  | 'INVALID_CHARACTERS'
  | 'INVALID_CHECK_DIGIT'
  | 'UNSUPPORTED_SYMBOLOGY'
  | 'INVALID_X_DIMENSION'
  | 'INSUFFICIENT_SIZE'
  | 'RENDER_FAILED';

export class BarcodeDomainError extends Error {
  public readonly code: BarcodeErrorCode;
  public readonly symbology?: string;

  constructor(code: BarcodeErrorCode, message: string, symbology?: string) {
    super(message);
    this.name = 'BarcodeDomainError';
    this.code = code;
    this.symbology = symbology;
    Object.setPrototypeOf(this, BarcodeDomainError.prototype);
  }
}
