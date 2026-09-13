import { PrintPlanLine } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint, toZplDimensions } from '../zpl-units';

/**
 * Compiles a PrintPlanLine into native ZPL II ^GB command.
 */
export function compileLineZpl(el: PrintPlanLine, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const dims = toZplDimensions(el.widthMm, el.heightMm, dpi);
  const strokeDots = Math.max(1, mmToZplDots(el.strokeWidthMm || 1, dpi));

  if (el.orientation === 'vertical') {
    return `^FO${pt.xDots},${pt.yDots}^GB${strokeDots},${dims.heightDots},${strokeDots},B,0^FS`;
  }

  // Horizontal or diagonal default
  return `^FO${pt.xDots},${pt.yDots}^GB${dims.widthDots},${strokeDots},${strokeDots},B,0^FS`;
}
