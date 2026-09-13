import { PrintPlanRectangle } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint, toZplDimensions } from '../zpl-units';

/**
 * Compiles a PrintPlanRectangle into native ZPL II ^GB command.
 */
export function compileRectangleZpl(el: PrintPlanRectangle, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const dims = toZplDimensions(el.widthMm, el.heightMm, dpi);

  const isFilled = el.fill && el.fill !== 'transparent' && el.fill !== 'none';
  const strokeThicknessDots = isFilled
    ? Math.min(dims.widthDots, dims.heightDots) // fully solid fill
    : Math.max(1, mmToZplDots(el.strokeWidthMm || 1, dpi));

  // Corner rounding index in ZPL is 0-8
  const rounding = el.cornerRadiusMm > 0 ? Math.min(8, Math.max(1, Math.round(el.cornerRadiusMm))) : 0;

  return `^FO${pt.xDots},${pt.yDots}^GB${dims.widthDots},${dims.heightDots},${strokeThicknessDots},B,${rounding}^FS`;
}
