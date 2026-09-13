import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  RecoverySnapshotSchema,
  RecoverySnapshot,
} from '../../core/documents/recovery-snapshot.schema';
import { atomicWriteFile } from './document.service';

export class AutosaveService {
  private dirPath: string;

  constructor(customDirPath?: string) {
    if (customDirPath) {
      this.dirPath = customDirPath;
    } else {
      try {
        const userData = app.getPath('userData');
        this.dirPath = path.join(userData, 'autosave');
      } catch {
        this.dirPath = path.join(process.cwd(), '.autosave');
      }
    }
  }

  private async ensureDir(): Promise<void> {
    if (!fs.existsSync(this.dirPath)) {
      await fs.promises.mkdir(this.dirPath, { recursive: true });
    }
  }

  /**
   * Saves a recovery snapshot atomically to the autosave directory.
   */
  public async saveSnapshot(
    rawSnapshot: unknown
  ): Promise<{ success: boolean; snapshot?: RecoverySnapshot; errors?: string[] }> {
    const validation = RecoverySnapshotSchema.safeParse(rawSnapshot);
    if (!validation.success) {
      return {
        success: false,
        errors: validation.error.errors.map(
          (e) => `${e.path.join('.') || 'root'}: ${e.message}`
        ),
      };
    }

    try {
      await this.ensureDir();
      const snapshot = validation.data;
      const targetFile = path.join(this.dirPath, `${snapshot.documentId}.recovery.json`);
      const serialized = JSON.stringify(snapshot, null, 2);

      await atomicWriteFile(targetFile, serialized);
      return {
        success: true,
        snapshot,
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Failed to write autosave snapshot.'],
      };
    }
  }

  /**
   * Scans the autosave directory and returns all valid recovery snapshots, sorted newest first.
   */
  public async getRecoveryItems(): Promise<RecoverySnapshot[]> {
    try {
      if (!fs.existsSync(this.dirPath)) {
        return [];
      }

      const files = await fs.promises.readdir(this.dirPath);
      const recoveryFiles = files.filter((f) => f.endsWith('.recovery.json'));

      const snapshots: RecoverySnapshot[] = [];
      for (const file of recoveryFiles) {
        const fullPath = path.join(this.dirPath, file);
        try {
          const raw = await fs.promises.readFile(fullPath, 'utf8');
          const parsed = JSON.parse(raw);
          const validation = RecoverySnapshotSchema.safeParse(parsed);
          if (validation.success) {
            snapshots.push(validation.data);
          } else {
            // Remove corrupted snapshot
            await fs.promises.unlink(fullPath).catch(() => {});
          }
        } catch {
          // Remove malformed file
          await fs.promises.unlink(fullPath).catch(() => {});
        }
      }

      // Sort newest first
      return snapshots.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  /**
   * Deletes the recovery snapshot corresponding to the given documentId.
   */
  public async removeSnapshot(documentId: string): Promise<boolean> {
    try {
      const targetFile = path.join(this.dirPath, `${documentId}.recovery.json`);
      if (fs.existsSync(targetFile)) {
        await fs.promises.unlink(targetFile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Cleans up all recovery snapshots.
   */
  public async clearAllSnapshots(): Promise<void> {
    try {
      if (!fs.existsSync(this.dirPath)) return;
      const files = await fs.promises.readdir(this.dirPath);
      for (const file of files) {
        if (file.endsWith('.recovery.json')) {
          await fs.promises.unlink(path.join(this.dirPath, file)).catch(() => {});
        }
      }
    } catch {
      // Non-fatal cleanup
    }
  }
}

export const autosaveService = new AutosaveService();
