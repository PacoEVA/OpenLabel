import {
  DataSourceAdapter,
  DataSourceTestResult,
  FetchOptions,
  Dataset,
  DatasetColumn,
  DatasetRow,
  RestDataSourceConfig,
  RestDataSourceConfigInput,
  RestDataSourceConfigSchema,
  DATA_SOURCE_LIMITS,
  inferColumnType,
} from '../../../core/data-sources';
import { flattenNestedRecord } from './rest/object-flattener';

export class RestDataSourceAdapter implements DataSourceAdapter {
  readonly type = 'rest' as const;

  public readonly config: RestDataSourceConfig;

  constructor(
    config: RestDataSourceConfigInput,
    private readonly secret: string | null = null
  ) {
    this.config = RestDataSourceConfigSchema.parse(config);
  }

  private validateUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid REST URL: ${rawUrl}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Forbidden protocol '${parsed.protocol}'. REST adapter only allows http: and https: protocols.`
      );
    }

    return parsed;
  }

  async testConnection(abortSignal?: AbortSignal): Promise<DataSourceTestResult> {
    try {
      this.validateUrl(this.config.url);
      const dataset = await this.fetchPreview(1, abortSignal);
      return {
        success: true,
        message: `Endpoint reachable. Discovered ${dataset.columns.length} column(s).`,
        rowCount: dataset.totalRows,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: this.sanitizeError(err),
      };
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

    const targetUrl = this.validateUrl(this.config.url);

    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs || DATA_SOURCE_LIMITS.DEFAULT_REST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(new Error(`REST request timed out after ${timeoutMs}ms`)), timeoutMs);

    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => controller.abort(new Error('Operation aborted')));
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      // Non-sensitive configured headers
      if (this.config.headers) {
        for (const h of this.config.headers) {
          headers[h.name] = h.value;
        }
      }

      // Inject secure credential if configured
      if (this.secret) {
        if (this.secret.toLowerCase().startsWith('bearer ')) {
          headers['Authorization'] = this.secret;
        } else if (this.secret.includes(':')) {
          headers['Authorization'] = `Basic ${Buffer.from(this.secret).toString('base64')}`;
        } else {
          headers['Authorization'] = `Bearer ${this.secret}`;
        }
      }

      const requestInit: RequestInit = {
        method: this.config.method,
        headers,
        signal: controller.signal,
      };

      if (this.config.method === 'POST') {
        headers['Content-Type'] = 'application/json';
        requestInit.body = this.config.body || '{}';
      }

      const response = await fetch(targetUrl.toString(), requestInit);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > DATA_SOURCE_LIMITS.MAX_REST_RESPONSE_BYTES) {
        throw new Error(
          `REST response exceeds maximum size of ${DATA_SOURCE_LIMITS.MAX_REST_RESPONSE_BYTES / (1024 * 1024)} MB`
        );
      }

      const text = await response.text();
      if (text.length > DATA_SOURCE_LIMITS.MAX_REST_RESPONSE_BYTES) {
        throw new Error(
          `REST response exceeds maximum size of ${DATA_SOURCE_LIMITS.MAX_REST_RESPONSE_BYTES / (1024 * 1024)} MB`
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error('REST endpoint response is not valid JSON');
      }

      const records = this.extractRecords(parsedJson, this.config.dataPath);
      const totalRows = records.length;
      const truncated = totalRows > limit;
      const sliced = records.slice(0, limit);

      // Controlled flattening of nested objects
      const flattenedRows: DatasetRow[] = sliced.map((rec) => flattenNestedRecord(rec));

      // Build column metadata
      const columnKeysSet = new Set<string>();
      for (const row of flattenedRows) {
        for (const k of Object.keys(row)) {
          columnKeysSet.add(k);
        }
      }

      const columns: DatasetColumn[] = Array.from(columnKeysSet).map((key) => {
        const sampleValues = flattenedRows.map((r) => r[key]);
        return {
          key,
          label: key,
          inferredType: inferColumnType(sampleValues),
        };
      });

      return {
        columns,
        rows: flattenedRows,
        totalRows,
        truncated,
      };
    } catch (err: unknown) {
      throw new Error(this.sanitizeError(err));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractRecords(data: unknown, dataPath?: string): Record<string, unknown>[] {
    let current: unknown = data;

    if (dataPath && dataPath.trim() !== '') {
      const parts = dataPath.split('.');
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          throw new Error(`Configured dataPath '${dataPath}' could not be resolved in JSON response`);
        }
      }
    }

    if (Array.isArray(current)) {
      return current.map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return item as Record<string, unknown>;
        }
        return { value: item };
      });
    }

    if (current && typeof current === 'object') {
      return [current as Record<string, unknown>];
    }

    throw new Error('Resolved REST response is neither an array of records nor an object');
  }

  private sanitizeError(error: unknown): string {
    let msg = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && 'cause' in error && error.cause) {
      msg += `: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
    }
    if (this.secret) {
      msg = msg.split(this.secret).join('******');
    }
    return msg;
  }
}
