import * as fs from 'fs';
import * as os from 'os';
import { app, dialog } from 'electron';
import { getLogger, LogEntry } from '../logging/logger';
import { getSettingsService } from '../ipc/settings.ipc';
import { getPrintingService } from '../ipc/printing.ipc';
import { AppSettings } from '../../core/settings';

export interface DiagnosticsBundle {
  version: string;
  generatedAt: string;
  system: {
    platform: string;
    arch: string;
    osRelease: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryMb: number;
    freeMemoryMb: number;
  };
  settings: AppSettings;
  printerProfiles: Array<{
    id: string;
    name: string;
    language: string;
    dpi?: number;
    connectionType: string;
  }>;
  recentLogs: LogEntry[];
}

export class DiagnosticsService {
  /**
   * Builds an in-memory sanitized diagnostics bundle.
   * Strictly excludes passwords, tokens, API keys, document bodies, and datasets.
   */
  public async generateBundle(): Promise<DiagnosticsBundle> {
    const logger = getLogger();
    const settingsService = getSettingsService();
    const printingService = getPrintingService();

    const [settings, recentLogs, profiles] = await Promise.all([
      settingsService.getSettings(),
      logger.getRecentLogs(100),
      Promise.resolve(printingService.profileStore.list()),
    ]);

    const sanitizedProfiles = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      language: p.language,
      dpi: p.dpi,
      connectionType: p.connection.type,
    }));

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      system: {
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron || 'unknown',
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      },
      settings,
      printerProfiles: sanitizedProfiles,
      recentLogs,
    };
  }

  /**
   * Prompts native save dialog and saves diagnostics bundle JSON to chosen destination.
   */
  public async exportBundleWithDialog(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const bundle = await this.generateBundle();
      const defaultFileName = `openlabels-diagnostics-${Date.now()}.json`;

      const saveResult = await dialog.showSaveDialog({
        title: 'Export Diagnostics Bundle',
        defaultPath: defaultFileName,
        filters: [{ name: 'JSON Files (*.json)', extensions: ['json'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, error: 'Export canceled by user' };
      }

      const jsonStr = JSON.stringify(bundle, null, 2);
      await fs.promises.writeFile(saveResult.filePath, jsonStr, 'utf8');

      return { success: true, filePath: saveResult.filePath };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

let sharedDiagnosticsService: DiagnosticsService | null = null;

export function getDiagnosticsService(): DiagnosticsService {
  if (!sharedDiagnosticsService) {
    sharedDiagnosticsService = new DiagnosticsService();
  }
  return sharedDiagnosticsService;
}
