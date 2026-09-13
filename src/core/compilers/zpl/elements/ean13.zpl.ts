import { PrintPlanBarcode } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint } from '../zpl-units';
import { toZplOrientation } from '../zpl-orientation';
import { escapeZplFieldData } from '../zpl-escape';

/**
 * Compiles an EAN-13 barcode into native ZPL II ^BE command using Phase 3 normalized data.
 */
export function compileEan13Zpl(el: PrintPlanBarcode, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const orientation = toZplOrientation(el.rotation);
  const heightDots = Math.max(10, mmToZplDots(el.heightMm, dpi));
  const moduleWidthDots = Math.max(1, el.narrowBarRatio || 2);
  const printLine = el.displayValue ? 'Y' : 'N';
  const dataToPrint = el.normalizedData || el.data;
  const escapedData = escapeZplFieldData(dataToPrint);

  return `^FO${pt.xDots},${pt.yDots}^BY${moduleWidthDots},3,${heightDots}^BE${orientation},${heightDots},${printLine},N^FH^FD${escapedData}^FS`;
}
