import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';
import { setupContentSecurityPolicy, setupPermissionHandlers } from './security/csp';
import { registerLabelIpcHandlers } from './ipc/label.ipc';
import { registerPrintingIpcHandlers } from './ipc/printing.ipc';
import { registerDocumentIpcHandlers } from './ipc/document.ipc';
import { registerDataSourceIpcHandlers } from './ipc/datasource.ipc';
import { registerProductionIpcHandlers } from './ipc/production.ipc';
import { CredentialVaultService } from './data-sources/credentials/credential-vault.service';

/**
 * OpenLabels - Main Process
 * Manages Electron lifecycle, window creation, strict isolation, and IPC boundaries.
 */

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  // Block unauthorized secondary windows
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Block unexpected external navigation
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // In production or local development, allow only local origins (file:// or localhost)
    const isAllowedOrigin =
      parsedUrl.protocol === 'file:' ||
      (parsedUrl.hostname === 'localhost' && ['http:', 'https:'].includes(parsedUrl.protocol));

    if (!isAllowedOrigin) {
      event.preventDefault();
    }
  });

  // Load entry HTML in renderer
  const rendererPath = path.join(__dirname, '../../renderer/index.html');
  if (process.env.NODE_ENV === 'development' && !app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(rendererPath);
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// Application Lifecycle
app.whenReady().then(() => {
  // Apply security policies to the default session
  setupContentSecurityPolicy(session.defaultSession);
  setupPermissionHandlers(session.defaultSession);

  // Register strictly typed IPC endpoints
  registerLabelIpcHandlers();
  registerPrintingIpcHandlers();
  registerDocumentIpcHandlers();
  registerProductionIpcHandlers();

  const vaultDir = path.join(app.getPath('userData'), 'vault');
  const vaultService = new CredentialVaultService(vaultDir);
  registerDataSourceIpcHandlers(vaultService);

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
