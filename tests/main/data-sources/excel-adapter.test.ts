import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { ExcelDataSourceAdapter } from '../../../src/main/data-sources/adapters/excel.adapter';

describe('ExcelDataSourceAdapter (Bloque 5)', () => {
  let tmpDir: string;
  let sampleXlsxPath: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-excel-test-'));
    sampleXlsxPath = path.join(tmpDir, 'test_workbook.xlsx');

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Products
    const sheet1 = workbook.addWorksheet('Products');
    sheet1.addRow(['sku', 'product_name', 'price', 'quantity', 'created_at', 'total']);
    sheet1.addRow([
      'SKU-100',
      'Tornillo Acero 5mm',
      0.25,
      100,
      new Date('2026-01-15T08:00:00Z'),
      { formula: 'C2*D2', result: 25 },
    ]);
    sheet1.addRow([
      'SKU-200',
      'Tuerca Hexagonal',
      0.1,
      null, // empty cell
      new Date('2026-02-01T10:00:00Z'),
      { formula: 'C3*D3', result: 0 },
    ]);

    // Sheet 2: Customers
    const sheet2 = workbook.addWorksheet('Customers');
    sheet2.addRow(['id', 'customer_name', 'active']);
    sheet2.addRow([1, 'Acme Corp', true]);
    sheet2.addRow([2, 'Industrial Supplies Ltd', false]);

    await workbook.xlsx.writeFile(sampleXlsxPath);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('lists sheets in the workbook', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      headerRow: 1,
    });

    const sheets = await adapter.listSheets();
    expect(sheets).toEqual(['Products', 'Customers']);
  });

  it('tests connection successfully when file and sheet exist', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      sheetName: 'Products',
      headerRow: 1,
    });

    const testRes = await adapter.testConnection();
    expect(testRes.success).toBe(true);
    expect(testRes.message).toContain('Products');
  });

  it('reports error when sheet does not exist in workbook', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      sheetName: 'NonExistentSheet',
      headerRow: 1,
    });

    const testRes = await adapter.testConnection();
    expect(testRes.success).toBe(false);
    expect(testRes.message).toContain('not found in workbook');
  });

  it('parses rows, numbers, dates, empty cells, and formula results from selected sheet', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      sheetName: 'Products',
      headerRow: 1,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.columns.map((c) => c.key)).toEqual([
      'sku',
      'product_name',
      'price',
      'quantity',
      'created_at',
      'total',
    ]);
    expect(dataset.rows).toHaveLength(2);

    const row1 = dataset.rows[0];
    expect(row1.sku).toBe('SKU-100');
    expect(row1.product_name).toBe('Tornillo Acero 5mm');
    expect(row1.price).toBe(0.25);
    expect(row1.quantity).toBe(100);
    expect(row1.created_at).toBeInstanceOf(Date);
    expect(row1.total).toBe(25); // formula result evaluated

    const row2 = dataset.rows[1];
    expect(row2.quantity).toBeNull(); // empty cell
  });

  it('selects second sheet cleanly', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      sheetName: 'Customers',
      headerRow: 1,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.columns.map((c) => c.key)).toEqual(['id', 'customer_name', 'active']);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]).toEqual({
      id: 1,
      customer_name: 'Acme Corp',
      active: true,
    });
  });

  it('respects row limits and flags truncated', async () => {
    const adapter = new ExcelDataSourceAdapter({
      filePath: sampleXlsxPath,
      sheetName: 'Products',
      headerRow: 1,
    });

    const dataset = await adapter.fetchPreview(1);
    expect(dataset.rows).toHaveLength(1);
    expect(dataset.truncated).toBe(true);
  });
});
