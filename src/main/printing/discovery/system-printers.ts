import type { SystemPrinterInfo } from './system-printers.types';

export type RawPrinterProvider = () => Promise<
  Array<{
    name: string;
    displayName?: string;
    description?: string;
    isDefault?: boolean;
    status?: number;
  }>
>;

/**
 * Discovers printers installed in the operating system.
 * Uses the provided raw printer provider (e.g. Electron webContents.getPrintersAsync).
 */
export async function getSystemPrinters(
  provider?: RawPrinterProvider
): Promise<SystemPrinterInfo[]> {
  if (!provider) {
    try {
      // Dynamic import to avoid static electron dependency issues in headless unit tests
      const { BrowserWindow } = await import('electron');
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        provider = () => win.webContents.getPrintersAsync();
      }
    } catch {
      // Electron not available or in non-electron test context
    }
  }

  if (!provider) {
    return [];
  }

  try {
    const rawPrinters = await provider();
    return rawPrinters.map((p) => ({
      name: p.name,
      displayName: p.displayName && p.displayName.trim().length > 0 ? p.displayName : p.name,
      description: p.description,
      isDefault: Boolean(p.isDefault),
      status: p.status,
    }));
  } catch (error) {
    console.error('Failed to discover system printers:', error);
    return [];
  }
}
