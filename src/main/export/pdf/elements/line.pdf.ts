import PDFKit from 'pdfkit';
import { PrintPlanLine } from '../../../../core/compilers/print-plan/print-plan.types';
import { mmToPoints } from '../../../../core/compilers/pdf/pdf-units';

/**
 * Renders a PrintPlanLine element vectorially into PDFDocument.
 */
export function renderLinePdf(doc: typeof PDFKit, el: PrintPlanLine): void {
  const xPt = mmToPoints(el.xMm);
  const yPt = mmToPoints(el.yMm);
  const wPt = mmToPoints(el.widthMm);
  const hPt = mmToPoints(el.heightMm);
  const strokeWidthPt = Math.max(0.5, mmToPoints(el.strokeWidthMm));

  doc.save();

  if (el.rotation !== 0) {
    doc.rotate(el.rotation, { origin: [xPt, yPt] });
  }

  doc.lineWidth(strokeWidthPt);
  doc.strokeColor(el.stroke || '#000000');

  if (el.orientation === 'vertical') {
    doc.moveTo(xPt, yPt).lineTo(xPt, yPt + hPt).stroke();
  } else {
    doc.moveTo(xPt, yPt).lineTo(xPt + wPt, yPt).stroke();
  }

  doc.restore();
}
