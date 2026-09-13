import { PrintPlanText } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint, toZplDimensions } from '../zpl-units';
import { toZplOrientation } from '../zpl-orientation';
import { escapeZplFieldData } from '../zpl-escape';

/**
 * Compiles a PrintPlanText element into native ZPL II commands.
 * Uses scalable font 0 (^A0) and Field Hex (^FH) for safe UTF-8 rendering.
 */
export function compileTextZpl(el: PrintPlanText, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);
  const dims = toZplDimensions(el.widthMm, el.heightMm, dpi);
  const orientation = toZplOrientation(el.rotation);

  // Convert font size points to dots (1 pt = 25.4 / 72 mm)
  const fontHeightMm = (el.fontSizePt * 25.4) / 72;
  const fontHeightDots = Math.max(10, mmToZplDots(fontHeightMm, dpi));
  // Standard aspect width for font 0 is ~0.8 * height
  const fontWidthDots = Math.max(8, Math.round(fontHeightDots * 0.8));

  const escapedContent = escapeZplFieldData(el.content);

  // If text alignment is specified and not left, use Field Block (^FB)
  let fieldBlock = '';
  if (el.align === 'center') {
    fieldBlock = `^FB${dims.widthDots},1,0,C`;
  } else if (el.align === 'right') {
    fieldBlock = `^FB${dims.widthDots},1,0,R`;
  }

  return `^FO${pt.xDots},${pt.yDots}^A0${orientation},${fontHeightDots},${fontWidthDots}${fieldBlock}^FH^FD${escapedContent}^FS`;
}
