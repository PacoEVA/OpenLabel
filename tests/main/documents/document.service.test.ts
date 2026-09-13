import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  atomicWriteFile,
  readDocumentFile,
  saveDocument,
  saveDocumentAsDialog,
  openDocumentDialog,
} from '../../../src/main/documents/document.service';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';
import { serializeLabelFile } from '../../../src/core/documents';

// Mock electron dialog and BrowserWindow
vi.mock('electron', () => {
  return {
    dialog: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
    },
    BrowserWindow: {
      getFocusedWindow: vi.fn(() => null),
    },
  };
});

describe('DocumentService & Atomic Writes (Bloque 4)', () => {
  let tempDir: string;

  const validDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Test Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 40,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'Hello World',
        fontSize: 12,
        fontFamily: 'Roboto',
        bold: false,
        italic: false,
        align: 'left',
      },
    ],
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    vi.clearAllMocks();
  });

  describe('atomicWriteFile', () => {
    it('successfully writes content to a target file', async () => {
      const target = path.join(tempDir, 'test.label');
      const sampleContent = JSON.stringify({ hello: 'world' });

      await atomicWriteFile(target, sampleContent);

      expect(fs.existsSync(target)).toBe(true);
      const read = fs.readFileSync(target, 'utf8');
      expect(read).toBe(sampleContent);
    });

    it('cleanly replaces an existing file without leaving temp files behind', async () => {
      const target = path.join(tempDir, 'replace.label');
      await atomicWriteFile(target, JSON.stringify({ v: 1 }));
      await atomicWriteFile(target, JSON.stringify({ v: 2 }));

      const read = fs.readFileSync(target, 'utf8');
      expect(JSON.parse(read)).toEqual({ v: 2 });

      // No temp files left in directory
      const files = fs.readdirSync(tempDir);
      expect(files).toEqual(['replace.label']);
    });

    it('rejects and cleans up temp file if written content is not valid JSON', async () => {
      const target = path.join(tempDir, 'invalid.label');
      const malformedJson = '{"truncated":';

      await expect(atomicWriteFile(target, malformedJson)).rejects.toThrow();
      expect(fs.existsSync(target)).toBe(false);

      // Verify no temporary files remain
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBe(0);
    });
  });

  describe('saveDocument & readDocumentFile', () => {
    it('saves a valid document and reads it back successfully', async () => {
      const target = path.join(tempDir, 'mylabel.label');
      const saveRes = await saveDocument(target, validDoc);

      expect(saveRes.success).toBe(true);
      expect(saveRes.filePath).toBe(target);
      expect(saveRes.savedAt).toBeDefined();

      const readRes = await readDocumentFile(target);
      expect(readRes.success).toBe(true);
      expect(readRes.document).toEqual(validDoc);
      expect(readRes.filePath).toBe(target);
      expect(readRes.migrated).toBe(false);
    });

    it('rejects invalid document before saving', async () => {
      const target = path.join(tempDir, 'bad.label');
      const badDoc = { ...validDoc, dimensions: { width: -50 } }; // invalid width

      const saveRes = await saveDocument(target, badDoc);
      expect(saveRes.success).toBe(false);
      expect(saveRes.errors).toBeDefined();
      expect(fs.existsSync(target)).toBe(false);
    });

    it('returns FILE_NOT_FOUND when reading a non-existent file', async () => {
      const target = path.join(tempDir, 'does-not-exist.label');
      const readRes = await readDocumentFile(target);

      expect(readRes.success).toBe(false);
      expect(readRes.errors?.[0].code).toBe('FILE_NOT_FOUND');
    });

    it('returns error when reading a corrupted file', async () => {
      const target = path.join(tempDir, 'corrupted.label');
      fs.writeFileSync(target, 'NOT VALID JSON CONTENT', 'utf8');

      const readRes = await readDocumentFile(target);
      expect(readRes.success).toBe(false);
      expect(readRes.errors?.[0].code).toBe('INVALID_JSON');
    });
  });

  describe('Dialog wrappers', () => {
    it('handles openDocumentDialog cancellation', async () => {
      const { dialog } = await import('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });

      const res = await openDocumentDialog();
      expect(res.success).toBe(false);
      expect(res.canceled).toBe(true);
    });

    it('handles saveDocumentAsDialog cancellation', async () => {
      const { dialog } = await import('electron');
      vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
        canceled: true,
        filePath: undefined as unknown as string,
      });

      const res = await saveDocumentAsDialog(validDoc, 'My Label');
      expect(res.success).toBe(false);
      expect(res.canceled).toBe(true);
    });

    it('appends .label extension if user saves without extension', async () => {
      const { dialog } = await import('electron');
      const targetWithoutExt = path.join(tempDir, 'custom-name');
      vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
        canceled: false,
        filePath: targetWithoutExt,
      });

      const res = await saveDocumentAsDialog(validDoc, 'custom-name');
      expect(res.success).toBe(true);
      expect(res.filePath).toBe(`${targetWithoutExt}.label`);
      expect(fs.existsSync(`${targetWithoutExt}.label`)).toBe(true);
    });
  });
});
