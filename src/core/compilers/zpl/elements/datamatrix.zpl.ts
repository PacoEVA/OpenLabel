import { PrintPlanBarcode } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint } from '../zpl-units';
import { toZplOrientation } from '../zpl-orientation';
import { escapeZplFieldData } from '../zpl-escape';

/**
 * Compiles a Data Matrix code into native ZPL II ^BX command (ECC 200 standard).
 */
export function compileDataMatrixZpl(el: PrintPlanBarcode, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const orientation = toZplOrientation(el.rotation);
  const moduleHeightDots = Math.max(3, Math.round(mmToZplDots(el.xDimensionMm || 0.33, dpi)));
  const escapedData = escapeZplFieldData(el.data);

  return `^FO${pt.xDots},${pt.yDots}^BX${orientation},${moduleHeightDots},200^FH^FD${escapedData}^FS`;
}
