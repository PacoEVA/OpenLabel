import { describe, it, expect } from 'vitest';
import {
  Dataset,
  FieldMapping,
  mapDatasetToRecords,
  resolveDocumentFromRow,
} from '../../src/core/data-sources';
import { LabelDocument } from '../../src/core/schemas/label.schema';
import { compileLabelToZpl } from '../../src/core/compilers/zpl/zpl-compiler';

describe('Phase 8 Integration: External Data Sources to ResolvedDocument and Compilers (Bloque 9)', () => {
  const field1Id = '11111111-1111-4111-8111-111111111111';
  const field2Id = '22222222-2222-4222-8222-222222222222';
  const field3Id = '33333333-3333-4333-8333-333333333333';

  // Sample Label Document using variable placeholders
  const sampleDocument: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Warehouse Item Label',
      author: 'Tester',
      created: '2026-09-12T12:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    dataModel: {
      fields: [
        { id: field1Id, name: 'product_name', type: 'input', required: true },
        { id: field2Id, name: 'sku_code', type: 'input', required: true },
        { id: field3Id, name: 'lot_number', type: 'input', required: true, defaultValue: 'LOT-DEF' },
      ],
    },
    elements: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        type: 'text',
        content: 'Product: {product_name}',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        fontSize: 12,
        fontFamily: 'monospace',
        bold: false,
        italic: false,
        align: 'left',
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        type: 'barcode',
        symbology: 'code128',
        data: '{sku_code}',
        x: 10,
        y: 25,
        width: 60,
        height: 15,
        rotation: 0,
        locked: false,
        narrowBarRatio: 3,
        displayValue: true,
      },
    ],
  };

  // Simulated Dataset produced by an adapter (e.g. CSV, Excel, SQL, or REST)
  const externalDataset: Dataset = {
    columns: [
      { key: 'col_desc', label: 'Descripción Producto', inferredType: 'string' },
      { key: 'col_art', label: 'Código Artículo', inferredType: 'string' },
      { key: 'col_lote', label: 'Lote Fabricación', inferredType: 'string' },
    ],
    rows: [
      { col_desc: 'Tornillo M6 Inox', col_art: 'SKU-M6-9901', col_lote: 'L-2026-A' },
      { col_desc: 'Tuerca M6 Autoblocante', col_art: 'SKU-M6-9902', col_lote: null },
    ],
    totalRows: 2,
    truncated: false,
  };

  // Field mapping connecting external column keys to internal DataField names
  const mapping: FieldMapping = {
    rules: [
      {
        dataFieldId: field1Id,
        dataFieldName: 'product_name',
        sourceColumnKey: 'col_desc',
        nullHandling: 'default',
      },
      {
        dataFieldId: field2Id,
        dataFieldName: 'sku_code',
        sourceColumnKey: 'col_art',
        nullHandling: 'default',
      },
      {
        dataFieldId: field3Id,
        dataFieldName: 'lot_number',
        sourceColumnKey: 'col_lote',
        nullHandling: 'default',
      },
    ],
  };

  it('maps external dataset rows to ResolvedRecords without engine pollution', () => {
    const mapResult = mapDatasetToRecords(externalDataset, mapping, sampleDocument.dataModel!.fields);
    expect(mapResult.success).toBe(true);
    expect(mapResult.records).toHaveLength(2);

    expect(mapResult.records[0]).toEqual({
      product_name: 'Tornillo M6 Inox',
      sku_code: 'SKU-M6-9901',
      lot_number: 'L-2026-A',
    });

    // Row 2 has null lot, so defaultValue LOT-DEF from field definition is used
    expect(mapResult.records[1]).toEqual({
      product_name: 'Tuerca M6 Autoblocante',
      sku_code: 'SKU-M6-9902',
      lot_number: 'LOT-DEF',
    });
  });

  it('resolves a LabelDocument from an external row and compiles to valid ZPL', () => {
    const row = externalDataset.rows[0];
    const resolveResult = resolveDocumentFromRow(sampleDocument, row, mapping);

    expect(resolveResult.success).toBe(true);
    if (!resolveResult.success) return;

    const resolvedDoc = resolveResult.document;

    // Verify text element is resolved
    const textElem = resolvedDoc.elements.find((e) => e.type === 'text') as any;
    expect(textElem.content).toBe('Product: Tornillo M6 Inox');

    // Verify barcode element is resolved
    const barcodeElem = resolvedDoc.elements.find((e) => e.type === 'barcode') as any;
    expect(barcodeElem.data).toBe('SKU-M6-9901');

    // Compile resolved document to ZPL
    const compileResult = compileLabelToZpl(resolvedDoc);
    expect(compileResult.success).toBe(true);
    const zpl = (compileResult as any).data;
    expect(zpl).toContain('^XA');
    expect(zpl).toContain('Product: Tornillo M6 Inox');
    expect(zpl).toContain('SKU-M6-9901');
    expect(zpl).toContain('^XZ');
  });

  it('handles multiple external records resolving independent documents', () => {
    const mapResult = mapDatasetToRecords(externalDataset, mapping, sampleDocument.dataModel!.fields);
    expect(mapResult.success).toBe(true);

    const zplOutputs = mapResult.records.map((record) => {
      const res = resolveDocumentFromRow(sampleDocument, externalDataset.rows[0], mapping);
      expect(res.success).toBe(true);
      const compiled = compileLabelToZpl((res as any).document);
      return (compiled as any).data;
    });

    expect(zplOutputs).toHaveLength(2);
    expect(zplOutputs[0]).toContain('Product: Tornillo M6 Inox');
  });
});
