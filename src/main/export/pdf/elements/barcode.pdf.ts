import PDFKit from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { PrintPlanBarcode } from '../../../../core/compilers/print-plan/print-plan.types';
import { mmToPoints } from '../../../../core/compilers/pdf/pdf-units';
import { renderBarcodeSvg } from '../../../../renderer/barcodes/bwip-adapter';

/**
 * Renders a barcode element vectorially into PDFDocument via SVGtoPDF.
 * Maintains native vector paths for crisp, hardware-agnostic printing fidelity.
 */
export function renderBarcodePdf(doc: typeof PDFKit, el: PrintPlanBarcode): void {
  const xPt = mmToPoints(el.xMm);
  const yPt = mmToPoints(el.yMm);
  const widthPt = mmToPoints(el.widthMm);
  const heightPt = mmToPoints(el.heightMm);

  const res = renderBarcodeSvg({
    symbology: el.symbology,
    data: el.data,
    displayValue: el.displayValue,
    errorCorrection: el.errorCorrection,
  });

  if (!res.success) {
    // If barcode data is corrupt, draw a red warning placeholder outline in PDF
    doc.save();
    doc.lineWidth(1);
    doc.strokeColor('#e11d48');
    doc.dash(4, { space: 4 });
    doc.rect(xPt, yPt, widthPt, heightPt).stroke();
    doc.undash();
    doc.fontSize(8);
    doc.fillColor('#e11d48');
    doc.text(`[Invalid ${el.symbology.toUpperCase()}]`, xPt + 2, yPt + 2, { width: widthPt - 4 });
    doc.restore();
    return;
  }

  doc.save();

  if (el.rotation !== 0) {
    doc.rotate(el.rotation, { origin: [xPt, yPt] });
  }

  // Convert SVG vector paths directly into PDF vector drawing calls
  SVGtoPDF(doc, res.svg, xPt, yPt, {
    width: widthPt,
    height: heightPt,
    preserveAspectRatio: el.symbology === 'qrcode' ? 'xMidYMid meet' : 'none',
  });

  doc.restore();
}
