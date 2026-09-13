import { describe, it, expect } from 'vitest';
import {
  ExternalDataSourceSchema,
  CsvDataSourceSchema,
  ExcelDataSourceSchema,
  SqlDataSourceSchema,
  RestDataSourceSchema,
} from '../../../src/core/data-sources';

describe('ExternalDataSource Schemas (Bloque 2)', () => {
  const sampleId = '11111111-1111-4111-8111-111111111111';
  const sampleCredRef = '22222222-2222-4222-8222-222222222222';

  describe('CSV Data Source Schema', () => {
    it('validates a correct CSV source configuration', () => {
      const csv = {
        id: sampleId,
        name: 'Inventory CSV',
        type: 'csv' as const,
        enabled: true,
        config: {
          filePath: '/data/inventory.csv',
          delimiter: ';' as const,
          hasHeader: true,
          encoding: 'utf-8' as const,
          skipEmptyLines: true,
        },
      };

      const parsed = CsvDataSourceSchema.parse(csv);
      expect(parsed.config.delimiter).toBe(';');
      expect(ExternalDataSourceSchema.parse(csv).type).toBe('csv');
    });

    it('rejects empty file path or invalid delimiter', () => {
      expect(() =>
        CsvDataSourceSchema.parse({
          id: sampleId,
          name: 'Invalid CSV',
          type: 'csv',
          config: { filePath: '', delimiter: ',' },
        })
      ).toThrow();

      expect(() =>
        CsvDataSourceSchema.parse({
          id: sampleId,
          name: 'Invalid Delim',
          type: 'csv',
          config: { filePath: 'test.csv', delimiter: '?' },
        })
      ).toThrow();
    });
  });

  describe('Excel Data Source Schema', () => {
    it('validates a correct Excel source configuration', () => {
      const excel = {
        id: sampleId,
        name: 'Price List XLSX',
        type: 'excel' as const,
        enabled: true,
        config: {
          filePath: 'C:/data/prices.xlsx',
          sheetName: 'Sheet1',
          headerRow: 1,
        },
      };

      const parsed = ExcelDataSourceSchema.parse(excel);
      expect(parsed.config.sheetName).toBe('Sheet1');
      expect(ExternalDataSourceSchema.parse(excel).type).toBe('excel');
    });

    it('rejects headerRow < 1', () => {
      expect(() =>
        ExcelDataSourceSchema.parse({
          id: sampleId,
          name: 'Invalid Excel',
          type: 'excel',
          config: {
            filePath: 'prices.xlsx',
            headerRow: 0,
          },
        })
      ).toThrow();
    });
  });

  describe('SQL Data Source Schema', () => {
    it('validates a SQL Server source in table mode', () => {
      const sql = {
        id: sampleId,
        name: 'ERP SQL Server',
        type: 'sql' as const,
        enabled: true,
        config: {
          engine: 'mssql' as const,
          host: 'db.internal',
          port: 1433,
          database: 'ProductionDB',
          username: 'label_reader',
          credentialRef: sampleCredRef,
          queryMode: 'table' as const,
          tableName: 'Products',
          timeoutMs: 15000,
        },
      };

      const parsed = SqlDataSourceSchema.parse(sql);
      expect(parsed.config.credentialRef).toBe(sampleCredRef);
      expect(ExternalDataSourceSchema.parse(sql).type).toBe('sql');
    });

    it('validates a SQL source in custom_select mode', () => {
      const sql = {
        id: sampleId,
        name: 'Custom Query SQL',
        type: 'sql' as const,
        config: {
          engine: 'postgres' as const,
          host: 'postgres.internal',
          port: 5432,
          database: 'warehouse',
          username: 'reporter',
          queryMode: 'custom_select' as const,
          customQuery: 'SELECT id, sku, description FROM items WHERE active = 1',
        },
      };

      const parsed = SqlDataSourceSchema.parse(sql);
      expect(parsed.config.customQuery).toBeDefined();
    });

    it('rejects missing tableName in table mode', () => {
      expect(() =>
        SqlDataSourceSchema.parse({
          id: sampleId,
          name: 'Incomplete SQL',
          type: 'sql',
          config: {
            host: 'db.internal',
            database: 'db',
            username: 'user',
            queryMode: 'table',
            tableName: '',
          },
        })
      ).toThrow();
    });

    it('rejects invalid port ranges', () => {
      expect(() =>
        SqlDataSourceSchema.parse({
          id: sampleId,
          name: 'Bad Port SQL',
          type: 'sql',
          config: {
            host: 'db.internal',
            port: 70000,
            database: 'db',
            username: 'user',
            queryMode: 'table',
            tableName: 'test',
          },
        })
      ).toThrow();
    });
  });

  describe('REST Data Source Schema', () => {
    it('validates a correct REST source configuration', () => {
      const rest = {
        id: sampleId,
        name: 'Product Catalog API',
        type: 'rest' as const,
        enabled: true,
        config: {
          url: 'https://api.example.com/v1/products',
          method: 'GET' as const,
          headers: [{ name: 'Accept', value: 'application/json' }],
          credentialRef: sampleCredRef,
          dataPath: 'data.items',
          timeoutMs: 5000,
        },
      };

      const parsed = RestDataSourceSchema.parse(rest);
      expect(parsed.config.url).toBe('https://api.example.com/v1/products');
      expect(ExternalDataSourceSchema.parse(rest).type).toBe('rest');
    });

    it('rejects unsafe URL protocols such as file:, javascript:, or ftp:', () => {
      const unsafeProtocols = [
        'file:///etc/passwd',
        'javascript:alert(1)',
        'ftp://ftp.example.com/data.json',
      ];

      for (const url of unsafeProtocols) {
        expect(() =>
          RestDataSourceSchema.parse({
            id: sampleId,
            name: 'Unsafe REST',
            type: 'rest',
            config: { url },
          })
        ).toThrow();
      }
    });

    it('rejects timeoutMs < 1000 or > 60000', () => {
      expect(() =>
        RestDataSourceSchema.parse({
          id: sampleId,
          name: 'Invalid Timeout',
          type: 'rest',
          config: {
            url: 'https://api.example.com/items',
            timeoutMs: 200,
          },
        })
      ).toThrow();
    });
  });
});
