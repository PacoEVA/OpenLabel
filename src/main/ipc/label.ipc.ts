import { ipcMain } from 'electron';
import { LabelDocumentSchema, LabelDocument } from '../../core/schemas/label.schema';
import { SUPPORTED_DPIS } from '../../core/units/converter';

export interface ValidateDocumentResponse {
  success: boolean;
  data?: LabelDocument;
  errors?: string[];
}

export interface HardwareProfilesResponse {
  supportedDpis: number[];
}

/**
 * Registers secure and strongly typed IPC handlers for label operations.
 * Treats all incoming renderer payloads as untrusted (`unknown`).
 */
export function registerLabelIpcHandlers(): void {
  // Discrete channel for document validation
  ipcMain.handle('label:validate-document', async (_event, payload: unknown): Promise<ValidateDocumentResponse> => {
    try {
      const parseResult = LabelDocumentSchema.safeParse(payload);

      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(
          (err) => `${err.path.join('.') || 'root'}: ${err.message}`
        );
        return {
          success: false,
          errors,
        };
      }

      return {
        success: true,
        data: parseResult.data,
      };
    } catch (err) {
      // Capture anomalies without leaking internal stack traces or raw errors
      return {
        success: false,
        errors: ['An unexpected error occurred during document validation'],
      };
    }
  });

  // Discrete channel for querying hardware profiles
  ipcMain.handle('label:get-hardware-profiles', async (): Promise<HardwareProfilesResponse> => {
    return {
      supportedDpis: [...SUPPORTED_DPIS],
    };
  });

  // Discrete channel for PDF generation in Main Process
  ipcMain.handle('label:generate-pdf', async (_event, payload: unknown) => {
    try {
      const parseResult = LabelDocumentSchema.safeParse(payload);
      if (!parseResult.success) {
        return {
          success: false,
          errors: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }

      let docToRender = parseResult.data;
      if (docToRender.dataModel && docToRender.dataModel.fields.length > 0) {
        const { generateRecords } = await import('../../core/data/batch-generator');
        const { resolveDocument } = await import('../../core/data/document-resolver');
        const genRes = generateRecords({
          fields: docToRender.dataModel.fields,
          count: 1,
          context: { now: new Date() },
        });
        if (!genRes.success) {
          return {
            success: false,
            errors: genRes.errors.map((e) => `[${e.code}] ${e.message}`),
          };
        }
        const resolveRes = resolveDocument(docToRender, genRes.records[0]);
        if (!resolveRes.success) {
          return {
            success: false,
            errors: resolveRes.errors.map((e) => `[${e.code}] ${e.message}`),
          };
        }
        docToRender = resolveRes.document;
      }

      const { renderLabelToPdf } = await import('../export/pdf/pdf-renderer');
      const renderRes = await renderLabelToPdf(docToRender);

      if (!renderRes.success) {
        return {
          success: false,
          errors: renderRes.errors.map((e) => `[${e.code}] ${e.message}`),
          warnings: renderRes.warnings,
        };
      }

      const base64 = Buffer.from(renderRes.data).toString('base64');
      return {
        success: true,
        pdfBase64: base64,
        warnings: renderRes.warnings,
      };
    } catch (err: unknown) {
      return {
        success: false,
        errors: ['An error occurred while generating the PDF document.'],
      };
    }
  });
}
