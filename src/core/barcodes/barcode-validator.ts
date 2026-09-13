import { BarcodeSymbology, SymbologyValidationResult } from './barcode.types';
import { validateCode128 } from './symbologies/code128';
import { validateEan13 } from './symbologies/ean13';
import { validateQrCode } from './symbologies/qrcode';
import { validateDataMatrix } from './symbologies/datamatrix';

/**
 * OpenLabels - Unified Barcode Validation Dispatcher
 * Validates incoming barcode payload against the specific rules of the symbology.
 */
export function validateBarcodeData(
  symbology: BarcodeSymbology,
  data: string,
  options?: { errorCorrection?: string }
): SymbologyValidationResult {
  switch (symbology) {
    case 'code128':
      return validateCode128(data);
    case 'ean13':
      return validateEan13(data);
    case 'qrcode':
      return validateQrCode(data, options?.errorCorrection || 'M');
    case 'datamatrix':
      return validateDataMatrix(data);
    default:
      return {
        valid: false,
        error: `Unsupported barcode symbology: ${symbology}`,
        errorCode: 'UNSUPPORTED_SYMBOLOGY',
      };
  }
}
