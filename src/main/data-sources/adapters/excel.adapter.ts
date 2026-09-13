import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {
  DataSourceAdapter,
  DataSourceTestResult,
  FetchOptions,
  Dataset,
  DatasetColumn,
  DatasetRow,
  ExcelDataSourceConfig,
  DATA_SOURCE_LIMITS,
  inferColumnType,
} from '../../../core/data-sources';

export class ExcelDataSourceAdapter implements DataSourceAdapter {
  readonly type = 'excel' as const;

  constructor(public readonly config: ExcelDataSourceConfig) {}

  async listSheets(): Promise<string[]> {
    if (!fs.existsSync(this.config.filePath)) {
      throw new Error(`Excel file not found: ${this.config.filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.config.filePath);
    return workbook.worksheets.map((ws) => ws.name);
  }

  async testConnection(abortSignal?: AbortSignal): Promise<DataSourceTestResult> {
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    if (!fs.existsSync(this.config.filePath)) {
      return {
        success: false,
        message: `Excel file not found: ${this.config.filePath}`,
      };
    }

    try {
      const stats = fs.statSync(this.config.filePath);
      if (stats.size > DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          message: `Excel file exceeds maximum size of ${DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        };
      }

      const sheets = await this.listSheets();
      if (sheets.length === 0) {
        return {
          success: false,
          message: 'Excel workbook contains no sheets',
        };
      }

      if (this.config.sheetName && !sheets.includes(this.config.sheetName)) {
        return {
          success: false,
          message: `Sheet '${this.config.sheetName}' not found in workbook (available: ${sheets.join(', ')})`,
        };
      }

      return {
        success: true,
        message: this.config.sheetName
          ? `Excel file valid with sheet '${this.config.sheetName}' (${sheets.length} total sheets)`
          : `Excel file valid with ${sheets.length} sheet(s)`,
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
      throw new Error(`Excel file not found: ${this.config.filePath}`);
    }

    const stats = fs.statSync(this.config.filePath);
    if (stats.size > DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `Excel file exceeds maximum size of ${DATA_SOURCE_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.config.filePath);

    if (abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }

    let worksheet: ExcelJS.Worksheet | undefined;
    if (this.config.sheetName) {
      worksheet = workbook.getWorksheet(this.config.sheetName);
      if (!worksheet) {
        throw new Error(`Sheet '${this.config.sheetName}' not found in Excel workbook`);
      }
    } else {
      worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel workbook contains no worksheets');
      }
    }

    const headerRowNumber = this.config.headerRow || 1;
    const headerRow = worksheet.getRow(headerRowNumber);

    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = this.extractCellValue(cell.value);
      const str = raw !== null && raw !== undefined ? String(raw).trim() : '';
      headers[colNumber - 1] = str !== '' ? str : `column_${colNumber}`;
    });

    if (headers.length === 0) {
      return {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      };
    }

    const rows: DatasetRow[] = [];
    const totalRowCount = Math.max(0, worksheet.rowCount - headerRowNumber);
    let truncated = false;

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      if (abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }

      if (rows.length >= limit) {
        truncated = true;
        break;
      }

      const row = worksheet.getRow(r);
      // Check if entire row is empty
      if (!row.hasValues) {
        continue;
      }

      const rowObj: DatasetRow = {};
      let rowHasNonEmptyCell = false;

      headers.forEach((headerKey, idx) => {
        const colNum = idx + 1;
        const cell = row.getCell(colNum);
        const cellValue = this.extractCellValue(cell.value);
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          rowHasNonEmptyCell = true;
        }
        rowObj[headerKey] = cellValue;
      });

      if (rowHasNonEmptyCell) {
        rows.push(rowObj);
      }
    }

    const columns: DatasetColumn[] = headers.map((header) => {
      const sampleValues = rows.map((r) => r[header]);
      return {
        key: header,
        label: header,
        inferredType: inferColumnType(sampleValues),
      };
    });

    return {
      columns,
      rows,
      totalRows: totalRowCount,
      truncated,
    };
  }

  private extractCellValue(value: ExcelJS.CellValue): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    // Formula cell: { formula: string, result: unknown }
    if (typeof value === 'object' && 'formula' in value) {
      const formulaVal = value as ExcelJS.CellFormulaValue;
      return formulaVal.result !== undefined ? formulaVal.result : null;
    }

    // Shared string or rich text: { richText: [{ text: string }] }
    if (typeof value === 'object' && 'richText' in value) {
      const richTextVal = value as ExcelJS.CellRichTextValue;
      return richTextVal.richText.map((rt) => rt.text).join('');
    }

    // Hyperlink cell: { text: string, hyperlink: string }
    if (typeof value === 'object' && 'hyperlink' in value) {
      const hyperlinkVal = value as ExcelJS.CellHyperlinkValue;
      return hyperlinkVal.text || hyperlinkVal.hyperlink;
    }

    // Date object
    if (value instanceof Date) {
      return value;
    }

    return value;
  }
}
