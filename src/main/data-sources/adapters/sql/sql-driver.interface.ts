import { SqlEngine, SqlDataSourceConfig } from '../../../../core/data-sources';

export interface QueryExecutionOptions {
  timeoutMs?: number;
  rowLimit?: number;
  abortSignal?: AbortSignal;
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows?: number;
}

export interface SqlDriver {
  readonly engine: SqlEngine;
  connect(config: SqlDataSourceConfig, secret: string | null): Promise<void>;
  disconnect(): Promise<void>;
  query(
    sql: string,
    params: Record<string, unknown>,
    options: QueryExecutionOptions
  ): Promise<SqlQueryResult>;
  test(): Promise<{ success: boolean; message?: string }>;
}
