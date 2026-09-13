import { Connection, Request, TYPES } from 'tedious';
import { SqlEngine, SqlDataSourceConfig } from '../../../../core/data-sources';
import { SqlDriver, QueryExecutionOptions, SqlQueryResult } from './sql-driver.interface';

export class TediousMssqlDriver implements SqlDriver {
  readonly engine: SqlEngine = 'mssql';
  private connection: Connection | null = null;

  async connect(config: SqlDataSourceConfig, secret: string | null): Promise<void> {
    if (this.connection) {
      await this.disconnect();
    }

    const tediousConfig = {
      server: config.host,
      authentication: {
        type: 'default' as const,
        options: {
          userName: config.username,
          password: secret || '',
        },
      },
      options: {
        port: config.port,
        database: config.database,
        encrypt: config.encrypt ?? true,
        trustServerCertificate: config.trustServerCertificate ?? false,
        connectTimeout: 15000,
        requestTimeout: config.timeoutMs || 30000,
        rowCollectionOnRequestCompletion: false,
      },
    };

    return new Promise((resolve, reject) => {
      const conn = new Connection(tediousConfig);

      conn.on('connect', (err) => {
        if (err) {
          reject(err);
        } else {
          this.connection = conn;
          resolve();
        }
      });

      conn.on('error', (err) => {
        // Log or handle background connection drops
        if (!this.connection) {
          reject(err);
        }
      });

      conn.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        // ignore
      }
      this.connection = null;
    }
  }

  async query(
    sql: string,
    params: Record<string, unknown>,
    options: QueryExecutionOptions
  ): Promise<SqlQueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to SQL Server');
    }

    return new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      const columnsSet = new Set<string>();
      let isCompleted = false;

      const request = new Request(sql, (err) => {
        if (isCompleted) return;
        isCompleted = true;
        if (err) {
          reject(err);
        } else {
          resolve({
            columns: Array.from(columnsSet),
            rows,
            totalRows: rows.length,
          });
        }
      });

      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          if (!isCompleted) {
            isCompleted = true;
            try {
              this.connection?.cancel();
            } catch {
              // ignore
            }
            reject(new Error('SQL operation aborted by user'));
          }
        });
      }

      // Add typed parameters safely to prevent SQL injection
      for (const [key, val] of Object.entries(params)) {
        if (typeof val === 'number') {
          if (Number.isInteger(val)) {
            request.addParameter(key, TYPES.Int, val);
          } else {
            request.addParameter(key, TYPES.Float, val);
          }
        } else if (typeof val === 'boolean') {
          request.addParameter(key, TYPES.Bit, val);
        } else if (val instanceof Date) {
          request.addParameter(key, TYPES.DateTime, val);
        } else {
          request.addParameter(key, TYPES.NVarChar, val !== null && val !== undefined ? String(val) : null);
        }
      }

      request.on('row', (columns) => {
        if (options.rowLimit && rows.length >= options.rowLimit) {
          // Reached limit
          return;
        }

        const rowObj: Record<string, unknown> = {};
        for (const col of columns) {
          columnsSet.add(col.metadata.colName);
          rowObj[col.metadata.colName] = col.value;
        }
        rows.push(rowObj);
      });

      request.on('error', (err) => {
        if (!isCompleted) {
          isCompleted = true;
          reject(err);
        }
      });

      if (!this.connection) {
        return reject(new Error('Connection lost before SQL execution'));
      }
      this.connection.execSql(request);
    });
  }

  async test(): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.query('SELECT 1 AS [test_connection]', {}, { timeoutMs: 5000, rowLimit: 1 });
      return {
        success: res.rows.length > 0,
        message: 'SQL Server connection verified successfully',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
