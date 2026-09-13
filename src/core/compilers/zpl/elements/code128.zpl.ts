import { PrintPlanBarcode } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint } from '../zpl-units';
import { toZplOrientation } from '../zpl-orientation';
import { escapeZplFieldData } from '../zpl-escape';

/**
 * Compiles a Code 128 barcode into native ZPL II ^BC command.
 */
export function compileCode128Zpl(el: PrintPlanBarcode, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const orientation = toZplOrientation(el.rotation);
  const heightDots = Math.max(10, mmToZplDots(el.heightMm, dpi));
  const moduleWidthDots = Math.max(1, el.narrowBarRatio || 2);
  const printLine = el.displayValue ? 'Y' : 'N';
  const escapedData = escapeZplFieldData(el.normalizedData || el.data);

  return `^FO${pt.xDots},${pt.yDots}^BY${moduleWidthDots},3,${heightDots}^BC${orientation},${heightDots},${printLine},N,N^FH^FD${escapedData}^FS`;
}
