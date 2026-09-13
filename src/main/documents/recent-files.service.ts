import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { z } from 'zod';
import { atomicWriteFile } from './document.service';

export const MAX_RECENT_FILES = 10;

export interface RecentFileEntry {
  filePath: string;
  displayName: string;
  lastOpenedAt: string;
}

const RecentFileEntrySchema = z.object({
  filePath: z.string().min(1),
  displayName: z.string().min(1),
  lastOpenedAt: z.string().min(1),
});

const RecentFilesStoreSchema = z.object({
  version: z.literal(1),
  entries: z.array(RecentFileEntrySchema),
});

export class RecentFilesService {
  private storagePath: string;

  constructor(customStoragePath?: string) {
    if (customStoragePath) {
      this.storagePath = customStoragePath;
    } else {
      try {
        const userData = app.getPath('userData');
        this.storagePath = path.join(userData, 'recent-files.json');
      } catch {
        // Fallback for isolated test environments
        this.storagePath = path.join(process.cwd(), '.recent-files.json');
      }
    }
  }

  /**
   * Retrieves the recent files list, filtering out files that no longer exist on disk.
   */
  public async getRecentFiles(): Promise<RecentFileEntry[]> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return [];
      }

      const raw = await fs.promises.readFile(this.storagePath, 'utf8');
      const parsed = JSON.parse(raw);
      const validation = RecentFilesStoreSchema.safeParse(parsed);

      if (!validation.success) {
        return [];
      }

      // Filter out files that no longer exist
      const existingEntries = validation.data.entries.filter((entry) =>
        fs.existsSync(entry.filePath)
      );

      // If missing files were filtered, prune on disk
      if (existingEntries.length !== validation.data.entries.length) {
        await this.persistEntries(existingEntries);
      }

      return existingEntries;
    } catch {
      return [];
    }
  }

  /**
   * Adds or bumps a file to the top of the recent files list.
   */
  public async addRecentFile(filePath: string, displayName?: string): Promise<RecentFileEntry[]> {
    const entries = await this.getRecentFiles();
    const resolvedDisplayName =
      displayName || path.basename(filePath, path.extname(filePath)) || 'Untitled Label';

    // Deduplicate and filter out the current file
    const filtered = entries.filter(
      (e) => path.resolve(e.filePath) !== path.resolve(filePath)
    );

    const newEntry: RecentFileEntry = {
      filePath,
      displayName: resolvedDisplayName,
      lastOpenedAt: new Date().toISOString(),
    };

    // Prepend to top and enforce maximum limit
    const updatedEntries = [newEntry, ...filtered].slice(0, MAX_RECENT_FILES);
    await this.persistEntries(updatedEntries);

    return updatedEntries;
  }

  /**
   * Clears the entire recent files list.
   */
  public async clearRecentFiles(): Promise<void> {
    await this.persistEntries([]);
  }

  private async persistEntries(entries: RecentFileEntry[]): Promise<void> {
    try {
      const data = {
        version: 1 as const,
        entries,
      };
      const json = JSON.stringify(data, null, 2);
      await atomicWriteFile(this.storagePath, json);
    } catch (err) {
      // Non-fatal logging for recent files persistence
      console.error('Failed to persist recent files list:', err);
    }
  }
}

// Singleton instance for Main process
export const recentFilesService = new RecentFilesService();
