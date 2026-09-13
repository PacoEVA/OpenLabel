import { describe, it, expect } from 'vitest';
import {
  FieldMappingSchema,
  FieldMapping,
  validateFieldMapping,
  applyMappingToRow,
  Dataset,
} from '../../../src/core/data-sources';
import { DataField } from '../../../src/core/data';

describe('FieldMapping and Validation', () => {
  const field1Id = '11111111-1111-4111-8111-111111111111';
  const field2Id = '22222222-2222-4222-8222-222222222222';
  const field3Id = '33333333-3333-4333-8333-333333333333';

  const mockDataFields: DataField[] = [
    {
      id: field1Id,
      name: 'product_name',
      type: 'input',
      required: true,
    },
    {
      id: field2Id,
      name: 'lot_number',
      type: 'input',
      required: true,
      defaultValue: 'LOT-DEFAULT',
    },
    {
      id: field3Id,
      name: 'ean_code',
      type: 'input',
      required: false,
    },
  ];

  const mockDataset: Dataset = {
    columns: [
      { key: 'col_prod', label: 'Producto', inferredType: 'string' },
      { key: 'col_lote', label: 'Lote', inferredType: 'number' },
      { key: 'col_ean', label: 'EAN', inferredType: 'string' },
    ],
    rows: [
      { col_prod: 'Tornillo 5mm', col_lote: 45001, col_ean: '8412345678901' },
      { col_prod: 'Tuerca 5mm', col_lote: null, col_ean: '8412345678902' },
    ],
    totalRows: 2,
    truncated: false,
  };

  describe('FieldMappingSchema', () => {
    it('validates a correct mapping collection', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'col_prod',
            nullHandling: 'default',
          },
          {
            dataFieldId: field2Id,
            dataFieldName: 'lot_number',
            sourceColumnKey: 'col_lote',
            nullHandling: 'default',
          },
        ],
      };

      const parsed = FieldMappingSchema.parse(mapping);
      expect(parsed.rules.length).toBe(2);
    });

    it('rejects duplicate mappings targeting the same field ID', () => {
      const duplicateIdMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'field_a',
            sourceColumnKey: 'col_1',
            nullHandling: 'default' as const,
          },
          {
            dataFieldId: field1Id,
            dataFieldName: 'field_b',
            sourceColumnKey: 'col_2',
            nullHandling: 'default' as const,
          },
        ],
      };

      expect(() => FieldMappingSchema.parse(duplicateIdMapping)).toThrowError(
        /same DataField ID/i
      );
    });

    it('rejects duplicate mappings targeting the same field name', () => {
      const duplicateNameMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'col_1',
            nullHandling: 'default' as const,
          },
          {
            dataFieldId: field2Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'col_2',
            nullHandling: 'default' as const,
          },
        ],
      };

      expect(() => FieldMappingSchema.parse(duplicateNameMapping)).toThrowError(
        /same DataField name/i
      );
    });
  });

  describe('validateFieldMapping', () => {
    it('returns valid: true for a properly matched mapping', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'col_prod',
            nullHandling: 'default',
          },
        ],
      };

      // Note: field2 is required but has defaultValue: 'LOT-DEFAULT', field3 is not required
      const result = validateFieldMapping(mapping, mockDataset, mockDataFields);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects unknown dataset column', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'non_existent_column',
            nullHandling: 'default',
          },
        ],
      };

      const result = validateFieldMapping(mapping, mockDataset, mockDataFields);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'UNKNOWN_COLUMN',
            columnKey: 'non_existent_column',
          }),
        ])
      );
    });

    it('detects unknown data field', () => {
      const unknownId = '99999999-9999-4999-8999-999999999999';
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: unknownId,
            dataFieldName: 'ghost_field',
            sourceColumnKey: 'col_prod',
            nullHandling: 'default',
          },
        ],
      };

      const result = validateFieldMapping(mapping, mockDataset, mockDataFields);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'UNKNOWN_FIELD',
            fieldId: unknownId,
          }),
        ])
      );
    });

    it('detects unmapped required field without defaultValue', () => {
      // Empty mapping - product_name is required and has no default
      const mapping: FieldMapping = { rules: [] };
      const result = validateFieldMapping(mapping, mockDataset, mockDataFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'REQUIRED_FIELD_UNMAPPED',
            fieldName: 'product_name',
          }),
        ])
      );
    });
  });

  describe('applyMappingToRow', () => {
    it('maps external column values to a ResolvedRecord', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field1Id,
            dataFieldName: 'product_name',
            sourceColumnKey: 'col_prod',
            nullHandling: 'default',
          },
          {
            dataFieldId: field2Id,
            dataFieldName: 'lot_number',
            sourceColumnKey: 'col_lote',
            nullHandling: 'default',
          },
          {
            dataFieldId: field3Id,
            dataFieldName: 'ean_code',
            sourceColumnKey: 'col_ean',
            nullHandling: 'default',
          },
        ],
      };

      const row = mockDataset.rows[0];
      const res = applyMappingToRow(row, mapping, mockDataFields);

      expect(res.success).toBe(true);
      expect(res.record).toEqual({
        product_name: 'Tornillo 5mm',
        lot_number: '45001',
        ean_code: '8412345678901',
      });
    });

    it('applies field defaultValue on null values when using default policy', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field2Id,
            dataFieldName: 'lot_number',
            sourceColumnKey: 'col_lote',
            nullHandling: 'default',
          },
        ],
      };

      const rowWithNull = mockDataset.rows[1]; // col_lote is null
      const res = applyMappingToRow(rowWithNull, mapping, mockDataFields);

      expect(res.success).toBe(true);
      expect(res.record.lot_number).toBe('LOT-DEFAULT');
    });

    it('applies rule fallbackValue over field defaultValue if specified', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field2Id,
            dataFieldName: 'lot_number',
            sourceColumnKey: 'col_lote',
            nullHandling: 'default',
            fallbackValue: 'FALLBACK-RULE',
          },
        ],
      };

      const rowWithNull = mockDataset.rows[1];
      const res = applyMappingToRow(rowWithNull, mapping, mockDataFields);

      expect(res.success).toBe(true);
      expect(res.record.lot_number).toBe('FALLBACK-RULE');
    });

    it('returns error when null encountered under "error" policy', () => {
      const mapping: FieldMapping = {
        rules: [
          {
            dataFieldId: field2Id,
            dataFieldName: 'lot_number',
            sourceColumnKey: 'col_lote',
            nullHandling: 'error',
          },
        ],
      };

      const rowWithNull = mockDataset.rows[1];
      const res = applyMappingToRow(rowWithNull, mapping, mockDataFields);

      expect(res.success).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('col_lote');
    });
  });
});
