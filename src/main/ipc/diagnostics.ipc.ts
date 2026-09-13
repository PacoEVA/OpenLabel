import { ipcMain } from 'electron';
import { getDiagnosticsService, DiagnosticsService } from '../diagnostics/diagnostics.service';

export function registerDiagnosticsIpcHandlers(
  service: DiagnosticsService = getDiagnosticsService()
): void {
  ipcMain.handle('diagnostics:get-bundle', async () => {
    try {
      const bundle = await service.generateBundle();
      return { success: true, bundle };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('diagnostics:export-bundle', async () => {
    return await service.exportBundleWithDialog();
  });
}
