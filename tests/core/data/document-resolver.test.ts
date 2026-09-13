import { describe, it, expect } from 'vitest';
import { resolveDocument } from '../../../src/core/data/document-resolver';
import { LabelDocument } from '../../../src/core/schemas/label.schema';
import { ResolvedRecord } from '../../../src/core/data/template-resolver';

describe('resolveDocument', () => {
  const baseDocument: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Shipping Label',
      author: 'Test',
      created: '2026-03-01T00:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 300,
    },
    elements: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'Product: {product_name} | LOT: {lot}',
        fontSize: 12,
        fontFamily: 'monospace',
        bold: false,
        italic: false,
        align: 'left',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        type: 'barcode',
        x: 10,
        y: 25,
        width: 80,
        height: 15,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: '{serial}',
        narrowBarRatio: 2,
        displayValue: true,
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        type: 'qrcode',
        x: 70,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        locked: false,
        data: 'https://example.com/item/{serial}',
        errorCorrection: 'M',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        type: 'rectangle',
        x: 5,
        y: 5,
        width: 90,
        height: 40,
        rotation: 0,
        locked: true,
        strokeWidth: 1,
        stroke: '#000000',
        cornerRadius: 0,
      },
    ],
  };

  it('resolves text, barcode, and QR code placeholders correctly', () => {
    const record: ResolvedRecord = {
      product_name: 'Super Anvil',
      lot: 'LOT-456',
      serial: 'SN-0099',
    };

    const result = resolveDocument(baseDocument, record);
    expect(result.success).toBe(true);

    if (result.success) {
      const doc = result.document;
      expect(doc.elements[0]).toMatchObject({
        type: 'text',
        content: 'Product: Super Anvil | LOT: LOT-456',
      });
      expect(doc.elements[1]).toMatchObject({
        type: 'barcode',
        data: 'SN-0099',
      });
      expect(doc.elements[2]).toMatchObject({
        type: 'qrcode',
        data: 'https://example.com/item/SN-0099',
      });
      expect(doc.elements[3]).toMatchObject({
        type: 'rectangle',
      });
    }
  });

  it('does NOT mutate the original template document (strict immutability)', () => {
    const originalJson = JSON.stringify(baseDocument);
    const deepCloneDoc = JSON.parse(originalJson) as LabelDocument;

    const record: ResolvedRecord = {
      product_name: 'Super Anvil',
      lot: 'LOT-456',
      serial: 'SN-0099',
    };

    resolveDocument(baseDocument, record);

    expect(JSON.stringify(baseDocument)).toBe(originalJson);
    expect(baseDocument).toEqual(deepCloneDoc);
  });

  it('fails if placeholder field is missing in record', () => {
    const record: ResolvedRecord = {
      product_name: 'Super Anvil',
      // 'lot' and 'serial' are missing
    };

    const result = resolveDocument(baseDocument, record);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD')).toBe(true);
    }
  });

  it('revalidates EAN-13 barcode after placeholder resolution and rejects invalid data', () => {
    const eanDoc: LabelDocument = {
      ...baseDocument,
      elements: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 60,
          height: 20,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '{ean}',
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    // Invalid non-numeric / invalid length
    const badRecord: ResolvedRecord = { ean: 'ABC-NON-NUMERIC' };
    const badResult = resolveDocument(eanDoc, badRecord);
    expect(badResult.success).toBe(false);
    if (!badResult.success) {
      expect(badResult.errors[0].code).toBe('INVALID_BARCODE');
      expect(badResult.errors[0].message).toContain('EAN-13');
    }

    // Invalid checksum: 4006381333930 (correct is 4006381333931)
    const badChecksumRecord: ResolvedRecord = { ean: '4006381333930' };
    const badChecksumResult = resolveDocument(eanDoc, badChecksumRecord);
    expect(badChecksumResult.success).toBe(false);
    if (!badChecksumResult.success) {
      expect(badChecksumResult.errors[0].code).toBe('INVALID_BARCODE');
      expect(badChecksumResult.errors[0].message).toContain('check digit');
    }

    // Valid EAN-13
    const validRecord: ResolvedRecord = { ean: '4006381333931' };
    const validResult = resolveDocument(eanDoc, validRecord);
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.document.elements[0]).toMatchObject({
        type: 'barcode',
        data: '4006381333931',
      });
    }
  });
});
