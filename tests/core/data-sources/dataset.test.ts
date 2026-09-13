import { describe, it, expect } from 'vitest';
import {
  DatasetSchema,
  DatasetColumnSchema,
  Dataset,
  inferColumnType,
} from '../../../src/core/data-sources';

describe('Dataset Schemas and Type Inference', () => {
  describe('DatasetColumnSchema', () => {
    it('validates a correct column descriptor', () => {
      const col = {
        key: 'prod_sku',
        label: 'Product SKU',
        inferredType: 'string' as const,
      };
      const parsed = DatasetColumnSchema.parse(col);
      expect(parsed).toEqual(col);
    });

    it('rejects empty key or label', () => {
      expect(() =>
        DatasetColumnSchema.parse({
          key: '',
          label: 'Valid',
          inferredType: 'string',
        })
      ).toThrow();

      expect(() =>
        DatasetColumnSchema.parse({
          key: 'valid_key',
          label: '',
          inferredType: 'string',
        })
      ).toThrow();
    });

    it('supports all required column types', () => {
      const types = ['string', 'number', 'boolean', 'date', 'null', 'mixed'] as const;
      for (const t of types) {
        const col = { key: 'test', label: 'Test', inferredType: t };
        expect(DatasetColumnSchema.parse(col).inferredType).toBe(t);
      }
    });
  });

  describe('DatasetSchema', () => {
    it('validates a complete, valid tabular dataset', () => {
      const validDataset: Dataset = {
        columns: [
          { key: 'id', label: 'ID', inferredType: 'number' },
          { key: 'name', label: 'Name', inferredType: 'string' },
          { key: 'active', label: 'Active', inferredType: 'boolean' },
        ],
        rows: [
          { id: 1, name: 'Tornillo M4', active: true },
          { id: 2, name: 'Tuerca M4', active: false },
        ],
        totalRows: 2,
        truncated: false,
      };

      const parsed = DatasetSchema.parse(validDataset);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.totalRows).toBe(2);
      expect(parsed.truncated).toBe(false);
    });

    it('validates a truncated dataset preview', () => {
      const truncatedDataset: Dataset = {
        columns: [{ key: 'sku', label: 'SKU', inferredType: 'string' }],
        rows: [{ sku: 'SKU-001' }, { sku: 'SKU-002' }],
        totalRows: 5000,
        truncated: true,
      };

      const parsed = DatasetSchema.parse(truncatedDataset);
      expect(parsed.truncated).toBe(true);
      expect(parsed.totalRows).toBe(5000);
      expect(parsed.rows.length).toBe(2);
    });

    it('rejects negative totalRows', () => {
      expect(() =>
        DatasetSchema.parse({
          columns: [],
          rows: [],
          totalRows: -10,
          truncated: false,
        })
      ).toThrow();
    });
  });

  describe('inferColumnType', () => {
    it('infers null when all values are null, undefined or empty string', () => {
      expect(inferColumnType([null, undefined, ''])).toBe('null');
      expect(inferColumnType([])).toBe('null');
    });

    it('infers number for numeric arrays', () => {
      expect(inferColumnType([10, 20.5, -3, 0])).toBe('number');
      expect(inferColumnType([null, 42, undefined])).toBe('number');
    });

    it('infers boolean for boolean arrays', () => {
      expect(inferColumnType([true, false, true])).toBe('boolean');
      expect(inferColumnType([false, null, true])).toBe('boolean');
    });

    it('infers date for genuine Date objects', () => {
      expect(inferColumnType([new Date(2025, 0, 1), new Date(2025, 1, 1)])).toBe('date');
    });

    it('infers string for text and NEVER guesses ambiguous date strings as dates', () => {
      // Ambiguous date string must remain string!
      expect(inferColumnType(['01/02/03', '04/05/06'])).toBe('string');
      expect(inferColumnType(['2025-01-01', '2025-02-01'])).toBe('string');
      expect(inferColumnType(['hello', 'world'])).toBe('string');
    });

    it('infers mixed when values have conflicting types', () => {
      expect(inferColumnType([123, 'hello'])).toBe('mixed');
      expect(inferColumnType([true, 42])).toBe('mixed');
      expect(inferColumnType([new Date(), 'not-a-date'])).toBe('mixed');
    });
  });
});
