import { app, BrowserWindow, session, dialog } from 'electron';
import * as path from 'path';
import { setupContentSecurityPolicy, setupPermissionHandlers } from './security/csp';
import { registerLabelIpcHandlers } from './ipc/label.ipc';
import { registerPrintingIpcHandlers } from './ipc/printing.ipc';
import { registerDocumentIpcHandlers } from './ipc/document.ipc';
import { registerDataSourceIpcHandlers } from './ipc/datasource.ipc';
import { registerProductionIpcHandlers } from './ipc/production.ipc';
import { registerSettingsIpcHandlers } from './ipc/settings.ipc';
import { registerDiagnosticsIpcHandlers } from './ipc/diagnostics.ipc';
import { getLogger } from './logging/logger';
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
  registerSettingsIpcHandlers();
  registerDiagnosticsIpcHandlers();

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

// Process crash handling and logging
process.on('uncaughtException', (error) => {
  try {
    const logger = getLogger();
    logger.error('main', 'crash', 'Uncaught Exception in Main Process', {
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  } catch {
    // Fallback if logger fails
  }

  dialog.showErrorBox(
    'Application Error',
    `An unexpected error occurred.\n\nError: ${error.message}\n\nPlease export a diagnostics bundle from Settings for assistance.`
  );
});

process.on('unhandledRejection', (reason) => {
  try {
    const logger = getLogger();
    logger.error('main', 'crash', 'Unhandled Promise Rejection in Main Process', {
      details: {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      },
    });
  } catch {
    // Fallback if logger fails
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

