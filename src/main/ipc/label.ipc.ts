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
}
