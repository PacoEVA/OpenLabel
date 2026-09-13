import { LabelDocument, LabelDpi } from '../../schemas/label.schema';
import { CompileResult, CompileWarning } from '../compile.types';
import { PrintPlan } from '../print-plan/print-plan.types';
import { buildPrintPlan } from '../print-plan/build-print-plan';
import { validatePrintPlan } from '../print-plan/validate-print-plan';
import { mmToZplDots } from './zpl-units';
import { compileTextZpl } from './elements/text.zpl';
import { compileRectangleZpl } from './elements/rectangle.zpl';
import { compileLineZpl } from './elements/line.zpl';
import { compileCode128Zpl } from './elements/code128.zpl';
import { compileEan13Zpl } from './elements/ean13.zpl';
import { compileQrCodeZpl } from './elements/qrcode.zpl';
import { compileDataMatrixZpl } from './elements/datamatrix.zpl';

export interface ZplCompilerOptions {
  dpi?: LabelDpi;
  strict?: boolean;
}

/**
 * Compiles a validated PrintPlan into native, deterministic ZPL II.
 */
export function compilePrintPlanToZpl(
  plan: PrintPlan,
  options: ZplCompilerOptions = {}
): CompileResult<string> {
  // Defensively re-validate the PrintPlan
  const validation = validatePrintPlan(plan);
  if (!validation.success) {
    return validation as CompileResult<string>;
  }

  const validPlan = validation.data;
  const dpi = options.dpi || validPlan.page.dpi;
  const warnings: CompileWarning[] = [...validPlan.warnings];

  const widthDots = mmToZplDots(validPlan.page.widthMm, dpi);
  const heightDots = mmToZplDots(validPlan.page.heightMm, dpi);

  const lines: string[] = [
    '^XA',
    `^PW${widthDots}`,
    `^LL${heightDots}`,
    '^LH0,0',
    '^CI28', // Standard UTF-8 character encoding
  ];

  for (const el of validPlan.elements) {
    switch (el.type) {
      case 'text':
        lines.push(compileTextZpl(el, dpi));
        break;

      case 'rectangle':
        lines.push(compileRectangleZpl(el, dpi));
        break;

      case 'line':
        lines.push(compileLineZpl(el, dpi));
        break;

      case 'barcode': {
        switch (el.symbology) {
          case 'code128':
            lines.push(compileCode128Zpl(el, dpi));
            break;
          case 'ean13':
            lines.push(compileEan13Zpl(el, dpi));
            break;
          case 'qrcode':
            lines.push(compileQrCodeZpl(el, dpi));
            break;
          case 'datamatrix':
            lines.push(compileDataMatrixZpl(el, dpi));
            break;
          default:
            warnings.push({
              code: 'UNSUPPORTED_ELEMENT',
              message: `Unsupported barcode symbology '${el.symbology}' in ZPL compiler`,
              elementId: el.id,
            });
            break;
        }
        break;
      }

      case 'image':
        warnings.push({
          code: 'IMAGE_SOURCE_UNAVAILABLE',
          message: `Raster image elements are not yet supported for direct ZPL generation`,
          elementId: el.id,
        });
        break;
    }
  }

  lines.push('^XZ\n');
  const zpl = lines.join('\n');

  return {
    success: true,
    data: zpl,
    warnings,
  };
}

/**
 * High-level pure API: Compiles a LabelDocument into native ZPL II.
 */
export function compileLabelToZpl(
  document: LabelDocument,
  options: ZplCompilerOptions = {}
): CompileResult<string> {
  const planResult = buildPrintPlan(document, { targetDpi: options.dpi });
  if (!planResult.success) {
    return planResult as CompileResult<string>;
  }

  return compilePrintPlanToZpl(planResult.data, options);
}
