import { ipcMain } from 'electron';
import { z } from 'zod';
import {
  openDocumentDialog,
  saveDocument,
  saveDocumentAsDialog,
  readDocumentFile,
  OpenDocumentResult,
  SaveDocumentResult,
} from '../documents/document.service';

const SavePayloadSchema = z.object({
  filePath: z.string().min(1),
  document: z.unknown().refine((v) => v !== undefined && v !== null, {
    message: 'document is required',
  }),
});

const SaveAsPayloadSchema = z.object({
  document: z.unknown().refine((v) => v !== undefined && v !== null, {
    message: 'document is required',
  }),
  defaultTitle: z.string().optional(),
});

const ReadFilePayloadSchema = z.object({
  filePath: z.string().min(1),
});

/**
 * Registers strictly typed IPC handlers for document filesystem operations.
 * Main process acts as the security boundary, validating all incoming payloads.
 */
export function registerDocumentIpcHandlers(): void {
  // Open document via native file picker dialog
  ipcMain.handle('document:open', async (): Promise<OpenDocumentResult> => {
    try {
      return await openDocumentDialog();
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_READ_FAILED',
            message: err instanceof Error ? err.message : 'Failed to open document dialog.',
          },
        ],
      };
    }
  });

  // Save document to an existing file path
  ipcMain.handle('document:save', async (_event, payload: unknown): Promise<SaveDocumentResult> => {
    const parseResult = SavePayloadSchema.safeParse(payload);
    if (!parseResult.success) {
      return {
        success: false,
        errors: [
          {
            code: 'DOCUMENT_VALIDATION_FAILED',
            message: 'Invalid save payload: filePath and document are required.',
          },
        ],
      };
    }

    try {
      return await saveDocument(parseResult.data.filePath, parseResult.data.document);
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_WRITE_FAILED',
            message: err instanceof Error ? err.message : 'Failed to save document.',
          },
        ],
      };
    }
  });

  // Save document as a new file via native file save dialog
  ipcMain.handle('document:save-as', async (_event, payload: unknown): Promise<SaveDocumentResult> => {
    const parseResult = SaveAsPayloadSchema.safeParse(payload);
    if (!parseResult.success) {
      return {
        success: false,
        errors: [
          {
            code: 'DOCUMENT_VALIDATION_FAILED',
            message: 'Invalid save-as payload: document is required.',
          },
        ],
      };
    }

    try {
      return await saveDocumentAsDialog(
        parseResult.data.document,
        parseResult.data.defaultTitle
      );
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_WRITE_FAILED',
            message: err instanceof Error ? err.message : 'Failed to save document as.',
          },
        ],
      };
    }
  });

  // Read a document file directly (for recent files, templates, recovery)
  ipcMain.handle('document:read-file', async (_event, payload: unknown): Promise<OpenDocumentResult> => {
    const parseResult = ReadFilePayloadSchema.safeParse(payload);
    if (!parseResult.success) {
      return {
        success: false,
        errors: [
          {
            code: 'DOCUMENT_VALIDATION_FAILED',
            message: 'Invalid read payload: filePath is required.',
          },
        ],
      };
    }

    try {
      return await readDocumentFile(parseResult.data.filePath);
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_READ_FAILED',
            message: err instanceof Error ? err.message : 'Failed to read document file.',
          },
        ],
      };
    }
  });

  // Query recent files list
  ipcMain.handle('document:get-recent-files', async () => {
    try {
      const { recentFilesService } = await import('../documents/recent-files.service');
      return await recentFilesService.getRecentFiles();
    } catch {
      return [];
    }
  });

  // Clear recent files list
  ipcMain.handle('document:clear-recent-files', async () => {
    try {
      const { recentFilesService } = await import('../documents/recent-files.service');
      await recentFilesService.clearRecentFiles();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Save autosave/recovery snapshot
  ipcMain.handle('document:save-recovery-snapshot', async (_event, payload: unknown) => {
    try {
      const { autosaveService } = await import('../documents/autosave.service');
      return await autosaveService.saveSnapshot(payload);
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Failed to save recovery snapshot.'],
      };
    }
  });

  // Query recovery items
  ipcMain.handle('document:get-recovery-items', async () => {
    try {
      const { autosaveService } = await import('../documents/autosave.service');
      return await autosaveService.getRecoveryItems();
    } catch {
      return [];
    }
  });

  // Remove recovery item
  ipcMain.handle('document:remove-recovery-item', async (_event, payload: unknown) => {
    const parseResult = z.object({ documentId: z.string().min(1) }).safeParse(payload);
    if (!parseResult.success) {
      return { success: false };
    }

    try {
      const { autosaveService } = await import('../documents/autosave.service');
      const removed = await autosaveService.removeSnapshot(parseResult.data.documentId);
      return { success: removed };
    } catch {
      return { success: false };
    }
  });

  // List templates
  ipcMain.handle('document:list-templates', async () => {
    try {
      const { templatesService } = await import('../documents/templates.service');
      return await templatesService.listTemplates();
    } catch {
      return { builtIn: [], user: [] };
    }
  });

  // Get template document
  ipcMain.handle('document:get-template', async (_event, payload: unknown) => {
    const parseResult = z
      .object({ templateId: z.string().min(1), isBuiltIn: z.boolean() })
      .safeParse(payload);
    if (!parseResult.success) {
      return null;
    }

    try {
      const { templatesService } = await import('../documents/templates.service');
      return await templatesService.getTemplateDocument(
        parseResult.data.templateId,
        parseResult.data.isBuiltIn
      );
    } catch {
      return null;
    }
  });

  // Save as user template
  ipcMain.handle('document:save-user-template', async (_event, payload: unknown) => {
    const parseResult = z
      .object({ templateName: z.string().min(1), document: z.unknown() })
      .safeParse(payload);
    if (!parseResult.success) {
      return { success: false, errors: ['Invalid template save payload.'] };
    }

    try {
      const { templatesService } = await import('../documents/templates.service');
      return await templatesService.saveUserTemplate(
        parseResult.data.templateName,
        parseResult.data.document
      );
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Failed to save template.'],
      };
    }
  });
}
