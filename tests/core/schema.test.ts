import { describe, it, expect } from 'vitest';
import {
  LabelDocumentSchema,
  LabelDocument,
  LabelElement,
} from '../../src/core/schemas/label.schema';

describe('Label Schema - Pure Zod Validation Boundaries', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const validIsoDate = '2026-09-12T19:00:00.000Z';

  const createValidDocument = (overrides?: Partial<LabelDocument>): LabelDocument => ({
    version: '1.0.0',
    meta: {
      title: 'Shipping Label',
      author: 'Test Author',
      created: validIsoDate,
    },
    dimensions: {
      width: 100,
      height: 50,
      unit: 'mm',
      dpi: 203,
    },
    elements: [
      {
        id: validUuid,
        type: 'barcode',
        x: 10,
        y: 10,
        width: 80,
        height: 30,
        rotation: 0,
        locked: false,
        symbology: 'code128',
        data: 'PKG-123456',
        narrowBarRatio: 2,
        displayValue: true,
      },
    ],
    ...overrides,
  });

  describe('Valid Documents', () => {
    it('should successfully validate a complete valid document with multiple elements', () => {
      const doc: LabelDocument = {
        version: '1.0.0',
        meta: {
          title: 'Industrial Label',
          author: 'Engineer',
          created: '2026-09-12T12:00:00.000Z',
        },
        dimensions: {
          width: 101.6,
          height: 152.4,
          unit: 'mm',
          dpi: 300,
        },
        elements: [
          {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            type: 'text',
            x: 5,
            y: 5,
            width: 90,
            height: 10,
            rotation: 0,
            locked: true,
            content: 'CONFIDENTIAL',
            fontSize: 14,
            fontFamily: 'monospace',
            bold: true,
            italic: false,
            align: 'center',
          },
          {
            id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            type: 'qrcode',
            x: 5,
            y: 20,
            width: 25,
            height: 25,
            rotation: 90,
            locked: false,
            data: 'https://openlabels.org',
            errorCorrection: 'H',
          },
          {
            id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 101.6,
            height: 152.4,
            rotation: 180,
            locked: false,
            strokeWidth: 2,
            stroke: '#000000',
            cornerRadius: 0,
          },
          {
            id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
            type: 'line',
            x: 5,
            y: 18,
            width: 90,
            height: 1,
            rotation: 270,
            locked: false,
            strokeWidth: 1,
            stroke: '#333333',
            orientation: 'horizontal',
          },
          {
            id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
            type: 'image',
            x: 35,
            y: 20,
            width: 40,
            height: 20,
            rotation: 0,
            locked: false,
            source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            format: 'png',
          },
        ],
      };

      const result = LabelDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.elements.length).toBe(5);
      }
    });

    it('should support inch dimensions', () => {
      const doc = createValidDocument({
        dimensions: {
          width: 4,
          height: 6,
          unit: 'inch',
          dpi: 600,
        },
      });
      const result = LabelDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });
  });

  describe('Dimension & Unit Rejections', () => {
    it('should reject non-supported DPI values', () => {
      const invalidDpiDoc = createValidDocument({
        dimensions: {
          width: 100,
          height: 50,
          unit: 'mm',
          dpi: 150 as any, // Not 203, 300, or 600
        },
      });
      const result = LabelDocumentSchema.safeParse(invalidDpiDoc);
      expect(result.success).toBe(false);
    });

    it('should reject unsupported units', () => {
      const invalidUnitDoc = createValidDocument({
        dimensions: {
          width: 100,
          height: 50,
          unit: 'cm' as any, // Not mm or inch
          dpi: 203,
        },
      });
      const result = LabelDocumentSchema.safeParse(invalidUnitDoc);
      expect(result.success).toBe(false);
    });

    it('should reject document dimensions <= 0', () => {
      const zeroWidthDoc = createValidDocument({
        dimensions: {
          width: 0,
          height: 50,
          unit: 'mm',
          dpi: 203,
        },
      });
      expect(LabelDocumentSchema.safeParse(zeroWidthDoc).success).toBe(false);

      const negativeHeightDoc = createValidDocument({
        dimensions: {
          width: 100,
          height: -10,
          unit: 'mm',
          dpi: 203,
        },
      });
      expect(LabelDocumentSchema.safeParse(negativeHeightDoc).success).toBe(false);
    });
  });

  describe('Element Coordinates & Geometry Rejections', () => {
    it('should reject negative element coordinates x < 0 or y < 0', () => {
      const negativeXDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: -5,
            y: 10,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 2,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(negativeXDoc).success).toBe(false);

      const negativeYDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 5,
            y: -1,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 2,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(negativeYDoc).success).toBe(false);
    });

    it('should reject element width or height <= 0', () => {
      const zeroWidthElem = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 0,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 1,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(zeroWidthElem).success).toBe(false);

      const negativeHeightElem = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: -5,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 1,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(negativeHeightElem).success).toBe(false);
    });

    it('should reject invalid UUIDs for element IDs', () => {
      const invalidIdDoc = createValidDocument({
        elements: [
          {
            id: 'not-a-valid-uuid-v4',
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 1,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(invalidIdDoc).success).toBe(false);
    });

    it('should reject non-orthogonal rotations (must strictly be 0, 90, 180, 270)', () => {
      const angles = [45, 120, 360, -90];
      for (const angle of angles) {
        const invalidRotationDoc = createValidDocument({
          elements: [
            {
              id: validUuid,
              type: 'barcode',
              x: 0,
              y: 0,
              width: 50,
              height: 20,
              rotation: angle as any,
              locked: false,
              symbology: 'code128',
              data: 'TEST',
              narrowBarRatio: 1,
              displayValue: true,
            },
          ],
        });
        expect(LabelDocumentSchema.safeParse(invalidRotationDoc).success).toBe(false);
      }
    });
  });

  describe('Barcode Specific Rejections', () => {
    it('should reject unsupported barcode symbologies', () => {
      const invalidSymbologyDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'pdf417' as any, // Not code128, ean13, datamatrix, qrcode
            data: 'TEST',
            narrowBarRatio: 1,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(invalidSymbologyDoc).success).toBe(false);
    });

    it('should reject empty barcode data', () => {
      const emptyDataDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: '',
            narrowBarRatio: 1,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(emptyDataDoc).success).toBe(false);
    });

    it('should reject narrowBarRatio < 1 or non-integer', () => {
      const ratioZeroDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 0,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(ratioZeroDoc).success).toBe(false);

      const ratioFloatDoc = createValidDocument({
        elements: [
          {
            id: validUuid,
            type: 'barcode',
            x: 0,
            y: 0,
            width: 50,
            height: 20,
            rotation: 0,
            locked: false,
            symbology: 'code128',
            data: 'TEST',
            narrowBarRatio: 1.5,
            displayValue: true,
          },
        ],
      });
      expect(LabelDocumentSchema.safeParse(ratioFloatDoc).success).toBe(false);
    });
  });

  describe('Version & Meta Rejections', () => {
    it('should reject non-semantic version strings', () => {
      const invalidVersions = ['v1.0', '1', 'beta-1', '1.0', '1.0.0.0'];
      for (const ver of invalidVersions) {
        const invalidVerDoc = createValidDocument({ version: ver });
        expect(LabelDocumentSchema.safeParse(invalidVerDoc).success).toBe(false);
      }
    });

    it('should accept valid semantic version strings', () => {
      const validVersions = ['1.0.0', '2.1.3', '0.0.1', '1.0.0-alpha.1'];
      for (const ver of validVersions) {
        const validVerDoc = createValidDocument({ version: ver });
        expect(LabelDocumentSchema.safeParse(validVerDoc).success).toBe(true);
      }
    });

    it('should reject invalid created datetime strings', () => {
      const invalidDates = ['2026-02-31', 'invalid-date', 'yesterday', '12/09/2026'];
      for (const dt of invalidDates) {
        const invalidDateDoc = createValidDocument({
          meta: {
            title: 'Test',
            author: 'Me',
            created: dt,
          },
        });
        expect(LabelDocumentSchema.safeParse(invalidDateDoc).success).toBe(false);
      }
    });
  });
});
