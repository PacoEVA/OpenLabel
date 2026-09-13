import PDFKit from 'pdfkit';
import { PrintPlanText } from '../../../../core/compilers/print-plan/print-plan.types';
import { mmToPoints } from '../../../../core/compilers/pdf/pdf-units';

function resolveStandardPdfFont(fontFamily: string, bold: boolean, italic: boolean): string {
  const isMono = fontFamily.toLowerCase().includes('mono') || fontFamily.toLowerCase().includes('courier');
  if (isMono) {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }

  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

/**
 * Renders a PrintPlanText element vectorially into PDFDocument.
 */
export function renderTextPdf(doc: typeof PDFKit, el: PrintPlanText): void {
  const xPt = mmToPoints(el.xMm);
  const yPt = mmToPoints(el.yMm);
  const widthPt = mmToPoints(el.widthMm);

  doc.save();

  if (el.rotation !== 0) {
    doc.rotate(el.rotation, { origin: [xPt, yPt] });
  }

  const fontName = resolveStandardPdfFont(el.fontFamily, el.bold, el.italic);
  doc.font(fontName);
  doc.fontSize(el.fontSizePt);
  doc.fillColor('#000000');

  doc.text(el.content, xPt, yPt, {
    width: widthPt,
    align: el.align || 'left',
    lineBreak: false,
  });

  doc.restore();
}
