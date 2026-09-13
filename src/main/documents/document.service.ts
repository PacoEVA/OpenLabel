import * as fs from 'fs';
import * as path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { LabelDocumentSchema } from '../../core/schemas/label.schema';
import {
  serializeLabelFile,
  deserializeLabelFile,
  DocumentError,
  DocumentWarning,
  LabelDocument,
} from '../../core/documents';
import { recentFilesService } from './recent-files.service';

export const MAX_LABEL_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes

export interface OpenDocumentResult {
  canceled?: boolean;
  success: boolean;
  document?: LabelDocument;
  filePath?: string;
  migrated?: boolean;
  warnings?: DocumentWarning[];
  errors?: DocumentError[];
}

export interface SaveDocumentResult {
  canceled?: boolean;
  success: boolean;
  filePath?: string;
  savedAt?: string;
  errors?: DocumentError[];
}

/**
 * Performs an atomic file write to prevent file corruption in case of unexpected
 * crashes, power cuts, or process interruptions midway through writing.
 *
 * Steps:
 * 1. Write content to a secure temporary sibling file.
 * 2. Validate that the written temp file is intact and valid JSON.
 * 3. Atomically rename the temporary file to targetPath.
 * 4. Clean up the temp file on any intermediate error.
 */
export async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const tempPath = path.join(dir, `.${baseName}.tmp.${Date.now()}.${randomSuffix}`);

  try {
    // 1. Write to temporary file
    await fs.promises.writeFile(tempPath, content, { encoding: 'utf8', flag: 'w' });

    // 2. Validate temporary file integrity
    const writtenStats = await fs.promises.stat(tempPath);
    if (writtenStats.size === 0) {
      throw new Error('Atomic write integrity check failed: temporary file is empty.');
    }

    // Ensure it parses as valid JSON before replacing target
    const readBack = await fs.promises.readFile(tempPath, 'utf8');
    JSON.parse(readBack);

    // 3. Atomically replace target file
    await fs.promises.rename(tempPath, targetPath);
  } catch (err) {
    // 4. Clean up temp file on failure
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch {
      // Ignore cleanup error
    }
    throw err;
  }
}

/**
 * Reads and deserializes a .label file from a known path with size validation.
 */
export async function readDocumentFile(filePath: string): Promise<OpenDocumentResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_NOT_FOUND',
            message: `The specified file does not exist: ${filePath}`,
          },
        ],
      };
    }

    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_LABEL_FILE_SIZE_BYTES) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds the 10MB safety limit (${stats.size} bytes).`,
          },
        ],
      };
    }

    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    const deserializeResult = deserializeLabelFile(rawContent);

    if (!deserializeResult.success) {
      return {
        success: false,
        errors: deserializeResult.errors,
      };
    }

    // Record file in recent files list
    try {
      await recentFilesService.addRecentFile(filePath, deserializeResult.document.meta.title);
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      document: deserializeResult.document,
      filePath,
      migrated: deserializeResult.migrated,
      warnings: deserializeResult.warnings,
    };
  } catch (err) {
    return {
      success: false,
      errors: [
        {
          code: 'FS_READ_ERROR',
          message: err instanceof Error ? err.message : 'Unknown file system read error.',
        },
      ],
    };
  }
}

/**
 * Opens a native file dialog for selecting a .label file and loads it safely.
 */
export async function openDocumentDialog(
  parentWindow?: BrowserWindow
): Promise<OpenDocumentResult> {
  const result = await dialog.showOpenDialog(parentWindow ?? (BrowserWindow.getFocusedWindow() || undefined)!, {
    title: 'Open Label',
    filters: [
      { name: 'OpenLabels Document (*.label)', extensions: ['label'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const selectedPath = result.filePaths[0];
  return readDocumentFile(selectedPath);
}

/**
 * Validates, serializes, and saves a document to an existing filePath using atomic writes.
 */
export async function saveDocument(
  filePath: string,
  rawDocument: unknown
): Promise<SaveDocumentResult> {
  try {
    // Always validate untrusted input from renderer
    const validation = LabelDocumentSchema.safeParse(rawDocument);
    if (!validation.success) {
      return {
        success: false,
        errors: validation.error.errors.map((e) => ({
          code: 'DOCUMENT_VALIDATION_FAILED',
          message: `${e.path.join('.') || 'root'}: ${e.message}`,
        })),
      };
    }

    const serialization = serializeLabelFile(validation.data);
    if (!serialization.success) {
      return {
        success: false,
        errors: serialization.errors,
      };
    }

    if (Buffer.byteLength(serialization.json, 'utf8') > MAX_LABEL_FILE_SIZE_BYTES) {
      return {
        success: false,
        errors: [
          {
            code: 'FILE_TOO_LARGE',
            message: 'Serialized label exceeds the 10MB safety limit.',
          },
        ],
      };
    }

    await atomicWriteFile(filePath, serialization.json);

    // Record file in recent files list
    try {
      await recentFilesService.addRecentFile(filePath, validation.data.meta.title);
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      filePath,
      savedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      errors: [
        {
          code: 'FS_WRITE_ERROR',
          message: err instanceof Error ? err.message : 'Unknown file system write error.',
        },
      ],
    };
  }
}

/**
 * Prompts user for a save path via native dialog and saves the document atomically.
 */
export async function saveDocumentAsDialog(
  rawDocument: unknown,
  defaultTitle?: string,
  parentWindow?: BrowserWindow
): Promise<SaveDocumentResult> {
  const sanitizedTitle = (defaultTitle || 'untitled')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim();
  const defaultFileName = sanitizedTitle.endsWith('.label')
    ? sanitizedTitle
    : `${sanitizedTitle}.label`;

  const result = await dialog.showSaveDialog(parentWindow ?? (BrowserWindow.getFocusedWindow() || undefined)!, {
    title: 'Save Label As',
    defaultPath: defaultFileName,
    filters: [{ name: 'OpenLabels Document (*.label)', extensions: ['label'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  let finalPath = result.filePath;
  if (!finalPath.toLowerCase().endsWith('.label')) {
    finalPath = `${finalPath}.label`;
  }

  return saveDocument(finalPath, rawDocument);
}
