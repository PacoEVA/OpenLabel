import { LabelDocument, LabelElement, TextElement, BarcodeElement, QrCodeElement } from '../schemas/label.schema';
import { ResolvedRecord, resolveTemplate } from './template-resolver';
import { validateBarcodeData } from '../barcodes/barcode-validator';

export interface DocumentResolutionError {
  elementId: string;
  elementType: 'text' | 'barcode' | 'qrcode';
  code: 'TEMPLATE_ERROR' | 'MISSING_FIELD' | 'INVALID_BARCODE';
  message: string;
}

export type ResolveDocumentResult =
  | {
      success: true;
      document: LabelDocument;
    }
  | {
      success: false;
      errors: DocumentResolutionError[];
    };

/**
 * Resolves all placeholders in a LabelDocument against a ResolvedRecord,
 * generating a new, fully resolved LabelDocument.
 *
 * Requirements:
 * - Strictly non-destructive: does NOT mutate the original document or its elements.
 * - Resolves TextElement.content, BarcodeElement.data, QrCodeElement.data.
 * - Revalidates all barcodes and QR codes against Phase 3 validation rules after placeholder substitution.
 * - Fails with typed errors if any placeholder cannot be resolved or if the resolved data is invalid for the symbology.
 */
export function resolveDocument(
  document: LabelDocument,
  record: ResolvedRecord
): ResolveDocumentResult {
  const errors: DocumentResolutionError[] = [];
  const resolvedElements: LabelElement[] = [];

  for (const element of document.elements) {
    if (element.type === 'text') {
      const templateRes = resolveTemplate(element.content, record);
      if (!templateRes.success) {
        errors.push({
          elementId: element.id,
          elementType: 'text',
          code: templateRes.error.code === 'MISSING_FIELD_VALUE' ? 'MISSING_FIELD' : 'TEMPLATE_ERROR',
          message: templateRes.error.message,
        });
        continue;
      }

      const updatedText: TextElement = {
        ...element,
        content: templateRes.value,
      };
      resolvedElements.push(updatedText);
    } else if (element.type === 'barcode') {
      const templateRes = resolveTemplate(element.data, record);
      if (!templateRes.success) {
        errors.push({
          elementId: element.id,
          elementType: 'barcode',
          code: templateRes.error.code === 'MISSING_FIELD_VALUE' ? 'MISSING_FIELD' : 'TEMPLATE_ERROR',
          message: templateRes.error.message,
        });
        continue;
      }

      // Revalidate barcode data against symbology constraints
      const validation = validateBarcodeData(element.symbology, templateRes.value);
      if (!validation.valid) {
        errors.push({
          elementId: element.id,
          elementType: 'barcode',
          code: 'INVALID_BARCODE',
          message: validation.error || `Invalid barcode data for ${element.symbology}`,
        });
        continue;
      }

      const updatedBarcode: BarcodeElement = {
        ...element,
        data: templateRes.value,
      };
      resolvedElements.push(updatedBarcode);
    } else if (element.type === 'qrcode') {
      const templateRes = resolveTemplate(element.data, record);
      if (!templateRes.success) {
        errors.push({
          elementId: element.id,
          elementType: 'qrcode',
          code: templateRes.error.code === 'MISSING_FIELD_VALUE' ? 'MISSING_FIELD' : 'TEMPLATE_ERROR',
          message: templateRes.error.message,
        });
        continue;
      }

      const validation = validateBarcodeData('qrcode', templateRes.value, {
        errorCorrection: element.errorCorrection,
      });
      if (!validation.valid) {
        errors.push({
          elementId: element.id,
          elementType: 'qrcode',
          code: 'INVALID_BARCODE',
          message: validation.error || 'Invalid QRCode data',
        });
        continue;
      }

      const updatedQr: QrCodeElement = {
        ...element,
        data: templateRes.value,
      };
      resolvedElements.push(updatedQr);
    } else {
      // Unaffected elements (rectangle, line, image) are preserved
      resolvedElements.push({ ...element });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    document: {
      ...document,
      elements: resolvedElements,
    },
  };
}
