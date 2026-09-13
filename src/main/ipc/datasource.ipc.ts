import { ipcMain, dialog } from 'electron';
import { z } from 'zod';
import {
  ExternalDataSourceSchema,
  Dataset,
  SetCredentialPayloadSchema,
  CredentialMetadata,
} from '../../core/data-sources';
import { CsvDataSourceAdapter } from '../data-sources/adapters/csv.adapter';
import { ExcelDataSourceAdapter } from '../data-sources/adapters/excel.adapter';
import { SqlDataSourceAdapter } from '../data-sources/adapters/sql.adapter';
import { RestDataSourceAdapter } from '../data-sources/adapters/rest.adapter';
import { CredentialVaultService } from '../data-sources/credentials/credential-vault.service';

export interface DataSourceLogEntry {
  sourceId?: string;
  sourceType?: string;
  operation: string;
  durationMs: number;
  rowCount?: number;
  errorCode?: string;
}

/**
 * Sanitized logging for data source operations.
 * Strictly avoids logging secrets, passwords, full datasets, or connection strings.
 */
export function logDataSourceOp(entry: DataSourceLogEntry): void {
  // Safe structured log output
  const safeLog = {
    timestamp: new Date().toISOString(),
    sourceId: entry.sourceId || 'anonymous',
    sourceType: entry.sourceType || 'unknown',
    operation: entry.operation,
    durationMs: entry.durationMs,
    rowCount: entry.rowCount,
    errorCode: entry.errorCode,
  };
  // Internal console or audit logger
  if (process.env.NODE_ENV !== 'test') {
    console.info('[DataSource IPC]', JSON.stringify(safeLog));
  }
}

/**
 * Factory creating the proper adapter given an ExternalDataSource definition
 * and resolving any referenced credentials securely in Main Process.
 */
export async function createAdapterForSource(
  source: z.infer<typeof ExternalDataSourceSchema>,
  vaultService: CredentialVaultService
) {
  let secret: string | null = null;
  if ('credentialRef' in source.config && source.config.credentialRef) {
    secret = await vaultService.getSecret(source.config.credentialRef);
  }

  switch (source.type) {
    case 'csv':
      return new CsvDataSourceAdapter(source.config);
    case 'excel':
      return new ExcelDataSourceAdapter(source.config);
    case 'sql':
      return new SqlDataSourceAdapter(source.config, undefined, secret);
    case 'rest':
      return new RestDataSourceAdapter(source.config, secret);
    default:
      throw new Error(`Unsupported data source type: ${(source as any).type}`);
  }
}

export function registerDataSourceIpcHandlers(vaultService: CredentialVaultService): void {
  // 1. Controlled File Selection Dialog (Main Process controls file system access)
  ipcMain.handle('datasource:select-file', async (_event, type: unknown) => {
    const isCsv = type === 'csv';
    const filters = isCsv
      ? [{ name: 'CSV Files (*.csv)', extensions: ['csv', 'txt'] }]
      : [{ name: 'Excel Files (*.xlsx)', extensions: ['xlsx'] }];

    const res = await dialog.showOpenDialog({
      title: isCsv ? 'Seleccionar archivo CSV' : 'Seleccionar archivo Excel',
      properties: ['openFile'],
      filters,
    });

    if (res.canceled || res.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: res.filePaths[0] };
  });

  // 2. Test Connection
  ipcMain.handle('datasource:test', async (_event, rawSource: unknown) => {
    const startTime = Date.now();
    const parseRes = ExternalDataSourceSchema.safeParse(rawSource);
    if (!parseRes.success) {
      logDataSourceOp({
        operation: 'testConnection',
        durationMs: Date.now() - startTime,
        errorCode: 'INVALID_CONFIG',
      });
      return {
        success: false,
        message: `Configuración inválida: ${parseRes.error.errors[0].message}`,
      };
    }

    const source = parseRes.data;
    try {
      const adapter = await createAdapterForSource(source, vaultService);
      const testRes = await adapter.testConnection();

      logDataSourceOp({
        sourceId: source.id,
        sourceType: source.type,
        operation: 'testConnection',
        durationMs: Date.now() - startTime,
        errorCode: testRes.success ? undefined : 'TEST_FAILED',
      });

      return testRes;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logDataSourceOp({
        sourceId: source.id,
        sourceType: source.type,
        operation: 'testConnection',
        durationMs: Date.now() - startTime,
        errorCode: 'EXECUTION_ERROR',
      });
      return { success: false, message: msg };
    }
  });

  // 3. Preview Source
  ipcMain.handle(
    'datasource:preview',
    async (
      _event,
      payload: { source: unknown; limit?: number }
    ): Promise<{ success: boolean; dataset?: Dataset; error?: string }> => {
      const startTime = Date.now();
      const parseRes = ExternalDataSourceSchema.safeParse(payload?.source);
      if (!parseRes.success) {
        logDataSourceOp({
          operation: 'preview',
          durationMs: Date.now() - startTime,
          errorCode: 'INVALID_CONFIG',
        });
        return {
          success: false,
          error: `Configuración inválida: ${parseRes.error.errors[0].message}`,
        };
      }

      const source = parseRes.data;
      const limit = typeof payload?.limit === 'number' ? payload.limit : 100;

      try {
        const adapter = await createAdapterForSource(source, vaultService);
        const dataset = await adapter.fetchPreview(limit);

        logDataSourceOp({
          sourceId: source.id,
          sourceType: source.type,
          operation: 'preview',
          durationMs: Date.now() - startTime,
          rowCount: dataset.rows.length,
        });

        return { success: true, dataset };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logDataSourceOp({
          sourceId: source.id,
          sourceType: source.type,
          operation: 'preview',
          durationMs: Date.now() - startTime,
          errorCode: 'FETCH_ERROR',
        });
        return { success: false, error: msg };
      }
    }
  );

  // 4. Secure Credential Vault Management (Renderer sees only sanitized metadata)
  ipcMain.handle('datasource:list-credentials', async (): Promise<CredentialMetadata[]> => {
    return vaultService.listCredentials();
  });

  ipcMain.handle('datasource:set-credential', async (_event, payload: unknown) => {
    const parseRes = SetCredentialPayloadSchema.safeParse(payload);
    if (!parseRes.success) {
      return {
        success: false,
        error: `Payload de credencial inválido: ${parseRes.error.errors[0].message}`,
      };
    }

    try {
      const meta = await vaultService.setCredential(parseRes.data);
      return { success: true, credential: meta };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('datasource:delete-credential', async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return { success: false };
    }
    const deleted = await vaultService.deleteCredential(id);
    return { success: deleted };
  });
}
