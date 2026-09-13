import { describe, it, expect } from 'vitest';
import { LabelDocument } from '../../../../src/core/schemas/label.schema';
import { compileLabelToZpl } from '../../../../src/core/compilers/zpl/zpl-compiler';

describe('ZPL II Compiler (Phase 4 Blocks 2-5)', () => {
  const baseDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'Canonical Label',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 100,
      height: 75,
      unit: 'mm',
      dpi: 203,
    },
    elements: [],
  };

  it('should generate valid base ZPL document structure', () => {
    const res = compileLabelToZpl(baseDoc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain('^XA');
      expect(res.data).toContain('^PW799'); // 100mm @ 203 DPI: 100 * 203 / 25.4 = 799 dots
      expect(res.data).toContain('^LL599'); // 75mm @ 203 DPI: 75 * 203 / 25.4 = 599 dots
      expect(res.data).toContain('^LH0,0');
      expect(res.data).toContain('^CI28');
      expect(res.data).toContain('^XZ');
    }
  });

  it('should be strictly deterministic (identical output across multiple runs)', () => {
    const docWithText: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'text',
          x: 10,
          y: 10,
          width: 50,
          height: 10,
          rotation: 0,
          locked: false,
          content: 'DETERMINISTIC TEXT',
          fontSize: 14,
          fontFamily: 'monospace',
          bold: false,
          italic: false,
          align: 'left',
        },
      ],
    };

    const run1 = compileLabelToZpl(docWithText);
    const run2 = compileLabelToZpl(docWithText);

    expect(run1.success).toBe(true);
    expect(run2.success).toBe(true);
    if (run1.success && run2.success) {
      expect(run1.data).toBe(run2.data);
    }
  });

  it('should compile text elements with rotation, alignment, and escaping', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          type: 'text',
          x: 5,
          y: 5,
          width: 40,
          height: 10,
          rotation: 90,
          locked: false,
          content: 'ITEM^PRICE',
          fontSize: 12,
          fontFamily: 'monospace',
          bold: false,
          italic: false,
          align: 'center',
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      // Rotation 90 -> ^A0R
      expect(res.data).toContain('^A0R');
      // Alignment center -> ^FB...C
      expect(res.data).toContain(',C');
      // Escaped caret in ITEM^PRICE -> ITEM_5ePRICE
      expect(res.data).toContain('ITEM_5ePRICE');
      expect(res.data).not.toContain('^PRICE');
    }
  });

  it('should compile rectangle and line primitives into native ^GB commands', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          type: 'rectangle',
          x: 10,
          y: 10,
          width: 30,
          height: 20,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 2,
        },
        {
          id: '44444444-4444-4444-4444-444444444444',
          type: 'line',
          x: 10,
          y: 35,
          width: 30,
          height: 1,
          rotation: 0,
          locked: false,
          strokeWidth: 0.5,
          stroke: '#000000',
          orientation: 'horizontal',
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toMatch(/\^GB\d+,\d+,\d+,B,\d+\^FS/);
    }
  });

  it('should compile Code 128 into native ^BC command', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 50,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'code128',
          data: 'SHIP-9988',
          narrowBarRatio: 3,
          displayValue: true,
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain('^BY3,3,'); // narrowBarRatio 3
      expect(res.data).toContain('^BCN,'); // orientation Normal
      expect(res.data).toContain('^FH^FDSHIP-9988^FS');
    }
  });

  it('should compile EAN-13 into native ^BE command with Phase 3 normalized check digit', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 37,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '841234567890', // 12 digits -> normalized to 8412345678905
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain('^BEN,');
      expect(res.data).toContain('^FH^FD8412345678905^FS'); // check digit 5 appended!
    }
  });

  it('should compile QR Code into native ^BQ command', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '77777777-7777-7777-7777-777777777777',
          type: 'qrcode',
          x: 10,
          y: 10,
          width: 25,
          height: 25,
          rotation: 0,
          locked: false,
          data: 'https://openlabels.org',
          errorCorrection: 'Q',
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain('^BQN,2,');
      expect(res.data).toContain('^FH^FDQA,https://openlabels.org^FS');
    }
  });

  it('should compile Data Matrix into native ^BX command', () => {
    const doc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '88888888-8888-8888-8888-888888888888',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 20,
          height: 20,
          rotation: 0,
          locked: false,
          symbology: 'datamatrix',
          data: 'DM-ECC200-BATCH',
          narrowBarRatio: 2,
          displayValue: false,
        },
      ],
    };

    const res = compileLabelToZpl(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain('^BXN,');
      expect(res.data).toContain('^FH^FDDM-ECC200-BATCH^FS');
    }
  });

  it('should scale dots proportionally across 203, 300, and 600 DPI', () => {
    const res203 = compileLabelToZpl(baseDoc, { dpi: 203 });
    const res300 = compileLabelToZpl(baseDoc, { dpi: 300 });
    const res600 = compileLabelToZpl(baseDoc, { dpi: 600 });

    expect(res203.success && res300.success && res600.success).toBe(true);
    if (res203.success && res300.success && res600.success) {
      expect(res203.data).toContain('^PW799'); // 100mm @ 203 DPI = 799
      expect(res300.data).toContain('^PW1181'); // 100mm @ 300 DPI = ~1181
      expect(res600.data).toContain('^PW2362'); // 100mm @ 600 DPI = ~2362
    }
  });

  it('should reject out of bounds elements before compiling', () => {
    const overflowDoc: LabelDocument = {
      ...baseDoc,
      elements: [
        {
          id: '99999999-9999-9999-9999-999999999999',
          type: 'rectangle',
          x: 90,
          y: 10,
          width: 30, // 90 + 30 = 120mm > 100mm!
          height: 20,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        },
      ],
    };

    const res = compileLabelToZpl(overflowDoc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0].code).toBe('ELEMENT_OUT_OF_BOUNDS');
    }
  });
});
