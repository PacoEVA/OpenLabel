import PDFKit from 'pdfkit';
import { PrintPlanRectangle } from '../../../../core/compilers/print-plan/print-plan.types';
import { mmToPoints } from '../../../../core/compilers/pdf/pdf-units';

/**
 * Renders a PrintPlanRectangle element vectorially into PDFDocument.
 */
export function renderRectanglePdf(doc: typeof PDFKit, el: PrintPlanRectangle): void {
  const xPt = mmToPoints(el.xMm);
  const yPt = mmToPoints(el.yMm);
  const wPt = mmToPoints(el.widthMm);
  const hPt = mmToPoints(el.heightMm);
  const strokeWidthPt = Math.max(0.5, mmToPoints(el.strokeWidthMm));
  const cornerRadiusPt = mmToPoints(el.cornerRadiusMm);

  doc.save();

  if (el.rotation !== 0) {
    doc.rotate(el.rotation, { origin: [xPt, yPt] });
  }

  doc.lineWidth(strokeWidthPt);
  doc.strokeColor(el.stroke || '#000000');

  if (cornerRadiusPt > 0) {
    doc.roundedRect(xPt, yPt, wPt, hPt, cornerRadiusPt);
  } else {
    doc.rect(xPt, yPt, wPt, hPt);
  }

  const isFilled = el.fill && el.fill !== 'transparent' && el.fill !== 'none';
  if (isFilled) {
    doc.fillColor(el.fill!);
    doc.fillAndStroke();
  } else {
    doc.stroke();
  }

  doc.restore();
}
