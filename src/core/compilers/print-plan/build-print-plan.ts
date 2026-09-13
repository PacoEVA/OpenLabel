import { LabelDocument, LabelDocumentSchema, LabelDpi } from '../../schemas/label.schema';
import { CompileResult, CompileError, CompileWarning } from '../compile.types';
import {
  PrintPlan,
  PrintPlanElement,
  PrintPlanText,
  PrintPlanRectangle,
  PrintPlanLine,
  PrintPlanBarcode,
  PrintPlanImage,
} from './print-plan.types';
import { inchToMm, dotsToMm } from '../../units/converter';
import { normalizeBarcodeElement } from '../../barcodes/barcode-normalizer';
import { BarcodeDomainError } from '../../barcodes/barcode-errors';

export interface BuildPrintPlanOptions {
  targetDpi?: LabelDpi;
}

/**
 * Builds an intermediate PrintPlan from a validated LabelDocument.
 * Normalizes all dimensions to physical millimeters and prepares elements for backends.
 */
export function buildPrintPlan(
  document: LabelDocument,
  options: BuildPrintPlanOptions = {}
): CompileResult<PrintPlan> {
  // 1. Defensively validate document against schema
  const parsed = LabelDocumentSchema.safeParse(document);
  if (!parsed.success) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_DOCUMENT',
          message: `Document schema validation failed: ${parsed.error.message}`,
        },
      ],
      warnings: [],
    };
  }

  const validDoc = parsed.data;
  const isInch = validDoc.dimensions.unit === 'inch';
  const toMm = (val: number): number => (isInch ? inchToMm(val) : val);

  const dpi: LabelDpi = options.targetDpi || validDoc.dimensions.dpi;
  const widthMm = toMm(validDoc.dimensions.width);
  const heightMm = toMm(validDoc.dimensions.height);

  const warnings: CompileWarning[] = [];
  const errors: CompileError[] = [];
  const elements: PrintPlanElement[] = [];

  for (const el of validDoc.elements) {
    const xMm = toMm(el.x);
    const yMm = toMm(el.y);
    const wMm = toMm(el.width);
    const hMm = toMm(el.height);

    switch (el.type) {
      case 'text': {
        const textElement: PrintPlanText = {
          id: el.id,
          type: 'text',
          xMm,
          yMm,
          widthMm: wMm,
          heightMm: hMm,
          rotation: el.rotation,
          locked: el.locked,
          content: el.content,
          fontSizePt: el.fontSize,
          fontFamily: el.fontFamily,
          bold: el.bold,
          italic: el.italic,
          align: el.align,
        };
        elements.push(textElement);
        break;
      }

      case 'rectangle': {
        const rectElement: PrintPlanRectangle = {
          id: el.id,
          type: 'rectangle',
          xMm,
          yMm,
          widthMm: wMm,
          heightMm: hMm,
          rotation: el.rotation,
          locked: el.locked,
          strokeWidthMm: toMm(el.strokeWidth),
          fill: el.fill,
          stroke: el.stroke,
          cornerRadiusMm: toMm(el.cornerRadius),
        };
        elements.push(rectElement);
        break;
      }

      case 'line': {
        const lineElement: PrintPlanLine = {
          id: el.id,
          type: 'line',
          xMm,
          yMm,
          widthMm: wMm,
          heightMm: hMm,
          rotation: el.rotation,
          locked: el.locked,
          strokeWidthMm: toMm(el.strokeWidth),
          stroke: el.stroke,
          orientation: el.orientation,
        };
        elements.push(lineElement);
        break;
      }

      case 'barcode':
      case 'qrcode': {
        try {
          const normalized = normalizeBarcodeElement(el, { dpi });
          const dots = normalized.xDimensionDots || (el.type === 'barcode' ? el.narrowBarRatio : 2);
          const xDimMm = normalized.xDimensionMm || dotsToMm(dots, dpi);

          const barcodeElement: PrintPlanBarcode = {
            id: el.id,
            type: 'barcode',
            xMm,
            yMm,
            widthMm: wMm,
            heightMm: hMm,
            rotation: el.rotation,
            locked: el.locked,
            symbology: normalized.symbology,
            data: el.data,
            normalizedData: normalized.data,
            displayValue: normalized.displayValue,
            narrowBarRatio: dots,
            xDimensionMm: xDimMm,
            quietZone: normalized.quietZone,
            errorCorrection: normalized.errorCorrection,
          };
          elements.push(barcodeElement);
        } catch (err: unknown) {
          const message = err instanceof BarcodeDomainError ? err.message : String(err);
          errors.push({
            code: 'BARCODE_INVALID',
            message: `Barcode '${el.id}' is invalid: ${message}`,
            elementId: el.id,
          });
        }
        break;
      }

      case 'image': {
        const imageElement: PrintPlanImage = {
          id: el.id,
          type: 'image',
          xMm,
          yMm,
          widthMm: wMm,
          heightMm: hMm,
          rotation: el.rotation,
          locked: el.locked,
          source: el.source,
          format: el.format,
        };
        elements.push(imageElement);
        break;
      }

      default: {
        errors.push({
          code: 'UNSUPPORTED_ELEMENT',
          // @ts-expect-error type fallback for unknown element
          message: `Element type '${el.type}' is not supported for printing`,
          // @ts-expect-error fallback
          elementId: el.id,
        });
        break;
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
    };
  }

  return {
    success: true,
    data: {
      page: {
        widthMm,
        heightMm,
        dpi,
      },
      elements,
      warnings,
    },
    warnings,
  };
}
