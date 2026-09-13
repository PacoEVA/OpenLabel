import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDocumentIpcHandlers } from '../../../src/main/ipc/document.ipc';
import * as docService from '../../../src/main/documents/document.service';

// Mock electron's ipcMain
const handlers: Record<string, Function> = {};
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers[channel] = handler;
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
  },
}));

vi.mock('../../../src/main/documents/document.service', () => ({
  openDocumentDialog: vi.fn(),
  saveDocument: vi.fn(),
  saveDocumentAsDialog: vi.fn(),
  readDocumentFile: vi.fn(),
}));

describe('Document IPC Handlers (Bloque 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDocumentIpcHandlers();
  });

  describe('document:open', () => {
    it('delegates to openDocumentDialog and returns result', async () => {
      vi.mocked(docService.openDocumentDialog).mockResolvedValueOnce({
        success: true,
        document: { version: '1.0.0' } as any,
        filePath: '/path/test.label',
        migrated: false,
      });

      const res = await handlers['document:open']({});
      expect(res.success).toBe(true);
      expect(res.filePath).toBe('/path/test.label');
      expect(docService.openDocumentDialog).toHaveBeenCalledTimes(1);
    });

    it('handles unexpected exceptions cleanly', async () => {
      vi.mocked(docService.openDocumentDialog).mockRejectedValueOnce(
        new Error('Dialog crashed')
      );

      const res = await handlers['document:open']({});
      expect(res.success).toBe(false);
      expect(res.errors?.[0].code).toBe('FILE_READ_FAILED');
      expect(res.errors?.[0].message).toBe('Dialog crashed');
    });
  });

  describe('document:save', () => {
    it('rejects invalid payload without filePath', async () => {
      const res = await handlers['document:save']({}, { document: {} });
      expect(res.success).toBe(false);
      expect(res.errors?.[0].code).toBe('DOCUMENT_VALIDATION_FAILED');
      expect(docService.saveDocument).not.toHaveBeenCalled();
    });

    it('delegates to saveDocument on valid payload', async () => {
      vi.mocked(docService.saveDocument).mockResolvedValueOnce({
        success: true,
        filePath: '/saved.label',
        savedAt: '2026-09-12T10:00:00Z',
      });

      const payload = { filePath: '/saved.label', document: { version: '1.0.0' } };
      const res = await handlers['document:save']({}, payload);
      expect(res.success).toBe(true);
      expect(docService.saveDocument).toHaveBeenCalledWith(payload.filePath, payload.document);
    });
  });

  describe('document:save-as', () => {
    it('rejects payload missing document', async () => {
      const res = await handlers['document:save-as']({}, {});
      expect(res.success).toBe(false);
      expect(res.errors?.[0].code).toBe('DOCUMENT_VALIDATION_FAILED');
      expect(docService.saveDocumentAsDialog).not.toHaveBeenCalled();
    });

    it('delegates to saveDocumentAsDialog on valid payload', async () => {
      vi.mocked(docService.saveDocumentAsDialog).mockResolvedValueOnce({
        success: true,
        filePath: '/as.label',
      });

      const res = await handlers['document:save-as'](
        {},
        { document: { version: '1.0.0' }, defaultTitle: 'My Doc' }
      );
      expect(res.success).toBe(true);
      expect(docService.saveDocumentAsDialog).toHaveBeenCalledWith(
        { version: '1.0.0' },
        'My Doc'
      );
    });
  });

  describe('document:read-file', () => {
    it('rejects payload missing filePath', async () => {
      const res = await handlers['document:read-file']({}, {});
      expect(res.success).toBe(false);
      expect(res.errors?.[0].code).toBe('DOCUMENT_VALIDATION_FAILED');
    });

    it('delegates to readDocumentFile on valid payload', async () => {
      vi.mocked(docService.readDocumentFile).mockResolvedValueOnce({
        success: true,
        filePath: '/file.label',
      });

      const res = await handlers['document:read-file']({}, { filePath: '/file.label' });
      expect(res.success).toBe(true);
      expect(docService.readDocumentFile).toHaveBeenCalledWith('/file.label');
    });
  });
});
