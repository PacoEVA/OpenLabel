import { describe, it, expect } from 'vitest';
import {
  Dataset,
  FieldMapping,
  validateFieldMapping,
} from '../../src/core/data-sources';
import { DataField } from '../../src/core/data';

describe('Data Sources UI & Mapping logic (Bloque 6)', () => {
  const mockFields: DataField[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'product_name',
      type: 'input',
      required: true,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'lot',
      type: 'input',
      required: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'ean',
      type: 'input',
      required: false,
    },
  ];

  const mockDataset: Dataset = {
    columns: [
      { key: 'col_prod', label: 'Producto', inferredType: 'string' },
      { key: 'col_lot', label: 'Lote', inferredType: 'string' },
      { key: 'col_ean', label: 'EAN', inferredType: 'string' },
    ],
    rows: [
      { col_prod: 'Caja 10x10', col_lot: 'L-998', col_ean: '840000000001' },
      { col_prod: 'Caja 20x20', col_lot: 'L-999', col_ean: '840000000002' },
    ],
    totalRows: 2,
    truncated: false,
  };

  it('detects unmapped required fields immediately', () => {
    // Only product_name is mapped, 'lot' is unmapped and required
    const mapping: FieldMapping = {
      rules: [
        {
          dataFieldId: '11111111-1111-4111-8111-111111111111',
          dataFieldName: 'product_name',
          sourceColumnKey: 'col_prod',
          nullHandling: 'default',
        },
      ],
    };

    const res = validateFieldMapping(mapping, mockDataset, mockFields);
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('REQUIRED_FIELD_UNMAPPED');
    expect(res.errors[0].fieldName).toBe('lot');
  });

  it('validates complete mapping successfully', () => {
    const mapping: FieldMapping = {
      rules: [
        {
          dataFieldId: '11111111-1111-4111-8111-111111111111',
          dataFieldName: 'product_name',
          sourceColumnKey: 'col_prod',
          nullHandling: 'default',
        },
        {
          dataFieldId: '22222222-2222-4222-8222-222222222222',
          dataFieldName: 'lot',
          sourceColumnKey: 'col_lot',
          nullHandling: 'default',
        },
        {
          dataFieldId: '33333333-3333-4333-8333-333333333333',
          dataFieldName: 'ean',
          sourceColumnKey: 'col_ean',
          nullHandling: 'default',
        },
      ],
    };

    const res = validateFieldMapping(mapping, mockDataset, mockFields);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});
