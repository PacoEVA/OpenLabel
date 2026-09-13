import {
  DataSourceAdapter,
  DataSourceTestResult,
  FetchOptions,
  Dataset,
  DatasetColumn,
  SqlDataSourceConfig,
  DATA_SOURCE_LIMITS,
  inferColumnType,
} from '../../../core/data-sources';
import { SqlDriver } from './sql/sql-driver.interface';
import { TediousMssqlDriver } from './sql/tedious-mssql.driver';
import {
  validateReadOnlyQuery,
  escapeSqlIdentifier,
  sanitizeSqlErrorMessage,
} from './sql/sql-sanitizer';

export class SqlDataSourceAdapter implements DataSourceAdapter {
  readonly type = 'sql' as const;
  private readonly driver: SqlDriver;

  constructor(
    public readonly config: SqlDataSourceConfig,
    driver?: SqlDriver,
    private readonly secret: string | null = null
  ) {
    this.driver = driver || new TediousMssqlDriver();
  }

  async testConnection(abortSignal?: AbortSignal): Promise<DataSourceTestResult> {
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      await this.driver.connect(this.config, this.secret);
      const testRes = await this.driver.test();
      return testRes;
    } catch (err: unknown) {
      return {
        success: false,
        message: sanitizeSqlErrorMessage(err, this.secret),
      };
    } finally {
      await this.driver.disconnect();
    }
  }

  async fetchPreview(
    limit: number = DATA_SOURCE_LIMITS.DEFAULT_PREVIEW_ROWS,
    abortSignal?: AbortSignal
  ): Promise<Dataset> {
    return this.fetchAll({ limit, abortSignal });
  }

  async fetchAll(options: FetchOptions = {}): Promise<Dataset> {
    const limit = Math.min(
      options.limit ?? DATA_SOURCE_LIMITS.MAX_FETCH_ROWS,
      DATA_SOURCE_LIMITS.MAX_FETCH_ROWS
    );

    if (options.abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      await this.driver.connect(this.config, this.secret);

      let querySql: string;

      if (this.config.queryMode === 'table') {
        if (!this.config.tableName) {
          throw new Error('Table name is required in table query mode');
        }
        const escapedTable = escapeSqlIdentifier(this.config.tableName, this.config.engine);
        querySql = `SELECT * FROM ${escapedTable}`;
      } else {
        if (!this.config.customQuery) {
          throw new Error('Custom query string is required in custom_select mode');
        }
        const validation = validateReadOnlyQuery(this.config.customQuery);
        if (!validation.valid) {
          throw new Error(`Invalid SQL Query: ${validation.error}`);
        }
        querySql = this.config.customQuery;
      }

      const queryResult = await this.driver.query(querySql, {}, {
        timeoutMs: this.config.timeoutMs || DATA_SOURCE_LIMITS.DEFAULT_SQL_TIMEOUT_MS,
        rowLimit: limit,
        abortSignal: options.abortSignal,
      });

      const columns: DatasetColumn[] = queryResult.columns.map((colName) => {
        const sampleValues = queryResult.rows.map((r) => r[colName]);
        return {
          key: colName,
          label: colName,
          inferredType: inferColumnType(sampleValues),
        };
      });

      const truncated = queryResult.rows.length >= limit;

      return {
        columns,
        rows: queryResult.rows,
        totalRows: queryResult.totalRows ?? queryResult.rows.length,
        truncated,
      };
    } catch (err: unknown) {
      throw new Error(sanitizeSqlErrorMessage(err, this.secret));
    } finally {
      await this.driver.disconnect();
    }
  }
}
