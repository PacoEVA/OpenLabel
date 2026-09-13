/**
 * Centralized operational limits for external data sources.
 */
export const DATA_SOURCE_LIMITS = {
  /** Maximum number of rows returned for UI preview */
  DEFAULT_PREVIEW_ROWS: 100,

  /** Maximum number of rows fetched for document resolution / batch printing */
  MAX_FETCH_ROWS: 10000,

  /** Maximum allowed file size for CSV and Excel files (50 MB) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,

  /** Maximum allowed response size for REST API endpoints (20 MB) */
  MAX_REST_RESPONSE_BYTES: 20 * 1024 * 1024,

  /** Default and maximum SQL query timeouts */
  DEFAULT_SQL_TIMEOUT_MS: 30000,
  MAX_SQL_TIMEOUT_MS: 120000,

  /** Default and maximum REST request timeouts */
  DEFAULT_REST_TIMEOUT_MS: 10000,
  MAX_REST_TIMEOUT_MS: 60000,
} as const;
