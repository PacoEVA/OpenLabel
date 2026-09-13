import { ipcMain } from 'electron';
import { SettingsService } from '../settings/settings.service';

let sharedSettingsService: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!sharedSettingsService) {
    sharedSettingsService = new SettingsService();
  }
  return sharedSettingsService;
}

/**
 * Registers IPC handlers for global application settings.
 * All incoming payloads are treated as untrusted and validated with Zod.
 */
export function registerSettingsIpcHandlers(
  service: SettingsService = getSettingsService()
): void {
  // 1. Get current settings
  ipcMain.handle('settings:get', async () => {
    try {
      return await service.getSettings();
    } catch {
      return service.resetDefaults();
    }
  });

  // 2. Save settings
  ipcMain.handle('settings:save', async (_event, rawPayload: unknown) => {
    return await service.saveSettings(rawPayload);
  });

  // 3. Reset settings to default
  ipcMain.handle('settings:reset', async () => {
    try {
      const settings = await service.resetDefaults();
      return { success: true, settings };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
