import { SqlEngine, SqlDataSourceConfig } from '../../../../core/data-sources';
import { SqlDriver, QueryExecutionOptions, SqlQueryResult } from './sql-driver.interface';

export class MockSqlDriver implements SqlDriver {
  readonly engine: SqlEngine = 'mssql';

  public isConnected = false;
  public lastConfig: SqlDataSourceConfig | null = null;
  public lastSecret: string | null = null;
  public lastQuery: string | null = null;
  public lastParams: Record<string, unknown> | null = null;
  public lastOptions: QueryExecutionOptions | null = null;

  public mockColumns: string[] = ['id', 'sku', 'name', 'price'];
  public mockRows: Record<string, unknown>[] = [
    { id: 1, sku: 'SKU-001', name: 'Tornillo Acero', price: 0.15 },
    { id: 2, sku: 'SKU-002', name: 'Arandela Plana', price: 0.05 },
  ];

  public shouldFailConnect = false;
  public shouldTimeout = false;
  public connectErrorMessage = 'Connection to SQL Server failed';

  async connect(config: SqlDataSourceConfig, secret: string | null): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error(this.connectErrorMessage);
    }
    this.isConnected = true;
    this.lastConfig = config;
    this.lastSecret = secret;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async query(
    sql: string,
    params: Record<string, unknown>,
    options: QueryExecutionOptions
  ): Promise<SqlQueryResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to database');
    }

    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, (options.timeoutMs || 1000) + 100));
      throw new Error('Query execution timed out');
    }

    this.lastQuery = sql;
    this.lastParams = params;
    this.lastOptions = options;

    const rowLimit = options.rowLimit || 100;
    const sliced = this.mockRows.slice(0, rowLimit);

    return {
      columns: this.mockColumns,
      rows: sliced,
      totalRows: this.mockRows.length,
    };
  }

  async test(): Promise<{ success: boolean; message?: string }> {
    if (this.shouldFailConnect) {
      return { success: false, message: this.connectErrorMessage };
    }
    return { success: true, message: 'Connected successfully to SQL Server' };
  }
}
