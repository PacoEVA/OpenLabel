import fs from 'node:fs';
import { parse } from 'csv-parse';
import {
  DataSourceAdapter,
  DataSourceTestResult,
  FetchOptions,
  Dataset,
  DatasetColumn,
  DatasetRow,
  CsvDataSourceConfig,
  DATA_SOURCE_LIMITS,
  inferColumnType,
} from '../../../core/data-sources';

export class CsvDataSourceAdapter implements DataSourceAdapter {
  readonly type = 'csv' as const;

  constructor(public readonly config: CsvDataSourceConfig) {}

  async testConnection(abortSignal?: AbortSignal): Promise<DataSourceTestResult> {
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    if (!fs.existsSync(this.config.filePath)) {
      return {
        success: false,
        message: `CSV file not found: ${this.config.filePath}`,
      };
    }

    try {
      const stats = fs.statSync(this.config.filePath);
      if (stats.size > DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          message: `CSV file exceeds maximum size limit of ${DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        };
      }

      // Quick read of first few bytes to check readability
      const fd = fs.openSync(this.config.filePath, 'r');
      const buf = Buffer.alloc(1024);
      fs.readSync(fd, buf, 0, 1024, 0);
      fs.closeSync(fd);

      return {
        success: true,
        message: 'CSV file is readable',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
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
    const { limit = DATA_SOURCE_LIMITS.MAX_FETCH_ROWS, abortSignal } = options;

    if (abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    if (!fs.existsSync(this.config.filePath)) {
      throw new Error(`CSV file not found: ${this.config.filePath}`);
    }

    const stats = fs.statSync(this.config.filePath);
    if (stats.size > DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `CSV file exceeds maximum size of ${DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(this.config.filePath, {
        encoding: this.config.encoding === 'latin1' ? 'latin1' : 'utf8',
      });

      const parser = parse({
        delimiter: this.config.delimiter,
        skip_empty_lines: this.config.skipEmptyLines,
        bom: true,
        relax_column_count: true,
      });

      let headers: string[] = [];
      let isFirstRow = true;
      const rows: DatasetRow[] = [];
      let totalRowsRead = 0;
      let truncated = false;

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          fileStream.destroy();
          parser.destroy();
          reject(new Error('Operation aborted'));
        });
      }

      parser.on('readable', () => {
        let record: string[] | null;
        while ((record = parser.read()) !== null) {
          if (abortSignal?.aborted) {
            fileStream.destroy();
            parser.destroy();
            return;
          }

          if (isFirstRow) {
            isFirstRow = false;
            if (this.config.hasHeader) {
              headers = record.map((h, idx) => {
                const trimmed = h.trim();
                return trimmed !== '' ? trimmed : `column_${idx + 1}`;
              });
              continue;
            } else {
              // Generate headers column_1, column_2, ...
              headers = record.map((_, idx) => `column_${idx + 1}`);
            }
          }

          totalRowsRead++;

          if (rows.length < limit) {
            const rowObj: DatasetRow = {};
            record.forEach((val, colIdx) => {
              const colKey = headers[colIdx] || `column_${colIdx + 1}`;
              rowObj[colKey] = val;
            });
            rows.push(rowObj);
          } else {
            truncated = true;
            // Early stop when previewing large files
            fileStream.destroy();
            parser.destroy();
            break;
          }
        }
      });

      parser.on('error', (err) => {
        fileStream.destroy();
        reject(err);
      });

      const finish = () => {
        // If file had no records at all
        if (headers.length === 0) {
          return resolve({
            columns: [],
            rows: [],
            totalRows: 0,
            truncated: false,
          });
        }

        // Build columns metadata and infer types
        const columns: DatasetColumn[] = headers.map((header) => {
          const sampleValues = rows.map((r) => r[header]);
          const inferred = inferColumnType(sampleValues);
          return {
            key: header,
            label: header,
            inferredType: inferred,
          };
        });

        resolve({
          columns,
          rows,
          totalRows: totalRowsRead,
          truncated,
        });
      };

      parser.on('end', finish);
      parser.on('close', finish);

      fileStream.pipe(parser);
    });
  }
}
