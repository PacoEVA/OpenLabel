import { describe, it, expect } from 'vitest';
import { LabelDocument } from '../../../../src/core/schemas/label.schema';
import { renderLabelToPdf } from '../../../../src/main/export/pdf/pdf-renderer';

describe('PDF Vector Renderer (Phase 4 Blocks 6-8)', () => {
  const canonicalDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Canonical Multi-Element Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 75,
      unit: 'mm',
      dpi: 203,
    },
    elements: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'text',
        x: 5,
        y: 5,
        width: 60,
        height: 10,
        rotation: 0,
        locked: false,
        content: 'INDUSTRIAL SHIPPING LABEL',
        fontSize: 12,
        fontFamily: 'Helvetica',
        bold: true,
        italic: false,
        align: 'left',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        type: 'rectangle',
        x: 5,
        y: 18,
        width: 90,
        height: 52,
        rotation: 0,
        locked: false,
        strokeWidth: 0.5,
        stroke: '#000000',
        cornerRadius: 1,
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        type: 'line',
        x: 5,
        y: 35,
        width: 90,
        height: 1,
        rotation: 0,
        locked: false,
        strokeWidth: 0.5,
        stroke: '#000000',
        orientation: 'horizontal',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        type: 'barcode',
        x: 8,
        y: 40,
        width: 45,
        height: 25,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: 'SHIP-998811',
        narrowBarRatio: 2,
        displayValue: true,
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        type: 'qrcode',
        x: 65,
        y: 40,
        width: 25,
        height: 25,
        rotation: 0,
        locked: false,
        data: 'https://openlabels.org/manifest',
        errorCorrection: 'M',
      },
    ],
  };

  it('should render a canonical multi-element label into valid vector PDF bytes', async () => {
    const res = await renderLabelToPdf(canonicalDoc);
    expect(res.success).toBe(true);

    if (res.success) {
      expect(res.data).toBeInstanceOf(Uint8Array);
      expect(res.data.length).toBeGreaterThan(500);

      // Verify PDF Magic Header: %PDF-1.
      const header = Buffer.from(res.data.slice(0, 8)).toString('ascii');
      expect(header).toContain('%PDF-');

      // Verify PDF contains EOF trailer
      const trailer = Buffer.from(res.data.slice(-32)).toString('ascii');
      expect(trailer).toContain('%%EOF');
    }
  });

  it('should render EAN-13 and Data Matrix into vector PDF successfully', async () => {
    const docWithEanAndDm: LabelDocument = {
      ...canonicalDoc,
      elements: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 40,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '841234567890',
          narrowBarRatio: 2,
          displayValue: true,
        },
        {
          id: '77777777-7777-7777-7777-777777777777',
          type: 'barcode',
          x: 55,
          y: 10,
          width: 20,
          height: 20,
          rotation: 0,
          locked: false,
          symbology: 'datamatrix',
          data: 'DM-BATCH-102',
          narrowBarRatio: 2,
          displayValue: false,
        },
      ],
    };

    const res = await renderLabelToPdf(docWithEanAndDm);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.length).toBeGreaterThan(500);
      const str = Buffer.from(res.data).toString('ascii');
      expect(str).toContain('%PDF-');
    }
  });

  it('should reject documents with out-of-bounds elements and return typed error', async () => {
    const badDoc: LabelDocument = {
      ...canonicalDoc,
      elements: [
        {
          id: '88888888-8888-8888-8888-888888888888',
          type: 'rectangle',
          x: 80,
          y: 10,
          width: 30, // 80 + 30 = 110 > 100mm!
          height: 20,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        },
      ],
    };

    const res = await renderLabelToPdf(badDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0].code).toBe('ELEMENT_OUT_OF_BOUNDS');
    }
  });
});
