import PDFDocument from 'pdfkit';
import { LabelDocument } from '../../../core/schemas/label.schema';
import { PrintPlan } from '../../../core/compilers/print-plan/print-plan.types';
import { buildPrintPlan } from '../../../core/compilers/print-plan/build-print-plan';
import { validatePrintPlan } from '../../../core/compilers/print-plan/validate-print-plan';
import { CompileResult } from '../../../core/compilers/compile.types';
import { mmToPoints } from '../../../core/compilers/pdf/pdf-units';
import { renderTextPdf } from './elements/text.pdf';
import { renderRectanglePdf } from './elements/rectangle.pdf';
import { renderLinePdf } from './elements/line.pdf';
import { renderBarcodePdf } from './elements/barcode.pdf';

export interface PdfRenderOptions {
  title?: string;
  author?: string;
}

/**
 * Renders a validated PrintPlan into a vector PDF document with exact physical dimensions.
 * Produces a Uint8Array containing pure vector PDF bytes.
 */
export function renderPrintPlanToPdf(
  plan: PrintPlan,
  options: PdfRenderOptions = {}
): Promise<CompileResult<Uint8Array>> {
  return new Promise<CompileResult<Uint8Array>>((resolve) => {
    const validation = validatePrintPlan(plan);
    if (!validation.success) {
      resolve(validation as CompileResult<Uint8Array>);
      return;
    }

    const validPlan = validation.data;
    const widthPt = mmToPoints(validPlan.page.widthMm);
    const heightPt = mmToPoints(validPlan.page.heightMm);

    // Exact label page size, no default A4/Letter margins
    const doc = new PDFDocument({
      size: [widthPt, heightPt],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: options.title || 'OpenLabels Label',
        Author: options.author || 'OpenLabels',
        CreationDate: new Date(0), // Deterministic timestamp for testing
      },
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.on('end', () => {
      const fullBuffer = Buffer.concat(chunks);
      resolve({
        success: true,
        data: new Uint8Array(fullBuffer),
        warnings: validPlan.warnings,
      });
    });

    doc.on('error', (err: Error) => {
      resolve({
        success: false,
        errors: [
          {
            code: 'PDF_RENDER_FAILED',
            message: `PDF rendering error: ${err.message}`,
          },
        ],
        warnings: validPlan.warnings,
      });
    });

    // Render elements in sequential layer order
    for (const el of validPlan.elements) {
      switch (el.type) {
        case 'text':
          renderTextPdf(doc, el);
          break;
        case 'rectangle':
          renderRectanglePdf(doc, el);
          break;
        case 'line':
          renderLinePdf(doc, el);
          break;
        case 'barcode':
          renderBarcodePdf(doc, el);
          break;
        case 'image':
          // Raster images not yet implemented in Phase 4
          break;
      }
    }

    doc.end();
  });
}

/**
 * High-level API: Takes a LabelDocument and compiles it into exact vector PDF bytes.
 */
export async function renderLabelToPdf(
  document: LabelDocument,
  options: PdfRenderOptions = {}
): Promise<CompileResult<Uint8Array>> {
  const planResult = buildPrintPlan(document);
  if (!planResult.success) {
    return planResult as CompileResult<Uint8Array>;
  }

  return renderPrintPlanToPdf(planResult.data, options);
}
