import { describe, it, expect } from 'vitest';
import { LabelDocument } from '../../../src/core/schemas/label.schema';
import { buildPrintPlan } from '../../../src/core/compilers/print-plan/build-print-plan';
import { validatePrintPlan } from '../../../src/core/compilers/print-plan/validate-print-plan';

describe('PrintPlan Pipeline (Phase 4 Block 1)', () => {
  it('should successfully build and validate a PrintPlan from a valid empty document', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Empty Label',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: {
        width: 100,
        height: 50,
        unit: 'mm',
        dpi: 203,
      },
      elements: [],
    };

    const buildResult = buildPrintPlan(doc);
    expect(buildResult.success).toBe(true);
    if (buildResult.success) {
      expect(buildResult.data.page.widthMm).toBe(100);
      expect(buildResult.data.page.heightMm).toBe(50);
      expect(buildResult.data.page.dpi).toBe(203);
      expect(buildResult.data.elements.length).toBe(0);

      const validateResult = validatePrintPlan(buildResult.data);
      expect(validateResult.success).toBe(true);
    }
  });

  it('should convert inch dimensions and positions to physical millimeters', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Inch Label',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: {
        width: 4, // 4 inches = 101.6 mm
        height: 2, // 2 inches = 50.8 mm
        unit: 'inch',
        dpi: 300,
      },
      elements: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'rectangle',
          x: 0.5, // 12.7 mm
          y: 0.5, // 12.7 mm
          width: 2, // 50.8 mm
          height: 1, // 25.4 mm
          rotation: 0,
          locked: false,
          strokeWidth: 0.05,
          stroke: '#000000',
          cornerRadius: 0,
        },
      ],
    };

    const res = buildPrintPlan(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.page.widthMm).toBeCloseTo(101.6, 2);
      expect(res.data.page.heightMm).toBeCloseTo(50.8, 2);

      const rect = res.data.elements[0];
      expect(rect.xMm).toBeCloseTo(12.7, 2);
      expect(rect.yMm).toBeCloseTo(12.7, 2);
      expect(rect.widthMm).toBeCloseTo(50.8, 2);
      expect(rect.heightMm).toBeCloseTo(25.4, 2);
    }
  });

  it('should preserve strict visual layer ordering in the elements array', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Layers',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: { width: 100, height: 100, unit: 'mm', dpi: 203 },
      elements: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'rectangle',
          x: 5,
          y: 5,
          width: 50,
          height: 50,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          type: 'text',
          x: 10,
          y: 10,
          width: 40,
          height: 10,
          rotation: 0,
          locked: false,
          content: 'Overlay Text',
          fontSize: 12,
          fontFamily: 'monospace',
          bold: true,
          italic: false,
          align: 'left',
        },
      ],
    };

    const res = buildPrintPlan(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.elements[0].id).toBe('11111111-1111-1111-1111-111111111111');
      expect(res.data.elements[1].id).toBe('22222222-2222-2222-2222-222222222222');
    }
  });

  it('should normalize EAN-13 barcode data (calculating check digit if 12 digits)', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Barcode Label',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
      elements: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 50,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '841234567890', // 12 digits -> check digit 5
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    const res = buildPrintPlan(doc);
    expect(res.success).toBe(true);
    if (res.success) {
      const barcodeEl = res.data.elements[0];
      if (barcodeEl.type === 'barcode') {
        expect(barcodeEl.symbology).toBe('ean13');
        expect(barcodeEl.normalizedData).toBe('8412345678905');
        expect(barcodeEl.quietZone).toBeDefined();
      }
    }
  });

  it('should reject invalid barcode payload and return BARCODE_INVALID error', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Bad Barcode',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
      elements: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          type: 'barcode',
          x: 10,
          y: 10,
          width: 50,
          height: 25,
          rotation: 0,
          locked: false,
          symbology: 'ean13',
          data: '123ABC_NOT_VALID', // invalid EAN-13
          narrowBarRatio: 2,
          displayValue: true,
        },
      ],
    };

    const res = buildPrintPlan(doc);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors[0].code).toBe('BARCODE_INVALID');
      expect(res.errors[0].elementId).toBe('44444444-4444-4444-4444-444444444444');
    }
  });

  it('should fail validation if an element extends beyond page boundary (ELEMENT_OUT_OF_BOUNDS)', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Overflowing Element',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
      elements: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          type: 'rectangle',
          x: 80,
          y: 10,
          width: 30, // 80 + 30 = 110mm > 100mm!
          height: 20,
          rotation: 0,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        },
      ],
    };

    const buildRes = buildPrintPlan(doc);
    expect(buildRes.success).toBe(true);
    if (buildRes.success) {
      const validateRes = validatePrintPlan(buildRes.data);
      expect(validateRes.success).toBe(false);
      if (!validateRes.success) {
        expect(validateRes.errors[0].code).toBe('ELEMENT_OUT_OF_BOUNDS');
        expect(validateRes.errors[0].elementId).toBe('55555555-5555-5555-5555-555555555555');
      }
    }
  });

  it('should handle 90-degree rotated element bounds checking correctly', () => {
    const doc: LabelDocument = {
      version: '1.0.0',
      meta: {
        title: 'Rotated Element',
        author: 'Tester',
        created: '2026-09-12T10:00:00.000Z',
      },
      dimensions: { width: 100, height: 50, unit: 'mm', dpi: 203 },
      elements: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 40, // at 90 deg rotation, effective height is 40mm -> y + 40 = 20 + 40 = 60mm > 50mm!
          height: 10,
          rotation: 90,
          locked: false,
          strokeWidth: 1,
          stroke: '#000000',
          cornerRadius: 0,
        },
      ],
    };

    const buildRes = buildPrintPlan(doc);
    expect(buildRes.success).toBe(true);
    if (buildRes.success) {
      const validateRes = validatePrintPlan(buildRes.data);
      expect(validateRes.success).toBe(false);
      if (!validateRes.success) {
        expect(validateRes.errors[0].code).toBe('ELEMENT_OUT_OF_BOUNDS');
      }
    }
  });
});
