import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CsvDataSourceAdapter } from '../../../src/main/data-sources/adapters/csv.adapter';

describe('CsvDataSourceAdapter (Bloque 4)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-csv-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('parses standard comma-delimited CSV with headers', async () => {
    const csvContent = 'id,name,price\n1,Tornillo,0.15\n2,Tuerca,0.08\n';
    const filePath = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(filePath, csvContent, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const testRes = await adapter.testConnection();
    expect(testRes.success).toBe(true);

    const dataset = await adapter.fetchPreview();
    expect(dataset.columns).toHaveLength(3);
    expect(dataset.columns.map((c) => c.key)).toEqual(['id', 'name', 'price']);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]).toEqual({ id: '1', name: 'Tornillo', price: '0.15' });
    expect(dataset.truncated).toBe(false);
  });

  it('parses semicolon and tab delimiters', async () => {
    const semiContent = 'sku;desc;qty\nSKU1;Item A;10\nSKU2;Item B;20\n';
    const semiFile = path.join(tmpDir, 'semi.csv');
    fs.writeFileSync(semiFile, semiContent, 'utf8');

    const semiAdapter = new CsvDataSourceAdapter({
      filePath: semiFile,
      delimiter: ';',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });
    const semiDataset = await semiAdapter.fetchPreview();
    expect(semiDataset.columns.map((c) => c.key)).toEqual(['sku', 'desc', 'qty']);
    expect(semiDataset.rows[0].sku).toBe('SKU1');

    const tabContent = 'code\tlabel\nC1\tAlpha\nC2\tBeta\n';
    const tabFile = path.join(tmpDir, 'tab.csv');
    fs.writeFileSync(tabFile, tabContent, 'utf8');

    const tabAdapter = new CsvDataSourceAdapter({
      filePath: tabFile,
      delimiter: '\t',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });
    const tabDataset = await tabAdapter.fetchPreview();
    expect(tabDataset.columns.map((c) => c.key)).toEqual(['code', 'label']);
    expect(tabDataset.rows[0].label).toBe('Alpha');
  });

  it('handles quoted values containing commas and internal quotes', async () => {
    const quotedContent = 'id,description,category\n1,"Tornillo, Cabeza Hexagonal, 5mm",Ferretería\n2,"Tuerca ""M5"" zincada",Fijación\n';
    const filePath = path.join(tmpDir, 'quoted.csv');
    fs.writeFileSync(filePath, quotedContent, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows[0].description).toBe('Tornillo, Cabeza Hexagonal, 5mm');
    expect(dataset.rows[1].description).toBe('Tuerca "M5" zincada');
  });

  it('handles multiline fields cleanly inside quotes', async () => {
    const multilineContent = 'id,notes\n1,"Line 1\nLine 2\nLine 3"\n2,"Simple Note"\n';
    const filePath = path.join(tmpDir, 'multiline.csv');
    fs.writeFileSync(filePath, multilineContent, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows[0].notes).toBe('Line 1\nLine 2\nLine 3');
    expect(dataset.rows[1].notes).toBe('Simple Note');
  });

  it('generates column_1, column_2, ... when hasHeader is false', async () => {
    const noHeaderContent = 'ValA,ValB,ValC\nValD,ValE,ValF\n';
    const filePath = path.join(tmpDir, 'noheader.csv');
    fs.writeFileSync(filePath, noHeaderContent, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: false,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.columns.map((c) => c.key)).toEqual(['column_1', 'column_2', 'column_3']);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]).toEqual({
      column_1: 'ValA',
      column_2: 'ValB',
      column_3: 'ValC',
    });
  });

  it('handles UTF-8 with BOM and accents', async () => {
    const bomUtf8 = '\uFEFFartículo,descripción,precio\nCAFÉ,Café de Colombia,4.50€\n';
    const filePath = path.join(tmpDir, 'utf8.csv');
    fs.writeFileSync(filePath, bomUtf8, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.columns[0].key).toBe('artículo');
    expect(dataset.rows[0].artículo).toBe('CAFÉ');
    expect(dataset.rows[0].descripción).toBe('Café de Colombia');
    expect(dataset.rows[0].precio).toBe('4.50€');
  });

  it('enforces row limits and sets truncated: true', async () => {
    let content = 'num,text\n';
    for (let i = 1; i <= 20; i++) {
      content += `${i},Row ${i}\n`;
    }
    const filePath = path.join(tmpDir, 'limit.csv');
    fs.writeFileSync(filePath, content, 'utf8');

    const adapter = new CsvDataSourceAdapter({
      filePath,
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const preview = await adapter.fetchPreview(5);
    expect(preview.rows).toHaveLength(5);
    expect(preview.truncated).toBe(true);
  });

  it('reports failure when CSV file does not exist', async () => {
    const adapter = new CsvDataSourceAdapter({
      filePath: path.join(tmpDir, 'ghost.csv'),
      delimiter: ',',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    });

    const testRes = await adapter.testConnection();
    expect(testRes.success).toBe(false);
    expect(testRes.message).toContain('not found');

    await expect(adapter.fetchPreview()).rejects.toThrow(/not found/);
  });
});
