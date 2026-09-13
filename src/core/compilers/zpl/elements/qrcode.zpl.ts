import { PrintPlanBarcode } from '../../print-plan/print-plan.types';
import { LabelDpi } from '../../../schemas/label.schema';
import { mmToZplDots, toZplPoint } from '../zpl-units';
import { escapeZplFieldData } from '../zpl-escape';

/**
 * Compiles a QR Code into native ZPL II ^BQ command.
 * ZPL syntax: ^BQa,b,c,d,e
 * a = orientation (N)
 * b = model (2 = Enhanced Model 2 recommended)
 * c = magnification factor (1 to 10)
 * Data format: ^FD<error_correction><input_mode>,<data>^FS
 */
export function compileQrCodeZpl(el: PrintPlanBarcode, dpi: LabelDpi): string {
  const pt = toZplPoint(el.xMm, el.yMm, dpi);

  // Approximate module magnification factor (1 - 10) based on physical width
  const sideDots = mmToZplDots(Math.min(el.widthMm, el.heightMm), dpi);
  // An average QR version has ~29 modules across. Magnification = sideDots / 29
  const calculatedMag = Math.round(sideDots / 29);
  const magnification = Math.min(10, Math.max(1, calculatedMag || 3));

  const ecLevel = el.errorCorrection || 'M';
  const escapedData = escapeZplFieldData(el.data);

  return `^FO${pt.xDots},${pt.yDots}^BQN,2,${magnification}^FH^FD${ecLevel}A,${escapedData}^FS`;
}
