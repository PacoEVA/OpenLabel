import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  type AppSettings,
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  migrateAppSettings,
} from '../../core/settings';
import { atomicWriteFile } from '../documents/document.service';

/**
 * Service managing global application preferences in the Main Process.
 *
 * Guarantees:
 * - Atomic file replacement via sibling temporary files (avoids corrupted preferences).
 * - Automatic migration of legacy/older settings versions via migrateAppSettings.
 * - Safe fallback to factory defaults if settings file is corrupt or unreadable.
 * - Quarantine/backup of corrupted settings files.
 */
export class SettingsService {
  private readonly filePath: string;
  private inMemoryCache: AppSettings | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      try {
        const userData = app.getPath('userData');
        this.filePath = path.join(userData, 'settings.json');
      } catch {
        this.filePath = path.join(process.cwd(), '.settings.json');
      }
    }
  }

  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Loads and normalizes AppSettings from disk.
   */
  public async getSettings(): Promise<AppSettings> {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }

    if (!fs.existsSync(this.filePath)) {
      this.inMemoryCache = { ...DEFAULT_APP_SETTINGS };
      return this.inMemoryCache;
    }

    try {
      const content = await fs.promises.readFile(this.filePath, 'utf8');
      const raw = JSON.parse(content);

      const migrationResult = migrateAppSettings(raw);

      if (!migrationResult.success || !migrationResult.settings) {
        throw new Error(migrationResult.error || 'Failed to parse settings');
      }

      // If settings were migrated to a new version, persist the updated format atomically
      if (migrationResult.migrated) {
        await this.saveSettings(migrationResult.settings);
      }

      this.inMemoryCache = migrationResult.settings;
      return this.inMemoryCache;
    } catch (err) {
      // Quarantine corrupted settings file and recover with default settings
      try {
        const corruptPath = `${this.filePath}.corrupt.${Date.now()}`;
        if (fs.existsSync(this.filePath)) {
          await fs.promises.rename(this.filePath, corruptPath);
        }
      } catch {
        // Ignore quarantine failure
      }

      this.inMemoryCache = { ...DEFAULT_APP_SETTINGS };
      return this.inMemoryCache;
    }
  }

  /**
   * Validates and persists new AppSettings atomically to disk.
   */
  public async saveSettings(newSettings: unknown): Promise<{ success: boolean; settings?: AppSettings; error?: string }> {
    const parse = AppSettingsSchema.safeParse(newSettings);
    if (!parse.success) {
      const issues = parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Validation error: ${issues}`,
      };
    }

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      const jsonString = JSON.stringify(parse.data, null, 2);
      await atomicWriteFile(this.filePath, jsonString);

      this.inMemoryCache = parse.data;
      return {
        success: true,
        settings: parse.data,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message || 'Failed to save settings atomically',
      };
    }
  }

  /**
   * Resets settings to factory defaults atomically.
   */
  public async resetDefaults(): Promise<AppSettings> {
    const res = await this.saveSettings(DEFAULT_APP_SETTINGS);
    if (!res.success || !res.settings) {
      throw new Error(res.error || 'Failed to reset defaults');
    }
    return res.settings;
  }
}
