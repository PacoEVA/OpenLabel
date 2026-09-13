import { DataSourceType } from './datasource.schema';
import { Dataset } from './dataset.schema';

export interface FetchOptions {
  limit?: number;
  offset?: number;
  abortSignal?: AbortSignal;
}

export interface DataSourceTestResult {
  success: boolean;
  message?: string;
  rowCount?: number;
}

/**
 * Standard protocol-agnostic contract for all data source adapters (CSV, Excel, SQL, REST).
 */
export interface DataSourceAdapter {
  readonly type: DataSourceType;

  /**
   * Tests connectivity, file presence, or endpoint accessibility without pulling entire dataset.
   */
  testConnection(abortSignal?: AbortSignal): Promise<DataSourceTestResult>;

  /**
   * Loads a truncated preview of the dataset (typically 100 rows) with column descriptors.
   */
  fetchPreview(limit?: number, abortSignal?: AbortSignal): Promise<Dataset>;

  /**
   * Loads the full dataset up to the configured safety limit (e.g. 10,000 rows).
   */
  fetchAll(options?: FetchOptions): Promise<Dataset>;
}
