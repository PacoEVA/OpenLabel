import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  PrintTransport,
  PrintTransportContext,
  PrintTransportResult,
  PrinterProfile,
  PrintArtifact,
  PrintError,
} from '../../../core/printing';

export type SystemPrintExecutor = (
  printerName: string,
  pdfData: Uint8Array,
  options?: { signal?: AbortSignal }
) => Promise<{ success: boolean; error?: PrintError }>;

/**
 * Default Electron-based printing executor using a hidden BrowserWindow.
 */
export async function defaultElectronPrintExecutor(
  printerName: string,
  pdfData: Uint8Array,
  options?: { signal?: AbortSignal }
): Promise<{ success: boolean; error?: PrintError }> {
  let tempFilePath: string | undefined;
  let hiddenWindow: import('electron').BrowserWindow | undefined;

  try {
    const { BrowserWindow } = await import('electron');

    if (options?.signal?.aborted) {
      return {
        success: false,
        error: {
          code: 'CANCELLED',
          message: 'Printing cancelled before starting spooler',
          retryable: false,
        },
      };
    }

    // Secure temporary file creation in OS temp directory
    const tempDir = os.tmpdir();
    const tempFileName = `openlabels_job_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    tempFilePath = path.join(tempDir, tempFileName);

    await fs.writeFile(tempFilePath, pdfData);

    hiddenWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await hiddenWindow.loadURL(`file://${tempFilePath}`);

    if (options?.signal?.aborted) {
      return {
        success: false,
        error: {
          code: 'CANCELLED',
          message: 'Printing cancelled after loading PDF',
          retryable: false,
        },
      };
    }

    return await new Promise<{ success: boolean; error?: PrintError }>((resolve) => {
      hiddenWindow!.webContents.print(
        {
          silent: true,
          deviceName: printerName,
        },
        (success, failureReason) => {
          if (success) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: {
                code: 'SPOOLER_ERROR',
                message: `Spooler failed to print to "${printerName}": ${failureReason}`,
                retryable: true,
              },
            });
          }
        }
      );
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: {
        code: 'SPOOLER_ERROR',
        message: `System printer error: ${message}`,
        retryable: true,
      },
    };
  } finally {
    if (hiddenWindow && !hiddenWindow.isDestroyed()) {
      hiddenWindow.destroy();
    }
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore temp cleanup error
      }
    }
  }
}

/**
 * SystemPrinterTransport handles delivery of PDF artifacts to OS spooler printers.
 */
export class SystemPrinterTransport implements PrintTransport {
  public readonly type = 'system-spooler';
  private readonly executor: SystemPrintExecutor;

  constructor(executor: SystemPrintExecutor = defaultElectronPrintExecutor) {
    this.executor = executor;
  }

  public canHandle(profile: PrinterProfile, artifact: PrintArtifact): boolean {
    return profile.connection.type === 'system' && artifact.type === 'pdf';
  }

  public async send(
    profile: PrinterProfile,
    artifact: PrintArtifact,
    context: PrintTransportContext
  ): Promise<PrintTransportResult> {
    if (profile.connection.type !== 'system') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: `SystemPrinterTransport cannot handle connection type "${profile.connection.type}"`,
          retryable: false,
        },
      };
    }

    if (artifact.type !== 'pdf') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_ARTIFACT',
          message: `SystemPrinterTransport only supports PDF artifacts, received "${artifact.type}"`,
          retryable: false,
        },
      };
    }

    if (context.signal?.aborted) {
      return {
        success: false,
        error: {
          code: 'CANCELLED',
          message: 'Print dispatch cancelled before spooler delivery',
          retryable: false,
        },
      };
    }

    const { printerName } = profile.connection;
    const execution = await this.executor(printerName, artifact.data, {
      signal: context.signal,
    });

    if (!execution.success) {
      return {
        success: false,
        error: execution.error ?? {
          code: 'SPOOLER_ERROR',
          message: `Failed to print to system printer "${printerName}"`,
          retryable: true,
        },
      };
    }

    return {
      success: true,
      bytesWritten: artifact.data.byteLength,
    };
  }
}
